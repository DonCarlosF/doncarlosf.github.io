'use strict';
/*
 * The Social Skills button (`--student-led --subject social-skills`).
 *
 * Social Skills is TeachTown's separate Social Skills app (#/apps/ssms) — the
 * same app the group rotation drives — not an enCORE subject. SLZUSD's enCORE
 * lesson screen has only ELA, Math, Science, and Social Studies boxes (live,
 * 2026-10-08), so the old route (enCORE step 2, keep only a "Social Skills"
 * box) could only ever stop at SUBJECT CHECK FAILED.
 *
 * What the button does now: open the Social Skills app, "Login as.." the
 * learner, and stop at READY on their My Activities list. The human picks
 * the movie or activity on screen; nothing is launched. --dry-run does the
 * same walk, then logs the learner back out and ends.
 *
 * The browser steps are passed in (runner.js owns the Playwright code), so
 * the order and the log lines are testable without a browser. Every line and
 * error leaving here names the learner by pseudonym only — the display name
 * is scrubbed even out of error text the browser steps produce, and only an
 * error's first line is kept (Playwright's call log can quote other students).
 */

const SOCIAL_SKILLS_APP_SUBJECT = 'social-skills';

// True for the one Student-Led subject key that is a separate app, not an
// enCORE box. Social Studies is an enCORE subject and never matches.
function usesSocialSkillsApp(key) {
  return key === SOCIAL_SKILLS_APP_SUBJECT;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Every occurrence of the display name, in any case, becomes the pseudonym —
// also the spellings Playwright prints locators with: regex-escaped ("Jr\."),
// and quoted strings with \' \" \/ escapes ("O\'Neil").
function scrubName(text, name, who) {
  let s = String(text == null ? '' : text);
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return s;
  const forms = new Set([
    escapeRe(n),
    escapeRe(n).replace(/\//g, '\\/'),
    n.replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    n.replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
    n,
  ]);
  // Longest first, so a plain-name pass never splits an escaped spelling.
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(escapeRe(form), 'gi'), () => who);
  }
  return s;
}

// Only an error's first line leaves this flow. Playwright appends a call
// log, matched-element lists and element previews — page text that can be
// OTHER students' names, which no scrub list knows. The screenshot in
// logs/ shows the page.
function headline(message) {
  return String(message == null ? '' : message).split('\n')[0];
}

/**
 * steps (all async):
 *   openApp()      the teacher's View Students list is showing
 *   loginAs(name)  true once the learner's student view (My Activities) is
 *                  up; false when the name is not in View Students
 *   logOut()       leave the student view; true when it did
 *   hold()         never settles in a live run — Ctrl+C or closing the
 *                  browser ends the run
 * opts: { name: display name, who: pseudonym, dryRun, log(line) }
 */
async function socialSkillsAppSetup(steps, opts) {
  const { name, who, dryRun } = opts;
  const say = (m) => opts.log(scrubName(m, name, who));
  try {
    say(`SOCIAL SKILLS — opening the Social Skills app for "${who}"`);
    await steps.openApp();
    if (!(await steps.loginAs(name))) {
      const err = new Error(
        `Social Skills: the display name configured for "${who}" is not in the View Students list — ` +
          'check studentLed.learners in config.json against what View Students shows.'
      );
      err.code = 'LEARNER_NOT_FOUND';
      throw err;
    }
    say(`Logged in as "${who}" in Social Skills (My Activities)`);
    if (dryRun) {
      say(
        (await steps.logOut())
          ? `Logged "${who}" back out.`
          : `WARN could not find the student Log out for "${who}" — the browser closes at the end of this run anyway.`
      );
      say(`SOCIAL SKILLS DRY RUN COMPLETE — "${who}" reached My Activities; nothing was launched.`);
      return;
    }
    say(`READY — Social Skills for "${who}". Pick the movie or activity on screen.`);
    say('Idling — the session is in your hands (Ctrl+C here or close the browser when done)');
  } catch (err) {
    // Keep the error's class (the runner branches on it); only the text
    // changes. The runner logs every line of a fatal error, so it gets one.
    if (err && typeof err.message === 'string') {
      err.message = scrubName(headline(err.message), name, who);
      // The stack and cause carry Playwright's unscrubbed call log.
      err.stack = `${err.name}: ${err.message}`;
      if ('cause' in err) delete err.cause;
    }
    throw err;
  }
  await steps.hold();
}

module.exports = { SOCIAL_SKILLS_APP_SUBJECT, usesSocialSkillsApp, scrubName, headline, socialSkillsAppSetup };
