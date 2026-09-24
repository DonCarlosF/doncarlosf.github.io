'use strict';
/*
 * Student-Led wizard, step 1 → step 2.
 *
 * July 2026 recon: select one learner, click Next, land on a screen whose
 * title is "Select Session Mode".
 *
 * SLZUSD live (2026-09, HIL-005-TC-02): clicking the learner opens step 2
 * ("Select lessons for …'s Student-Led Session") by itself. Step 1 has no
 * Next, so a 60s wait for that button is a false fatal. The stepper header
 * still reads "Select Session Mode" on every step, so that string cannot
 * tell step 1 from step 2.
 *
 * Step 2 is the lesson picker. Any one of these phrases is enough:
 *   "select lessons for" | "domain selections below" | "recommended lessons"
 * After the learner click, wait briefly for that copy. Only if it never
 * shows, wait for Next and click it, then wait for the same copy.
 */

const STEP2_SOURCE = 'select lessons for|domain selections below|recommended lessons';

function step2TextRe() {
  return new RegExp(STEP2_SOURCE, 'i');
}

function isStudentLedStep2Text(text) {
  return step2TextRe().test(text == null ? '' : String(text));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function visibleSoon(locator, timeout) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

// Buttons can be disabled via the attribute or a "disabled" class.
async function waitForEnabled(locator, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await locator.isEnabled()) {
        const cls = (await locator.getAttribute('class')) || '';
        if (!/\bdisabled\b/i.test(cls)) return true;
      }
    } catch {
      /* mid-navigation */
    }
    await sleep(400);
  }
  return false;
}

/*
 * Call after the learner row has been clicked.
 * Returns { via: 'auto' | 'next' }.
 *
 * opts.autoAdvanceMs  how long to wait for step 2 before looking for Next (default 8000)
 * opts.nextTimeout    wait for the Next control on the explicit-Next path
 * opts.step2Timeout   wait for step 2 after Next is clicked
 * opts.enabledTimeout how long Next may stay disabled before we click anyway
 * opts.log            line logger (the runner's logger.event)
 */
async function advanceStudentLedToStep2(root, opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const autoAdvanceMs = Number.isFinite(opts.autoAdvanceMs) ? opts.autoAdvanceMs : 8_000;
  const nextTimeout = Number.isFinite(opts.nextTimeout) ? opts.nextTimeout : 60_000;
  const step2Timeout = Number.isFinite(opts.step2Timeout) ? opts.step2Timeout : 60_000;
  const enabledTimeout = Number.isFinite(opts.enabledTimeout) ? opts.enabledTimeout : 10_000;

  // Step 2 first. A forward control already on step 2 must not be clicked
  // as if it were step 1's Next. Same order as the 2026-09-23 SLZUSD patch.
  const step2 = root.getByText(step2TextRe()).first();
  if (await visibleSoon(step2, autoAdvanceMs)) {
    log('Step 2 opened on the learner click (no Next on step 1)');
    return { via: 'auto' };
  }

  const next = root.getByRole('button', { name: /^next$/i }).or(root.getByText(/^\s*Next\s*$/)).first();
  await next.waitFor({ state: 'visible', timeout: nextTimeout });
  if (!(await waitForEnabled(next, enabledTimeout))) {
    log('WARN Next still looks disabled after selecting the learner — trying anyway');
  }
  await next.click({ timeout: 10_000 });
  await step2.waitFor({ state: 'visible', timeout: step2Timeout });
  return { via: 'next' };
}

module.exports = {
  STEP2_SOURCE,
  isStudentLedStep2Text,
  advanceStudentLedToStep2,
};
