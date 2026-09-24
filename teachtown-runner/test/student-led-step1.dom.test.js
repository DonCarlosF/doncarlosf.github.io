'use strict';
// Step 1 → 2 against a mock enCORE iframe: SLZUSD auto-advance (no Next)
// and the July recon's explicit Next. Skips when no Playwright browser is
// installed, same as test/subjects.dom.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const { chromium } = require('playwright');
const { advanceStudentLedToStep2 } = require('../lib/student-led');

const HOST = pathToFileURL(path.join(__dirname, 'fixtures', 'student-led-step1-host.html')).href;

let browser = null;
let launchError = null;
test.before(async () => {
  try {
    browser = await chromium.launch();
  } catch (err) {
    launchError = err;
    console.error(
      `\n[student-led-step1.dom.test] SKIPPED — no browser: ${err.message.split('\n')[0]}\n  run: npx playwright install chromium\n`
    );
  }
});
test.after(async () => {
  if (browser) await browser.close();
});

async function openWizard(query) {
  const page = await browser.newPage();
  await page.goto(HOST + (query ? '?' + query : ''));
  const frame = page.frameLocator('#encore');
  await frame.getByRole('button', { name: 'Luis' }).waitFor({ state: 'visible', timeout: 5_000 });
  return { page, frame };
}

async function wizardState(page) {
  const frame = page.frames().find((f) => f.url().includes('student-led-step1.html'));
  return frame.evaluate(() => ({ step: window.__step, nextClicks: window.__nextClicks }));
}

test('SLZUSD: the learner click opens step 2 and Next is never clicked', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const { page, frame } = await openWizard('advance=auto&delay=150');
  try {
    const lines = [];
    await frame.getByRole('button', { name: 'Luis' }).click();
    const result = await advanceStudentLedToStep2(frame, {
      autoAdvanceMs: 3_000,
      log: (m) => lines.push(m),
    });
    assert.equal(result.via, 'auto');
    assert.deepEqual(await wizardState(page), { step: 2, nextClicks: 0 });
    assert.match(lines.join('\n'), /Step 2 opened on the learner click \(no Next on step 1\)/);
    // The header is on screen the whole time and must not be what we matched.
    assert.equal(await frame.getByText('Select Session Mode').isVisible(), true);
    assert.equal(await frame.getByText(/select lessons for/i).isVisible(), true);
  } finally {
    await page.close();
  }
});

test('explicit Next: step 2 is absent after the learner click, so Next is clicked', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const { page, frame } = await openWizard('advance=next');
  try {
    const lines = [];
    await frame.getByRole('button', { name: 'Luis' }).click();
    const result = await advanceStudentLedToStep2(frame, {
      autoAdvanceMs: 400,
      enabledTimeout: 1_000,
      log: (m) => lines.push(m),
    });
    assert.equal(result.via, 'next');
    assert.deepEqual(await wizardState(page), { step: 2, nextClicks: 1 });
    assert.equal(lines.some((l) => /no Next on step 1/.test(l)), false);
  } finally {
    await page.close();
  }
});

test('auto-advance inside the probe window wins over a Next button that is also shown', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const { page, frame } = await openWizard('advance=both&delay=200');
  try {
    await frame.getByRole('button', { name: 'Luis' }).click();
    const result = await advanceStudentLedToStep2(frame, { autoAdvanceMs: 3_000 });
    assert.equal(result.via, 'auto');
    assert.deepEqual(await wizardState(page), { step: 2, nextClicks: 0 });
  } finally {
    await page.close();
  }
});

test('no step 2 and no Next fails without waiting on the stepper header', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const { page, frame } = await openWizard('advance=stuck');
  try {
    await frame.getByRole('button', { name: 'Luis' }).click();
    await assert.rejects(
      () =>
        advanceStudentLedToStep2(frame, {
          autoAdvanceMs: 300,
          nextTimeout: 400,
        }),
      /Timeout \d+ms exceeded/
    );
    assert.deepEqual(await wizardState(page), { step: 1, nextClicks: 0 });
    assert.equal(await frame.getByText('Select Session Mode').isVisible(), true);
  } finally {
    await page.close();
  }
});

test('Next that does not reveal the lesson step is an error', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const { page, frame } = await openWizard('advance=next-dead');
  try {
    await frame.getByRole('button', { name: 'Luis' }).click();
    await assert.rejects(
      () =>
        advanceStudentLedToStep2(frame, {
          autoAdvanceMs: 200,
          enabledTimeout: 500,
          step2Timeout: 400,
        }),
      /Timeout \d+ms exceeded/
    );
    assert.equal((await wizardState(page)).nextClicks, 1);
    assert.equal((await wizardState(page)).step, 1);
  } finally {
    await page.close();
  }
});
