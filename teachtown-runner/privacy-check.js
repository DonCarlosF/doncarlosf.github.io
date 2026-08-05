#!/usr/bin/env node
/*
 * Privacy gate: blocks commits and validation runs when any local privacy
 * term (student name fragments, nicknames, school names, IEP dates) appears
 * in committable content.
 *
 * Terms live in config/privacy-terms.txt — gitignored, LOCAL ONLY.
 *
 * Usage:
 *   node privacy-check.js            scan all tracked + untracked-committable files
 *   node privacy-check.js --staged   scan staged content only (pre-commit hook)
 *
 * Fail-safe direction: a missing/empty terms file WARNS LOUDLY and exits 0 —
 * it never silently passes as if it had checked something, and it never
 * hard-fails a machine that simply hasn't been set up yet.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const TERMS_PATH = path.join(HERE, 'config', 'privacy-terms.txt');
const STAGED_ONLY = process.argv.includes('--staged');
const MAX_BYTES = 2 * 1024 * 1024;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function loudWarn(lines) {
  const bar = '!'.repeat(72);
  console.error(bar);
  for (const l of lines) console.error(l);
  console.error(bar);
}

let repoRoot;
try {
  repoRoot = git(['rev-parse', '--show-toplevel'], HERE).trim();
} catch {
  console.error('privacy-check: not inside a git repository — nothing to scan.');
  process.exit(0);
}

if (!fs.existsSync(TERMS_PATH)) {
  loudWarn([
    'PRIVACY GATE IS UNARMED: config/privacy-terms.txt not found.',
    'Create it now (it is gitignored and never leaves this machine):',
    '  cp teachtown-runner/config/privacy-terms.template.txt \\',
    '     teachtown-runner/config/privacy-terms.txt',
    'then replace the placeholders with real name fragments, nicknames,',
    'school names, and IEP dates. Until then NOTHING is being checked.',
  ]);
  process.exit(0);
}

const terms = fs
  .readFileSync(TERMS_PATH, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#') && l.length >= 3);
if (!terms.length) {
  loudWarn([
    'PRIVACY GATE IS UNARMED: config/privacy-terms.txt has no usable terms.',
    'One fragment per line (min 3 chars); lines starting with # are comments.',
  ]);
  process.exit(0);
}
const lowered = terms.map((t) => t.toLowerCase());

// --message <file>: commit-msg hook mode — scan the commit MESSAGE itself.
// A name in a message leaks exactly like a name in a file (file-content
// scans and `git log -S` both miss messages; learned the hard way).
const msgIdx = process.argv.indexOf('--message');
if (msgIdx >= 0) {
  const msgFile = process.argv[msgIdx + 1];
  let msg = '';
  try {
    msg = fs.readFileSync(msgFile, 'utf8');
  } catch {
    process.exit(0); // no message file — nothing to scan
  }
  let msgHits = 0;
  msg.split('\n').forEach((line, i) => {
    const low = line.toLowerCase();
    lowered.forEach((t, ti) => {
      if (low.includes(t)) {
        msgHits += 1;
        console.error(`LEAK commit message line ${i + 1}: contains "${terms[ti]}"`);
      }
    });
  });
  if (msgHits) {
    console.error(`privacy-check: ${msgHits} hit(s) in the COMMIT MESSAGE — BLOCKED.`);
    process.exit(1);
  }
  console.log(`privacy-check: commit message clean (${terms.length} terms).`);
  process.exit(0);
}

let files;
if (STAGED_ONLY) {
  files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], repoRoot)
    .split('\n')
    .filter(Boolean);
} else {
  // Everything committable: tracked files plus untracked files that are NOT
  // gitignored (those are one `git add .` away from a commit).
  const tracked = git(['ls-files'], repoRoot).split('\n');
  const untracked = git(['ls-files', '--others', '--exclude-standard'], repoRoot).split('\n');
  files = [...new Set([...tracked, ...untracked])].filter(Boolean);
}

let hits = 0;
let scanned = 0;
for (const file of files) {
  let content;
  try {
    if (STAGED_ONLY) {
      content = git(['show', ':0:' + file], repoRoot); // index content = what would be committed
    } else {
      const p = path.join(repoRoot, file);
      const st = fs.statSync(p);
      if (!st.isFile() || st.size > MAX_BYTES) continue;
      content = fs.readFileSync(p, 'utf8');
    }
  } catch {
    continue; // deleted/unreadable — nothing to leak
  }
  if (content.includes('\u0000')) continue; // binary
  scanned += 1;
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    lowered.forEach((t, ti) => {
      if (low.includes(t)) {
        hits += 1;
        console.error(`LEAK ${file}:${i + 1}: contains "${terms[ti]}"`);
      }
    });
  });
}

if (hits) {
  console.error(
    `privacy-check: ${hits} hit(s) in ${STAGED_ONLY ? 'staged' : 'committable'} content — BLOCKED.`
  );
  process.exit(1);
}
console.log(
  `privacy-check: clean (${terms.length} terms, ${scanned} file(s) scanned${STAGED_ONLY ? ', staged only' : ''}).`
);
