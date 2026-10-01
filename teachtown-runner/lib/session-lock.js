'use strict';
/*
 * One TeachTown session per browser profile.
 *
 * Chrome hands a second launch on an in-use profile to the instance that
 * owns it — which opens a blank window INSIDE the live session, and the
 * runner's "next new page is the player/tab" logic can then latch onto it.
 * A friendlier error after the fact is too late; the second runner must find
 * out BEFORE it launches Chrome. So every runner takes a lock file next to
 * the profile first:
 *
 *   <profileDir>.lock        JSON { pid, subject, mode, learner, source, startedAt }
 *   <profileDir>.lock.stop   one line: the pid that has been asked to shut down
 *
 * (Next to the profile, not inside it: Chrome owns everything in the profile
 * directory and the lock must survive a profile wipe. .profiles/ is
 * gitignored, so the lock never gets committed.)
 *
 * Node built-ins only. No names: `learner` is a pseudonym.
 */
const fs = require('fs');
const path = require('path');

// A lock this old is probably debris (a reused pid) — UNLESS Chrome still has
// the profile open: a session left idling overnight is alive, and clearing its
// lock sends every other launch to a "browser is still open" crash instead of
// the switch prompt (seen 10/1: a Science session idle for 16 h).
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const PARTIAL_WRITE_GRACE_MS = 2_000; // a just-created file may not have its JSON yet — not stale

function lockPathFor(profileDir) {
  return `${profileDir}.lock`;
}
function stopPathFor(profileDir) {
  return `${lockPathFor(profileDir)}.stop`;
}

// EPERM means the process exists but belongs to someone else — alive.
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readLockFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const holder = JSON.parse(raw);
    if (holder && typeof holder === 'object' && Number.isInteger(holder.pid)) return { holder };
  } catch {
    /* fallthrough: missing, empty, or unparseable */
  }
  let ageMs = Infinity;
  try {
    ageMs = Date.now() - fs.statSync(file).mtimeMs;
  } catch {
    return { missing: true };
  }
  return { unreadable: true, ageMs };
}

// Is this lock debris? (dead holder, unreadable for longer than a write
// takes, or implausibly old with no browser behind it.) Returns the reason
// string, or null if live. `chromeHeld` is evaluated lazily — it touches disk.
function staleReason(read, chromeHeld = () => false) {
  if (read.missing) return 'missing';
  if (read.unreadable) return read.ageMs > PARTIAL_WRITE_GRACE_MS ? 'unreadable' : null;
  const { holder } = read;
  if (!isPidAlive(holder.pid)) return `PID ${holder.pid} is not running`;
  const started = Date.parse(holder.startedAt);
  if (Number.isFinite(started) && Date.now() - started > STALE_AFTER_MS && !chromeHeld()) {
    return `older than 12 h (PID ${holder.pid})`;
  }
  return null;
}

/**
 * Read-only: who holds the profile right now? null when it's free (or the
 * lock is stale). Never mutates — the UI server uses this to decide whether
 * to offer a switch.
 */
function inspect(profileDir) {
  const read = readLockFile(lockPathFor(profileDir));
  if (read.missing) return null;
  if (staleReason(read, () => chromeProfileHeld(profileDir))) return null;
  return read.holder || { pid: 0, unknown: true }; // a fresh, still-being-written lock is busy
}

/**
 * Take the lock. { ok: true, clearedStale } or { ok: false, holder }.
 * `clearedStale` is the reason a dead lock was removed (for a WARN line).
 */
function acquire(profileDir, info) {
  const file = lockPathFor(profileDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let clearedStale = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = fs.openSync(file, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const read = readLockFile(file);
      if (read.missing) continue; // released between our open and read — retry
      const why = staleReason(read, () => chromeProfileHeld(profileDir));
      if (!why) return { ok: false, holder: read.holder || { pid: 0, unknown: true } };
      clearedStale = why;
      try {
        fs.unlinkSync(file);
      } catch {}
      continue;
    }
    try {
      const holder = { ...info, pid: process.pid, startedAt: new Date().toISOString() };
      fs.writeSync(fd, JSON.stringify(holder) + '\n');
    } finally {
      fs.closeSync(fd);
    }
    // A stop request left over from an earlier run names a pid that may be
    // reused — it was never meant for us.
    try {
      fs.unlinkSync(stopPathFor(profileDir));
    } catch {}
    return { ok: true, clearedStale };
  }
  const read = readLockFile(file);
  return { ok: false, holder: read.holder || { pid: 0, unknown: true } };
}

