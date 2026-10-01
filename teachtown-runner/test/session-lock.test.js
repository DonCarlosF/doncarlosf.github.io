'use strict';
/*
 * lib/session-lock.js — one TeachTown session per browser profile — and the
 * runner's use of it: a second run on a held profile must stop BEFORE it
 * launches Chrome (Chrome would hand the launch to the running session's
 * browser as a blank window).
 *
 * Everything here uses temp directories. The two-runs harness copies
 * runner.js + lib/ + config/ into a temp project with a placeholder config
 * whose profileDir is a temp folder, so the real config.json, the real
 * .profiles/, and the real logs/ are never touched. No TeachTown traffic:
 * the blocked run exits before any browser exists.
 *
 * TT_BROWSER_TESTS=1 adds a real-Chrome check (opens a window).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const lock = require('../lib/session-lock');

const ROOT = path.join(__dirname, '..');

function tmpDir(prefix = 'ttlock-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// A live process that isn't us, for "someone else holds the lock".
function startSleeper() {
  return spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
}

// A pid that is certainly dead: a process that already exited.
function deadPid() {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  return Number(r.stdout);
}

function writeHolder(profileDir, holder) {
  fs.writeFileSync(lock.lockPathFor(profileDir), JSON.stringify(holder) + '\n');
}

const INFO = { subject: 'science', mode: 'student-led', learner: 'Luis', source: 'shortcut' };

test('acquire / release', () => {
  const profile = path.join(tmpDir(), 'slzusd');
  const r = lock.acquire(profile, INFO);
  assert.equal(r.ok, true);
  assert.equal(r.clearedStale, null);
  const held = JSON.parse(fs.readFileSync(lock.lockPathFor(profile), 'utf8'));
  assert.equal(held.pid, process.pid);
  assert.equal(held.subject, 'science');
  assert.equal(held.learner, 'Luis');
  assert.equal(held.source, 'shortcut');
  assert.ok(!Number.isNaN(Date.parse(held.startedAt)));
  assert.equal(lock.release(profile), true);
  assert.equal(fs.existsSync(lock.lockPathFor(profile)), false);
  assert.equal(lock.acquire(profile, INFO).ok, true, 'free again after release');
  lock.release(profile);
});

test('busy while the holder pid is alive', async (t) => {
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  writeHolder(profile, { ...INFO, pid: sleeper.pid, startedAt: new Date().toISOString() });
  const r = lock.acquire(profile, { ...INFO, subject: 'math' });
  assert.equal(r.ok, false);
  assert.equal(r.holder.pid, sleeper.pid);
  assert.equal(r.holder.subject, 'science');
  assert.equal(lock.inspect(profile).pid, sleeper.pid);
  // The loser never touches the winner's file.
  assert.equal(JSON.parse(fs.readFileSync(lock.lockPathFor(profile), 'utf8')).pid, sleeper.pid);
});

test('a dead pid is a stale lock: cleared, then acquired', () => {
  const profile = path.join(tmpDir(), 'slzusd');
  const pid = deadPid();
  writeHolder(profile, { ...INFO, pid, startedAt: new Date().toISOString() });
  assert.equal(lock.inspect(profile), null);
  const r = lock.acquire(profile, INFO);
  assert.equal(r.ok, true);
  assert.match(r.clearedStale, new RegExp(`PID ${pid}`));
  lock.release(profile);
});

test('an unreadable lock is stale once it is older than a write takes', () => {
  const profile = path.join(tmpDir(), 'slzusd');
  const file = lock.lockPathFor(profile);
  fs.writeFileSync(file, '{not json');
  // Brand new: could be a lock someone is writing right now — busy.
  assert.equal(lock.acquire(profile, INFO).ok, false);
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(file, old, old);
  const r = lock.acquire(profile, INFO);
  assert.equal(r.ok, true);
  assert.equal(r.clearedStale, 'unreadable');
  lock.release(profile);
});

test('a lock older than 12 hours is stale even if the pid is alive (pid reuse)', async (t) => {
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  writeHolder(profile, { ...INFO, pid: sleeper.pid, startedAt: new Date(Date.now() - 13 * 3600_000).toISOString() });
  const r = lock.acquire(profile, INFO);
  assert.equal(r.ok, true);
  assert.match(r.clearedStale, /older than 12 h/);
  lock.release(profile);
});

// Make chromeProfileHeld(profile) true the way Chrome does, for a few seconds.
// Windows: hold <profile>\lockfile open with no sharing (a Node fd shares by
// default, so a PowerShell child does it). Mac/Linux: SingletonLock -> a live pid.
async function holdProfileLikeChrome(t, profile) {
  fs.mkdirSync(profile, { recursive: true });
  if (process.platform !== 'win32') {
    const sleeper = startSleeper();
    t.after(() => sleeper.kill());
    fs.symlinkSync(`somehost-${sleeper.pid}`, path.join(profile, 'SingletonLock'));
    return;
  }
  const file = path.join(profile, 'lockfile');
  fs.writeFileSync(file, '');
  const ps = spawn(
    'powershell.exe',
    ['-NoProfile', '-Command', `$f=[IO.File]::Open('${file}','Open','ReadWrite','None'); 'held'; Start-Sleep 20`],
    { stdio: ['ignore', 'pipe', 'ignore'] }
  );
  t.after(() => ps.kill());
  await new Promise((resolve) => ps.stdout.once('data', resolve));
  assert.equal(lock.chromeProfileHeld(profile), true, 'test setup: profile should look Chrome-held');
}

test('a lock older than 12 h with a live pid stays BUSY while Chrome holds the profile', async (t) => {
  // An idle session left open overnight is alive. Clearing its lock sent the
  // next launch to "browser is still open" instead of the switch prompt.
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  await holdProfileLikeChrome(t, profile);
  writeHolder(profile, { ...INFO, pid: sleeper.pid, startedAt: new Date(Date.now() - 16 * 3600_000).toISOString() });
  assert.equal(lock.inspect(profile).pid, sleeper.pid, 'still reported as the holder');
  const r = lock.acquire(profile, { ...INFO, subject: 'math' });
  assert.equal(r.ok, false);
  assert.equal(r.holder.pid, sleeper.pid);
  assert.equal(JSON.parse(fs.readFileSync(lock.lockPathFor(profile), 'utf8')).pid, sleeper.pid, 'lock untouched');
});

test('release never deletes another pid\'s lock', async (t) => {
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  writeHolder(profile, { ...INFO, pid: sleeper.pid, startedAt: new Date().toISOString() });
  assert.equal(lock.release(profile), false);
  assert.equal(fs.existsSync(lock.lockPathFor(profile)), true);
});

test('a stop request is honored only by the pid it names', async (t) => {
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  lock.requestStop(profile, { pid: sleeper.pid });
  assert.equal(lock.stopRequestedFor(profile, process.pid), false);
  assert.equal(lock.stopRequestedFor(profile, sleeper.pid), true);
  lock.clearStopRequest(profile);
  assert.equal(lock.stopRequestedFor(profile, sleeper.pid), false);
});

test('acquiring clears a leftover stop request (it was never for us)', () => {
  const profile = path.join(tmpDir(), 'slzusd');
  lock.requestStop(profile, { pid: process.pid });
  assert.equal(lock.acquire(profile, INFO).ok, true);
  assert.equal(lock.stopRequestedFor(profile, process.pid), false);
  lock.release(profile);
});

test('waitForRelease: true once the holder lets go, false on timeout', async (t) => {
  const profile = path.join(tmpDir(), 'slzusd');
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  writeHolder(profile, { ...INFO, pid: sleeper.pid, startedAt: new Date().toISOString() });
  assert.equal(await lock.waitForRelease(profile, 300, 50), false);
  setTimeout(() => fs.unlinkSync(lock.lockPathFor(profile)), 200);
  assert.equal(await lock.waitForRelease(profile, 3000, 50), true);
});

test('chromeProfileHeld: no lock file, or a leftover one nobody holds, is free', () => {
  const profile = tmpDir();
  assert.equal(lock.chromeProfileHeld(profile), false);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(profile, 'lockfile'), '');
    assert.equal(lock.chromeProfileHeld(profile), false);
  }
});

test('chromeProfileHeld (Mac/Linux): SingletonLock names a live pid', { skip: process.platform === 'win32' && 'SingletonLock is the Mac/Linux mechanism' }, async (t) => {
  const profile = tmpDir();
  const sleeper = startSleeper();
  t.after(() => sleeper.kill());
  fs.symlinkSync(`somehost-${sleeper.pid}`, path.join(profile, 'SingletonLock'));
  assert.equal(lock.chromeProfileHeld(profile), true);
  fs.unlinkSync(path.join(profile, 'SingletonLock'));
  fs.symlinkSync(`somehost-${deadPid()}`, path.join(profile, 'SingletonLock'));
  assert.equal(lock.chromeProfileHeld(profile), false);
});

test('profileDirForConfig follows the runner\'s precedence', () => {
  const home = path.join(os.tmpdir(), 'home');
  const proj = path.join(os.tmpdir(), 'proj');
  assert.equal(lock.profileDirForConfig(proj, { district: 'slzusd' }, { browserProfileDir: '.profiles/slzusd' }, home), path.resolve(proj, '.profiles/slzusd'));
  assert.equal(lock.profileDirForConfig(proj, { district: 'x' }, null, home), path.resolve(proj, '.profiles', 'x'));
  assert.equal(path.normalize(lock.profileDirForConfig(proj, { profileDir: '~/p' }, { browserProfileDir: 'ignored' }, home)), path.join(home, 'p'));
  assert.equal(lock.profileDirForConfig(proj, {}, null, home), path.join(home, '.teachtown-runner', 'profile'));
});

/* ------------------------- two runs, one profile ------------------------- */

