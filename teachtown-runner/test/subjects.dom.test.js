'use strict';
// selectOnlySubject against a mock of the live step-2 screen, in a real
// (headless) browser. Skips itself — loudly — when no Playwright browser is
// installed, so `npm test` still runs the pure planner tests everywhere.
//
//   npx playwright install chromium   (once; the runner itself drives Chrome)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const { chromium } = require('playwright');
const { SUBJECT_KEYS, SUBJECTS, selectOnlySubject, readCheckboxes, describeSubjectState } = require('../lib/subjects');

const FIXTURE = pathToFileURL(path.join(__dirname, 'fixtures', 'student-led-step2.html')).href;

let browser = null;
let launchError = null;
test.before(async () => {
  try {
    browser = await chromium.launch();
  } catch (err) {
    launchError = err;
    console.error(`\n[subjects.dom.test] SKIPPED — no browser: ${err.message.split('\n')[0]}\n  run: npx playwright install chromium\n`);
  }
});
test.after(async () => {
  if (browser) await browser.close();
});

async function openStep2(query) {
  const page = await browser.newPage();
  await page.goto(FIXTURE + (query ? '?' + query : ''));
  return page;
}

// The mock's own idea of the truth, independent of how we read the DOM.
const mockState = (page) => page.evaluate(() => window.__mockState());

for (const mode of ['native', 'aria']) {
  for (const key of SUBJECT_KEYS) {
    test(`[${mode}] "${key}" leaves only ${SUBJECTS[key].label} checked and the lesson list untouched`, async (t) => {
      if (!browser) return t.skip(launchError.message);
      const page = await openStep2(`mode=${mode}`);
      try {
        const lines = [];
        const result = await selectOnlySubject(page, key, { log: (m) => lines.push(m), settleMs: 120 });
        assert.equal(result.ok, true, `not ok: ${describeSubjectState(result.boxes)} / ${lines.join(' | ')}`);
        assert.deepEqual(result.plan.toggles, []);
        assert.deepEqual(lines, [], 'no warnings on a clean screen');

        const truth = await mockState(page);
        for (const [name, checked] of Object.entries(truth)) {
          const shouldBe = name === SUBJECTS[key].label;
          assert.equal(checked, shouldBe, `${name} should be ${shouldBe ? 'checked' : 'unchecked'}`);
        }
        // The lesson checklist and its "Select all" were never touched: the
        // one visible lesson for the kept subject keeps its default state.
        const selectAll = await page.locator('#selectAll').isChecked();
        assert.equal(selectAll, true);
        const lessonBoxes = await page.locator('#lessonlist input[type=checkbox]').evaluateAll((els) => els.map((e) => e.checked));
        assert.equal(lessonBoxes.length, 1, 'only the kept subject\'s lesson remains listed');
        assert.equal(lessonBoxes[0], key !== 'science', 'lesson row state is the fixture default, not ours');
      } finally {
        await page.close();
      }
    });
  }
}

test('running twice is idempotent — the second pass clicks nothing', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('');
  try {
    const first = await selectOnlySubject(page, 'math', { settleMs: 120 });
    assert.equal(first.ok, true);
    assert.equal(first.attempts, 1);
    const before = await readCheckboxes(page);
    const second = await selectOnlySubject(page, 'math', { settleMs: 120 });
    assert.equal(second.ok, true);
    assert.equal(second.attempts, 0, 'nothing to toggle → no click attempt');
    assert.deepEqual(await readCheckboxes(page), before);
  } finally {
    await page.close();
  }
});

test('switching subjects re-checks the new one and unchecks the previous', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('');
  try {
    assert.equal((await selectOnlySubject(page, 'ela', { settleMs: 120 })).ok, true);
    assert.equal((await selectOnlySubject(page, 'science', { settleMs: 120 })).ok, true);
    assert.deepEqual(await mockState(page), {
      ELA: false, Math: false, Science: true, 'Social Studies': false, 'Social Skills': false,
    });
  } finally {
    await page.close();
  }
});

test('Social Studies checks Social Studies and unchecks Social Skills', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('');
  try {
    const result = await selectOnlySubject(page, 'social-studies', { settleMs: 120 });
    assert.equal(result.ok, true);
    assert.deepEqual(await mockState(page), {
      ELA: false, Math: false, Science: false, 'Social Studies': true, 'Social Skills': false,
    });
  } finally {
    await page.close();
  }
});

test('Social Skills does not check a Social Studies box', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('domains=encore');
  try {
    const lines = [];
    const result = await selectOnlySubject(page, 'social-skills', { log: (m) => lines.push(m), settleMs: 120 });
    assert.equal(result.ok, false);
    assert.equal(result.plan.target, null);
    assert.equal(result.attempts, 0);
    assert.match(lines.join('\n'), /no "Social Skills" checkbox/);
    assert.deepEqual(await mockState(page), {
      ELA: true, Math: true, Science: true, 'Social Studies': true,
    }, 'Social Studies was not clicked');
  } finally {
    await page.close();
  }
});

test('the enCORE Social Studies screen leaves only Social Studies checked', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('domains=encore');
  try {
    const result = await selectOnlySubject(page, 'social-studies', { settleMs: 120 });
    assert.equal(result.ok, true);
    assert.deepEqual(await mockState(page), {
      ELA: false, Math: false, Science: false, 'Social Studies': true,
    });
  } finally {
    await page.close();
  }
});

test('a Social Skills box is not accepted as Social Studies', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('domains=skills');
  try {
    const lines = [];
    const missed = await selectOnlySubject(page, 'social-studies', { log: (m) => lines.push(m), settleMs: 120 });
    assert.equal(missed.ok, false);
    assert.equal(missed.attempts, 0);
    assert.match(lines.join('\n'), /no "Social Studies" checkbox/);
    assert.deepEqual(await mockState(page), {
      ELA: true, Math: true, Science: true, 'Social Skills': true,
    }, 'untouched');
    const result = await selectOnlySubject(page, 'social-skills', { settleMs: 120 });
    assert.equal(result.ok, true);
    assert.deepEqual(await mockState(page), {
      ELA: false, Math: false, Science: false, 'Social Skills': true,
    });
  } finally {
    await page.close();
  }
});

test('a missing target box reports ok:false and clicks nothing', async (t) => {
  if (!browser) return t.skip(launchError.message);
  const page = await openStep2('missing=science');
  try {
    const lines = [];
    const result = await selectOnlySubject(page, 'science', { log: (m) => lines.push(m), settleMs: 120 });
    assert.equal(result.ok, false);
    assert.equal(result.plan.target, null);
    assert.equal(result.attempts, 0);
    assert.match(lines.join('\n'), /no "Science" checkbox found/);
    assert.deepEqual(await mockState(page), {
      ELA: true, Math: true, 'Social Studies': true, 'Social Skills': true,
    }, 'untouched');
  } finally {
    await page.close();
  }
});
