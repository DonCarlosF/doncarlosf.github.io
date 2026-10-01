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
 *
 * Step 2 → step 3 (advanceStudentLedToStep3): once the subject boxes are
 * verified, press Next so the only thing left for the human is the Start
 * Session button. Next is the SAME control a person presses there. This
 * module never presses Start Session — that creates a real, logged session.
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

// True if ANY element the locator matches is visible. `.first()` is not
// enough: it picks the first match in DOM order even when that one is hidden
// (a collapsed stepper, an earlier hidden copy of the same text).
async function anyVisible(locator, limit = 12) {
  try {
    const n = Math.min(await locator.count(), limit);
    for (let i = 0; i < n; i++) if (await locator.nth(i).isVisible()) return true;
  } catch {
    /* mid-navigation */
  }
  return false;
}

async function waitUntil(fn, timeoutMs, pollMs = 250) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= deadline) return false;
    await sleep(pollMs);
  }
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

/*
 * Press Next on step 2 and land on step 3 (Prepare Session), where only the
 * Start Session button remains. Returns:
 *   { pressed: false, reason }              Next not found / still disabled — nothing clicked
 *   { pressed: true, step3: 'confirmed' }   Next clicked; step-2 copy gone AND Prepare Session / a start control showing
 *   { pressed: true, step3: 'unconfirmed' } Next clicked; step 3 was not recognized (screen never recon'd) — look at the screen
 * The step-2 copy leaving is part of "confirmed": the stepper can show
 * "Prepare Session" on every step, so that text alone proves nothing.
 *
 * opts.nextTimeout / enabledTimeout / step3Timeout / log, as above.
 */
async function advanceStudentLedToStep3(root, opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const nextTimeout = Number.isFinite(opts.nextTimeout) ? opts.nextTimeout : 10_000;
  const enabledTimeout = Number.isFinite(opts.enabledTimeout) ? opts.enabledTimeout : 15_000;
  const step3Timeout = Number.isFinite(opts.step3Timeout) ? opts.step3Timeout : 15_000;

  const next = root.getByRole('button', { name: /^next$/i }).or(root.getByText(/^\s*Next\s*$/)).first();
  if (!(await visibleSoon(next, nextTimeout))) return { pressed: false, reason: 'no Next button found on step 2' };
  if (!(await waitForEnabled(next, enabledTimeout))) return { pressed: false, reason: 'Next is still disabled on step 2' };
  await next.click({ timeout: 10_000 });
  log('Next pressed (step 2 → 3)');

  const step3 = root
    .getByText(/prepare session/i)
    .or(root.getByRole('button', { name: /begin session|start session|launch session/i }));
  const step2 = root.getByText(step2TextRe());
  const seen3 = await waitUntil(() => anyVisible(step3), step3Timeout);
  const step2Gone = await waitUntil(async () => !(await anyVisible(step2)), 5_000);
  return { pressed: true, step3: seen3 && step2Gone ? 'confirmed' : 'unconfirmed' };
}

module.exports = {
  advanceStudentLedToStep3,
  STEP2_SOURCE,
  isStudentLedStep2Text,
  advanceStudentLedToStep2,
};
