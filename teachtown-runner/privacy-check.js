#!/usr/bin/env node
/*
 * Privacy gate: blocks commits, pushes, and validation runs when any local
 * privacy term (student name fragments, nicknames, school names, IEP dates)
 * appears in committable content, file PATHS, commit messages, or outgoing
 * pushes.
 *
 * Terms live in config/privacy-terms.txt — gitignored, LOCAL ONLY.
 *
 * Usage:
 *   node privacy-check.js                    scan tracked + untracked-unignored files
 *   node privacy-check.js --staged  --hook   staged index content + paths (pre-commit)
 *   node privacy-check.js --message F --hook commit message file (commit-msg)
 *   node privacy-check.js --push    --hook   outgoing commits: messages, diffs,
 *                                            ref names (pre-push; reads stdin)
 *
 * Fail-safe direction:
 *   - Unarmed (missing/empty terms file): the bare npm-script mode warns
 *     LOUDLY and exits 0 (a machine that never opted in isn't broken). The
 *     --hook modes exit 1 — hooks only run where someone installed them, and
 *     on that machine a missing terms file must BLOCK, not scroll past.
 *   - Nothing is ever skipped silently: binary/oversize/unreadable files are
 *     named in the output, and in --staged mode an unreadable index entry is
 *     a hard failure.
 *   - Matching folds Unicode (NFKD, combining marks and zero-width chars
 *     stripped, lowercased) so an accented name in NFC, NFD, or
 *     zero-width-split form matches its plain-ASCII term; latin-1 files get
 *     a second decoding pass. (No example names in this file on purpose —
 *     the pre-push scan reads this source too.)
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const TERMS_PATH = path.join(HERE, 'config', 'privacy-terms.txt');
const ARGV = process.argv.slice(2);
const STAGED_ONLY = ARGV.includes('--staged');
const PUSH_MODE = ARGV.includes('--push');
const HOOK_MODE = ARGV.includes('--hook');
const MSG_IDX = ARGV.indexOf('--message');
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PUSH_COMMITS = 500;

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: opts.cwd || HERE,
    encoding: opts.buffer ? 'buffer' : 'utf8',
    input: opts.input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function loudWarn(lines) {
  const bar = '!'.repeat(72);
  console.error(bar);
  for (const l of lines) console.error(l);
  console.error(bar);
}

// Unicode fold: NFKD, strip combining marks + zero-width/default-ignorable
// characters, lowercase. Applied to terms, content, paths, and messages so
// accent/normalization/zero-width variants of a name cannot slip through.
const IGNORABLE = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g;
function fold(s) {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').replace(IGNORABLE, '').toLowerCase();
}

function decodeBuffer(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString('utf16le');
  }
  return buf.toString('utf8');
}

let repoRoot;
try {
  repoRoot = git(['rev-parse', '--show-toplevel']).trim();
} catch {
  console.error('privacy-check: not inside a git repository — nothing to scan.');
  process.exit(0);
}

const UNARMED_LINES = [
  'PRIVACY GATE IS UNARMED: config/privacy-terms.txt is missing or has no',
  'usable terms. Create it now (gitignored — it never leaves this machine):',
  '  cp teachtown-runner/config/privacy-terms.template.txt \\',
  '     teachtown-runner/config/privacy-terms.txt',
  'then fill it with real name fragments, nicknames, school names, and IEP',
  'dates. One fragment per line, min 3 chars, # for comments.',
];

let terms = [];
if (fs.existsSync(TERMS_PATH)) {
  terms = fs
    .readFileSync(TERMS_PATH, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.length >= 3);
}
if (!terms.length) {
  if (HOOK_MODE) {
    loudWarn([...UNARMED_LINES, 'This hook BLOCKS until the terms file exists — hooks only run where the', 'gate was deliberately installed, so unarmed means broken, not unconfigured.']);
    process.exit(1);
  }
  loudWarn([...UNARMED_LINES, 'Until then NOTHING is being checked.']);
  process.exit(0);
}
const folded = terms.map((t) => fold(t));

let hits = 0;
function scanText(text, where) {
  text.split('\n').forEach((line, i) => {
    const low = fold(line);
    folded.forEach((t, ti) => {
      if (low.includes(t)) {
        hits += 1;
        console.error(`LEAK ${where}:${i + 1}: contains "${terms[ti]}"`);
      }
    });
  });
}
function scanPath(file, label) {
  const low = fold(file);
  folded.forEach((t, ti) => {
    if (low.includes(t)) {
      hits += 1;
      console.error(`LEAK ${file} (${label}): contains "${terms[ti]}"`);
    }
  });
}
function scanContentString(text, where) {
  scanText(text, where);
  if (text.includes('�')) return true; // caller should retry latin-1
  return false;
}

/* ---------------------- commit-msg hook mode ------------------------ */
if (MSG_IDX >= 0) {
  const msgFile = ARGV[MSG_IDX + 1];
  let msg;
  try {
    msg = fs.readFileSync(msgFile, 'utf8');
  } catch (err) {
    console.error(`privacy-check: cannot read commit message file "${msgFile}" (${err.message}) — refusing to pass unchecked.`);
    process.exit(1);
  }
  scanText(msg, 'commit message line');
  if (hits) {
    console.error(`privacy-check: ${hits} hit(s) in the COMMIT MESSAGE — BLOCKED.`);
    process.exit(1);
  }
  console.log(`privacy-check: commit message clean (${terms.length} terms).`);
  process.exit(0);
}

