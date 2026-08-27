#!/usr/bin/env node
/*
 * npm run init-config — create the LOCAL config.json from the committed
 * template and enter student names here, on this machine only.
 *
 * config.json is gitignored and the privacy hooks block any commit that
 * carries the configured privacy terms, so names entered here never leave
 * this computer. The template itself ships every real setting EXCEPT names.
 *
 * Overwrite an existing config.json with: npm run init-config -- --force
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DIR = __dirname;
const TEMPLATE = path.join(DIR, 'config.template.json');
const CONFIG = path.join(DIR, 'config.json');

const force = process.argv.includes('--force');

if (fs.existsSync(CONFIG) && !force) {
  console.error(
    'config.json already exists — edit it directly, or re-run with\n' +
      '  npm run init-config -- --force\n' +
      'to start over from the template (your current names would be lost).'
  );
  process.exit(1);
}

let template;
try {
  template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
} catch (err) {
  console.error(`could not read config.template.json: ${err.message}`);
  process.exit(1);
}

// A buffered ask(): rl.question DROPS lines that arrive while no question is
// pending, which loses everything after the first answer when input is
// pasted or piped in all at once. Queue every line instead; EOF resolves any
// remaining question with an empty answer.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pending = [];
let waiter = null;
let ended = false;
rl.on('line', (l) => {
  if (waiter) {
    const w = waiter;
    waiter = null;
    w(l);
  } else {
    pending.push(l);
  }
});
rl.on('close', () => {
  ended = true;
  if (waiter) {
    const w = waiter;
    waiter = null;
    w('');
  }
});
const ask = (q) => {
  process.stdout.write(q);
  if (pending.length) return Promise.resolve(pending.shift().trim());
  if (ended) return Promise.resolve('');
  return new Promise((res) => (waiter = (l) => res(l.trim())));
};

(async () => {
  console.log('');
  console.log('TeachTown runner — local config setup');
  console.log('Creates config.json (gitignored: real names never leave this machine).');
  console.log('');
  console.log('Enter each student\'s display name EXACTLY as TeachTown\'s View Students');
  console.log('shows it (unsure? run `npm start -- --recon-roster` first and copy from');
  console.log('the report). The order you enter is the rotation order.');
  console.log('Press Enter on an empty line when done.');
  console.log('');

  const students = [];
  for (;;) {
    const name = await ask(`Student ${students.length + 1} (empty line = done): `);
    if (!name) break;
    students.push(name);
  }
  if (!students.length) {
    console.error('\nNo names entered — config.json not written. Run npm run init-config again.');
    rl.close();
    process.exit(1);
  }

  const alsoRoster = (await ask('Use the same names for the recon roster? [Y/n]: ')).toLowerCase();
  rl.close();

  template.students = students;
  template.roster =
    alsoRoster === 'n' || alsoRoster === 'no'
      ? []
      : students.map((name) => ({ name, aka: [], expected: true }));

  fs.writeFileSync(CONFIG, JSON.stringify(template, null, 2) + '\n');
  console.log('');
  console.log(`Wrote ${CONFIG}`);
  console.log(`  students (rotation order): ${students.length}`);
  console.log(`  roster entries: ${template.roster.length}`);
  console.log('');
  console.log('This file stays on this machine (gitignored). Next:');
  console.log('  npm start -- --dry-run     rehearse without launching anything');
})();
