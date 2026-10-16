'use strict';
// The Social Skills button opens the Social Skills APP, never enCORE. The
// browser steps are fakes here, so this runs without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');

const { usesSocialSkillsApp, scrubName, headline, socialSkillsAppSetup } = require('../lib/social-skills-app');
const { SUBJECT_KEYS, DEFAULT_SETTINGS } = require('../lib/subjects');
const { classifyLine, parentStatus } = require('../lib/home-status');

// A made-up display name. The pseudonym is what every line must show.
const NAME = 'Testy Q. McExample';
const WHO = 'Luis';

function fakeSteps({ found = true, loggedOut = true, failAt = null, error = null } = {}) {
  const calls = [];
  const step = (label, value) => async (...args) => {
    calls.push(args.length ? [label, ...args] : [label]);
    if (failAt === label) throw error || new Error(`${label} failed`);
    return value;
  };
  return {
    calls,
    steps: {
      openApp: step('openApp'),
      loginAs: step('loginAs', found),
      logOut: step('logOut', loggedOut),
      hold: step('hold'),
    },
  };
}

async function run(opts, stepOpts) {
  const { calls, steps } = fakeSteps(stepOpts);
  const lines = [];
  let error = null;
  try {
    await socialSkillsAppSetup(steps, { name: NAME, who: WHO, log: (m) => lines.push(m), ...opts });
  } catch (err) {
    error = err;
  }
  return { calls, lines, error };
}

const ts = (lines) => lines.map((l) => `[2026-10-08 09:00:00] ${l}`);

test('only the social-skills key goes to the Social Skills app', () => {
  assert.equal(usesSocialSkillsApp('social-skills'), true);
  for (const key of [...SUBJECT_KEYS.filter((k) => k !== 'social-skills'), DEFAULT_SETTINGS, 'social', 'Social Skills', null, undefined]) {
    assert.equal(usesSocialSkillsApp(key), false, String(key));
  }
});

test('live run: open the app, log in by display name, READY, then hold', async () => {
  const { calls, lines, error } = await run({ dryRun: false });
  assert.equal(error, null);
  assert.deepEqual(calls, [['openApp'], ['loginAs', NAME], ['hold']]);
  assert.ok(lines.some((l) => l.startsWith('SOCIAL SKILLS — opening the Social Skills app')));
  assert.ok(lines.includes(`Logged in as "${WHO}" in Social Skills (My Activities)`));
  const ready = lines.find((l) => l.startsWith('READY — '));
  assert.equal(ready, `READY — Social Skills for "${WHO}". Pick the movie or activity on screen.`);
  assert.ok(lines.every((l) => !/enCORE/i.test(l)), 'never mentions enCORE');
  // Home screen reads it as Ready, like every other button.
  assert.equal(classifyLine(`[2026-10-08 09:00:00] ${ready}`).phase, 'ready');
});

test('dry run: logs the learner back out, never holds, never launches', async () => {
  const { calls, lines, error } = await run({ dryRun: true });
  assert.equal(error, null);
  assert.deepEqual(calls, [['openApp'], ['loginAs', NAME], ['logOut']]);
  assert.ok(lines.includes(`Logged "${WHO}" back out.`));
  assert.ok(lines.some((l) => l.startsWith('SOCIAL SKILLS DRY RUN COMPLETE')));
  assert.ok(!lines.some((l) => l.startsWith('READY')), 'a dry run never reports READY');
  const view = parentStatus({ running: false, exitCode: 0, lines: ts([...lines, 'SESSION COMPLETE']) });
  assert.equal(view.phase, 'finished');
});

test('dry run whose Log out is missing still finishes, with a WARN', async () => {
  const { lines, error } = await run({ dryRun: true }, { loggedOut: false });
  assert.equal(error, null);
  assert.ok(lines.some((l) => l.startsWith('WARN could not find the student Log out')));
  assert.ok(lines.some((l) => l.startsWith('SOCIAL SKILLS DRY RUN COMPLETE')));
});