// A throwaway copy of the runner with a placeholder config: the real
// config.json / .profiles / logs are never read or written.
function makeTempProject() {
  const dir = tmpDir('ttproj-');
  fs.copyFileSync(path.join(ROOT, 'runner.js'), path.join(dir, 'runner.js'));
  fs.cpSync(path.join(ROOT, 'lib'), path.join(dir, 'lib'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'config', 'districts'), path.join(dir, 'config', 'districts'), { recursive: true });
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.template.json'), 'utf8'));
  const profileDir = path.join(dir, 'profile-under-test');
  cfg.profileDir = profileDir;
  cfg.studentLed.learners = { Luis: 'Placeholder Learner' };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
  return { dir, profileDir };
}

function runTempRunner(dir, args, extraEnv = {}) {
  const env = { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules'), ...extraEnv };
  if (!('TT_UI' in extraEnv)) delete env.TT_UI;
  delete env.TT_UI_OVERRIDES;
  const r = spawnSync(process.execPath, [path.join(dir, 'runner.js'), ...args], {
    cwd: dir,
    env,
    input: '', // not a TTY: no prompt, straight to BLOCKED
    encoding: 'utf8',
    timeout: 20_000,
  });
  const logs = fs.existsSync(path.join(dir, 'logs'))
    ? fs.readdirSync(path.join(dir, 'logs')).map((f) => fs.readFileSync(path.join(dir, 'logs', f), 'utf8')).join('')
    : '';
  return { code: r.status, out: String(r.stdout) + String(r.stderr), logs };
}

test('two runs on one profile: the second exits 3 with BLOCKED, the first is untouched', async (t) => {
  const { dir, profileDir } = makeTempProject();
  const first = startSleeper(); // stands in for the running Science session
  t.after(() => first.kill());
  const startedAt = new Date().toISOString();
  writeHolder(profileDir, { ...INFO, pid: first.pid, startedAt });

  for (const [label, env] of [['shortcut, no TTY', {}], ['UI child', { TT_UI: '1' }]]) {
    const r = runTempRunner(dir, ['--student-led', '--subject', 'math', '--dry-run'], env);
    assert.equal(r.code, 3, `${label}: exit 3\n${r.out}`);
    assert.match(r.logs, /BLOCKED Science is already running \(started /, `${label}: BLOCKED in the log`);
    assert.doesNotMatch(r.logs, /FATAL/, `${label}: not a crash`);
    // Never got as far as a browser: Chrome's own lock files were never made.
    assert.equal(fs.existsSync(path.join(profileDir, 'lockfile')), false);
    assert.equal(fs.existsSync(path.join(profileDir, 'SingletonLock')), false);
  }
  const held = JSON.parse(fs.readFileSync(lock.lockPathFor(profileDir), 'utf8'));
  assert.equal(held.pid, first.pid, 'first session still owns the lock');
  assert.equal(held.startedAt, startedAt);
  assert.equal(lock.isPidAlive(first.pid), true, 'first session still running');
  assert.equal(fs.existsSync(lock.stopPathFor(profileDir)), false, 'no stop request was sent');
});

test('with a real browser: a blocked second run adds no page to the first', { skip: !process.env.TT_BROWSER_TESTS && 'set TT_BROWSER_TESTS=1 (opens Chrome)' }, async (t) => {
  const { chromium } = require('playwright');
  const { dir, profileDir } = makeTempProject();
  assert.equal(lock.acquire(profileDir, INFO).ok, true); // this test process is the "first session"
  const context = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: false });
  t.after(async () => {
    await context.close().catch(() => {});
    lock.release(profileDir);
  });
  await new Promise((r) => setTimeout(r, 1000));
  const before = context.pages().length;
  const r = runTempRunner(dir, ['--student-led', '--subject', 'math', '--dry-run']);
  assert.equal(r.code, 3, r.out);
  await new Promise((r2) => setTimeout(r2, 3000)); // a handed-off launch shows up within a second or two
  assert.equal(context.pages().length, before, 'no blank window appeared in the running session');
});