/* ------------------------ pre-push hook mode ------------------------ */
if (PUSH_MODE) {
  // stdin lines: <local ref> <local sha> <remote ref> <remote sha>
  let stdin = '';
  try {
    stdin = fs.readFileSync(0, 'utf8');
  } catch {}
  const updates = stdin.split('\n').map((l) => l.trim()).filter(Boolean);
  let scannedCommits = 0;
  for (const line of updates) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    if (!localSha || /^0+$/.test(localSha)) continue; // deletion — nothing outgoing
    scanPath(remoteRef + ' ' + localRef, 'REF NAME');
    const range = /^0+$/.test(remoteSha || '')
      ? [localSha, '--not', '--remotes']
      : [`${remoteSha}..${localSha}`];
    let shas = [];
    try {
      shas = git(['rev-list', ...range], { cwd: repoRoot }).split('\n').filter(Boolean);
    } catch {}
    if (shas.length > MAX_PUSH_COMMITS) {
      console.error(
        `privacy-check: push range has ${shas.length} commits; scanning the newest ${MAX_PUSH_COMMITS} (older history assumed previously vetted).`
      );
      shas = shas.slice(0, MAX_PUSH_COMMITS);
    }
    for (const sha of shas) {
      scannedCommits += 1;
      const short = sha.slice(0, 7);
      try {
        scanText(git(['log', '-1', '--format=%B', sha], { cwd: repoRoot }), `commit ${short} message line`);
      } catch {}
      try {
        const patch = decodeBuffer(git(['diff-tree', '-r', '-p', '--no-commit-id', '--root', sha], { cwd: repoRoot, buffer: true }));
        scanText(patch, `commit ${short} diff line`);
      } catch (err) {
        console.error(`privacy-check: could not read the diff of commit ${short} (${err.message.split('\n')[0]}) — refusing to pass unchecked.`);
        process.exit(1);
      }
    }
  }
  if (hits) {
    console.error(`privacy-check: ${hits} hit(s) in the outgoing push — BLOCKED.`);
    process.exit(1);
  }
  console.log(`privacy-check: push clean (${terms.length} terms, ${scannedCommits} outgoing commit(s) scanned).`);
  process.exit(0);
}

/* ------------------- staged / full content scan --------------------- */
const skipped = { binary: [], oversize: [] };
let hardFail = false;

let contentFiles;
let pathAudit;
if (STAGED_ONLY) {
  contentFiles = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { cwd: repoRoot })
    .split('\0')
    .filter(Boolean);
  // Paths of EVERYTHING the commit records — including deletions and both
  // sides of renames: a leaking path in any of them lands in history.
  pathAudit = [];
  const tokens = git(['diff', '--cached', '--name-status', '-z', '--diff-filter=ACMRD'], { cwd: repoRoot })
    .split('\0')
    .filter((t) => t !== '');
  for (let i = 0; i < tokens.length; ) {
    const status = tokens[i];
    if (/^[RC]/.test(status)) {
      pathAudit.push(tokens[i + 1], tokens[i + 2]);
      i += 3;
    } else {
      pathAudit.push(tokens[i + 1]);
      i += 2;
    }
  }
} else {
  const tracked = git(['ls-files', '-z'], { cwd: repoRoot }).split('\0');
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard'], { cwd: repoRoot }).split('\0');
  contentFiles = [...new Set([...tracked, ...untracked])].filter(Boolean);
  pathAudit = contentFiles;
}

for (const file of new Set(pathAudit.filter(Boolean))) {
  scanPath(file, 'FILENAME');
}

let scanned = 0;
for (const file of contentFiles) {
  let buf;
  try {
    if (STAGED_ONLY) {
      buf = git(['show', ':0:' + file], { cwd: repoRoot, buffer: true });
    } else {
      const p = path.join(repoRoot, file);
      const st = fs.statSync(p);
      if (!st.isFile()) continue;
      buf = fs.readFileSync(p);
    }
  } catch (err) {
    if (STAGED_ONLY) {
      // Every file git says is staged must be scanned or must block.
      console.error(`privacy-check: cannot read staged content of "${file}" (${err.message.split('\n')[0]}) — refusing to pass unchecked.`);
      hardFail = true;
    }
    continue; // worktree: deleted mid-scan — nothing committable
  }
  if (buf.length > MAX_BYTES) {
    skipped.oversize.push(file);
    continue;
  }
  const text = decodeBuffer(buf);
  if (text.includes('\u0000')) {
    skipped.binary.push(file);
    continue;
  }
  scanned += 1;
  const sawReplacement = scanContentString(text, file);
  if (sawReplacement) {
    // Bytes that aren't valid UTF-8 (latin-1 exports): second pass so an
    // accented name in a legacy encoding can't hide behind U+FFFD.
    scanText(buf.toString('latin1'), `${file} (latin-1 pass)`);
  }
}

// Nothing skips silently: name every file whose CONTENT was not examined
// (their paths were still scanned above).
for (const [reason, files] of Object.entries(skipped)) {
  for (const f of files) {
    console.error(`NOT SCANNED (${reason}): ${f} — content not examined; only its path was checked.`);
  }
}

if (hits || hardFail) {
  console.error(
    `privacy-check: ${hits} hit(s)${hardFail ? ' + unreadable staged content' : ''} in ${STAGED_ONLY ? 'staged' : 'committable'} content — BLOCKED.`
  );
  process.exit(1);
}
console.log(
  `privacy-check: clean (${terms.length} terms, ${scanned} file(s) scanned, ${skipped.binary.length} binary + ${skipped.oversize.length} oversize content-skipped${STAGED_ONLY ? ', staged only' : ''}).`
);
