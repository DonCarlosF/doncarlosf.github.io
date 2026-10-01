'use strict';
// Step 2 → 3 against a mock enCORE page: after the subject boxes are verified
// the runner presses Next so only Start Session is left — and never presses
// Start Session itself (that creates a real, logged session). Skips when no
// Playwright browser is installed, same as student-led-step1.dom.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const { chromium } = require('playwright');
const { advanceStudentLedToStep3 } = require('../lib/student-led');

const FIXTURE = pathToFileURL(path.join(__dirname, 'fixtures', 'student-led-step3.html')).href;

let browser = null;
let launchError = null;
test.before(async () => {
  try {
    // TT_TEST_CHROME=1: use the installed Chrome (headless, throwaway profile) when no Playwright chromium is installed.
    browser = await chromium.launch(process.env.TT_TEST_CHROME ? { channel: 'chrome' } : {});
  } catch (err) {
    launchError = err;
    console.error(
      `\n[student-led-step3.dom.test] SKIPPED — no browser: ${err.message.split('\n')[0]}\n  run: npx playwright install chromium\n`
    );
  }
});
test.after(async () => {
  if (browser) await browser.close();
});

async function open(query) {
  const page = await browser.newPage();
  await page.goto(FIXTURE + (query ? '?' + query : ''));
  return page;
}
const counts = (page) => page.evaluate(() => ({ step: window.__step, next: window.__nextClicks, start: window.__startClicks }));
const FAST = { nextTimeout: 1_000, enabledTimeout: 1_500, step3Timeout: 1_500 };

test('presses Next once, lands on step 3, and never presses Start Session', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('');
  try {
    const lines = [];
    const r = await advanceStudentLedToStep3(page, { ...FAST, log: (m) => lines.push(m) });
    assert.deepEqual(r, { pressed: true, step3: 'confirmed' });
    assert.deepEqual(await counts(page), { step: 3, next: 1, start: 0 });
    assert.match(lines.join('\n'), /Next pressed \(step 2 → 3\)/);
  } finally {
    await page.close();
  }
});

test('Next that enables a moment late is still pressed', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('next=slow');
  try {
    const r = await advanceStudentLedToStep3(page, FAST);
    assert.equal(r.pressed, true);
    assert.deepEqual(await counts(page), { step: 3, next: 1, start: 0 });
  } finally {
    await page.close();
  }
});

test('a slow step 3 is waited for', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('step3=slow');
  try {
    const r = await advanceStudentLedToStep3(page, FAST);
    assert.deepEqual(r, { pressed: true, step3: 'confirmed' });
  } finally {
    await page.close();
  }
});

test('Next disabled for good: nothing is clicked, and it says why', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('next=disabled');
  try {
    const r = await advanceStudentLedToStep3(page, { ...FAST, enabledTimeout: 600 });
    assert.equal(r.pressed, false);
    assert.match(r.reason, /disabled/);
    assert.deepEqual(await counts(page), { step: 2, next: 0, start: 0 });
  } finally {
    await page.close();
  }
});

test('no Next button: nothing is clicked', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('next=missing');
  try {
    const r = await advanceStudentLedToStep3(page, { ...FAST, nextTimeout: 400 });
    assert.equal(r.pressed, false);
    assert.match(r.reason, /no Next/);
    assert.deepEqual(await counts(page), { step: 2, next: 0, start: 0 });
  } finally {
    await page.close();
  }
});

test('Next pressed but step 3 never shows: reported unconfirmed, Start never pressed', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('step3=stuck');
  try {
    const r = await advanceStudentLedToStep3(page, { ...FAST, step3Timeout: 500 });
    assert.deepEqual(r, { pressed: true, step3: 'unconfirmed' });
    assert.deepEqual(await counts(page), { step: 2, next: 1, start: 0 });
  } finally {
    await page.close();
  }
});

test('a "Prepare Session" stepper on every step does not count as step 3 by itself', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await open('stepper=prepare&step3=stuck');
  try {
    const r = await advanceStudentLedToStep3(page, { ...FAST, step3Timeout: 500 });
    assert.equal(r.pressed, true);
    assert.equal(r.step3, 'unconfirmed', 'step-2 copy never left, so step 3 is not confirmed');
  } finally {
    await page.close();
  }
});