test('learner not in View Students: a pseudonym-only error marked not-found (the runner does not retry it)', async () => {
  const { calls, error } = await run({ dryRun: false }, { found: false });
  assert.ok(error);
  assert.equal(error.code, 'LEARNER_NOT_FOUND');
  assert.match(error.message, /"Luis" is not in the View Students list/);
  assert.doesNotMatch(error.message, /Testy|McExample/i);
  assert.deepEqual(calls, [['openApp'], ['loginAs', NAME]], 'nothing after the failed lookup');
});

test('browser errors: first line only, display name scrubbed, same class', async () => {
  class SignInError extends Error {}
  // Shaped like Playwright's: our text, then a call log quoting locators and
  // other on-page text — here another student's name the scrubber never saw.
  const leaky = new SignInError(
    `row → caret → "Login as.." failed after 3 attempts for "${NAME}": locator.click: Timeout 5000ms exceeded.\n` +
      'Call log:\n' +
      `  - waiting for locator('.row').filter({ hasText: /^\\s*${NAME.replace('.', '\\.')}\\s*$/ })\n` +
      '  - <div class="row">Other Kid Fullname</div> intercepts pointer events'
  );
  const { calls, error } = await run({ dryRun: false }, { failAt: 'loginAs', error: leaky });
  assert.ok(error instanceof SignInError, 'the runner branches on error class — keep it');
  assert.equal(
    error.message,
    'row → caret → "Login as.." failed after 3 attempts for "Luis": locator.click: Timeout 5000ms exceeded.'
  );
  assert.doesNotMatch(error.message, /Testy|McExample|Other Kid|Call log/i);
  assert.deepEqual(calls, [['openApp'], ['loginAs', NAME]]);
});

test('a name with an apostrophe is scrubbed in Playwright\'s quoted spelling too', async () => {
  const name = "Dee O'Hara-Smith";
  const err = new Error(
    `locator.click: Timeout 5000ms exceeded. waiting for getByText('Dee O\\'Hara-Smith', { exact: true }) ` +
      `or filter({ hasText: "Dee O'Hara-Smith" }) or /^\\s*Dee O'Hara-Smith\\s*$/`
  );
  const { calls, steps } = fakeSteps({ failAt: 'openApp', error: err });
  let thrown = null;
  try {
    await socialSkillsAppSetup(steps, { name, who: WHO, dryRun: false, log: () => {} });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown);
  assert.doesNotMatch(thrown.message, /Dee|Hara/i, thrown.message);
  assert.equal((thrown.message.match(/Luis/g) || []).length, 3);
  assert.deepEqual(calls, [['openApp']]);
});

test('no log line ever carries the display name', async () => {
  for (const dryRun of [false, true]) {
    const { lines } = await run({ dryRun });
    for (const l of lines) assert.doesNotMatch(l, /Testy|McExample/i, l);
  }
});

test('scrubName: any case, escaped and quoted spellings, special characters, empty name', () => {
  assert.equal(scrubName(`hi ${NAME}!`, NAME, WHO), 'hi Luis!');
  assert.equal(scrubName(`HI ${NAME.toUpperCase()}`, NAME, WHO), 'HI Luis');
  assert.equal(scrubName('filter /^Testy Q\\. McExample$/', NAME, WHO), 'filter /^Luis$/');
  assert.equal(scrubName("'Ann O\\'Neil' \"Ann O\\\"Neil\"", 'Ann O\'Neil', WHO), "'Luis' \"Ann O\\\"Neil\"");
  assert.equal(scrubName('"Ann O\\"Neil"', 'Ann O"Neil', WHO), '"Luis"');
  assert.equal(scrubName('/^A\\/B$/', 'A/B', WHO), '/^Luis$/');
  assert.equal(scrubName('a (b) [c]? a (b) [c]?', 'a (b) [c]?', WHO), 'Luis Luis');
  assert.equal(scrubName('x Name x', 'Name', '$&$1'), 'x $&$1 x', 'the pseudonym is inserted literally');
  assert.equal(scrubName('unchanged', '', WHO), 'unchanged');
  assert.equal(scrubName('unchanged', '   ', WHO), 'unchanged');
  assert.equal(scrubName(undefined, NAME, WHO), '');
});

test('headline keeps only the first line', () => {
  assert.equal(headline('one\nCall log:\n  - two'), 'one');
  assert.equal(headline('only'), 'only');
  assert.equal(headline(undefined), '');
});