// Remove the lock only if it is ours — never another session's.
function release(profileDir, pid = process.pid) {
  const read = readLockFile(lockPathFor(profileDir));
  if (!read.holder || read.holder.pid !== pid) return false;
  try {
    fs.unlinkSync(lockPathFor(profileDir));
  } catch {
    return false;
  }
  return true;
}

/* ---- "end the running session" handshake ---- */

function requestStop(profileDir, holder) {
  fs.writeFileSync(stopPathFor(profileDir), `${holder.pid}\n`);
}

// True only if a stop request exists AND names this pid.
function stopRequestedFor(profileDir, pid = process.pid) {
  try {
    return Number.parseInt(fs.readFileSync(stopPathFor(profileDir), 'utf8').trim(), 10) === pid;
  } catch {
    return false;
  }
}

function clearStopRequest(profileDir) {
  try {
    fs.unlinkSync(stopPathFor(profileDir));
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll until nobody (live) holds the lock. True when free, false on timeout.
async function waitForRelease(profileDir, timeoutMs, pollMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!inspect(profileDir)) return true;
    await sleep(pollMs);
  }
  return !inspect(profileDir);
}

/* ---- Chrome's own profile lock ---- */

// Chrome can outlive the runner that owned it by a moment (a switch closes
// the old browser and the new session starts immediately). Launching into a
// closing profile is the same blank-window / "profile in use" trap.
//   Windows: <profile>\lockfile is held open by Chrome with no sharing; it
//            disappears when Chrome exits. Opening it 'r+' fails with
//            EBUSY/EPERM/EACCES while held.
//   Mac/Linux: SingletonLock is a symlink "<host>-<pid>"; held if pid alive.
function chromeProfileHeld(profileDir, platform = process.platform) {
  if (platform === 'win32') {
    const file = path.join(profileDir, 'lockfile');
    let fd;
    try {
      fd = fs.openSync(file, 'r+');
    } catch (err) {
      return err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES';
    }
    fs.closeSync(fd); // openable → nobody holds it (a leftover file)
    return false;
  }
  try {
    const target = fs.readlinkSync(path.join(profileDir, 'SingletonLock'));
    const pid = Number.parseInt(String(target).split('-').pop(), 10);
    return isPidAlive(pid);
  } catch {
    return false;
  }
}

async function waitForChromeRelease(profileDir, timeoutMs, pollMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (chromeProfileHeld(profileDir)) {
    if (Date.now() >= deadline) return false;
    await sleep(pollMs);
  }
  return true;
}

// Where the runner's profile lives, from config.json + the district file —
// the same precedence runner.js's loadConfig uses, so the UI server can look
// at the same lock before it spawns anything.
function profileDirForConfig(projectDir, cfg, districtProfile, homedir) {
  const rel =
    (cfg && cfg.profileDir) ||
    (districtProfile && districtProfile.browserProfileDir) ||
    (cfg && cfg.district
      ? path.join('.profiles', cfg.district)
      : path.join(homedir, '.teachtown-runner', 'profile'));
  const expanded = rel.replace(/^~(?=$|[\\/])/, homedir);
  return path.isAbsolute(expanded) ? expanded : path.resolve(projectDir, expanded);
}

module.exports = {
  lockPathFor,
  stopPathFor,
  isPidAlive,
  inspect,
  acquire,
  release,
  requestStop,
  stopRequestedFor,
  clearStopRequest,
  waitForRelease,
  chromeProfileHeld,
  waitForChromeRelease,
  profileDirForConfig,
  STALE_AFTER_MS,
};
