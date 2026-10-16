#!/usr/bin/env node
/*
 * TeachTown Social Skills — group session runner
 *
 * Automates the *between*: Clever SSO → TeachTown → Social Skills →
 * "Login as.." each student → launch their activity on the big screen →
 * wait while the group answers live → log out → rotate to the next student.
 * Humans answer every question; this script never interacts with the
 * activity itself and never types into credential fields.
 *
 * Setup:
 *   1) npm install            (Google Chrome must be installed — this drives channel "chrome")
 *   2) npm run init-config       copies the template to config.json (gitignored)
 *                                and asks for student names locally — names
 *                                never go in committed files
 *   3) npm run ui                    button interface (local page, loopback
 *                                    only) — every button maps to the flags
 *                                    below; the CLI always works without it
 *      npm start                     full session (one launch per student, or
 *                                    the config "playlist" — an ordered mix of
 *                                    movies/activities per student; see
 *                                    config.template.json's _playlistNote)
 *      npm start -- --dry-run       login + parse roster/eligibility only, launch nothing
 *      npm start -- --teacher-led   skip Social Skills, set up an enCORE Teacher-Led
 *                                   session (stops at Begin Session unless
 *                                   teacherLed.autoBegin is true — autoBegin
 *                                   starts a REAL logged session)
 *      npm start -- --login         warm up the browser profile: run the sign-in
 *                                   chain AND the separate enCORE sign-in
 *                                   (manual sign-in in the browser if needed —
 *                                   never typed by the runner), then exit.
 *                                   After this, normal runs are zero-touch.
 *                                   Combined with any other mode flag, that
 *                                   mode wins (it signs in first anyway).
 *      npm start -- --student-led --subject ela|math|science|social-studies|social-skills
 *                                   enCORE Student-Led for ONE learner (the
 *                                   studentLed.learnerPseudonym entry — "Luis"
 *                                   — whose display name lives only in local
 *                                   config.json): pick the learner (the click
 *                                   opens step 2 on SLZUSD; other tenants
 *                                   still need Next), then leave ONLY that
 *                                   subject checked and stop at READY.
 *                                   social-studies (Social Studies) is an
 *                                   enCORE school subject. social-skills
 *                                   (Social Skills) is NOT enCORE: it opens
 *                                   the Social Skills app, does "Login as.."
 *                                   for the learner, and stops at READY on
 *                                   their My Activities (dry run: logs them
 *                                   back out). Not an alias for Social Studies.
 *                                   --subject default picks the learner and
 *                                   leaves step 2 exactly as enCORE sets it
 *                                   up (for a learner who doesn't work by
 *                                   subject), then READY. You
 *                                   press Next / launch on screen. With
 *                                   --dry-run it
 *                                   verifies the checkboxes, prints them, and
 *                                   backs out without starting anything.
 *                                   studentLed.autoBegin:true also presses Next
 *                                   and the step-3 launch button (unverified).
 *      npm start -- --recon-roster  day-one recon: SSO chain + list every student
 *                                   in Social Skills AND enCORE, diff against the
 *                                   config roster, write recon/roster-report-*.txt.
 *                                   Zero clicks on any student.
 *      npm start -- --recon-goals   walk Student-Led setup to step 2 for one
 *                                   student and log whether "IEP Goals" is
 *                                   selectable and what it lists. Backs out —
 *                                   never enters step 3, never launches.
 *      npm start -- --recon-social-skills
 *                                   why won't the Social Skills app load? Logs
 *                                   page/frame paths and counts of fixed marker
 *                                   words — never page text or student names —
 *                                   and saves one screenshot to recon/ for you.
 *      npm start -- --report NAME   Phase-3 scaffold: open enCORE Reporting
 *                                   (for NAME if given), screenshot + extract
 *                                   text to recon/. Read-only.
 *
 * District profiles: config/districts/<district>.json holds district-level
 * values (Clever entry URL, SSO button candidates, enCORE hash, browser
 * profile dir). config.json picks one via "district" and can override any
 * field. Browser profiles are PER DISTRICT — never share cookies across SSO
 * tenants.
 *
 * Privacy: config.json, logs/, recon/ and the browser profiles are
 * gitignored. Student names (roster, reports, logs) exist only on this
 * machine — never in committed files.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const subjects = require('./lib/subjects');
const { advanceStudentLedToStep2, advanceStudentLedToStep3 } = require('./lib/student-led');
const socialSkillsApp = require('./lib/social-skills-app');
const sessionLock = require('./lib/session-lock');

const PROJECT_DIR = __dirname;
const CONFIG_PATH = path.join(PROJECT_DIR, 'config.json');
const DISTRICTS_DIR = path.join(PROJECT_DIR, 'config', 'districts');
const LOGS_DIR = path.join(PROJECT_DIR, 'logs');
const RECON_DIR = path.join(PROJECT_DIR, 'recon'); // gitignored — screenshots + reports with student data stay local

// Generous timeout for navigation / UI waits. Activity waits are unbounded.
const NAV_TIMEOUT = 60_000;

// How long a human gets to finish a manual sign-in (password + MFA) before
// the run gives up. The chains keep polling and continue on their own the
// moment sign-in completes — no Enter required.
const MANUAL_SIGNIN_TIMEOUT = 300_000;

// Verified frame chain for Social Skills (devtools recon):
//   outer: legacy ASP.NET shell, inner: the AngularJS app. Same-origin.
const OUTER_IFRAME = 'iframe[src*="SocialSkills/Client/AppHost/AppHost.aspx"]';
const INNER_IFRAME = 'iframe[src*="AppHost/app"]';

// enCORE (Teacher-Led sessions) uses a SINGLE same-origin iframe.
const ENCORE_IFRAME = 'iframe[src*="WorkGroup/Client/AppHost/app"]';

// Verified on the live app (devtools recon, 2026-07):
const STUDENT_ROW = 'div.tt-list-item.sli_studentHolder'; // row text = the student's name
const ROW_SELECTED_CLASS = 'picker_selected'; // on the row when selected ("picker_unselected" otherwise)
const CONTEXT_BTN = '.context-btn'; // caret/menu button, child of the row (holds i.fa.fa-caret-down)
const LOGIN_AS_ITEM = 'li:text("Login as..")'; // menu items are bare Angular <li>s — match by text (two dots, no space)

// Fallback caret candidates, used only if STUDENT_ROW stops matching (app
// update). Tried in order from the student's name outward.
const CARET_SELECTORS = [
  '.context-btn', // verified live selector — first even in the fallback
  '.caret',
  '[class*="caret"]',
  '[class*="dropdown-toggle"]',
  'a[data-toggle="dropdown"]',
  '[data-toggle="dropdown"]',
  'button[class*="dropdown"]',
  '[class*="dropdown"] a',
  '[class*="menu-toggle"]',
  '[class*="arrow"]',
];

// Shared mutable state so the Ctrl+C handler can clean up whatever is open.
const state = {
  context: null,
  ttPage: null,
  ttNavBase: null, // TeachTown nav document URL (before the #hash) — for direct goto resets
  popup: null,
  logger: null,
  shuttingDown: false,
  finished: false,
  reconMode: false, // recon flag set OR first run on this browser profile
  manualSignInHappened: false, // a human signed in during this run
  autoSubmitHappened: false, // a browser-filled form was submitted this run
  playlistOnceRun: new Set(), // playlist entries (by index) already run this session
  profileAuthAnnounced: false, // PROFILE AUTHENTICATED printed (once per run)
  profileDir: '',
  lockHeld: false, // this process owns <profileDir>.lock (lib/session-lock.js)
  pendingRetarget: null, // { subject, learner } a later shortcut click asked this window to switch to
  onRetarget: null, // resolver of the idle hold, set while the run waits at READY
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Idle at READY, handing the screen to the human. Never settles on its own;
// it settles only when a later shortcut click asks this same window to switch
// to another subject (Ctrl+C / closing the browser still end the run).
function holdForRetarget() {
  return new Promise((resolve) => {
    if (state.pendingRetarget) return resolve();
    state.onRetarget = resolve;
  });
}

/* ----------------------------- logging ----------------------------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

function ts(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fileStamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

class Logger {
  constructor(file) {
    this.stream = fs.createWriteStream(file, { flags: 'a' });
  }
  // Timestamped event: console + per-run log file.
  event(msg) {
    const line = `[${ts()}] ${msg}`;
    console.log(line);
    try {
      this.stream.write(line + '\n');
    } catch {
      /* keep running even if the log disk write fails */
    }
  }
  // Console only — used for the dry-run roster table (never persisted).
  consoleOnly(msg) {
    console.log(msg);
  }
  close() {
    try {
      this.stream.end();
    } catch {}
  }
}

/* ------------------------------ config ----------------------------- */

function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

function readJson(p, what) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    fail(`${what} is not valid JSON (${p}): ${err.message}`);
  }
}

function loadConfig(flags) {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(
      'config.json not found.\n' +
        '  Run `npm run init-config` (terminal) or `npm run ui` → Settings\n' +
        '  to create it. config.json is gitignored — real names never leave\n' +
        '  this machine.'
    );
  }
  const cfg = readJson(CONFIG_PATH, 'config.json');

  // UI-mode per-run overrides (Custom Run, Set-up-only vs Start-Live). They
  // arrive in an ENVIRONMENT VARIABLE, deliberately: never argv (process
  // lists are world-readable on shared machines and these can carry student
  // names) and never a file (names live in gitignored config.json and
  // nowhere else on disk). Whitelisted keys only; teacherLed merges per-key
  // so unspecified fields keep their config values. afterRotation lets the
  // para page's one-learner Social Skills routine run exactly one pass.
  if (process.env.TT_UI === '1' && process.env.TT_UI_OVERRIDES) {
    try {
      const o = JSON.parse(process.env.TT_UI_OVERRIDES);
      for (const k of ['students', 'playlist', 'mode', 'targetActivity', 'afterRotation', 'district', 'autoSubmitPrefilledLogin']) {
        if (k in o) cfg[k] = o[k];
      }
      if (o.teacherLed && typeof o.teacherLed === 'object') {
        cfg.teacherLed = Object.assign({}, cfg.teacherLed || {}, o.teacherLed);
      }
      if (o.studentLed && typeof o.studentLed === 'object') {
        // Only run-shaping keys — the learner map stays whatever config.json
        // says; learnerPseudonym picks which of its entries this run uses.
        const pick = {};
        for (const k of ['subject', 'autoBegin', 'lessonSource', 'learnerPseudonym']) if (k in o.studentLed) pick[k] = o.studentLed[k];
        // The legacy "student" field is the config's OWN learner's name —
        // it must never stand in for a different learner's empty entry.
        const own = String((cfg.studentLed && cfg.studentLed.learnerPseudonym) || 'Luis').trim();
        if (typeof pick.learnerPseudonym === 'string' && pick.learnerPseudonym.trim() !== own) pick.student = '';
        cfg.studentLed = Object.assign({}, cfg.studentLed || {}, pick);
      }
    } catch (err) {
      fail(`TT_UI_OVERRIDES is not valid JSON: ${err.message}`);
    }
  }

  // District profile layer: committed per-district defaults live in
  // config/districts/<district>.json; anything set directly in the local
  // config.json overrides them. The roster lives ONLY in config.json
  // (gitignored) — never in the committed district files.
  let profile = {};
  if (cfg.district) {
    const p = path.join(DISTRICTS_DIR, `${cfg.district}.json`);
    if (!fs.existsSync(p)) {
      const known = fs.existsSync(DISTRICTS_DIR)
        ? fs.readdirSync(DISTRICTS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).join(', ')
        : '(none)';
      fail(`district profile not found: ${p}\nKnown districts: ${known}`);
    }
    profile = readJson(p, `district profile "${cfg.district}"`);
    if (profile.active === false) {
      console.warn(`District profile "${cfg.district}" is marked inactive (archive) — proceeding anyway.`);
    }
  }

  // Entry URL + login mode. F1 resolved for SLZUSD (8/2026): TeachTown login
  // is DIRECT on the TeachTown site — no Clever portal. "clever" mode keeps
  // the portal→tile flow for districts that front TeachTown with Clever.
  cfg.loginMode = cfg.loginMode || profile.loginMode || 'clever';
  if (!['clever', 'direct'].includes(cfg.loginMode)) {
    fail(`config.loginMode must be "clever" or "direct" (got "${cfg.loginMode}").`);
  }
  cfg.teachtownEntryUrl = cfg.teachtownEntryUrl || profile.teachtownEntryUrl || 'https://www.teachtown.com/nav/';
  cfg.cleverEntryUrl = cfg.cleverEntryUrl || cfg.cleverDistrictUrl || profile.cleverEntryUrl || null;
  if (cfg.loginMode === 'clever') {
    if (!cfg.cleverEntryUrl || !/^https?:\/\//i.test(cfg.cleverEntryUrl)) {
      fail('loginMode "clever" needs a Clever entry URL — set "district" (see config/districts/) or "cleverEntryUrl" in config.json.');
    }
    if (profile.cleverEntryUrlVerified === false && !cfg.cleverEntryUrl.startsWith('http://localhost')) {
      console.warn(
        `Heads up: ${cfg.cleverEntryUrl} is UNVERIFIED for "${cfg.district}". First run is a guided recon — ` +
          'auth hops are screenshotted to recon/ and an unrecognized page stops the run cleanly.'
      );
    }
  } else if (!/^https?:\/\//i.test(cfg.teachtownEntryUrl)) {
    fail('loginMode "direct" needs an http(s) "teachtownEntryUrl".');
  }

  cfg.ssoButtonText = (
    Array.isArray(cfg.ssoButtonText) ? cfg.ssoButtonText
    : Array.isArray(profile.ssoButtonText) ? profile.ssoButtonText
    : []
  ).filter((s) => typeof s === 'string' && s.trim());
  cfg.districtGroups = Array.isArray(profile.groups) ? profile.groups : [];

  // Per-district browser profile — NEVER share one across districts: the old
  // tenant's cookies will fight the new SSO.
  cfg.profileDir =
    cfg.profileDir ||
    profile.browserProfileDir ||
    (cfg.district
      ? path.join('.profiles', cfg.district) // relative → resolved against the project dir
      : path.join(os.homedir(), '.teachtown-runner', 'profile')); // built from os.homedir(), never a literal "~"

  // Roster (for recon diffing). Entries: "Name" or
  // { name, aka: ["nickname"], grade, school, expected } — expected:false
  // marks a student who may legitimately be absent (e.g. other school).
  cfg.roster = (Array.isArray(cfg.roster) ? cfg.roster : [])
    .map((r) =>
      typeof r === 'string'
        ? { name: r.trim(), aka: [], expected: true }
        : {
            name: String(r.name || '').trim(),
            aka: (Array.isArray(r.aka) ? r.aka : []).filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()),
            grade: r.grade,
            school: r.school,
            expected: r.expected !== false,
          }
    )
    .filter((r) => r.name);

  // The rotation students list is only required when the rotation will run.
  const rotationRun =
    !flags.teacherLedOnly && !flags.studentLed && !flags.reconRoster && !flags.reconGoals && !flags.reconSocialSkills && flags.report == null && !flags.loginOnly;
  if (rotationRun) {
    if (!Array.isArray(cfg.students) || cfg.students.length === 0 ||
        cfg.students.some((s) => typeof s !== 'string' || !s.trim())) {
      fail(
        'config.students is empty — a rotation needs student names.\n' +
          '  Run `npm run init-config` to enter them locally (config.json is\n' +
          '  gitignored; names never leave this machine), or edit config.json.'
      );
    }
    cfg.students = cfg.students.map((s) => s.trim());
  } else {
    cfg.students = (Array.isArray(cfg.students) ? cfg.students : [])
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim());
  }

  // Press the sign-in button when the BROWSER has already filled the form.
  // Never types, never stores credentials, never submits an unverified form.
  // Set false to always hand a sign-in form to a human.
  cfg.autoSubmitPrefilledLogin = cfg.autoSubmitPrefilledLogin !== false;

  cfg.targetActivity = cfg.targetActivity || null;
  cfg.mode = cfg.mode || 'activity';
  if (!['activity', 'movie'].includes(cfg.mode)) {
    fail(`config.mode must be "activity" or "movie" (got "${cfg.mode}").`);
  }
  // Session playlist: an ordered sequence run for each student, overriding
  // the single mode/targetActivity launch. Entries:
  //   { "mode": "movie"|"activity", "target": "Exact Name" }  → that one
  //   { "mode": "movie", "count": 5 }                         → first 5 listed
  //   ... plus "once": true                                   → only for the
  //       FIRST student of the session (e.g. movies the group watches
  //       together — nobody needs them repeated per student).
  cfg.playlist = (Array.isArray(cfg.playlist) ? cfg.playlist : []).map((e, i) => {
    const entry = {
      mode: e && (e.mode === 'movie' || e.mode === 'activity') ? e.mode : null,
      target: e && typeof e.target === 'string' && e.target.trim() ? e.target.trim() : null,
      count: e && Number.isInteger(e.count) && e.count > 0 ? e.count : null,
      once: !!(e && e.once === true),
    };
    if (!entry.mode) fail(`playlist[${i}].mode must be "movie" or "activity".`);
    if (entry.target && entry.count) fail(`playlist[${i}]: use "target" OR "count", not both.`);
    if (!entry.target && !entry.count) entry.count = 1;
    return entry;
  });

  cfg.afterRotation = cfg.afterRotation || 'stop';
  if (!['stop', 'repeat', 'teacherLed'].includes(cfg.afterRotation)) {
    console.warn(
      `afterRotation="${cfg.afterRotation}" is not implemented — treating it as "stop".`
    );
    cfg.afterRotation = 'stop';
  }

  // Teacher-Led (enCORE) settings; district profile supplies the app hash.
  const tl = Object.assign(
    { encoreAppHash: profile.encoreAppHash || '#/apps/encr', group: '', students: [], sessionLengthMin: 15, autoBegin: false },
    cfg.teacherLed || {}
  );
  if (!tl.encoreAppHash) tl.encoreAppHash = profile.encoreAppHash || '#/apps/encr';
  if (!Array.isArray(tl.students)) tl.students = [];
  tl.students = tl.students.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  tl.group = typeof tl.group === 'string' ? tl.group.trim() : '';
  if (typeof tl.sessionLengthMin !== 'number' || tl.sessionLengthMin <= 0) tl.sessionLengthMin = 15;
  if (tl.group && tl.students.length) {
    console.warn('teacherLed: both "group" and "students" are set — the group takes precedence.');
  }
  if (tl.group && cfg.districtGroups.length &&
      !cfg.districtGroups.some((g) => norm(g) === norm(tl.group))) {
    console.warn(
      `teacherLed.group "${tl.group}" isn't among the ${cfg.district || 'district'} profile's known groups (${cfg.districtGroups.join(', ')}).`
    );
  }
  cfg.teacherLed = tl;

  const willRunTeacherLed = flags.teacherLedOnly || (rotationRun && cfg.afterRotation === 'teacherLed');
  if (willRunTeacherLed && !tl.group && tl.students.length === 0) {
    fail('teacherLed needs either "group" or a non-empty "students" list in config.json.');
  }

  // Student-Led (enCORE), one learner at a time. The learner is addressed by
  // PSEUDONYM everywhere the repo can see — code, flags, UI labels, log
  // lines — and the pseudonym maps to a display name ONLY inside gitignored
  // config.json ("learners": { "Luis": "<display name>" }).
  const sl = Object.assign(
    { learnerPseudonym: 'Luis', learners: {}, lessonSource: 'recommended', subject: null, autoBegin: false },
    cfg.studentLed || {}
  );
  sl.learnerPseudonym =
    typeof sl.learnerPseudonym === 'string' && sl.learnerPseudonym.trim() ? sl.learnerPseudonym.trim() : 'Luis';
  if (typeof sl.learners !== 'object' || sl.learners === null || Array.isArray(sl.learners)) sl.learners = {};
  // The pre-build stub kept the display name in "student" — honor it once.
  if (!sl.learners[sl.learnerPseudonym] && typeof sl.student === 'string' && sl.student.trim()) {
    sl.learners[sl.learnerPseudonym] = sl.student.trim();
  }
  sl.studentName =
    typeof sl.learners[sl.learnerPseudonym] === 'string' ? sl.learners[sl.learnerPseudonym].trim() : '';
  sl.lessonSource = typeof sl.lessonSource === 'string' && sl.lessonSource.trim() ? sl.lessonSource.trim().toLowerCase() : 'recommended';
  if (!Object.prototype.hasOwnProperty.call(LESSON_SOURCES, sl.lessonSource)) {
    fail(`studentLed.lessonSource must be one of ${Object.keys(LESSON_SOURCES).join(', ')} (got "${sl.lessonSource}").`);
  }
  sl.autoBegin = sl.autoBegin === true;
  sl.pressNext = sl.pressNext !== false; // default ON: step 2 → 3, so only Start Session is left to press
  const rawSubject = flags.subject != null ? flags.subject : sl.subject;
  // "default" is not a subject: it leaves step 2 as enCORE sets it up.
  sl.subject =
    typeof rawSubject === 'string' && rawSubject.trim().toLowerCase() === subjects.DEFAULT_SETTINGS
      ? subjects.DEFAULT_SETTINGS
      : subjects.normalizeSubjectKey(rawSubject);
  const subjectChoices = [...subjects.SUBJECT_KEYS, subjects.DEFAULT_SETTINGS];
  if (rawSubject != null && rawSubject !== '' && !sl.subject) {
    fail(`unknown subject "${rawSubject}" — use one of: ${subjectChoices.join(', ')}`);
  }
  if (flags.studentLed) {
    if (!sl.subject) {
      fail(
        '--student-led needs a subject: --subject ' + subjectChoices.join('|') + '\n' +
          '  (the UI buttons and the windows/*.cmd launchers pass it for you).'
      );
    }
    if (!sl.studentName) {
      fail(
        `studentLed.learners["${sl.learnerPseudonym}"] is empty in config.json.\n` +
          `  Enter the learner's display name EXACTLY as enCORE (and, for Social Skills,\n` +
          `  View Students) shows it — there, or in\n` +
          '  `npm run ui` → Settings → Student-Led learner. config.json is gitignored;\n' +
          '  the name never leaves this machine.'
      );
    }
  }
  cfg.studentLed = sl;
  return cfg;
}

// Step-2 lesson-source radios (recon 2026-07). "recommended" is the app's
// default, so it is never clicked — a missing radio must not fail the run.
const LESSON_SOURCES = {
  recommended: /recommended lessons?/i,
  iep: /iep goals?/i,
  facilitator: /facilitator[- ]selected/i,
  benchmark: /benchmark assessments?/i,
};

// Defaults never contain "~" (they're built with os.homedir()); this
// expansion is only a convenience for a hand-written config value, and it
// substitutes os.homedir() so it behaves identically on Windows.
function resolveProfileDir(p) {
  const expanded = p.replace(/^~(?=$|[\\/])/, os.homedir());
  return path.isAbsolute(expanded) ? expanded : path.resolve(PROJECT_DIR, expanded);
}

/* --------------------------- small helpers ------------------------- */

function fmtScore(score) {
  return score == null ? 'no data' : `${score}%`;
}

function norm(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function visibleSoon(locator, timeout) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function findFirstVisible(locators, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const loc of locators) {
      try {
        const first = loc.first();
        if (await first.isVisible()) return first;
      } catch {
        /* page may be mid-navigation; keep polling */
      }
    }
    await sleep(300);
  } while (Date.now() < deadline);
  return null;
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
    } catch {}
    await sleep(400);
  }
  return false;
}

// Non-blocking Enter fallback during a manual sign-in: the chains poll for
// success on their own, so Enter is never required — pressing it just forces
// an immediate re-check. The returned disposer MUST run on every chain exit
// (success or error) or the referenced stdin keeps the process alive after
// its work is done.
function armEnterFallback(onEnter) {
  const armedAt = Date.now();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // A newline typed BEFORE arming sits in the stdin buffer and is delivered
  // the instant readline resumes the stream — it predates the banner and was
  // not aimed at us, so a line landing immediately after arming is dropped.
  rl.on('line', () => {
    if (Date.now() - armedAt > 300) onEnter();
  });
  rl.on('SIGINT', () => {
    rl.close();
    shutdown(130);
  });
  return () => {
    try {
      rl.close();
    } catch {}
    // In UI mode the STOP command also arrives over stdin. rl.close() pauses
    // the stream, which would deafen that listener for the rest of the run,
    // so resume it there.
    if (process.env.TT_UI === '1') process.stdin.resume();
    else process.stdin.pause();
    if (process.stdin.unref) process.stdin.unref();
  };
}

function announceManualSignIn(logger) {
  state.manualSignInHappened = true;
  logger.event("MANUAL SIGN-IN NEEDED — sign in in the open browser window; I'll continue automatically.");
  logger.event('(Waiting up to 5 minutes. Pressing Enter here also re-checks immediately.)');
}

// One confirmation per run, no matter which chain the manual sign-in happened
// in (the enCORE leg signs in separately and can prompt long after main()'s
// post-login checkpoint).
function noteProfileAuthenticated(logger) {
  if (state.manualSignInHappened && !state.profileAuthAnnounced) {
    state.profileAuthAnnounced = true;
    logger.event(`PROFILE AUTHENTICATED — future runs should be zero-touch. Profile: ${state.profileDir}`);
  }
}

async function screenshot(page, label) {
  try {
    if (!page || page.isClosed()) return;
    const file = path.join(LOGS_DIR, `error-${label}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    state.logger?.event(`Saved screenshot: ${file}`);
  } catch {
    /* screenshots are best-effort */
  }
}

/* ------------------------- frame plumbing -------------------------- */

function innerLocator(tt) {
  return tt.frameLocator(OUTER_IFRAME).frameLocator(INNER_IFRAME);
}

// The Frame object (not FrameLocator) for evaluate() calls. Inner frame URL
// contains "AppHost/app"; the outer one is excluded by its ".aspx".
function getInnerFrame(tt) {
  return (
    tt.frames().find((f) => {
      const u = f.url().toLowerCase();
      return u.includes('apphost/app') && !u.includes('.aspx');
    }) || null
  );
}

function encoreLocator(tt) {
  return tt.frameLocator(ENCORE_IFRAME);
}

/* ---------------------------- recon infra --------------------------- */

// Raised when an auth chain hits a page the runner doesn't recognize while
// in recon mode — the human takes over (exit code 2, screenshot saved).
class ReconStopError extends Error {}

// The 5-minute manual sign-in window closed without the chain reaching its
// success state. Distinct so callers can (a) skip the fatal screenshot — the
// page on screen is a live sign-in form — and (b) not retry into a silent
// second window.
class ManualSignInTimeoutError extends Error {}

async function reconShot(page, label) {
  try {
    fs.mkdirSync(RECON_DIR, { recursive: true });
    const file = path.join(RECON_DIR, `${label}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    state.logger?.event(`Recon screenshot: ${file}`);
    return file;
  } catch {
    return null;
  }
}

function ssoCandidatesRe(config) {
  const c = (config.ssoButtonText || []).filter(Boolean);
  return c.length ? new RegExp(c.map(escapeRe).join('|'), 'i') : null;
}

function hostnameOf(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
}

// The runner's own app (the TeachTown nav shell) can boot slowly with no URL
// change — never "unrecognized", the outer deadline governs it instead.
function onOwnApp(page) {
  return !!(state.ttNavBase && page.url().startsWith(state.ttNavBase));
}

// Tracks auth-chain progress: screenshots each new page (hop) in recon mode
// BEFORE anything is clicked on it, and measures how long we've been stuck.
// "Stuck" means no navigation AND no rendering progress — a cheap DOM
// fingerprint (text length + interactive element count) resets the clock, so
// a slow-but-loading page (SPA hydration, cold cache on school wifi) is not
// mistaken for an unrecognized one.
function makeHopTracker(page, chain) {
  let lastUrl = null;
  let lastFp = null;
  let lastProgress = Date.now();
  let hopN = 0;
  return {
    async tick() {
      let fp = lastFp;
      try {
        fp = await page.evaluate(() =>
          document.body
            ? document.body.innerText.length + ':' + document.querySelectorAll('button,a,input,iframe').length
            : '0'
        );
      } catch {
        /* mid-navigation — keep the previous fingerprint */
      }
      if (page.url() !== lastUrl) {
        lastUrl = page.url();
        lastFp = fp;
        lastProgress = Date.now();
        if (state.reconMode) {
          hopN += 1;
          await reconShot(page, `${chain}-hop${hopN}`);
        }
      } else if (fp !== lastFp) {
        lastFp = fp;
        lastProgress = Date.now();
      }
    },
    progress() {
      lastProgress = Date.now();
    },
    stalledFor() {
      return Date.now() - lastProgress;
    },
  };
}

// Recon-mode hard stop on an unrecognized auth page: report what's on it
// (never touching any field) and hand control back to the human.
async function unknownAuthStop(page, chain) {
  const info = await page
    .evaluate(() => ({
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
        .map((e) => (e.innerText || e.value || '').trim())
        .filter(Boolean)
        .slice(0, 25),
    }))
    .catch(() => ({ title: '(unreadable)', buttons: [] }));
  await reconShot(page, 'unrecognized');
  const hint = /classlink/i.test(page.url())
    ? '\n  This looks like ClassLink — the runner only knows the Clever flow. Capture it with `npx playwright codegen` and send the recording.'
    : '';
  throw new ReconStopError(
    `UNRECOGNIZED AUTH PAGE during ${chain}\n` +
      `  url: ${page.url()}\n` +
      `  title: ${info.title}\n` +
      `  visible buttons/links: ${info.buttons.join(' | ') || '(none)'}${hint}\n` +
      '  Screenshot saved to recon/. No credentials were touched.'
  );
}

function writeReconReport(lines, prefix) {
  fs.mkdirSync(RECON_DIR, { recursive: true });
  const file = path.join(RECON_DIR, `${prefix}-${fileStamp()}.txt`);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

/* --------------------------- browser/login ------------------------- */

async function launchBrowser(profileDir) {
  const opts = {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
    timeout: NAV_TIMEOUT,
    // This script owns Ctrl+C cleanup (close popup → log student out → close
    // browser); Playwright's default SIGINT handler would kill the browser
    // out from under it.
    handleSIGINT: false,
    handleSIGTERM: false,
  };
  try {
    return await chromium.launchPersistentContext(profileDir, opts);
  } catch (err) {
    const m = err.message || '';
    if (/not found|no such file|install/i.test(m) && /chrome/i.test(m)) {
      throw new Error(
        `Could not launch Chrome (channel "chrome"). Is Google Chrome installed on this machine?\n${m}`
      );
    }
    if (/ProcessSingleton|SingletonLock|profile.*in use/i.test(m)) {
      throw new Error(
        `The browser profile is already in use — close the other Chrome window first.\nProfile: ${profileDir}`
      );
    }
    throw err;
  }
}

async function findTeachTownTile(page) {
  const candidates = [
    page.getByRole('link', { name: /teachtown/i }),
    page.getByRole('button', { name: /teachtown/i }),
    page.locator('a:has(img[alt*="TeachTown" i])'),
    page.getByText(/teachtown/i),
  ];
  for (const c of candidates) {
    try {
      const first = c.first();
      if (await first.isVisible()) return first;
    } catch {
      /* mid-navigation */
    }
  }
  return null;
}

// True when Microsoft is asking a human for something (credentials or the
// account picker). Transient SSO redirects through microsoftonline don't
// count — only a visible form does.
async function microsoftWantsInput(page) {
  if (!/login\.microsoftonline|login\.live|login\.microsoft|adfs|sts\./i.test(page.url())) {
    return false;
  }
  const cred = page.locator(
    'input[type="password"], input[type="email"], input[name="loginfmt"], input[name="passwd"]'
  );
  try {
    if (await cred.first().isVisible()) return true;
  } catch {}
  try {
    if (await page.getByText(/pick an account/i).first().isVisible()) return true;
  } catch {}
  return false;
}

// A known IdP HOST (Microsoft / federation endpoints) is never an
// "unrecognized" page — dedicated handlers exist for it, and mid-MFA it can
// legitimately sit static for minutes (approval pending on a phone) with no
// visible inputs for microsoftWantsInput to match.
function onKnownIdpHost(page) {
  return /login\.microsoftonline|login\.live|login\.microsoft|adfs|sts\./i.test(hostnameOf(page.url()));
}

// A page that belongs to a sign-in flow — never navigate away from one.
// URL-based (login/sso/auth paths) plus a live password field, so a
// multi-step login on the app's own host stays protected while an ordinary
// app page (which may well have a search box) does not.
async function looksLikeSignInPage(page) {
  if (/login|signin|sign-in|sso|auth|oauth|saml|adfs/i.test(page.url())) return true;
  if (await credentialFormVisible(page)) return true;
  return false;
}

// What does this tenant's hub actually contain? Text lookups on the top
// document miss anything TeachTown renders inside a frame, so list both.
// On a new district this is the single most useful thing in the log: it is
// what tells us how to reach the apps here.
async function inventoryHub(page, logger) {
  try {
    const info = await page.evaluate(() => {
      const txt = (e) => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ');
      return {
        title: document.title,
        url: location.href,
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(txt).filter(Boolean).slice(0, 12),
        clickable: Array.from(
          document.querySelectorAll('a, button, [class*="card" i], [class*="tile" i], [role="button"]')
        )
          .map(txt)
          .filter(Boolean)
          .slice(0, 30),
        frames: Array.from(document.querySelectorAll('iframe')).map((f) => f.src || '(no src)').slice(0, 10),
        text: (document.body ? document.body.innerText : '').trim().replace(/\s+/g, ' ').slice(0, 220),
      };
    });
    logger.event(`HUB INVENTORY — "${info.title}" at ${info.url}`);
    logger.event(`  headings: ${info.headings.join(' | ') || '(none)'}`);
    logger.event(`  clickable: ${info.clickable.join(' | ') || '(none)'}`);
    logger.event(`  iframes: ${info.frames.join(' | ') || '(none)'}`);
    logger.event(`  text: "${info.text}"`);
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const t = await f
        .evaluate(() => (document.body ? document.body.innerText : '').trim().replace(/\s+/g, ' ').slice(0, 160))
        .catch(() => null);
      if (t) logger.event(`  frame ${f.url().slice(0, 100)} shows: "${t}"`);
    }
  } catch (err) {
    logger.event(`WARN hub inventory failed: ${err.message.split('\n')[0]}`);
  }
}

// Periodic "here is what I'm actually looking at" line. A chain waiting on
// something it doesn't recognize has to narrate itself — going silent for
// minutes and then failing with a bare timeout is not a diagnosable failure.
function makeHeartbeat(logger, everyMs = 15_000) {
  let last = Date.now();
  return async (page, what) => {
    if (Date.now() - last < everyMs) return;
    last = Date.now();
    const info = await page
      .evaluate(() => ({
        text: (document.body ? document.body.innerText : '').trim().replace(/\s+/g, ' ').slice(0, 160),
        controls: document.querySelectorAll('button, a, input').length,
      }))
      .catch(() => null);
    logger.event(`Still waiting for ${what} — url: ${page.url()}`);
    if (info) logger.event(`  the page shows: "${info.text}" (${info.controls} controls)`);
  };
}

// Enough structure and text to be a real app screen rather than a blank
// page, a spinner, or an error stub. Two shapes count: a hub (several
// cards/links) and an app screen — TeachTown embeds every app in an
// iframe, so a page whose only top-level content is a heading plus an
// iframe is a loaded app, not an empty page.
async function appContentRendered(page) {
  return await page
    .evaluate(() => {
      const controls = document.querySelectorAll('button, a, [class*="card" i], [class*="tile" i]').length;
      const frames = document.querySelectorAll('iframe').length;
      const text = (document.body ? document.body.innerText : '').trim().length;
      return (controls >= 3 && text > 20) || (frames >= 1 && text > 0);
    })
    .catch(() => false);
}

// Any visible form field = a human may be mid-flow on this page (step 2 of a
// login, an OTP box, a security question) — never navigate over it.
async function anyVisibleFormField(page) {
  try {
    return (
      (await page
        .locator('input:not([type="hidden"]), textarea, select')
        .filter({ visible: true })
        .count()) > 0
    );
  } catch {
    return false;
  }
}

// goto the district's Clever entry URL and get to the logged-in portal (the
// page with the TeachTown tile). Cached session → fully automatic. If a
// credential form shows up, hand control to the human. Never touch fields.
// In recon mode every hop is screenshotted before clicking, and an
// unrecognized page stops the run instead of guessing.
async function ensureCleverPortal(page, config, logger) {
  logger.event(`Opening Clever portal: ${config.cleverEntryUrl}`);
  await page.goto(config.cleverEntryUrl, {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });

  const tracker = makeHopTracker(page, 'clever');
  const heartbeat = makeHeartbeat(logger);
  const ssoRe = ssoCandidatesRe(config);
  let deadline = Date.now() + NAV_TIMEOUT * 2;
  let manualUntil = 0;
  let lastAuthSeen = 0; // last poll that saw a sign-in page (form/picker/MFA)
  let ssoClicks = 0;
  let kmsiClicks = 0;
  let autoSubmits = 0;
  let autoBlocked = false;
  let disposeEnter = null;
  let nudge = false;
  // The unknown-page stop is suppressed only while a human is plausibly
  // signing in: inside the 5-minute window AND within 45s of last actually
  // seeing a sign-in page — not for the whole window on wall-clock alone.
  const manualActive = () => manualUntil && Date.now() <= manualUntil && Date.now() <= lastAuthSeen + 45_000;

  try {
    while (Date.now() < deadline) {
      if (state.shuttingDown) throw new Error('interrupted');
      await tracker.tick();
      if (nudge) {
        nudge = false;
        tracker.progress();
      }

      if (await findTeachTownTile(page)) {
        logger.event('Clever portal ready (TeachTown tile visible)');
        return;
      }

      // Credential form / account picker / MFA → the human signs in in the
      // browser while we keep polling; the run continues on its own the
      // moment the portal loads. Enter is only a force-recheck fallback.
      if (await microsoftWantsInput(page)) {
        // Browser-filled form → press its button, but only before the banner
        // (afterwards a human may be mid-keystroke).
        if (config.autoSubmitPrefilledLogin && !manualUntil && !autoBlocked && autoSubmits < 3) {
          const r = await submitPrefilledLogin(page, logger);
          if (r === 'error') autoBlocked = true;
          if (r === 'submitted') {
            autoSubmits += 1;
            tracker.progress();
            deadline = Math.max(deadline, Date.now() + 60_000);
            continue;
          }
        }
        lastAuthSeen = Date.now();
        tracker.progress(); // recognized page — never the unknown-stop mid-MFA
        if (!manualUntil) {
          if (state.reconMode) await reconShot(page, 'clever-login-form');
          announceManualSignIn(logger);
          manualUntil = Date.now() + MANUAL_SIGNIN_TIMEOUT;
          deadline = Math.max(deadline, manualUntil + 10_000);
          disposeEnter = armEnterFallback(() => {
            nudge = true;
          });
        }
        await sleep(750);
        continue;
      }

      // Microsoft "Stay signed in?" — clicking Yes is what makes the profile
      // durable across runs. Checked AFTER the credential branch so a page
      // that still shows credential inputs is left to the human, and capped
      // so a lookalike page that never navigates still reaches the
      // unknown-page stop instead of being clicked forever.
      try {
        if (kmsiClicks < 3 && (await page.getByText(/stay signed in\?/i).first().isVisible())) {
          kmsiClicks += 1;
          await page
            .getByRole('button', { name: /^yes$/i })
            .or(page.locator('input[type="submit"][value="Yes"]'))
            .first()
            .click({ timeout: 2000 });
          logger.event('Answered "Stay signed in?" → Yes (keeps future runs zero-touch).');
          tracker.progress();
          deadline = Math.max(deadline, Date.now() + 60_000); // post-auth redirects get real time
          await sleep(1000);
          continue;
        }
      } catch {
        logger.event('WARN could not click Yes on "Stay signed in?" — will stop and report if the page stays stuck.');
      }

      // District SSO button: profile candidates first (e.g. "San Lorenzo"),
      // then a generic sign-in-looking button — but the generic fallback only
      // fires on clever-ish pages so an unknown provider is never blind-clicked.
      if (ssoClicks < 3) {
        let btn = null;
        if (ssoRe) {
          const cand = page
            .getByRole('button', { name: ssoRe })
            .or(page.getByRole('link', { name: ssoRe }))
            .first();
          if (await cand.isVisible().catch(() => false)) btn = cand;
        }
        // Hostname, not full URL: an unknown IdP carrying redirect_uri=...clever.com
        // in its query string must NOT pass as a clever page.
        if (!btn && /clever/i.test(hostnameOf(page.url()))) {
          const gen = page
            .getByRole('button', { name: /sign ?in|log ?in with/i })
            .or(page.getByRole('link', { name: /sign ?in|log ?in with/i }))
            .first();
          if (await gen.isVisible().catch(() => false)) btn = gen;
        }
        if (btn) {
          const label = ((await btn.textContent().catch(() => '')) || 'sign-in button').trim();
          if (state.reconMode) await reconShot(page, 'clever-before-sso-click');
          ssoClicks += 1;
          await btn.click().catch(() => {});
          logger.event(`SSO hop: clicked "${label}"`);
          tracker.progress();
          deadline = Math.max(deadline, Date.now() + 60_000);
          await sleep(1500);
          continue;
        }
      }

      // Mode-independent: an unrecognized page deserves a stop-and-report even
      // in steady state — but never while a human is mid-sign-in, and never on
      // a known IdP host (mid-MFA those sit static with nothing to match).
      if (!onOwnApp(page) && !onKnownIdpHost(page) && !manualActive() && tracker.stalledFor() > 20_000) {
        await unknownAuthStop(page, 'Clever portal chain');
      }
      if (!manualActive()) await heartbeat(page, 'the Clever portal (TeachTown tile)');
      await sleep(750);
    }
    throw manualUntil
      ? new ManualSignInTimeoutError(
          'SIGN-IN WINDOW EXPIRED — the Clever portal never became ready within the 5-minute manual sign-in window. Nothing was typed by the runner; re-run when ready (npm start -- --login warms up the profile).'
        )
      : new Error('timed out waiting for the Clever portal (TeachTown tile never appeared)');
  } finally {
    if (disposeEnter) disposeEnter();
  }
}

// A visible password field means a human needs to sign in. The runner NEVER
// touches credential inputs, in any mode.
async function credentialFormVisible(page) {
  try {
    return await page.locator('input[type="password"]').first().isVisible();
  } catch {
    return false;
  }
}

// Chrome's own password manager can pre-fill a sign-in form (the credentials
// live in the browser profile — never in this repo, never read by the
// runner). When the fields are demonstrably ALREADY filled, press the form's
// own submit button so nobody has to click it.
//
// The runner still never types, and never submits a form it cannot verify is
// filled: an empty submit is a failed login attempt, and enough of those lock
// a district account. A rejected sign-in stops all further attempts.
async function submitPrefilledLogin(page, logger) {
  try {
    const field = page
      .locator('input[type="password"], input[name="loginfmt"], input[type="email"]')
      .filter({ visible: true })
      .first();
    if ((await field.count()) === 0) return 'none';
    // Chrome marks autofilled inputs with :-webkit-autofill even when it
    // withholds the value from page scripts, so check both.
    const filled = await field.evaluate((el) => {
      let auto = false;
      try {
        auto = el.matches(':-webkit-autofill');
      } catch {}
      return auto || String(el.value || '').length > 0;
    });
    if (!filled) return 'none';

    const submit = page
      .getByRole('button', { name: /^\s*(sign in|log ?in|next|continue|submit)\s*$/i })
      .or(page.locator('input[type="submit"], button[type="submit"]'))
      .first();
    if (!(await submit.isVisible().catch(() => false))) return 'none';
    await submit.click({ timeout: 3_000 });
    logger.event('Sign-in form was already filled in by the browser — pressed its button for you (nothing was typed).');
    await sleep(1500);

    const rejected = page
      .getByText(/incorrect|isn't correct|is not correct|invalid|didn't work|try again|locked/i)
      .first();
    if (await rejected.isVisible().catch(() => false)) {
      logger.event(
        'WARN the site rejected the saved sign-in — stopping automatic attempts (repeated failures can lock the account). Over to you.'
      );
      return 'error';
    }
    state.autoSubmitHappened = true; // a sign-in DID happen this run — status lines must not claim otherwise
    return 'submitted';
  } catch {
    return 'none';
  }
}

// Direct TeachTown login (loginMode "direct"): the district account signs in
// on the TeachTown site itself — no Clever portal, no tile, same tab.
// Cookied profile → straight to the hub. A sign-in form hands off to the
// human; the persistent profile keeps later runs fully automatic.
async function ensureTeachTownDirect(page, config, logger) {
  const entry = config.teachtownEntryUrl;
  const target = entry.includes('#') ? entry : entry + '#/home';
  logger.event(`Opening TeachTown directly: ${target}`);
  state.ttNavBase = target.split('#')[0]; // own-app exemption covers the hub boot
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});

  const tracker = makeHopTracker(page, 'teachtown');
  const heartbeat = makeHeartbeat(logger);
  let deadline = Date.now() + NAV_TIMEOUT * 2;
  let manualUntil = 0;
  let lastAuthSeen = 0; // last poll that saw a sign-in page
  let steers = 0;
  let kmsiClicks = 0;
  let autoSubmits = 0;
  let autoBlocked = false;
  let disposeEnter = null;
  let nudge = false;
  const manualActive = () => manualUntil && Date.now() <= manualUntil && Date.now() <= lastAuthSeen + 45_000;
  // Browser-filled form → press its button. Only before the banner: once a
  // human has been asked to sign in, they may be mid-keystroke.
  const tryAuto = async () => {
    if (!config.autoSubmitPrefilledLogin || manualUntil || autoBlocked || autoSubmits >= 3) return false;
    const r = await submitPrefilledLogin(page, logger);
    if (r === 'error') autoBlocked = true;
    if (r !== 'submitted') return false;
    autoSubmits += 1;
    tracker.progress();
    deadline = Math.max(deadline, Date.now() + 60_000);
    return true;
  };
  // Shared manual-sign-in handling for both the TeachTown form and a
  // federated IdP's pages: announce once, then keep polling.
  const armManual = async (shotLabel) => {
    lastAuthSeen = Date.now();
    tracker.progress(); // recognized page — never the unknown-stop while a human is typing
    if (!manualUntil) {
      if (state.reconMode) await reconShot(page, shotLabel);
      announceManualSignIn(logger);
      manualUntil = Date.now() + MANUAL_SIGNIN_TIMEOUT;
      deadline = Math.max(deadline, manualUntil + 10_000);
      disposeEnter = armEnterFallback(() => {
        nudge = true;
      });
    }
    await sleep(750);
  };

  try {
    while (Date.now() < deadline) {
      if (state.shuttingDown) throw new Error('interrupted');
      await tracker.tick();
      if (nudge) {
        nudge = false;
        tracker.progress();
        // Enter's re-goto ONLY when it cannot destroy human work: from the
        // TeachTown host itself (never an IdP mid-MFA) and with no visible
        // form fields (never a half-typed sign-in or a step-2 page).
        if (
          !/#\/home/.test(page.url()) &&
          hostnameOf(page.url()) === hostnameOf(target) &&
          !(await anyVisibleFormField(page))
        ) {
          logger.event('Enter → reloading the TeachTown entry page.');
          await page.goto(target, { timeout: NAV_TIMEOUT }).catch(() => {});
          deadline = Math.max(deadline, Date.now() + 60_000);
        }
      }

      const onNav = hostnameOf(page.url()) === hostnameOf(target);
      const atHome = /#\/home/.test(page.url());

      if (
        atHome &&
        (await page
          .getByText(/social skills|welcome to teachtown/i)
          .filter({ visible: true }) // hidden "My Curriculum" menu copies come first in the DOM
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        state.ttNavBase = page.url().split('#')[0];
        logger.event('TeachTown home loaded (#/home) — direct session active');
        return page;
      }

      // Sign-in form (TeachTown's own or a federated IdP's) → the human signs
      // in in the browser while we keep polling; the run continues on its
      // own. Enter is only a force-recheck fallback.
      if (await credentialFormVisible(page)) {
        if (await tryAuto()) continue;
        await armManual('teachtown-login-form');
        continue;
      }

      // A federated IdP asking for something with no password field visible
      // (email-first page, account picker, MFA) — same manual handling.
      if (await microsoftWantsInput(page)) {
        if (await tryAuto()) continue;
        await armManual('teachtown-idp-login-form');
        continue;
      }

      // Signed in and at #/home, but the hub's wording isn't one we know —
      // tenants label it differently. Accept a settled, content-bearing hub
      // rather than stalling on a text match nobody can predict.
      if (atHome && onNav && tracker.stalledFor() > 5_000) {
        const rendered = await appContentRendered(page);
        if (rendered) {
          state.ttNavBase = page.url().split('#')[0];
          logger.event(
            'TeachTown home loaded (#/home) — direct session active ' +
              "(matched on rendered content; the hub's wording wasn't one I recognize)"
          );
          return page;
        }
      }

      // "Stay signed in?" (federated IdP) — Yes keeps the profile durable.
      // Checked AFTER the credential branches and capped (see clever chain).
      try {
        if (kmsiClicks < 3 && (await page.getByText(/stay signed in\?/i).first().isVisible())) {
          kmsiClicks += 1;
          await page
            .getByRole('button', { name: /^yes$/i })
            .or(page.locator('input[type="submit"][value="Yes"]'))
            .first()
            .click({ timeout: 2000 });
          logger.event('Answered "Stay signed in?" → Yes (keeps future runs zero-touch).');
          tracker.progress();
          deadline = Math.max(deadline, Date.now() + 60_000);
          await sleep(1000);
          continue;
        }
      } catch {
        logger.event('WARN could not click Yes on "Stay signed in?" — will stop and report if the page stays stuck.');
      }

      // On the TeachTown host but not at the hub — steer there. Sign-in
      // commonly returns you to your account's DEFAULT APP rather than
      // #/home, and a cookied run lands there having never seen a form, so
      // this must not depend on having seen one. Host-guarded and
      // sign-in-page-guarded so a multi-step login is never navigated over;
      // 4s dwell so an in-flight redirect settles first.
      if (
        steers < 3 &&
        onNav &&
        !atHome &&
        !(await looksLikeSignInPage(page)) &&
        tracker.stalledFor() > 4_000
      ) {
        steers += 1;
        logger.event(`Landed at "${page.url()}" instead of the hub — steering to #/home.`);
        await page.goto(target, { timeout: NAV_TIMEOUT }).catch(() => {});
        tracker.progress();
        deadline = Math.max(deadline, Date.now() + 60_000);
        await sleep(1000);
        continue;
      }

      // Steering didn't stick: this tenant pins you to an app rather than the
      // hub. The session is demonstrably live (own host, no sign-in page,
      // real content), and downstream steps navigate by hash anyway — carry
      // on from here rather than failing on a cosmetic landing difference.
      if (
        steers >= 3 &&
        onNav &&
        !atHome &&
        !(await looksLikeSignInPage(page)) &&
        tracker.stalledFor() > 4_000 &&
        (await appContentRendered(page))
      ) {
        state.ttNavBase = page.url().split('#')[0];
        logger.event(
          `WARN couldn't reach the hub (#/home) — this tenant keeps returning "${page.url()}". ` +
            'The session is live, so continuing from there.'
        );
        return page;
      }

      // Role picker, if the tenant shows one.
      const teacherRole = page.getByText(/log ?in as a teacher/i).first();
      if (await teacherRole.isVisible().catch(() => false)) {
        if (state.reconMode) await reconShot(page, 'teachtown-before-role-click');
        await teacherRole.click().catch(() => {});
        logger.event('SSO hop: clicked "Log in as a teacher"');
        tracker.progress();
        deadline = Math.max(deadline, Date.now() + 60_000);
        await sleep(1200);
        continue;
      }

      if (!onOwnApp(page) && !onKnownIdpHost(page) && !manualActive() && tracker.stalledFor() > 20_000) {
        await unknownAuthStop(page, 'TeachTown direct login');
      }
      if (!manualActive()) await heartbeat(page, 'the TeachTown hub (#/home)');
      await sleep(750);
    }
    if (state.reconMode) await reconShot(page, 'teachtown-timeout');
    throw manualUntil
      ? new ManualSignInTimeoutError(
          'SIGN-IN WINDOW EXPIRED — the TeachTown hub (#/home) never loaded within the 5-minute manual sign-in window. ' +
            `Nothing was typed by the runner; re-run when ready (npm start -- --login warms up the profile).\n  Last page: ${page.url()}`
        )
      : new Error(`timed out waiting for the TeachTown hub (#/home never loaded).\n  Last page: ${page.url()}`);
  } finally {
    if (disposeEnter) disposeEnter();
  }
}

// Clever opens TeachTown in a new tab; fall back to same-tab just in case.
async function openTeachTown(context, portal, logger) {
  const tile = await findTeachTownTile(portal);
  if (!tile) throw new Error('TeachTown tile not found on the Clever portal');
  logger.event('Opening TeachTown from Clever...');
  const newPagePromise = context.waitForEvent('page', { timeout: NAV_TIMEOUT }).catch(() => null);
  await tile.click();
  let tt = await newPagePromise;
  if (!tt) {
    if (/teachtown\./i.test(portal.url())) tt = portal;
    else throw new Error('clicking the TeachTown tile did not open a new tab');
  }
  await tt.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT }).catch(() => {});
  await tt.waitForURL(/#\/home/, { timeout: NAV_TIMEOUT });
  await tt.bringToFront().catch(() => {});
  state.ttNavBase = tt.url().split('#')[0]; // e.g. https://www.teachtown.com/nav/
  logger.event('TeachTown home loaded (#/home)');
  return tt;
}

async function gotoSocialSkills(tt) {
  // The app's own address is the reliable entry. The hub's cards are
  // ambiguous — live SLZUSD shows several visible "Social Skills" matches
  // (card title, a section heading, favorite-star buttons), and clicking
  // the wrong one goes nowhere while the runner waits on an app that never
  // loads. #/apps/ssms is confirmed on the live tenant; the card click is
  // the fallback now, not the primary.
  const viewStudents = () => innerLocator(tt).getByText('View Students').first();
  if (state.ttNavBase) {
    if (!/#\/apps\/ssms/i.test(tt.url())) {
      await tt.goto(state.ttNavBase + '#/apps/ssms', { timeout: NAV_TIMEOUT }).catch(() => {});
    }
    if (await visibleSoon(viewStudents(), 30_000)) return;
    state.logger?.event('Direct #/apps/ssms goto did not bring up the app — falling back to the hub card.');
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
  }
  const card = tt
    .getByRole('link', { name: /social skills/i })
    .or(tt.getByRole('button', { name: /social skills/i }))
    .or(tt.getByText(/social skills/i))
    .filter({ visible: true }) // the hub also carries a hidden "My Curriculum" menu copy
    .first();
  await card.waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await card.click();
  // The gate that matters is the teacher list rendering inside the frames.
  await tt.waitForURL(/#\/apps\/ssms/i, { timeout: NAV_TIMEOUT }).catch(() => {});
  if (!(await visibleSoon(viewStudents(), NAV_TIMEOUT))) {
    throw new Error(`Social Skills never showed "View Students" — last page: ${tt.url()}`);
  }
}

// Per-student cycle reset. Verified live: a direct goto of #/apps/ssms lands
// back on the teacher View Students screen with FRESH module state — and that
// fresh state is also what makes "Login as.." reliable. Hash-only
// navigations are same-document (no reload), so force a reload whenever the
// document part of the URL doesn't change. Fallback: the original student
// Log out → hub → Social Skills card chain. Never uses browser back.
async function resetSocialSkills(tt, logger) {
  const target = state.ttNavBase + '#/apps/ssms';
  try {
    const beforeDoc = tt.url().split('#')[0];
    await tt.goto(target, { timeout: NAV_TIMEOUT });
    if (beforeDoc === state.ttNavBase) {
      await tt.reload({ timeout: NAV_TIMEOUT });
    }
    await innerLocator(tt)
      .getByText('View Students')
      .first()
      .waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
    return;
  } catch (err) {
    logger.event(
      `WARN direct #/apps/ssms reset failed (${err.message.split('\n')[0]}) — falling back to hub → Social Skills`
    );
  }
  // Fallback chain: log out of any student view, then hub → card.
  try {
    const inner = innerLocator(tt);
    // Only log out of a *student* view — never a facilitator-level Log out.
    if (await inner.getByText('My Activities').first().isVisible().catch(() => false)) {
      const logout = inner.getByText(/log ?out/i).first();
      if (await logout.isVisible().catch(() => false)) {
        await logout.click({ timeout: 5_000 }).catch(() => {});
        await tt.waitForURL(/#\/home/, { timeout: 15_000 }).catch(() => {});
      }
    }
  } catch {}
  if (!/#\/home/.test(tt.url())) {
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
  }
  await gotoSocialSkills(tt);
}

/* --------- Social Skills app, rebuilt UI (seen live 2026-10-15) --------- */
// #/apps/ssms is now an Angular app in ONE iframe on the WorkGroup AppHost
// (the same host enCORE uses), not the old two-frame "View Students" app:
//   teacher Home: students are expansion panels; an opened panel has a
//                 "Login as Student" button.
//   student view: .../independent/ssms-landing, activity cards with
//                 "Watch movie" / "Do Activity"; the student menu button
//                 (top) holds "Logout", which signs out of TeachTown.
// The group rotation and --recon-roster still use the old flow above.

function socialSkillsLocators(tt) {
  const frame = tt.frameLocator(ENCORE_IFRAME);
  return {
    frame,
    title: frame.locator('.app-name').filter({ hasText: /social skills/i }).first(),
    firstPanel: frame.locator('tt-student-list mat-expansion-panel-header').first(),
    studentView: frame.locator('tt-ssms-independent-landing-view').first(),
    studentMenu: frame.locator('button.student-menu-button').first(),
  };
}

// Teacher Home of the Social Skills app, with its student list rendered.
// `reload` forces a fresh document (the per-attempt recovery).
async function openSocialSkillsHome(tt, logger, { reload = false, reauth = null } = {}) {
  const L = socialSkillsLocators(tt);
  // The student Logout ends the whole TeachTown session, and a window closed
  // or a failed login can leave a student view up. Both come first.
  if (await visibleSoon(L.studentMenu, 1_000)) {
    logger.event('Social Skills was left inside a student view — logging it out first.');
    await logOutOfStudentView(tt).catch(() => false);
  }
  if (/login\.aspx/i.test(tt.url()) && reauth) {
    logger.event('Signed out of TeachTown — signing in again.');
    await reauth();
  }
  const ready = async (ms) => (await visibleSoon(L.firstPanel, ms)) && (await visibleSoon(L.title, 5_000));
  if (state.ttNavBase) {
    if (reload || !/#\/apps\/ssms/i.test(tt.url())) {
      await tt.goto(state.ttNavBase + '#/apps/ssms', { timeout: NAV_TIMEOUT }).catch(() => {});
      if (reload) await tt.reload({ timeout: NAV_TIMEOUT }).catch(() => {});
    }
    if (await ready(30_000)) return;
    logger.event('Direct #/apps/ssms did not show the Social Skills student list — trying the hub card.');
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
  }
  const card = tt.locator('h3').filter({ hasText: /^\s*social skills\s*$/i }).filter({ visible: true }).first();
  if (await visibleSoon(card, 15_000)) await card.click({ timeout: 5_000 }).catch(() => {});
  if (await ready(30_000)) return;
  const onApp = await L.firstPanel.isVisible().catch(() => false);
  throw new Error(
    onApp
      ? `the page opened a student list, but it is not the Social Skills app — last page: ${safeUrl(tt.url())}`
      : `Social Skills never showed its student list — last page: ${safeUrl(tt.url())}`
  );
}

// Teacher Home → the learner's panel → "Login as Student". True once the
// student view is up; false when no student in the list matches `name`.
// `label` (the pseudonym) is the only name that ever reaches a message.
async function loginAsSocialSkillsStudent(tt, name, logger, label) {
  const L = socialSkillsLocators(tt);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Only the teacher's student list — never another expansion panel on Home.
  const panels = L.frame.locator('tt-student-list mat-expansion-panel');
  const exactRe = new RegExp(`^\\s*${esc(name.trim()).replace(/\s+/g, '\\s+')}\\s*$`, 'i');
  const exactSet = panels.filter({
    has: L.frame.locator('mat-expansion-panel-header .text-ellipsis').filter({ hasText: exactRe }),
  });
  const containsSet = panels.filter({
    has: L.frame.locator('mat-expansion-panel-header').filter({ hasText: new RegExp(esc(name.trim()), 'i') }),
  });
  // The list can paint its first rows before the rest: wait a few seconds
  // for a match before calling the learner missing.
  let candidates = null;
  const until = Date.now() + 10_000;
  for (;;) {
    const ne = await exactSet.count();
    if (ne > 0) {
      candidates = exactSet;
      if (ne > 1) throw new Error(`more than one student in Social Skills has the display name configured for "${label}"`);
      break;
    }
    const nc = await containsSet.count();
    if (nc === 1) {
      candidates = containsSet;
      logger.event(`WARN no student's name line equals the one configured for "${label}" — using the only name that contains it`);
      break;
    }
    if (nc > 1) {
      throw new Error(`more than one student in Social Skills matches the display name configured for "${label}" — make it the full name`);
    }
    if (Date.now() >= until) return false;
    await sleep(500);
  }
  const panel = candidates.first();
  const header = panel.locator('mat-expansion-panel-header').first();
  const loginBtn = panel.locator('button.clickable').filter({ hasText: /login as student/i }).first();
  if (!(await visibleSoon(loginBtn, 500))) {
    await header.click({ timeout: 5_000 });
  }
  if (!(await visibleSoon(loginBtn, 8_000))) {
    throw new Error(`"Login as Student" did not appear for "${label}"`);
  }
  logger.event(`Selected learner "${label}" in Social Skills`);
  await loginBtn.click({ timeout: 5_000 });
  if (!(await visibleSoon(L.studentView, 30_000))) {
    throw new Error(`the student view did not open for "${label}" after "Login as Student"`);
  }
  // Guard against a neighboring row's button: the student menu names who we
  // are. Unreadable or mismatching means we are in the wrong view — leave it
  // right away rather than idle on another child's account.
  const shown = norm(await L.studentMenu.textContent({ timeout: 5_000 }).catch(() => ''));
  const tokens = norm(name).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const ok = shown && tokens.length && tokens.every((t) => shown.includes(t));
  if (!ok) {
    await logOutOfStudentView(tt).catch(() => false);
    const err = new Error(
      shown
        ? `logged into a different student's view than "${label}" — logged back out`
        : `could not confirm whose student view opened for "${label}" — logged back out`
    );
    err.code = 'WRONG_STUDENT';
    throw err;
  }
  return true;
}

/* -------------------------- student flow --------------------------- */

function menuItem(inner, re) {
  // getByText targets the element that *directly* contains the text — the
  // menu item itself, never a row that merely wraps a hidden menu. Menus may
  // be detached from the row (jQuery appends some to <body>), so search the
  // whole inner frame, visible items only (closed menus keep their text in
  // the DOM).
  return inner.getByText(re).filter({ visible: true }).last();
}

async function findCaretNear(nameEl, label) {
  // The caret (▾) sits at the top right of the student's name. Walk outward
  // from the name element and take the first plausible toggle we can see.
  let scope = nameEl;
  for (let level = 0; level <= 4; level++) {
    for (const sel of CARET_SELECTORS) {
      const cand = scope.locator(sel).first();
      if (await cand.isVisible().catch(() => false)) return cand;
    }
    scope = scope.locator('xpath=..');
  }
  throw new Error(
    `no dropdown caret found near "${label}" — capture the real selector with \`npx playwright codegen\` and add it to CARET_SELECTORS`
  );
}

// After "Login as..", make sure we actually landed in the right student's
// view (guards against clicking a neighboring row's caret). `label` set =
// a pseudonym-only run (the Social Skills button): messages use it and never
// name the student we landed on. The rotation passes none and keeps names.
async function verifyStudentHeader(tt, name, label = null) {
  const frame = getInnerFrame(tt);
  if (!frame) return;
  const txt = await frame.evaluate(() => document.body.innerText).catch(() => '');
  const m = txt.match(/Student:\s*([^\n]+)/i);
  if (!m) return; // header text not found — don't block on cosmetics
  const header = m[1].trim().toLowerCase();
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (tokens.length && !tokens.some((t) => header.includes(t))) {
    throw new Error(
      label == null
        ? `logged into "${m[1].trim()}" but expected "${name}"`
        : `logged into a different student's view than "${label}"`
    );
  }
}

// Dismiss the red "Login unsuccessful." toast. The x's exact selector is
// unverified (the toast can't be reproduced on fresh state), so try common
// close buttons and ALWAYS fall through to waiting for it to hide — a toast
// left visible would spoof the next attempt's outcome race.
async function dismissLoginToast(inner) {
  const candidates = [
    inner.locator('.toast-close-button'),
    inner.locator('[class*="toast"] [class*="close"]'),
    inner.locator('[class*="toast"] button'),
  ];
  for (const c of candidates) {
    try {
      const btn = c.first();
      if (await btn.isVisible()) {
        await btn.click({ timeout: 2_000 });
        break;
      }
    } catch {}
  }
  await inner
    .getByText(/login unsuccessful/i)
    .first()
    .waitFor({ state: 'hidden', timeout: 8_000 })
    .catch(() => {});
}

// Leave a student view through its own Log out, like a person would. Only
// while "My Activities" shows — never a facilitator-level Log out. True only
// when the student view is actually gone afterwards.
async function logOutOfStudentView(tt) {
  if (!tt || tt.isClosed()) return false;
  // The rebuilt Social Skills app: the student menu's Logout, which ends the
  // TeachTown session (lands on Login.aspx). Checked first; it is the only
  // student view that exists there.
  const ss = socialSkillsLocators(tt);
  // Gated on the Social Skills header too, so a lookalike menu elsewhere in
  // the shared app host is never logged out of.
  if ((await visibleSoon(ss.studentMenu, 1_500)) && (await ss.title.isVisible().catch(() => false))) {
    const expanded = (await ss.studentMenu.getAttribute('aria-expanded').catch(() => null)) === 'true';
    if (!expanded) await ss.studentMenu.click({ timeout: 3_000 }).catch(() => {});
    const item = ss.frame
      .locator('.cdk-overlay-container [role=menuitem], .cdk-overlay-container .mat-mdc-menu-item, .cdk-overlay-container button')
      .filter({ hasText: /log ?out/i })
      .first();
    if (!(await visibleSoon(item, 2_000))) {
      await tt.keyboard.press('Escape').catch(() => {});
      return false;
    }
    await item.click({ timeout: 3_000 }).catch(() => {});
    return tt.waitForURL(/Login\.aspx|#\/home/i, { timeout: 10_000 }).then(() => true, () => false);
  }
  const inner = innerLocator(tt);
  const myActivities = inner.getByText('My Activities').first();
  if (!(await visibleSoon(myActivities, 1_500))) return false;
  const logout = inner.getByText(/log ?out/i).first();
  if (!(await visibleSoon(logout, 1_500))) return false;
  await logout.click({ timeout: 3_000 }).catch(() => {});
  const home = await tt.waitForURL(/#\/home/, { timeout: 8_000 }).then(() => true, () => false);
  return home || !(await myActivities.isVisible().catch(() => false));
}

// If a failed/misfired login left us inside a student view, retrying the
// row → caret dance is pointless — reset to the teacher list first.
async function recoverIfStranded(tt, logger) {
  try {
    if (await innerLocator(tt).getByText('My Activities').first().isVisible().catch(() => false)) {
      logger.event('Stranded in a student view mid-retry — resetting to the teacher list');
      await resetSocialSkills(tt, logger);
    }
  } catch {}
}

// Returns true on success, false if the student isn't in the list.
// Throws after 3 failed attempts.
//
// Verified sequence (recon'd on the live app): select the row FIRST and wait
// for its picker_selected class, then open the caret menu, then click
// "Login as..". Clicking "Login as.." on an unselected row can fail with a
// red "Login unsuccessful." toast (kept: the row-select is free and the
// toast is real).
//
// Practice note: keep these as real Playwright clicks. An earlier live test
// blamed "Login unsuccessful" on synthetic (untrusted) clicks; a re-test
// overturned that — the failures correlate with stale module state after
// heavy in-app navigation, which the fresh-load reset in resetSocialSkills
// addresses. Trusted clicks remain the safe default regardless.
//
// `label` (a pseudonym) is how log lines and errors name the student in a
// pseudonym-only run (see verifyStudentHeader); the rotation passes none.
async function loginAsStudent(tt, name, logger, label = null) {
  const tag = label == null ? name : label;
  const inner = innerLocator(tt);
  await inner.getByText('View Students').first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });

  // The roster rows render after the view chrome — give them time before
  // concluding the verified selector has drifted (instant count() here would
  // misroute healthy-but-slow loads to the legacy fallback).
  if (!(await visibleSoon(inner.locator(STUDENT_ROW).first(), 10_000))) {
    logger.event(`WARN student rows (${STUDENT_ROW}) not found — using text-based fallback`);
    return loginAsStudentLegacy(tt, name, logger, label);
  }

  // Row text is exactly the student's name: prefer an exact match (tolerating
  // surrounding whitespace), fall back to substring.
  const exact = new RegExp(`^\\s*${escapeRe(name)}\\s*$`);
  let row = inner.locator(STUDENT_ROW).filter({ hasText: exact }).first();
  let rowFilter = exact;
  if (!(await visibleSoon(row, 8_000))) {
    row = inner.locator(STUDENT_ROW).filter({ hasText: name }).first();
    rowFilter = name;
    if (!(await visibleSoon(row, 2_000))) return false;
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Clear any stale toast first — a leftover would win this attempt's
      // outcome race and spoof a failure.
      if (await inner.getByText(/login unsuccessful/i).first().isVisible().catch(() => false)) {
        await dismissLoginToast(inner);
      }

      // 1. Select the row; wait for the app to mark it picker_selected
      //    (state wait, not a fixed sleep — the menu is timing-sensitive).
      const selectedRow = inner
        .locator(`${STUDENT_ROW}.${ROW_SELECTED_CLASS}`)
        .filter({ hasText: rowFilter })
        .first();
      if (!(await selectedRow.isVisible().catch(() => false))) {
        await row.scrollIntoViewIfNeeded().catch(() => {});
        await row.click({ timeout: 5_000 });
      }
      await selectedRow.waitFor({ state: 'visible', timeout: 10_000 });

      // 2. Open the caret menu (child of the row) unless a previous attempt
      //    left it open already.
      const openItem = inner.locator(LOGIN_AS_ITEM).filter({ visible: true }).first();
      if (!(await openItem.isVisible().catch(() => false))) {
        await row.locator(CONTEXT_BTN).first().click({ timeout: 5_000 });
      }

      // 3. Click the menu item (auto-waits for visibility).
      await inner.locator(LOGIN_AS_ITEM).filter({ visible: true }).first().click({ timeout: 4_000 });

      // 4. Either the student view appears, or the app rejects the login.
      const swapTimeout = attempt === 3 ? NAV_TIMEOUT : 15_000;
      const outcome = await Promise.race([
        inner.getByText('My Activities').first()
          .waitFor({ state: 'visible', timeout: swapTimeout })
          .then(() => 'ok', () => 'timeout'),
        inner.getByText(/login unsuccessful/i).first()
          .waitFor({ state: 'visible', timeout: swapTimeout })
          .then(() => 'toast', () => 'timeout'),
      ]);
      if (outcome === 'toast') {
        await dismissLoginToast(inner);
        throw new Error('app rejected "Login as.." (Login unsuccessful toast)');
      }
      if (outcome === 'timeout') throw new Error('student view ("My Activities") did not appear');
      await verifyStudentHeader(tt, name, label);
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        logger.event(`WARN ${tag} — login-as attempt ${attempt} failed, retrying (${err.message.split('\n')[0]})`);
      }
      await tt.keyboard.press('Escape').catch(() => {});
      await recoverIfStranded(tt, logger); // e.g. wrong-student login — retry needs the teacher list
      await sleep(700);
    }
  }
  throw new Error(`row → caret → "Login as.." failed after 3 attempts for "${tag}": ${lastErr?.message}`);
}

// Pre-recon fallback: text-based row/caret discovery. Only used if
// STUDENT_ROW stops matching after a TeachTown update. Mirrors the verified
// sequence as closely as the unknown DOM allows: click the name (row) first,
// then the caret, then the menu item — and watch for the failure toast.
async function loginAsStudentLegacy(tt, name, logger, label = null) {
  const tag = label == null ? name : label;
  const inner = innerLocator(tt);

  const nameEl = await findFirstVisible(
    [inner.getByText(name, { exact: true }), inner.getByText(name)],
    8_000
  );
  if (!nameEl) return false;

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (await inner.getByText(/login unsuccessful/i).first().isVisible().catch(() => false)) {
        await dismissLoginToast(inner);
      }

      // A previous attempt may have left the menu open — use it directly.
      const already = menuItem(inner, /log ?in as/i);
      if (await already.isVisible().catch(() => false)) {
        await already.click({ timeout: 3_000 });
      } else {
        await nameEl.scrollIntoViewIfNeeded().catch(() => {});
        // Select the row first (click the name), matching the verified flow.
        await nameEl.click({ timeout: 5_000 }).catch(() => {});
        await sleep(500);
        const caret = await findCaretNear(nameEl, tag);
        await caret.click({ timeout: 5_000 });
        // Click the menu item immediately — these jQuery menus close easily.
        await menuItem(inner, /log ?in as/i).click({ timeout: 4_000 });
      }
      const swapTimeout = attempt === 3 ? NAV_TIMEOUT : 15_000;
      const outcome = await Promise.race([
        inner.getByText('My Activities').first()
          .waitFor({ state: 'visible', timeout: swapTimeout })
          .then(() => 'ok', () => 'timeout'),
        inner.getByText(/login unsuccessful/i).first()
          .waitFor({ state: 'visible', timeout: swapTimeout })
          .then(() => 'toast', () => 'timeout'),
      ]);
      if (outcome === 'toast') {
        await dismissLoginToast(inner);
        throw new Error('app rejected "Login as.." (Login unsuccessful toast)');
      }
      if (outcome === 'timeout') throw new Error('student view ("My Activities") did not appear');
      await verifyStudentHeader(tt, name, label);
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        logger.event(`WARN ${tag} — login-as attempt ${attempt} failed, retrying (${err.message.split('\n')[0]})`);
      }
      await tt.keyboard.press('Escape').catch(() => {});
      await recoverIfStranded(tt, logger);
      await sleep(700);
    }
  }
  throw new Error(`caret → "Login as.." failed after 3 attempts for "${tag}": ${lastErr?.message}`);
}

// Parse the student's activity list straight from the app (no shadow
// bookkeeping). Rows are found as the innermost repeating elements that
// contain "Last Score:". Each row is tagged with data-ttrunner-row so we can
// click it later without re-matching by text.
async function parseActivities(tt) {
  const frame = getInnerFrame(tt);
  if (!frame) throw new Error('inner app frame (AppHost/app) not found');
  return await frame.evaluate(() => {
    const textOf = (el) => el.textContent || '';
    const stopRe = /My Activities|Do the Activity|Watch the Movie|Log out|View Students/i;
    // Find the elements that directly contain a *visible* "Last Score:" text
    // node. Walking text nodes (rather than matching textContent) keeps
    // inline scripts / Angular templates that mention "Last Score:" in their
    // source from producing phantom rows.
    const innermost = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.includes('Last Score:')) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest('script,style,template,noscript')) continue;
      if (!parent.getClientRects || parent.getClientRects().length === 0) continue; // not rendered
      innermost.push(parent);
    }
    const out = [];
    const seen = new Set();
    for (const el of innermost) {
      let row = el;
      while (row.parentElement) {
        const p = row.parentElement;
        if ((textOf(p).match(/Last Score:/g) || []).length > 1) break; // p holds many rows
        if (stopRe.test(textOf(p))) break; // climbed into page chrome
        row = p;
      }
      if (seen.has(row)) continue;
      seen.add(row);
      const t = (row.innerText || '').replace(/\r/g, '');
      const beforeScore = t
        .split(/Last Score:/i)[0]
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const name = beforeScore.length ? beforeScore[beforeScore.length - 1] : '';
      if (!name) continue;
      const scoreMatch = t.match(/Last Score:\s*(\d+)\s*%/i);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null; // "no data" → null
      const attempted = (t.match(/Last Attempted:?\s*([^\n]+)/i) || [])[1];
      const idx = out.length;
      try {
        row.setAttribute('data-ttrunner-row', String(idx));
      } catch {}
      out.push({ idx, name, score, lastAttempted: attempted ? attempted.trim() : null });
    }
    return out;
  });
}

// Skip logic ("100% usage"). Score of exactly 100 is the only skip;
// "no data" (null) always runs.
// Build a student's launch sequence from config.playlist. Named targets use
// the same fuzzy match as targetActivity; count-entries take the first N in
// list order (activities also skip anything already at 100% — movies play
// regardless of score). once-entries are skipped after their first run.
function planPlaylist(activities, config) {
  const items = [];
  const skips = [];
  config.playlist.forEach((entry, i) => {
    if (entry.once && state.playlistOnceRun.has(i)) return;
    if (entry.target) {
      const target = norm(entry.target);
      const found =
        activities.find((a) => norm(a.name) === target) ||
        activities.find((a) => norm(a.name).includes(target) || target.includes(norm(a.name)));
      if (!found) {
        skips.push(`playlist: "${entry.target}" not found in list`);
        return;
      }
      if (entry.mode === 'activity' && found.score === 100) {
        skips.push(`playlist: "${found.name}" already at 100%`);
        return;
      }
      items.push({ activity: found, mode: entry.mode, entryIdx: i });
    } else {
      const pool = entry.mode === 'activity' ? activities.filter((a) => a.score !== 100) : activities;
      pool.slice(0, entry.count).forEach((a) => items.push({ activity: a, mode: entry.mode, entryIdx: i }));
    }
  });
  return { items, skips };
}

function pickActivity(activities, config) {
  if (config.targetActivity) {
    const target = norm(config.targetActivity);
    const found =
      activities.find((a) => norm(a.name) === target) ||
      activities.find((a) => norm(a.name).includes(target) || target.includes(norm(a.name)));
    if (!found) return { skip: `target activity "${config.targetActivity}" not found in list` };
    if (found.score === 100) return { skip: `"${found.name}" already at 100%` };
    return { activity: found };
  }
  const found = activities.find((a) => a.score !== 100);
  if (!found) return { skip: 'all activities at 100%' };
  return { activity: found };
}

async function launchActivity(tt, activity, mode, logger) {
  const inner = innerLocator(tt);

  const tagged = inner.locator(`[data-ttrunner-row="${activity.idx}"]`).first();
  if (await tagged.isVisible().catch(() => false)) {
    await tagged.click();
  } else {
    // Angular re-rendered and dropped our tag — fall back to the name text.
    await inner.getByText(activity.name).first().click();
  }

  const btnRe = mode === 'movie' ? /watch the movie/i : /do the activity/i;
  const btn = inner
    .getByRole('button', { name: btnRe })
    .or(inner.getByText(btnRe))
    .first();
  await btn.waitFor({ state: 'visible', timeout: NAV_TIMEOUT });

  if (mode === 'movie') {
    // Instrumented, not assumed: the movie player's surface is unverified.
    // Race popup vs in-frame <video> vs neither, log which one actually
    // happened, and handle both — the first live run documents reality.
    const popupPromise = tt.context().waitForEvent('page', { timeout: 15_000 }).catch(() => null);
    await btn.click();
    const outcome = await new Promise((resolve) => {
      let settled = false;
      const settle = (v) => {
        if (!settled && v) {
          settled = true;
          clearTimeout(noneTimer);
          resolve(v);
        }
      };
      const noneTimer = setTimeout(() => settle({ kind: 'none' }), 16_000);
      popupPromise.then((p) => settle(p ? { kind: 'popup', popup: p } : null));
      inner
        .locator('video')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => settle({ kind: 'inframe' }), () => {});
    });
    logger.event(
      `MOVIE-MODE OBSERVED: ${
        outcome.kind === 'popup'
          ? 'popup player window'
          : outcome.kind === 'inframe'
            ? 'in-frame video player'
            : 'no popup and no in-frame video within 15s'
      }`
    );
    if (outcome.kind === 'none') {
      throw new Error('clicked "Watch the Movie" but saw neither a popup nor an in-frame video within 15s');
    }
    if (outcome.kind === 'popup') {
      state.popup = outcome.popup;
      await outcome.popup.bringToFront().catch(() => {});
    }
    return outcome;
  }

  const popupPromise = tt.context().waitForEvent('page', { timeout: NAV_TIMEOUT }).catch(() => null);
  await btn.click();
  const popup = await popupPromise;
  if (!popup) {
    throw new Error('clicked "Do the Activity!" but no player window opened');
  }
  state.popup = popup;
  await popup.bringToFront().catch(() => {});
  return { kind: 'popup', popup };
}

// The group answers live on the touchscreen — the script only waits.
// Popup players resolve on the window's close event (primary, no timeout);
// in-frame players resolve on the video's `ended` event (or the element
// going away). Both also resolve when the main window's list shows the
// activity's Last Attempted/score changed.
async function waitForCompletion(launch, tt, activity, logger) {
  logger.event('WAITING (activity live)');
  const isPopup = launch.kind === 'popup';

  const primary = isPopup
    ? launch.popup
        .waitForEvent('close', { timeout: 0 })
        .catch(() => {})
        .then(() => 'player closed')
    : innerLocator(tt)
        .locator('video')
        .first()
        .evaluate(
          (v) =>
            v.ended
              ? true
              : new Promise((res) => v.addEventListener('ended', () => res(true), { once: true })),
          undefined,
          { timeout: 0 }
        )
        .then(() => 'video ended', () => 'video gone'); // detached video = player closed

  let raceDone = false;
  const updated = (async () => {
    while (!state.shuttingDown && !raceDone) {
      if (isPopup && launch.popup.isClosed()) break;
      await sleep(10_000);
      try {
        const list = await parseActivities(tt);
        const samePair = list.some(
          (a) =>
            a.name === activity.name &&
            a.lastAttempted === activity.lastAttempted &&
            a.score === activity.score
        );
        const stillListed = list.some((a) => a.name === activity.name);
        // Only treat it as done when the original row is gone/changed —
        // a side panel echoing the same activity must not fool us.
        if (stillListed && !samePair) return 'Last Attempted updated';
      } catch {
        /* frame busy or mid-render — keep waiting */
      }
    }
    return 'player closed';
  })();

  const how = await Promise.race([primary, updated]);
  raceDone = true;
  if (isPopup && !launch.popup.isClosed()) await launch.popup.close().catch(() => {});
  state.popup = null;
  return how;
}

/* ---------------------------- main loop ---------------------------- */

async function runStudent(tt, name, config, dryRun, logger) {
  const result = {
    student: name,
    status: 'ERROR',
    reason: null,
    activities: [],
    wouldRun: null,
    launched: false,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const found = await loginAsStudent(tt, name, logger);
      if (!found) {
        logger.event(`SKIP ${name} — not found in View Students list`);
        result.status = 'NOT FOUND';
        result.reason = 'not found in View Students list';
        return result;
      }
      logger.event(`LOGIN ${name}`);

      const activities = await parseActivities(tt);
      result.activities = activities;
      if (!activities.length) throw new Error('activity list parsed empty');

      if (config.playlist.length) {
        const { items, skips } = planPlaylist(activities, config);
        for (const s of skips) logger.event(`SKIP ${name} — ${s}`);
        const label = items.map((it) => `${it.activity.name} (${it.mode})`).join(' → ');
        if (!items.length) {
          result.status = 'SKIP';
          result.reason = skips.join('; ') || 'playlist produced nothing to run';
        } else if (dryRun) {
          result.status = 'READY';
          result.wouldRun = label;
          // The preview must consume once-entries exactly like the live run,
          // or every student's row shows the group movies they won't get.
          items.forEach((it) => state.playlistOnceRun.add(it.entryIdx));
        } else {
          for (const it of items) {
            // Re-find the row fresh each launch — the list re-renders after
            // every completion and stale row tags would miss.
            const fresh = (await parseActivities(tt).catch(() => null)) || activities;
            const row = fresh.find((a) => a.name === it.activity.name) || it.activity;
            const launch = await launchActivity(tt, row, it.mode, logger);
            logger.event(`START ${row.name}${it.mode === 'movie' ? ' (movie)' : ''}`);
            const how = await waitForCompletion(launch, tt, row, logger);
            if (state.shuttingDown) return result;
            logger.event(`DONE (${how})`);
            state.playlistOnceRun.add(it.entryIdx);
            result.launched = true;
          }
          result.status = 'RAN';
          result.wouldRun = label;
        }
      } else {
        const pick = pickActivity(activities, config);
        if (pick.skip) {
          logger.event(`SKIP ${name} — ${pick.skip}`);
          result.status = 'SKIP';
          result.reason = pick.skip;
        } else if (dryRun) {
          result.status = 'READY';
          result.wouldRun = pick.activity.name;
        } else {
          const launch = await launchActivity(tt, pick.activity, config.mode, logger);
          logger.event(`START ${pick.activity.name}`);
          const how = await waitForCompletion(launch, tt, pick.activity, logger);
          if (state.shuttingDown) return result;
          logger.event(`DONE (${how})`);
          result.status = 'RAN';
          result.wouldRun = pick.activity.name;
          result.launched = true;
        }
      }

      // Verified rotation reset: direct #/apps/ssms load → fresh teacher list.
      await resetSocialSkills(tt, logger);
      logger.event('NEXT');
      return result;
    } catch (err) {
      if (state.shuttingDown) return result;
      logger.event(`WARN ${name} — ${err.message.split('\n')[0]}`);
      await screenshot(tt, `student-attempt${attempt}`);
      result.reason = err.message.split('\n')[0];
      if (attempt < 2) {
        logger.event('Recovering: resetting to the student list');
        try {
          await resetSocialSkills(tt, logger);
        } catch (recErr) {
          logger.event(`Recovery failed: ${recErr.message.split('\n')[0]}`);
          throw err; // can't get back to a known state — bail out to main
        }
      } else {
        logger.event(`ERROR ${name} — giving up after retries; moving to next student`);
        await resetSocialSkills(tt, logger).catch(() => {});
      }
    }
  }
  return result;
}

/* ---------------------- enCORE (Teacher-Led) ----------------------- */
//
// Verified flow (live-clicked 2026-07-17): hub → enCORE card → Login.aspx
// ("Login with Clever") → Clever OAuth (district button) → role picker
// ("Log in as a teacher") → enCORE home → Start a Session → Teacher-Led
// "Get started" → student/group setup → Begin Session.
// Routing (RESOLVED): the OAuth return lands on the ACCOUNT-DEFAULT app
// regardless of which enCORE card was clicked; a direct hash goto then works
// for any entitled app (the classroom app is enCORE Elementary, #/apps/encr),
// while unknown hashes bounce back silently. So the runner enforces
// config teacherLed.encoreAppHash after auth and warns on CONTENT mismatch
// (app header), not navigation failure.

// Known app headers per hash, for the content-mismatch check.
const ENCORE_APP_LABELS = {
  '#/apps/encr': /encore elementary/i,
  '#/apps/enms': /encore middle school/i,
};

// Best-effort close button near a text anchor (banner X, quick-tip x).
async function closeNear(frame, textRe) {
  try {
    const anchor = frame.getByText(textRe).first();
    if (!(await anchor.isVisible().catch(() => false))) return;
    let scope = anchor;
    for (let up = 0; up <= 4; up++) {
      for (const cand of [
        scope.locator('[class*="close"]').first(),
        scope.locator('[aria-label*="close" i]').first(),
        scope.getByText(/^[x×✕]$/i).first(),
      ]) {
        if (await cand.isVisible().catch(() => false)) {
          await cand.click({ timeout: 2_000 }).catch(() => {});
          return;
        }
      }
      scope = scope.locator('xpath=..');
    }
  } catch {}
}

// enCORE greets you with onboarding chrome. Clear it in the recon'd order:
// "Customize Your Curriculum" modal → Not now; gold banner → its X;
// "Quick tip" card → its x. Best-effort; run after every enCORE navigation.
async function dismissOnboarding(tt, logger) {
  const frame = encoreLocator(tt);
  for (let pass = 0; pass < 2; pass++) {
    try {
      if (await frame.getByText(/customize your curriculum/i).first().isVisible()) {
        const notNow = frame
          .getByRole('button', { name: /not now/i })
          .or(frame.getByText(/not now/i))
          .first();
        if (await notNow.isVisible().catch(() => false)) {
          await notNow.click({ timeout: 3_000 }).catch(() => {});
          await sleep(400);
        }
      }
    } catch {}
    await closeNear(frame, /customize your curriculum experience/i);
    await closeNear(frame, /quick tip/i);
  }
}

// From the hub, enter enCORE and ride its auth chain. Every hop is
// click-if-present / skip-if-absent — a cookied session skips them all.
// Never touches the Login.aspx username/password fields.
async function enterEncore(tt, config, logger) {
  const wantHash = config.teacherLed.encoreAppHash || '#/apps/encr';
  // The app's own hash is the reliable entry (confirmed live) — the AppHost
  // runs its auth on load no matter how you arrive, and the OAuth return
  // uses the account default app regardless of which card was clicked. The
  // hub shows THREE enCORE cards plus favorite-star buttons, so a text
  // click is ambiguous; it's the fallback only if the hash bounces.
  await tt.goto(state.ttNavBase + wantHash, { timeout: NAV_TIMEOUT }).catch(() => {});
  await sleep(1500);
  if (/#\/home/.test(tt.url())) {
    logger.event(`${wantHash} bounced back to the hub — trying the enCORE card instead.`);
    const card = tt.getByText(/enCORE/i).filter({ visible: true }).first(); // hidden menu copies come first
    if (await visibleSoon(card, 10_000)) await card.click().catch(() => {});
  }

  const tracker = makeHopTracker(tt, 'encore');
  const heartbeat = makeHeartbeat(logger);
  const ssoRe = ssoCandidatesRe(config);
  let deadline = Date.now() + NAV_TIMEOUT * 2;
  let manualUntil = 0;
  let lastAuthSeen = 0; // last poll that saw a sign-in page
  let ssoClicks = 0; // shared cap across Login-with-Clever + district/generic buttons
  let kmsiClicks = 0;
  let autoSubmits = 0;
  let autoBlocked = false;
  let steered = 0;
  let succeeded = false;
  let disposeEnter = null;
  let nudge = false;
  const manualActive = () => manualUntil && Date.now() <= manualUntil && Date.now() <= lastAuthSeen + 45_000;
  // Shared manual-sign-in handling: announce once, then keep polling — the
  // chain resumes on its own when the human finishes. Enter = force-recheck.
  // Browser-filled form → press its button, before any banner is shown.
  const tryAuto = async () => {
    if (!config.autoSubmitPrefilledLogin || manualUntil || autoBlocked || autoSubmits >= 3) return false;
    const r = await submitPrefilledLogin(tt, logger);
    if (r === 'error') autoBlocked = true;
    if (r !== 'submitted') return false;
    autoSubmits += 1;
    tracker.progress();
    deadline = Math.max(deadline, Date.now() + 60_000);
    return true;
  };
  const manualPoll = async (shotLabel) => {
    lastAuthSeen = Date.now();
    tracker.progress(); // recognized page — never the unknown-stop mid-sign-in
    if (!manualUntil) {
      if (state.reconMode) await reconShot(tt, shotLabel);
      announceManualSignIn(logger);
      manualUntil = Date.now() + MANUAL_SIGNIN_TIMEOUT;
      deadline = Math.max(deadline, manualUntil + 10_000);
      disposeEnter = armEnterFallback(() => {
        nudge = true;
      });
    }
    await sleep(750);
  };

  try {
  while (Date.now() < deadline) {
    if (state.shuttingDown) throw new Error('interrupted');
    await tracker.tick();
    if (nudge) {
      nudge = false;
      tracker.progress();
    }

    // Success: the enCORE app frame is up (its top nav always shows Start a Session).
    if (await encoreLocator(tt).getByText(/start a session/i).first().isVisible().catch(() => false)) {
      succeeded = true;
      break;
    }

    // Direct mode: ANY visible credential form hands off to the human —
    // URL-agnostic, like the sibling direct chain (where the tenant's form
    // actually lives is not pinned to Login.aspx).
    if (config.loginMode === 'direct' && (await credentialFormVisible(tt))) {
      if (await tryAuto()) continue;
      await manualPoll('encore-login-form');
      continue;
    }

    // teachtown.com/Login.aspx: in clever mode click "Login with Clever"
    // (never the credential form).
    if (/login\.aspx/i.test(tt.url()) && config.loginMode !== 'direct') {
      if (ssoClicks < 3) {
        const btn = tt
          .getByRole('button', { name: /login with clever/i })
          .or(tt.getByRole('link', { name: /login with clever/i }))
          .or(tt.getByText(/login with clever/i))
          .first();
        if (await btn.isVisible().catch(() => false)) {
          if (state.reconMode) await reconShot(tt, 'encore-before-clever-click');
          ssoClicks += 1;
          await btn.click().catch(() => {});
          logger.event('SSO hop: clicked "Login with Clever"');
          tracker.progress();
          await sleep(1200);
          continue;
        }
      }
    }

    // Microsoft wants a human (credential form / account picker / MFA) —
    // checked BEFORE any generic button matching so a credential form's
    // "Sign in" submit can never be clicked by the matcher below.
    if (await microsoftWantsInput(tt)) {
      if (await tryAuto()) continue;
      await manualPoll('encore-ms-login-form');
      continue;
    }

    // "Stay signed in?" — clicking Yes is what makes the profile durable.
    // Checked AFTER the credential branches and capped (see clever chain).
    try {
      if (kmsiClicks < 3 && (await tt.getByText(/stay signed in\?/i).first().isVisible())) {
        kmsiClicks += 1;
        await tt
          .getByRole('button', { name: /^yes$/i })
          .or(tt.locator('input[type="submit"][value="Yes"]'))
          .first()
          .click({ timeout: 2000 });
        logger.event('Answered "Stay signed in?" → Yes (keeps future runs zero-touch).');
        tracker.progress();
        deadline = Math.max(deadline, Date.now() + 60_000);
        await sleep(1000);
        continue;
      }
    } catch {
      logger.event('WARN could not click Yes on "Stay signed in?" — will stop and report if the page stays stuck.');
    }

    // Role picker ("Select user") → teacher.
    const teacherRole = tt.getByText(/log ?in as a teacher/i).first();
    if (await teacherRole.isVisible().catch(() => false)) {
      if (state.reconMode) await reconShot(tt, 'encore-before-role-click');
      await teacherRole.click().catch(() => {});
      logger.event('SSO hop: clicked "Log in as a teacher"');
      tracker.progress();
      deadline = Math.max(deadline, Date.now() + 60_000);
      await sleep(1200);
      continue;
    }

    // OAuth provider page → district sign-in button: profile candidates
    // first, then generic. Capped and gated like the portal chain — the
    // generic matcher fires only on real clever hostnames, so an unknown
    // provider's buttons are never blind-clicked (that would also keep
    // resetting the stall clock and make the unrecognized-page stop
    // unreachable on exactly the pages it exists for).
    if (ssoClicks < 3 && !/\/nav\/|login\.aspx/i.test(tt.url())) {
      let btn = null;
      if (ssoRe) {
        const cand = tt.getByRole('button', { name: ssoRe }).or(tt.getByRole('link', { name: ssoRe })).first();
        if (await cand.isVisible().catch(() => false)) btn = cand;
      }
      if (!btn && /clever/i.test(hostnameOf(tt.url()))) {
        const gen = tt
          .getByRole('button', { name: /sign ?in|log ?in with/i })
          .or(tt.getByRole('link', { name: /sign ?in|log ?in with/i }))
          .first();
        if (await gen.isVisible().catch(() => false)) btn = gen;
      }
      if (btn) {
        const label = ((await btn.textContent().catch(() => '')) || 'sign-in button').trim();
        if (state.reconMode) await reconShot(tt, 'encore-before-sso-click');
        ssoClicks += 1;
        await btn.click().catch(() => {});
        logger.event(`SSO hop: clicked "${label}"`);
        tracker.progress();
        deadline = Math.max(deadline, Date.now() + 60_000);
        await sleep(1200);
        continue;
      }
    }

    // After a mid-chain sign-in the OAuth return can land on the hub or the
    // account-default app instead of the configured one — steer so the
    // success check becomes reachable inside the loop (the post-loop steer
    // only runs after the deadline).
    if (
      manualUntil &&
      steered < 2 &&
      onOwnApp(tt) &&
      !tt.url().includes(wantHash) &&
      tracker.stalledFor() > 3_000
    ) {
      steered += 1;
      await tt.goto(state.ttNavBase + wantHash, { timeout: NAV_TIMEOUT }).catch(() => {});
      tracker.progress();
      deadline = Math.max(deadline, Date.now() + 60_000);
      await sleep(1000);
      continue;
    }

    // Mode-independent stop on a page with nothing recognizable (the runner's
    // own slow-booting app is exempt — the outer deadline governs it, a
    // human mid-sign-in is never "unrecognized", and a known IdP host mid-MFA
    // can sit static for minutes).
    if (!onOwnApp(tt) && !onKnownIdpHost(tt) && !manualActive() && tracker.stalledFor() > 20_000) {
      await unknownAuthStop(tt, 'enCORE auth chain');
    }
    if (!manualActive()) await heartbeat(tt, 'the enCORE app (Start a Session)');
    await sleep(750);
  }
  } finally {
    if (disposeEnter) disposeEnter();
  }

  // A manual window was open and the app never became ready: say so plainly
  // instead of navigating away under a possibly-still-typing human and dying
  // later on a generic Playwright timeout. (Without a manual window the old
  // fall-through below stays — the post-loop steer gives a slow boot one
  // more chance under its own 60s wait.)
  if (!succeeded && manualUntil && Date.now() > manualUntil) {
    throw new ManualSignInTimeoutError(
      'SIGN-IN WINDOW EXPIRED — enCORE never became ready within the 5-minute manual sign-in window (a sign-in form may still be open in the browser). Nothing was typed by the runner.'
    );
  }

  // Land on the configured enCORE app (the OAuth return uses the account
  // default; a direct hash goto reaches any entitled app).
  if (!tt.url().includes(wantHash)) {
    await tt.goto(state.ttNavBase + wantHash, { timeout: NAV_TIMEOUT }).catch(() => {});
  }
  await encoreLocator(tt)
    .getByText(/start a session/i)
    .first()
    .waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  if (!tt.url().includes(wantHash)) {
    logger.event(
      `WARN enCORE landed at "${tt.url().split('#')[1] || tt.url()}" instead of ${wantHash} — an unknown hash bounces back to the current app; check encoreAppHash`
    );
  }
  // Unknown hashes bounce silently, so verify by content: the app header
  // should match the configured app (e.g. "enCORE Elementary" for encr).
  const appLabel = ENCORE_APP_LABELS[wantHash];
  if (appLabel && !(await visibleSoon(encoreLocator(tt).getByText(appLabel).first(), 5_000))) {
    logger.event(
      `WARN enCORE header doesn't look like ${wantHash} (expected ${appLabel}) — landed at "${tt.url().split('#')[1] || tt.url()}"`
    );
  }
  await dismissOnboarding(tt, logger);
}

// Slider mechanics are an open item. Native range inputs are handled
// (track-click + arrow-key nudge to the exact value); custom [role=slider]
// widgets get a best-effort drag. Failure never blocks the session.
async function setSessionLength(tt, target, logger) {
  try {
    const frame = encoreLocator(tt);
    const range = frame.locator('input[type="range"]').first();
    if (await range.isVisible().catch(() => false)) {
      const meta = await range.evaluate((el) => ({
        min: +el.min || 0,
        max: +el.max || 100,
        value: +el.value,
      }));
      if (meta.value !== target) {
        const box = await range.boundingBox();
        if (box) {
          const frac = Math.min(1, Math.max(0, (target - meta.min) / (meta.max - meta.min)));
          await tt.mouse.click(box.x + frac * box.width, box.y + box.height / 2);
        }
        for (let i = 0; i < 30; i++) {
          const v = await range.evaluate((el) => +el.value);
          if (v === target) break;
          await range.press(v < target ? 'ArrowRight' : 'ArrowLeft');
        }
      }
      const finalV = await range.evaluate((el) => +el.value);
      logger.event(`Session length: ${finalV} min${finalV === target ? '' : ` (wanted ${target})`}`);
      return;
    }
    const slider = frame.locator('[role="slider"]').first();
    if (await slider.isVisible().catch(() => false)) {
      const vmin = +((await slider.getAttribute('aria-valuemin')) || 0);
      const vmax = +((await slider.getAttribute('aria-valuemax')) || 60);
      const track = slider.locator('xpath=..');
      const box = (await track.boundingBox()) || (await slider.boundingBox());
      const thumb = await slider.boundingBox();
      if (box && thumb) {
        const frac = Math.min(1, Math.max(0, (target - vmin) / (vmax - vmin)));
        await tt.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await tt.mouse.down();
        await tt.mouse.move(box.x + frac * box.width, thumb.y + thumb.height / 2, { steps: 10 });
        await tt.mouse.up();
        const nowV = await slider.getAttribute('aria-valuenow');
        logger.event(`Session length: ${nowV ?? '?'} min (custom slider, best effort)`);
        return;
      }
    }
    logger.event('WARN no session-length slider found — leaving the default');
  } catch (err) {
    logger.event(`WARN could not set session length (${err.message.split('\n')[0]}) — leaving the default`);
  }
}

// Start a Session → the "Select a format" screen.
async function openSessionFormat(tt, logger) {
  const frame = encoreLocator(tt);
  await frame
    .getByRole('button', { name: /start a session/i })
    .or(frame.getByText(/start a session/i))
    .first()
    .click({ timeout: NAV_TIMEOUT });
  await frame.getByText(/select a format/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await dismissOnboarding(tt, logger);
}

// "Get started" under a specific format card. fallbackNth = the card's
// position on the screen (Teacher-Led first, Student-Led second) if scoping
// to the card fails.
async function clickGetStarted(tt, formatRe, fallbackNth, label, logger) {
  const frame = encoreLocator(tt);
  const card = frame
    .locator('div, section, article')
    .filter({ hasText: formatRe })
    .filter({ has: frame.getByRole('button', { name: /get started/i }) })
    .last();
  try {
    await card.getByRole('button', { name: /get started/i }).first().click({ timeout: 10_000 });
  } catch {
    logger.event(`WARN could not scope "Get started" to the ${label} card — using position ${fallbackNth + 1}`);
    await frame.getByRole('button', { name: /get started/i }).nth(fallbackNth).click({ timeout: 10_000 });
  }
}

// Start a Session → Teacher-Led → add group/students → set length → stop at
// Begin Session (autoBegin clicks it — that creates a REAL logged session).
async function teacherLedSetup(tt, tl, dryRun, logger) {
  const frame = encoreLocator(tt);

  await openSessionFormat(tt, logger);
  await clickGetStarted(tt, /teacher-led/i, 0, 'Teacher-Led', logger);
  await frame
    .getByText(/select one or more students/i)
    .first()
    .waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await dismissOnboarding(tt, logger);

  // Group takes precedence (validated at config load).
  if (tl.group) {
    await frame.getByText(/my groups/i).first().click({ timeout: 10_000 });
    await frame.getByText(tl.group).first().click({ timeout: 10_000 });
    logger.event(`Added group "${tl.group}"`);
  } else {
    const tab = frame.getByText(/my students/i).first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ timeout: 5_000 }).catch(() => {});
    for (const name of tl.students) {
      try {
        await frame.getByText(name).first().click({ timeout: 10_000 });
        logger.event(`Added ${name}`);
      } catch (err) {
        logger.event(`WARN could not add ${name} — ${err.message.split('\n')[0]}`);
      }
    }
  }

  if (tl.sessionLengthMin && tl.sessionLengthMin !== 15) {
    await setSessionLength(tt, tl.sessionLengthMin, logger);
  }

  const begin = frame
    .getByRole('button', { name: /begin session/i })
    .or(frame.getByText(/begin session/i))
    .first();
  await begin.waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  if (!(await waitForEnabled(begin, 15_000))) {
    logger.event('WARN Begin Session still looks disabled — check the student list on screen');
  }

  if (tl.autoBegin && !dryRun) {
    await begin.click({ timeout: 10_000 });
    logger.event('BEGIN SESSION clicked — teacher-led session is live (this is a real logged session)');
  } else {
    logger.event('READY — press Begin Session on screen');
  }
  logger.event('Idling — the session is in your hands (Ctrl+C here or close the browser when done)');
  await new Promise(() => {}); // hold the screen; Ctrl+C / window close end the run
}

async function runTeacherLed(tt, config, dryRun, logger) {
  logger.event('TEACHER-LED — entering enCORE');
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await enterEncore(tt, config, logger);
      noteProfileAuthenticated(logger);
      await teacherLedSetup(tt, config.teacherLed, dryRun, logger);
      return; // unreachable (setup idles) — kept for shape
    } catch (err) {
      if (state.shuttingDown) return;
      if (err instanceof ReconStopError) throw err; // retrying an unrecognized-page stop just repeats it
      if (err instanceof ManualSignInTimeoutError) throw err; // retrying would silently open a second 5-min window
      logger.event(`WARN teacher-led — ${err.message.split('\n')[0]}`);
      await screenshot(tt, `teacherled-attempt${attempt}`);
      if (attempt >= 2) throw err;
      // Recovery reset: hub → re-enter enCORE (cookied SSO skips the hops).
      // enterEncore starts from the hub, so looping is the reset. Never back.
      logger.event('Recovering: hub → re-enter enCORE');
    }
  }
}

/* ---------------------------- student-led ---------------------------- */

// Step 2b — ONLY the requested subject stays checked. Read → plan → click
// → re-read; the result is verified before anyone is told READY. A failed
// check throws in a dry run and otherwise idles with the screen handed over.
async function leaveOnlySubjectChecked(tt, frame, sl, subjectLabel, dryRun, logger) {
  const before = await subjects.readCheckboxes(frame);
  logger.event(`SUBJECTS before: ${subjects.describeSubjectState(before)}`);
  const result = await subjects.selectOnlySubject(frame, sl.subject, { log: (m) => logger.event(m) });
  logger.event(`SUBJECTS after:  ${subjects.describeSubjectState(result.boxes)}`);
  if (!result.ok) {
    await screenshot(tt, `studentled-subjects-${sl.subject}`);
    const why =
      result.plan.target == null
        ? `no "${subjectLabel}" checkbox was recognized on this screen`
        : `the boxes did not settle to only "${subjectLabel}" after ${result.attempts} attempt(s)`;
    if (dryRun) {
      throw new Error(`SUBJECT CHECK FAILED — ${why}. Nothing was started. See the screenshot in logs/.`);
    }
    logger.event(`SUBJECT CHECK FAILED — ${why}.`);
    logger.event('STOPPED before Next — fix the subject boxes on screen yourself, then continue by hand. Nothing was started.');
    logger.event('Idling — Ctrl+C here (or STOP in the UI) closes the browser.');
    await new Promise(() => {});
  }
  logger.event(`SUBJECTS OK — only ${subjectLabel} is checked for "${sl.learnerPseudonym}"`);
}

// Student-Led wizard: 1) Select Student → 2) lesson picker (subject
// checkboxes + lesson-source radios + lesson checklist) → 3) Prepare
// Session (never entered by the July 2026 recon; assumed confirm-and-launch).
//
// Step 1 → 2 is tenant-shaped. July recon clicked an explicit Next. On
// SLZUSD (2026-09) the learner click itself opens "Select lessons for …'s
// Student-Led Session" and step 1 has no Next. The stepper header still
// says "Select Session Mode" on every step, so that title is not a step
// detector — lib/student-led.js waits for the lesson-picker copy, and only
// clicks Next when that copy does not show up.
//
// This automates what Carlos does by hand after Start Session: pick the one
// learner, then uncheck every subject except the one being taught. It stops
// on step 2 with the boxes verified, presses Next (studentLed.pressNext, on by
// default), and READYs on step 3 — the human presses only Start Session.
// studentLed.autoBegin:true additionally presses the step-3 launch button, best effort on an unverified screen. Between-question
// navigation only: nothing here ever touches a lesson.
//
// `--subject default` (subjects.DEFAULT_SETTINGS) is for a learner who
// doesn't work by subject: the same walk, but step 2 is left exactly as
// enCORE sets it up — no lesson-source click, no subject box — and READY.
async function studentLedSetup(tt, sl, dryRun, logger) {
  const frame = encoreLocator(tt);
  const who = sl.learnerPseudonym; // never the display name — logs and the UI show the pseudonym
  const subjectLabel = subjects.studentLedLabel(sl.subject);
  const asIs = sl.subject === subjects.DEFAULT_SETTINGS;

  await openSessionFormat(tt, logger);
  await clickGetStarted(tt, /student-led/i, 1, 'Student-Led', logger);
  await frame.getByText(/select student/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await dismissOnboarding(tt, logger);

  // Step 1 — exactly one learner. The row is matched on the display name
  // from config.json; only the pseudonym is ever logged.
  const tab = frame.getByText(/my students/i).first();
  if (await tab.isVisible().catch(() => false)) await tab.click({ timeout: 5_000 }).catch(() => {});
  const row = frame.getByText(sl.studentName, { exact: true }).or(frame.getByText(sl.studentName)).first();
  if (!(await visibleSoon(row, 10_000))) {
    await screenshot(tt, 'studentled-no-learner');
    throw new Error(
      `Student-Led step 1: the display name configured for "${who}" is not in the student list — ` +
        'check studentLed.learners in config.json against what enCORE shows (npm start -- --recon-roster lists it).'
    );
  }
  await row.click({ timeout: 5_000 });
  logger.event(`Selected learner "${who}"`);

  // Step 1 → 2. The stepper header shows "Select Session Mode" on EVERY step,
  // so step 2 is recognized by its own content (the "Select lessons for …"
  // title / lesson-source radios), never by the stepper label. Live SLZUSD
  // (2026-09-23) opens step 2 on the learner click itself — there is no Next
  // on step 1; the July recon saw one. Check for step 2 first so a forward
  // button on step 2 is never mistaken for step 1's Next.
  await advanceStudentLedToStep2(frame, {
    log: (m) => logger.event(m),
    nextTimeout: NAV_TIMEOUT,
    step2Timeout: NAV_TIMEOUT,
  });
  await dismissOnboarding(tt, logger);
  if (state.reconMode) await reconShot(tt, 'student-led-step2-before');

  // Default settings: nothing on step 2 is clicked. The boxes are logged as
  // found, for the record.
  if (asIs) {
    const found = await subjects.readCheckboxes(frame).catch(() => []);
    logger.event(`SUBJECTS as found: ${subjects.describeSubjectState(found)} — default settings, nothing clicked`);
  }

  // Step 2a — lesson source. The app defaults to Recommended; anything else
  // is a click on the radio's label, best effort.
  if (!asIs && sl.lessonSource !== 'recommended') {
    const radio = frame.getByText(LESSON_SOURCES[sl.lessonSource]).first();
    if (await visibleSoon(radio, 5_000)) {
      await radio.click({ timeout: 5_000 }).catch(() => {});
      logger.event(`Lesson source: ${sl.lessonSource}`);
      await sleep(500);
    } else {
      logger.event(`WARN lesson source "${sl.lessonSource}" not found on step 2 — leaving the app default`);
    }
  }

  if (!asIs) await leaveOnlySubjectChecked(tt, frame, sl, subjectLabel, dryRun, logger);

  if (dryRun) {
    logger.event(
      `STUDENT-LED DRY RUN COMPLETE — ${subjectLabel} for "${who}" ${asIs ? 'reached' : 'verified on'} step 2; backing out, nothing started.`
    );
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
    return;
  }

  if (!sl.autoBegin) {
    // Press Next, so the one thing left for a human is Start Session. Fails
    // soft into the old "press Next yourself" READY — never presses Start.
    let advanced = null;
    if (sl.pressNext) {
      try {
        advanced = await advanceStudentLedToStep3(frame, { log: (m) => logger.event(m) });
      } catch (err) {
        if (state.shuttingDown) return;
        logger.event(`WARN could not press Next (${err.message.split('\n')[0]}) — press it on screen`);
      }
      if (advanced && !advanced.pressed) logger.event(`WARN Next not pressed — ${advanced.reason}; press it on screen`);
    }
    if (advanced && advanced.pressed) {
      await dismissOnboarding(tt, logger);
      logger.event(
        advanced.step3 === 'confirmed'
          ? `READY — ${subjectLabel} for "${who}". Next was pressed; only Start Session is left — press it on screen when the group is ready.`
          : `READY — ${subjectLabel} for "${who}". Next was pressed but the next screen wasn't recognized — check it, then press Start Session.`
      );
    } else {
      logger.event(`READY — ${subjectLabel} for "${who}". Press Next on screen and launch when the group is ready.`);
    }
    logger.event('Idling — the session is in your hands (Ctrl+C here or close the browser when done)');
    await holdForRetarget(); // hold the screen; Ctrl+C / window close end the run
    return;
  }

  // autoBegin — step 3 was never entered by recon; every selector below is a
  // guess that fails soft into READY. The step-2 forward control was
  // "Next" in the July recon; a tenant that labels it differently needs its
  // own pass.
  const next = frame.getByRole('button', { name: /^next$/i }).or(frame.getByText(/^\s*Next\s*$/)).first();
  await next.click({ timeout: 10_000 });
  if (await visibleSoon(frame.getByText(/prepare session/i).first(), 15_000)) {
    await dismissOnboarding(tt, logger);
    const begin = frame
      .getByRole('button', { name: /begin session|start session|launch/i })
      .or(frame.getByText(/begin session|start session|launch session/i))
      .first();
    if ((await visibleSoon(begin, 10_000)) && (await waitForEnabled(begin, 15_000))) {
      await begin.click({ timeout: 10_000 });
      logger.event(`BEGIN clicked — Student-Led ${subjectLabel} session for "${who}" is live (this is a real logged session)`);
    } else {
      logger.event('READY — on Prepare Session; the launch button was not recognized, press it on screen');
    }
  } else {
    logger.event('READY — Next was pressed; finish on screen (Prepare Session did not appear as expected)');
  }
  logger.event('Idling — the session is in your hands (Ctrl+C here or close the browser when done)');
  await holdForRetarget();
}

async function runStudentLed(tt, config, dryRun, logger) {
  const sl = config.studentLed;
  if (socialSkillsApp.usesSocialSkillsApp(sl.subject)) {
    throw new Error('Social Skills is its own app, not an enCORE subject — it must run through runSocialSkillsApp.');
  }
  logger.event(`STUDENT-LED — entering enCORE (${subjects.studentLedLabel(sl.subject)} for "${sl.learnerPseudonym}")`);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await enterEncore(tt, config, logger);
      noteProfileAuthenticated(logger);
      await studentLedSetup(tt, sl, dryRun, logger);
      return; // dry run backs out; live setups idle
    } catch (err) {
      if (state.shuttingDown) return;
      if (err instanceof ReconStopError) throw err;
      if (err instanceof ManualSignInTimeoutError) throw err;
      if (/^SUBJECT CHECK FAILED/.test(err.message)) throw err; // a retry would just re-click the same boxes
      logger.event(`WARN student-led — ${err.message.split('\n')[0]}`);
      await screenshot(tt, `studentled-attempt${attempt}`);
      if (attempt >= 2) throw err;
      logger.event('Recovering: hub → re-enter enCORE');
    }
  }
}

// The Social Skills button: the Social Skills APP, never enCORE — see
// lib/social-skills-app.js. Live: idles at READY on the learner's My
// Activities; dry run: logs them back out and returns.
async function runSocialSkillsApp(tt, config, dryRun, logger) {
  const sl = config.studentLed;
  const who = sl.learnerPseudonym;
  // loginAsStudent was written for the rotation, whose logs carry names. This
  // run is pseudonym-only like the rest of Student-Led, so its lines are
  // scrubbed on the way out.
  const scrubbed = { event: (m) => logger.event(socialSkillsApp.scrubName(m, sl.studentName, who)) };
  // The student Logout ends the TeachTown session; the profile's browser-filled
  // sign-in form (same chain every run starts with) brings it back.
  const reauth = async () => {
    if (config.loginMode !== 'direct') {
      throw new Error('the TeachTown session ended and this district signs in through Clever — click the shortcut again');
    }
    await ensureTeachTownDirect(tt, config, scrubbed);
  };
  const steps = {
    openApp: () => openSocialSkillsHome(tt, scrubbed, { reauth }),
    loginAs: (name) => loginAsSocialSkillsStudent(tt, name, scrubbed, who),
    logOut: () => logOutOfStudentView(tt),
    hold: () => holdForRetarget(), // Ctrl+C / window close end the run
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await socialSkillsApp.socialSkillsAppSetup(steps, {
        name: sl.studentName,
        who,
        dryRun,
        log: (m) => logger.event(m),
      });
      return;
    } catch (err) {
      if (state.shuttingDown) return;
      // A retry would read the same list / pick the same wrong row.
      if (err.code === 'LEARNER_NOT_FOUND' || err.code === 'WRONG_STUDENT') throw err;
      logger.event(`WARN social skills — ${err.message.split('\n')[0]}`);
      await screenshot(tt, `socialskills-attempt${attempt}`);
      if (attempt >= 2) throw err;
      logger.event('Recovering: reloading the Social Skills student list');
      await openSocialSkillsHome(tt, scrubbed, { reload: true, reauth }).catch(() => {});
    }
  }
}

/* ------------------------------ recon ------------------------------- */

function getEncoreFrame(tt) {
  return tt.frames().find((f) => f.url().toLowerCase().includes('workgroup/client/apphost/app')) || null;
}

// Best-effort extraction of student rows on the enCORE "My Students" list
// (row DOM unverified live — the screenshot is the authoritative capture).
async function collectEncoreStudents(tt) {
  const frame = getEncoreFrame(tt);
  if (!frame) return [];
  return await frame
    .evaluate(() => {
      const chrome = /^(my students|my groups|students in session|begin session|remove all|session settings|view previous sessions|back|next|session length|select a format|get started)$/i;
      const out = [];
      for (const el of document.querySelectorAll('.stu-row, [class*="student-row"], [class*="stu-"], [class*="list-item"]')) {
        if (!el.getClientRects || el.getClientRects().length === 0) continue;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 60 || chrome.test(t)) continue;
        if (!out.includes(t)) out.push(t);
      }
      return out;
    })
    .catch(() => []);
}

// Three-tier roster diff: exact (name or aka) → substring → name tokens
// (catches "Last, First" / order swaps). Whatever's left is unmatched.
// Tier passes run GLOBALLY (every exact match claims its display name before
// any substring/token match is attempted) so a weaker match for one roster
// entry can never consume a display name another entry matches exactly.
function diffRoster(found, roster) {
  const usedIdx = new Set();
  const nfound = found.map(norm);
  // Split on non-alphanumerics so a "Last, First" display tokens cleanly
  // (e.g. "Doe, Jane" → {doe, jane}) — a comma glued to a word must not
  // defeat the match.
  const tok = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  const rows = roster.map((r) => ({ entry: r, matchedTo: null, tier: null }));

  for (const row of rows) {
    for (const cand of [row.entry.name, ...(row.entry.aka || [])]) {
      const i = nfound.findIndex((f, ix) => !usedIdx.has(ix) && f === norm(cand));
      if (i >= 0) {
        row.matchedTo = found[i];
        row.tier = norm(cand) === norm(row.entry.name) ? 'exact' : 'aka';
        usedIdx.add(i);
        break;
      }
    }
  }
  for (const row of rows) {
    if (row.matchedTo) continue;
    for (const cand of [row.entry.name, ...(row.entry.aka || [])]) {
      const i = nfound.findIndex(
        (f, ix) => !usedIdx.has(ix) && (f.includes(norm(cand)) || norm(cand).includes(f))
      );
      if (i >= 0) {
        row.matchedTo = found[i];
        row.tier = 'substring';
        usedIdx.add(i);
        break;
      }
    }
  }
  for (const row of rows) {
    if (row.matchedTo) continue;
    const rt = tok(row.entry.name + ' ' + (row.entry.aka || []).join(' '));
    const i = nfound.findIndex((f, ix) => {
      if (usedIdx.has(ix)) return false;
      const ft = tok(found[ix]);
      let overlap = 0;
      rt.forEach((t) => {
        if (ft.has(t)) overlap += 1;
      });
      return overlap >= 2;
    });
    if (i >= 0) {
      row.matchedTo = found[i];
      row.tier = 'tokens';
      usedIdx.add(i);
    }
  }
  const extras = found.filter((_, ix) => !usedIdx.has(ix));
  return { rows, extras };
}

function reportDiff(diff, surface, logger, report) {
  report.push(`Roster diff (config roster vs ${surface}):`);
  for (const { entry, matchedTo, tier } of diff.rows) {
    let line;
    if (tier === 'exact') line = `RECON MATCH (exact): "${entry.name}"`;
    else if (tier === 'aka') line = `RECON MATCH (aka): "${entry.name}" ↔ "${matchedTo}"`;
    else if (tier === 'substring') line = `RECON MATCH (substring): "${entry.name}" ↔ "${matchedTo}"`;
    else if (tier === 'tokens') line = `RECON POSSIBLE (name tokens): "${entry.name}" ↔ "${matchedTo}"`;
    else line = `RECON NOT FOUND: "${entry.name}"${entry.expected === false ? ' (expected-maybe — OK)' : ''}`;
    logger.event(line);
    report.push('  ' + line);
  }
  for (const extra of diff.extras) {
    const line = `RECON IN APP, NOT IN CONFIG: "${extra}"`;
    logger.event(line);
    report.push('  ' + line);
  }
  report.push('');
}

// Day-one recon: list every student visible in Social Skills AND enCORE,
// diff against the config roster, write a plain-text report. ZERO clicks on
// any student row.
async function reconRoster(tt, config, logger) {
  const report = [];
  report.push(`TeachTown roster recon — ${ts()}`);
  report.push(`District: ${config.district || '(legacy config)'}`);
  report.push('');

  // --- Social Skills / View Students ---
  await gotoSocialSkills(tt);
  const inner = innerLocator(tt);
  await visibleSoon(inner.locator(STUDENT_ROW).first(), 10_000); // roster rows may render after the chrome
  const ssNames = (await inner.locator(STUDENT_ROW).allTextContents().catch(() => []))
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  await reconShot(tt, 'ss-view-students');
  logger.event(`RECON Social Skills: ${ssNames.length} student(s) found`);
  report.push(`Social Skills / View Students — ${ssNames.length} student(s):`);
  for (const n of ssNames) {
    logger.event(`  SS: ${n}`);
    report.push(`  - ${n}`);
  }
  if (ssNames.length === 0) {
    const msg =
      'Zero students in Social Skills. Most likely district rostering has not synced to TeachTown yet — ' +
      'a timing fact, not a runner bug. Re-run --recon-roster in a few days.';
    logger.event(`RECON ${msg}`);
    report.push('  ' + msg);
  }
  report.push('');

  // --- enCORE / My Students (Teacher-Led setup screen is state-free; we
  //     never go near Begin Session) ---
  let enNames = [];
  try {
    await enterEncore(tt, config, logger);
    await openSessionFormat(tt, logger);
    await clickGetStarted(tt, /teacher-led/i, 0, 'Teacher-Led', logger);
    const frame = encoreLocator(tt);
    await frame.getByText(/select one or more students/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
    await dismissOnboarding(tt, logger);
    const tab = frame.getByText(/my students/i).first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ timeout: 5_000 }).catch(() => {});
    await visibleSoon(frame.locator('.stu-row, [class*="student-row"], [class*="list-item"]').first(), 5_000);
    enNames = await collectEncoreStudents(tt);
    await reconShot(tt, 'encore-my-students');
    logger.event(`RECON enCORE: ${enNames.length} student(s) found`);
    report.push(`enCORE / My Students — ${enNames.length} student(s):`);
    for (const n of enNames) {
      logger.event(`  EN: ${n}`);
      report.push(`  - ${n}`);
    }
    if (enNames.length === 0) {
      const msg = 'Zero students in enCORE My Students (see the screenshot — extraction is best-effort on this screen).';
      logger.event(`RECON ${msg}`);
      report.push('  ' + msg);
    }
    report.push('');
    // Back out without touching Begin Session.
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
  } catch (err) {
    if (err instanceof ReconStopError) throw err; // exit-2 stop must surface, never a one-line footnote
    const msg = `enCORE student list unavailable: ${err.message.split('\n')[0]}`;
    logger.event(`RECON ${msg}`);
    report.push(msg);
    report.push('');
  }

  // --- diff against the config roster ---
  if (config.roster.length) {
    reportDiff(diffRoster(ssNames, config.roster), 'Social Skills', logger, report);
    if (enNames.length || ssNames.length) {
      reportDiff(diffRoster(enNames, config.roster), 'enCORE', logger, report);
    }
  } else {
    report.push('No roster in config.json — nothing to diff (found lists above are still valid).');
    logger.event('RECON no roster configured — skipping the diff');
  }

  const file = writeReconReport(report, 'roster-report');
  logger.event(`RECON report written: ${file}`);
}

// A URL that is safe to write to a log or an error: origin + path + the hash
// route only. Query strings, ';'-parameters and any '=' tail (tokens, return
// URLs, login hints) are cut.
function safeUrl(u) {
  const cut = (s) => String(s).split(/[?;&=]/)[0];
  try {
    const x = new URL(u);
    return x.origin + x.pathname + (x.hash ? cut(x.hash) : '');
  } catch {
    return cut(u);
  }
}

// Outline of the Social Skills app's frame for recon/. Names are masked HERE,
// in the browser, before anything is returned: every text inside the student
// list components is replaced by its length, and any other text containing a
// word that appears in those lists is masked too. The file holds structure and
// UI labels only. Also opens (never selects from) the first row's menu to list
// its item labels, then closes it.
async function outlineSocialSkillsApp(tt, logger, name) {
  const frame = tt.frames().find((f) => /WorkGroup\/Client\/AppHost\/app/i.test(f.url()));
  if (!frame) {
    logger.event('RECON-SS outline: no WorkGroup app frame on the page.');
    return;
  }
  const NAME_ROOTS = ['tt-student-list', 'tt-student-lesson-progress-list', 'tt-lesson-progress-list'];
  const mkRedactor = `
    const NAME_ROOTS = ${JSON.stringify(NAME_ROOTS)};
    const nameTokens = new Set();
    for (const sel of NAME_ROOTS) {
      for (const root of document.querySelectorAll(sel)) {
        for (const e of root.querySelectorAll('*')) {
          if (e.children.length) continue;
          for (const w of (e.textContent || '').toLowerCase().split(/[^\\p{L}\\p{N}]+/u)) if (w.length >= 2) nameTokens.add(w);
        }
      }
    }
    const inNames = (el) => NAME_ROOTS.some((s) => el.closest(s));
    const red = (t, el) => {
      t = String(t || '').replace(/\\s+/g, ' ').trim();
      if (!t) return '';
      if (el && inNames(el)) return '<' + t.length + '>';
      if (!nameTokens.size) return '<' + t.length + '>'; // no names known: fail closed
      for (const w of t.toLowerCase().split(/[^\\p{L}\\p{N}]+/u)) if (nameTokens.has(w)) return '<' + t.length + '>';
      return t.slice(0, 60);
    };
  `;
  const outline = await frame
    .evaluate(`(() => {
      ${mkRedactor}
      const lines = [];
      const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT', 'LINK', 'META']);
      const walk = (el, depth) => {
        if (lines.length >= 700 || depth > 18 || SKIP.has(el.tagName)) return;
        const tag = el.tagName.toLowerCase();
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
        const interesting =
          tag.includes('-') || /^(a|button|input|select|textarea|h1|h2|h3|h4|li|label|nav|header|main)$/.test(tag) ||
          el.hasAttribute('role') || el.hasAttribute('aria-label') || el.hasAttribute('tabindex') || own.trim();
        if (interesting) {
          const cls = [...el.classList].filter((c) => !/^ng-|^cdk-|^mat-mdc-(?!menu|tab|list)/.test(c)).slice(0, 4).join('.');
          const bits = [
            '  '.repeat(Math.min(depth, 14)) + tag + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : ''),
            el.getAttribute('role') ? 'role=' + el.getAttribute('role') : '',
            el.getAttribute('aria-label') ? 'aria-label="' + red(el.getAttribute('aria-label'), el) + '"' : '',
            el.getAttribute('aria-haspopup') ? 'haspopup=' + el.getAttribute('aria-haspopup') : '',
            el.getAttribute('type') ? 'type=' + el.getAttribute('type') : '',
            el.disabled ? 'disabled' : '',
            red(own, el) ? '"' + red(own, el) + '"' : '',
          ].filter(Boolean);
          lines.push(bits.join(' '));
        }
        for (const c of el.children) walk(c, depth + 1);
      };
      walk(document.body, 0);
      return { lines, nameTokens: nameTokens.size };
    })()`)
    .catch((e) => ({ lines: [], error: String(e.message).split('\n')[0] }));
  const file = path.join(RECON_DIR, `social-skills-outline-${Date.now()}.txt`);
  try {
    fs.mkdirSync(RECON_DIR, { recursive: true });
    fs.writeFileSync(file, outline.lines.join('\n') + '\n');
  } catch {}
  logger.event(
    `RECON-SS outline: ${outline.lines.length} line(s), ${outline.nameTokens || 0} name word(s) masked${outline.error ? ', error: ' + outline.error : ''} — ${file}`
  );

  await probeSocialSkillsPanel(tt, frame, name, logger);
}

// Click "Login as Student" in the already-expanded panel and record, names
// masked, what the app does: URL/frames/new tabs and an outline of the student
// view. Then look for the student view's own Log out (never the account-level
// Logout in the navigation shell) and use it. Returns lines for the report.
async function probeSocialSkillsLogin(tt, frame, idx, name) {
  const strip = safeUrl;
  const out = ['--- LOGIN AS STUDENT ---'];
  const tokens = [
    ...(await frame.evaluate(`(() => [...(window.__ttNameTokens || [])])()`).catch(() => [])),
    ...String(name || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2),
  ];
  const HELP = `
    const nameTokens = new Set(${JSON.stringify(tokens)});
    const red = (t) => {
      t = String(t || '').replace(/\\s+/g, ' ').trim();
      if (!t) return '';
      if (!nameTokens.size) return '<' + t.length + '>'; // no names known: fail closed
      for (const w of t.toLowerCase().split(/[^\\p{L}\\p{N}]+/u)) if (nameTokens.has(w)) return '<' + t.length + '>';
      return t.slice(0, 60);
    };
    const outlineOf = (root, cap) => {
      const lines = [];
      const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT']);
      const walk = (el, depth) => {
        if (lines.length >= cap || depth > 16 || SKIP.has(el.tagName)) return;
        const tag = el.tagName.toLowerCase();
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
        const interesting = tag.includes('-') || /^(a|button|input|select|textarea|h1|h2|h3|h4|h5|li|label|nav|img|video|canvas)$/.test(tag) ||
          el.hasAttribute('role') || el.hasAttribute('aria-label') || el.hasAttribute('tabindex') || el.hasAttribute('onclick') || own.trim();
        if (interesting) {
          const cls = [...el.classList].filter((c) => !/^ng-|^cdk-|^mdc-|^mat-mdc-(?!menu)/.test(c)).slice(0, 3).join('.');
          lines.push([
            '  '.repeat(Math.min(depth, 12)) + tag + (el.id ? '#' + red(el.id) : '') + (cls ? '.' + cls : ''),
            el.getAttribute('role') ? 'role=' + el.getAttribute('role') : '',
            el.getAttribute('aria-label') ? 'aria-label="' + red(el.getAttribute('aria-label')) + '"' : '',
            el.getAttribute('title') ? 'title="' + red(el.getAttribute('title')) + '"' : '',
            red(own) ? '"' + red(own) + '"' : '',
          ].filter(Boolean).join(' '));
        }
        for (const c of el.children) walk(c, depth + 1);
      };
      walk(root, 0);
      return lines;
    };
  `;
  const appFrames = () => {
    const res = [];
    for (const p of state.context.pages()) {
      if (p.isClosed()) continue;
      for (const f of p.frames()) {
        if (p === tt && f === p.mainFrame()) continue; // the navigation shell
        if (!f.url() || f.url() === 'about:blank') continue;
        res.push({ page: p, frame: f });
      }
    }
    return res;
  };
  try {
    if (idx >= 0) {
      const btn = frame
        .locator('mat-expansion-panel')
        .nth(idx)
        .locator('button.clickable', { hasText: 'Login as Student' })
        .first();
      if (!(await btn.count())) {
        out.push('no "Login as Student" button in the expanded panel');
        return out;
      }
      await btn.click({ timeout: 4_000 });
      await sleep(6_000);
    } else {
      out.push('(started already inside the student view)');
    }
    out.push(`top=${strip(tt.url())} frames=${JSON.stringify(appFrames().map(({ frame: f }) => strip(f.url())))}`);
    // Log out of the STUDENT view only, through the student menu in the app
    // frame — never the account-level Logout in the navigation shell.
    let clicked = false;
    for (const { frame: f } of appFrames()) {
      const menuBtn = f.locator('button.student-menu-button').first();
      if (!(await menuBtn.isVisible().catch(() => false))) continue;
      await menuBtn.click({ timeout: 4_000 }).catch(() => {});
      await sleep(800);
      const items = await f
        .evaluate(`(() => { ${HELP}; return [...document.querySelectorAll('.cdk-overlay-container [role=menuitem], .cdk-overlay-container .mat-mdc-menu-item, .cdk-overlay-container button')].map((e) => red(e.textContent)).filter(Boolean).slice(0, 15); })()`)
        .catch(() => []);
      out.push(`STUDENT MENU ITEMS (names masked): ${JSON.stringify(items)}`);
      const lo = f
        .locator('.cdk-overlay-container [role=menuitem], .cdk-overlay-container .mat-mdc-menu-item, .cdk-overlay-container button')
        .filter({ hasText: /log ?out|sign ?out/i })
        .first();
      if (await lo.isVisible().catch(() => false)) {
        await lo.click({ timeout: 4_000 }).catch(() => {});
        clicked = true;
        out.push('LOG OUT clicked in the student menu');
      } else {
        await tt.keyboard.press('Escape').catch(() => {});
      }
      break;
    }
    if (!clicked) out.push('LOG OUT: not found in the student menu');
    await sleep(4_000);
    const fr = appFrames().map(({ page, frame: f }) => `${page === tt ? 'tab0' : 'newtab'}:${strip(f.url())}`);
    out.push(`after logout: tabs=${state.context.pages().length} top=${strip(tt.url())} frames=${JSON.stringify(fr)}`);
  } catch (err) {
    out.push(`LOGIN PROBE ERROR: ${String(err.message).split('\n')[0]}`);
  }
  return out;
}

// The new Social Skills Home lists students as expansion panels. Expand only
// the configured learner's panel (read-only toggle), outline it, and list the
// items of the page's actions menu and of the panel's own menu. Name words are
// taken from the COLLAPSED lists first and masked everywhere; the display name
// itself is only ever used to pick the panel, never logged.
async function probeSocialSkillsPanel(tt, frame, name, logger) {
  const PAGE = `
    const nameTokens = window.__ttNameTokens || (window.__ttNameTokens = (() => {
      const s = new Set();
      for (const root of document.querySelectorAll('tt-student-list, tt-student-lesson-progress-list, tt-lesson-progress-list')) {
        for (const e of root.querySelectorAll('*')) {
          if (e.children.length) continue;
          for (const w of (e.textContent || '').toLowerCase().split(/[^\\p{L}\\p{N}]+/u)) if (w.length >= 2) s.add(w);
        }
      }
      return s;
    })());
    const red = (t) => {
      t = String(t || '').replace(/\\s+/g, ' ').trim();
      if (!t) return '';
      if (!nameTokens.size) return '<' + t.length + '>'; // no names known: fail closed
      for (const w of t.toLowerCase().split(/[^\\p{L}\\p{N}]+/u)) if (nameTokens.has(w)) return '<' + t.length + '>';
      return t.slice(0, 60);
    };
    const outlineOf = (root, cap) => {
      const lines = [];
      const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT']);
      const walk = (el, depth) => {
        if (lines.length >= cap || depth > 16 || SKIP.has(el.tagName)) return;
        const tag = el.tagName.toLowerCase();
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
        const interesting = tag.includes('-') || /^(a|button|input|select|textarea|h1|h2|h3|h4|h5|li|label|ul|nav)$/.test(tag) ||
          el.hasAttribute('role') || el.hasAttribute('aria-label') || el.hasAttribute('tabindex') || own.trim();
        if (interesting) {
          const cls = [...el.classList].filter((c) => !/^ng-|^cdk-|^mdc-|^mat-mdc-(?!menu)/.test(c)).slice(0, 4).join('.');
          lines.push([
            '  '.repeat(Math.min(depth, 12)) + tag + (el.id ? '#' + red(el.id) : '') + (cls ? '.' + cls : ''),
            el.getAttribute('role') ? 'role=' + el.getAttribute('role') : '',
            el.getAttribute('aria-label') ? 'aria-label="' + red(el.getAttribute('aria-label')) + '"' : '',
            el.getAttribute('aria-haspopup') ? 'haspopup=' + el.getAttribute('aria-haspopup') : '',
            el.getAttribute('aria-expanded') ? 'expanded=' + el.getAttribute('aria-expanded') : '',
            el.getAttribute('type') ? 'type=' + el.getAttribute('type') : '',
            el.disabled ? 'disabled' : '',
            red(own) ? '"' + red(own) + '"' : '',
          ].filter(Boolean).join(' '));
        }
        for (const c of el.children) walk(c, depth + 1);
      };
      walk(root, 0);
      return lines;
    };
    const menuItems = () => [...document.querySelectorAll('[role=menuitem], .mat-mdc-menu-item, [role=menu] button')]
      .map((e) => red(e.textContent)).filter(Boolean).slice(0, 20);
  `;
  const out = [];
  try {
    // A previous probe may have left the browser inside the student view:
    // log out of it first, through the same path the probe uses.
    if (/independent\/ssms-landing/i.test(frame.url())) {
      out.push(...(await probeSocialSkillsLogin(tt, frame, -1, name)));
      const file0 = path.join(RECON_DIR, `social-skills-panel-${Date.now()}.txt`);
      try {
        fs.writeFileSync(file0, out.join('\n') + '\n');
      } catch {}
      logger.event(`RECON-SS started inside the student view; logout attempt — ${file0}`);
      return;
    }
    // Tokens first, while every panel is collapsed.
    await frame.evaluate(`(() => { ${PAGE}; return nameTokens.size; })()`);

    const kebab = frame.locator('#actions-menu-button');
    if (await kebab.count()) {
      await kebab.click({ timeout: 3_000 });
      await sleep(700);
      const items = await frame.evaluate(`(() => { ${PAGE}; return menuItems(); })()`).catch(() => []);
      out.push(`ACTIONS MENU ITEMS: ${JSON.stringify(items)}`);
      await tt.keyboard.press('Escape').catch(() => {});
      await sleep(400);
    }

    const idx = await frame.evaluate(`(() => {
      ${PAGE}
      const n = ${JSON.stringify(String(name || '').toLowerCase())};
      const hs = [...document.querySelectorAll('tt-student-list mat-expansion-panel-header')];
      if (!hs.length) return -2;
      if (!n) return -3;
      const m = hs.map((h, i) => ((h.textContent || '').toLowerCase().includes(n) ? i : -1)).filter((i) => i >= 0);
      return m.length === 1 ? m[0] : m.length ? -4 : -1;
    })()`);
    out.push(
      `PANELS: header index for the configured learner = ${idx} ` +
        '(-1 none matched, -2 no panels, -3 no name configured, -4 ambiguous — nothing is clicked unless exactly one matches)'
    );
    if (idx >= 0) {
      await frame.locator('mat-expansion-panel-header').nth(idx).click({ timeout: 4_000 });
      await sleep(1_500);
      const lines = await frame
        .evaluate(`(() => { ${PAGE}; return outlineOf(document.querySelectorAll('mat-expansion-panel')[${idx}], 200); })()`)
        .catch(() => []);
      out.push('EXPANDED PANEL OUTLINE:', ...lines);
      const trig = frame.locator('mat-expansion-panel').nth(idx).locator('button[aria-haspopup]').first();
      if (await trig.count()) {
        await trig.click({ timeout: 3_000 }).catch(() => {});
        await sleep(700);
        const items = await frame.evaluate(`(() => { ${PAGE}; return menuItems(); })()`).catch(() => []);
        out.push(`PANEL MENU ITEMS: ${JSON.stringify(items)}`);
        await tt.keyboard.press('Escape').catch(() => {});
      } else {
        out.push('PANEL MENU: no button[aria-haspopup] inside the expanded panel');
      }
      out.push(...(await probeSocialSkillsLogin(tt, frame, idx, name)));
    }
  } catch (err) {
    out.push(`PROBE ERROR: ${String(err.message).split('\n')[0]}`);
  }
  const file = path.join(RECON_DIR, `social-skills-panel-${Date.now()}.txt`);
  try {
    fs.writeFileSync(file, out.join('\n') + '\n');
  } catch {}
  logger.event(`RECON-SS panel probe: ${out.length} line(s) — ${file}`);
}

// --recon-social-skills: why does the Social Skills app not come up?
// STRUCTURE ONLY. Every value logged is a URL path (query/token stripped), a
// count, a tag name, or a fixed marker word's hit count. No page text is ever
// read into the log, so no student name can land in it. The one screenshot
// goes to recon/ (gitignored) for a human to look at.
async function reconSocialSkills(tt, logger, name) {
  const strip = safeUrl;
  const MARKERS = [
    'View Students', 'My Activities', 'Log in', 'Login', 'Sign in', 'Password', 'Clever',
    'expired', 'not authorized', 'access denied', 'subscription', 'license', 'Loading', 'Error',
  ];
  const popups = [];
  state.context.on('page', (p) => popups.push(p));

  const frameFacts = (f) =>
    f
      .evaluate((markers) => {
        const text = ((document.body && document.body.innerText) || '').toLowerCase();
        const hits = {};
        for (const m of markers) {
          const n = text.split(m.toLowerCase()).length - 1;
          if (n) hits[m] = n;
        }
        const pathOf = (u) => {
          try {
            return new URL(u, location.href).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}|\d{3,}/gi, '#');
          } catch {
            return '';
          }
        };
        const uniq = (a, n) => [...new Set(a.filter(Boolean))].slice(0, n);
        return {
          textLength: text.length,
          inputs: document.querySelectorAll('input').length,
          passwordInputs: document.querySelectorAll('input[type=password]').length,
          iframes: document.querySelectorAll('iframe').length,
          hits,
          scripts: uniq([...document.scripts].map((s) => pathOf(s.src)), 12),
          components: uniq([...document.querySelectorAll('*')].map((e) => e.tagName.toLowerCase()).filter((t) => t.includes('-')), 20),
          requests: uniq(
            performance
              .getEntriesByType('resource')
              .map((r) => pathOf(r.name))
              .filter((p) => !/\.(png|jpe?g|gif|svg|woff2?|ttf|css|ico|js|webm)$|guide-content|\/data\/|ptm\.gif|pendo/i.test(p)),
            25
          ),
        };
      }, MARKERS)
      .catch((e) => ({ error: String(e.message).split('\n')[0].slice(0, 80) }));

  let last = '';
  const snapshot = async (label) => {
    const frames = [];
    for (const f of tt.frames()) frames.push({ url: strip(f.url()), ...(await frameFacts(f)) });
    const pops = popups.filter((p) => !p.isClosed()).map((p) => strip(p.url()));
    const out = JSON.stringify({ page: strip(tt.url()), frames, popups: pops });
    if (out !== last) {
      last = out;
      logger.event(`RECON-SS ${label}: ${out}`);
    }
  };

  logger.event('RECON-SS structure only — no page text, no student names.');
  await snapshot('hub');

  const cards = await tt
    .evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a,button,[role=link],[role=button],h1,h2,h3,h4,span,div')) {
        if (el.children.length) continue;
        const t = (el.textContent || '').trim();
        if (!t || t.length > 40 || !/social\s*skills/i.test(t)) continue;
        const r = el.getBoundingClientRect();
        const a = el.closest('a');
        out.push({
          tag: el.tagName.toLowerCase(),
          text: t,
          visible: r.width > 0 && r.height > 0,
          href: a ? a.getAttribute('href') || '' : '',
          target: a ? a.getAttribute('target') || '' : '',
        });
      }
      return out.slice(0, 12);
    })
    .catch(() => []);
  logger.event(
    `RECON-SS hub cards matching "Social Skills": ${cards.length} — ` +
      JSON.stringify(cards.map((c) => ({ ...c, href: strip(c.href) })))
  );

  const nav = async (label, doNav, polls = 8) => {
    logger.event(`RECON-SS ${label}`);
    await doNav();
    for (let i = 1; i <= polls; i++) {
      await sleep(4_000);
      await snapshot(`${label} +${i * 4}s`);
    }
  };

  if (state.ttNavBase) {
    await nav('direct goto #/apps/ssms', () => tt.goto(state.ttNavBase + '#/apps/ssms', { timeout: NAV_TIMEOUT }).catch(() => {}));
    await reconShot(tt, 'social-skills-direct');
    await outlineSocialSkillsApp(tt, logger, name);
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
    await sleep(2_000);
  }
  const card = tt
    .getByRole('link', { name: /social skills/i })
    .or(tt.getByRole('button', { name: /social skills/i }))
    .or(tt.getByText(/social skills/i))
    .filter({ visible: true })
    .first();
  if (await visibleSoon(card, 10_000)) {
    await nav('hub card click', () => card.click({ timeout: 5_000 }).catch(() => {}));
    await reconShot(tt, 'social-skills-card');
  } else {
    logger.event('RECON-SS no visible "Social Skills" card on the hub.');
  }
  logger.event(
    'RECON-SS COMPLETE — the screenshots in recon/ are NOT masked (they show the roster): for you only, do not share them.'
  );
}

// IEP-goals bridge check: walk Student-Led setup to step 2 for ONE student,
// log whether "IEP Goals" is selectable and what it lists, then back out.
// Never enters step 3 ("Prepare Session" — unexplored), never launches.
async function reconGoals(tt, config, logger) {
  const report = [`Student-Led IEP Goals recon — ${ts()}`, ''];
  await enterEncore(tt, config, logger);
  await openSessionFormat(tt, logger);
  await clickGetStarted(tt, /student-led/i, 1, 'Student-Led', logger);
  const frame = encoreLocator(tt);
  await frame.getByText(/select student/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await reconShot(tt, 'student-led-step1');

  // Step 1: pick the FIRST student (required to reach step 2; nothing launches).
  const row = frame.locator('.sl-stu, [class*="student-row"], [class*="stu-"], [class*="list-item"]').first();
  if (!(await visibleSoon(row, 8_000))) {
    const msg = 'No student rows on Student-Led step 1 (empty roster?) — cannot check IEP Goals yet.';
    logger.event(`IEP-GOALS: ${msg}`);
    report.push(msg);
    writeReconReport(report, 'iep-goals-report');
    await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
    return;
  }
  await row.click({ timeout: 5_000 });
  await advanceStudentLedToStep2(frame, {
    log: (m) => logger.event(m),
    nextTimeout: NAV_TIMEOUT,
    step2Timeout: NAV_TIMEOUT,
  });
  await reconShot(tt, 'student-led-step2');

  // Step 2: is "IEP Goals" present/selectable, and what does it list?
  const iepText = frame.getByText(/iep goals/i).first();
  const present = await iepText.isVisible().catch(() => false);
  let selectable = null;
  let items = [];
  if (present) {
    const radio = frame.locator('label:has-text("IEP Goals") input[type="radio"], input[type="radio"][value*="iep" i]').first();
    const hasRadio = await radio.count().then((c) => c > 0).catch(() => false);
    selectable = hasRadio ? await radio.isEnabled().catch(() => false) : null;
    if (selectable !== false) {
      await iepText.click({ timeout: 5_000 }).catch(() => {});
      // Unknown DOM: give the lesson list a moment to swap, then read it.
      const itemLoc = frame.locator('#lessonlist li, [class*="lesson"] li, [class*="checklist"] li, [class*="goal"] li');
      const deadline = Date.now() + 3_000;
      do {
        items = (await itemLoc.allTextContents().catch(() => [])).map((t) => t.trim()).filter(Boolean);
        if (items.some((t) => /goal/i.test(t))) break;
        await sleep(300);
      } while (Date.now() < deadline);
      await reconShot(tt, 'student-led-iep-goals');
    }
  }
  const verdict = !present
    ? 'IEP Goals option NOT FOUND on step 2'
    : selectable === false
      ? 'present but DISABLED'
      : `selectable — ${items.length} item(s) listed`;
  logger.event(`IEP-GOALS: ${verdict}`);
  report.push(`IEP Goals: ${verdict}`);
  for (const i of items) {
    logger.event(`  GOAL/LESSON: ${i}`);
    report.push(`  - ${i}`);
  }
  const frameObj = getEncoreFrame(tt);
  if (frameObj) {
    const dump = await frameObj.evaluate(() => document.body.innerText).catch(() => '');
    report.push('', '--- step 2 raw text ---', dump);
  }
  const file = writeReconReport(report, 'iep-goals-report');
  logger.event(`RECON report written: ${file}`);

  // Back out — fresh goto, never browser back, never step 3.
  await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT }).catch(() => {});
}

// TODO(--report): Phase-3 scaffold only. Full build after the first live
// recon shows what Reporting actually renders at SLZUSD (license also
// covers BE SAFE and Health & Wellness). Read-only: screenshot + text dump.
async function reportScrape(tt, config, studentName, logger) {
  await enterEncore(tt, config, logger);
  const frame = encoreLocator(tt);
  await frame.getByText(/^Reporting$/i).first().click({ timeout: NAV_TIMEOUT });
  await frame.getByText(/reporting/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await dismissOnboarding(tt, logger);
  if (studentName) {
    const row = frame.getByText(studentName).first();
    if (await visibleSoon(row, 8_000)) {
      await row.click({ timeout: 5_000 }).catch(() => {});
      await visibleSoon(frame.getByText(/session history|mastery|progress/i).first(), 5_000);
    } else {
      logger.event(`WARN --report: "${studentName}" not found in Reporting — capturing the overview instead`);
    }
  }
  const stamp = Date.now();
  fs.mkdirSync(RECON_DIR, { recursive: true });
  const png = path.join(RECON_DIR, `reporting-${stamp}.png`);
  await tt.screenshot({ path: png, fullPage: true }).catch(() => {});
  const frameObj = getEncoreFrame(tt);
  const text = frameObj ? await frameObj.evaluate(() => document.body.innerText).catch(() => '') : '';
  const txt = path.join(RECON_DIR, `reporting-${stamp}.txt`);
  fs.writeFileSync(
    txt,
    `TeachTown Reporting capture — ${ts()}\nStudent: ${studentName || '(overview)'}\n\n${text}\n`
  );
  logger.event(`REPORT saved: ${png} + ${txt}`);
}

/* ------------------------------ misc -------------------------------- */

function printDryRunTable(results, logger) {
  logger.consoleOnly('\nDRY RUN — parsed roster & eligibility (console only, not written to the log file):');
  console.table(
    results.map((r) => ({
      Student: r.student,
      Status: r.status + (r.status !== 'READY' && r.reason ? ` — ${r.reason}` : ''),
      'Would run': r.wouldRun || '—',
      'Activities (Last Score)':
        r.activities.map((a) => `${a.name}: ${fmtScore(a.score)}`).join('  |  ') || '—',
    }))
  );
}

/* ------------------- one session per browser profile ------------------ */

// Thrown when another session owns the profile (or the user chose to keep
// it). Logged as a plain line, exit code 3 — not a crash, no screenshot.
class SessionBlockedError extends Error {}

// This click was handed to the already-open window, which is switching
// itself. Nothing is wrong and nothing is left to do: exit 0, no pause.
class SessionHandedOffError extends Error {}

function releaseSessionLock() {
  if (!state.lockHeld) return;
  state.lockHeld = false;
  sessionLock.release(state.profileDir);
}

const MODE_LABELS = {
  'teacher-led': 'Teacher-led',
  'student-led': 'Student-Led',
  rotation: 'The rotation',
  login: 'Login setup',
  recon: 'Recon',
};
function sessionLabel(info) {
  if (info.subject) return subjects.studentLedLabel(info.subject);
  return MODE_LABELS[info.mode] || 'Another session';
}
function clockTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// One keypress, no Enter. Resolves to the lowercase key when it is one of
// `keys`; anything else — including Ctrl+C and a closed stream — is null.
function askChoice(keys) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const finish = (key) => {
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      try {
        stdin.setRawMode(false);
      } catch {}
      stdin.pause();
      resolve(key);
    };
    const onData = (d) => {
      const k = String(d).slice(0, 1).toLowerCase();
      finish(keys.includes(k) ? k : null);
    };
    const onEnd = () => finish(null);
    try {
      stdin.setRawMode(true);
    } catch {}
    stdin.on('data', onData);
    stdin.on('end', onEnd);
    stdin.resume();
  });
}

// Take the profile lock BEFORE Chrome launches. A second launch on an
// in-use profile opens a blank window inside the running session.
async function takeSessionLock(profileDir, info, logger, opts = {}) {
  const mine = sessionLabel(info);
  let r = sessionLock.acquire(profileDir, info);
  if (!r.ok) {
    const holder = r.holder;
    const theirs = sessionLabel(holder);
    const since = holder.startedAt ? clockTime(holder.startedAt) : null;
    const sinceTxt = since ? ` (started ${since})` : '';
    const interactive = process.stdin.isTTY && process.env.TT_UI !== '1' && !holder.unknown;
    if (!interactive) {
      throw new SessionBlockedError(`BLOCKED ${theirs} is already running${sinceTxt}.`);
    }
    // Both are Student-Led-style sessions started from a shortcut: the open
    // window can switch itself, staying up and signed in.
    const canSwitchInPlace =
      opts.canHandOff && holder.mode === 'student-led' && holder.subject && holder.source === 'shortcut';
    console.log('');
    if (canSwitchInPlace) {
      console.log(`${theirs} is open in the TeachTown window${sinceTxt}.`);
      console.log(
        holder.subject === 'social-skills'
          ? `  Y = switch that window to ${mine}  (stays open; it signs out of TeachTown and back in by itself)`
          : `  Y = switch that window to ${mine}  (stays open and signed in)`
      );
      console.log(`  E = close ${theirs} completely, then start ${mine} fresh`);
      console.log(`  N = leave ${theirs} alone`);
      console.log(`Only switch once ${theirs}'s lesson is finished.`);
    } else {
      console.log(`${theirs} is still running${sinceTxt}.`);
      console.log(`  Y = end ${theirs} and start ${mine}`);
      console.log(`  N = keep ${theirs} going`);
    }
    const choice = await askChoice(canSwitchInPlace ? 'yen' : 'yn');
    if (!choice || choice === 'n') {
      throw new SessionBlockedError(`BLOCKED ${theirs} is still running — left it alone.`);
    }
    if (canSwitchInPlace && choice === 'y') {
      sessionLock.requestSwitch(profileDir, holder, { subject: info.subject, learner: info.learner });
      logger.event(`SWITCH asking the open window (PID ${holder.pid}) to change from ${theirs} to ${mine}`);
      if (await sessionLock.waitForSwitchAck(profileDir, 15_000)) {
        throw new SessionHandedOffError(`SWITCH ${mine} was handed to the open window — carry on there.`);
      }
      sessionLock.clearSwitchRequest(profileDir);
      console.log(`The open window did not answer. Press Y to close ${theirs} and start ${mine} fresh, or N to stop.`);
      if ((await askChoice('yn')) !== 'y') {
        throw new SessionBlockedError(`BLOCKED ${theirs} is still running — left it alone.`);
      }
    }
    logger.event(`SWITCH asking ${theirs} to close (PID ${holder.pid}) so ${mine} can start`);
    sessionLock.requestStop(profileDir, holder);
    const freed = await sessionLock.waitForRelease(profileDir, 30_000);
    if (!freed) {
      sessionLock.clearStopRequest(profileDir);
      throw new SessionBlockedError(`BLOCKED ${theirs} didn't close. Close its window, then click ${mine} again.`);
    }
    r = sessionLock.acquire(profileDir, info);
    if (!r.ok) throw new SessionBlockedError(`BLOCKED ${sessionLabel(r.holder)} is already running.`);
  }
  state.lockHeld = true;
  process.on('exit', releaseSessionLock); // last-ditch, synchronous
  if (r.clearedStale) logger.event(`WARN cleared a stale session lock (${r.clearedStale})`);

  // The previous browser can still be closing after a switch; launching into
  // a closing profile is the same blank-window trap.
  if (!(await sessionLock.waitForChromeRelease(profileDir, 15_000))) {
    throw new Error('The TeachTown browser is still open. Close it and try again.');
  }

  const watcher = setInterval(() => {
    if (state.shuttingDown) return;
    // Another subject's switch request: same clean shutdown as STOP.
    if (sessionLock.stopRequestedFor(profileDir)) {
      sessionLock.clearStopRequest(profileDir);
      logger.event('SWITCH: another subject asked to take over; cleaning up');
      shutdown(0);
      return;
    }
    // A later shortcut click asks THIS window to change subject in place.
    if (state.pendingRetarget) return;
    // Validate BEFORE acknowledging: taking the request is the ack, and the
    // requester exits as soon as it sees it. A refusal makes it offer the
    // close-and-restart choice instead of reporting a hand-off that never happened.
    const req = sessionLock.peekSwitchRequest(profileDir);
    if (!req) return;
    const sl = state.config && state.config.studentLed;
    const subject =
      req.subject === subjects.DEFAULT_SETTINGS ? subjects.DEFAULT_SETTINGS : subjects.normalizeSubjectKey(req.subject);
    const name = sl && sl.learners && typeof sl.learners[req.learner] === 'string' ? sl.learners[req.learner].trim() : '';
    if (!sl || !subject || !name) {
      sessionLock.refuseSwitchRequest(profileDir);
      logger.event('WARN SWITCH refused — the requested subject or learner is not set up in this window');
      return;
    }
    if (!sessionLock.takeSwitchRequest(profileDir)) return;
    logger.event(`SWITCH: staying in this window, changing to ${subjects.studentLedLabel(subject)} for "${req.learner}"`);
    state.pendingRetarget = { subject, learner: req.learner, studentName: name };
    if (state.onRetarget) {
      const go = state.onRetarget;
      state.onRetarget = null;
      go();
    }
  }, 1000);
  if (watcher.unref) watcher.unref();
}

async function shutdown(code) {
  if (state.shuttingDown) process.exit(code);
  state.shuttingDown = true;
  const log = state.logger;
  log?.event('INTERRUPT — cleaning up (press Ctrl+C again to force-quit)');
  const failsafe = setTimeout(() => process.exit(code), 20_000);
  if (failsafe.unref) failsafe.unref();

  try {
    if (state.popup && !state.popup.isClosed()) await state.popup.close();
  } catch {}
  try {
    // Log out only if we're impersonating a student right now.
    if (await logOutOfStudentView(state.ttPage)) log?.event('Logged the student out before exiting.');
  } catch {}
  try {
    await state.context?.close();
  } catch {}
  log?.event('Clean exit.');
  log?.close();
  releaseSessionLock();
  process.exit(code);
}

(async function main() {
  const argv = process.argv;
  const reportArg = () => {
    const v = argv[argv.indexOf('--report') + 1];
    return v && !v.startsWith('-') ? v : ''; // next flag ≠ a student name
  };
  // --subject KEY or --subject=KEY (validated in loadConfig).
  const subjectArg = () => {
    const eq = argv.find((a) => a.startsWith('--subject='));
    if (eq) return eq.slice('--subject='.length);
    const i = argv.indexOf('--subject');
    if (i < 0) return null;
    const v = argv[i + 1];
    return v && !v.startsWith('-') ? v : '';
  };
  const flags = {
    dryRun: argv.includes('--dry-run'),
    teacherLedOnly: argv.includes('--teacher-led'),
    studentLed: argv.includes('--student-led'),
    subject: subjectArg(),
    reconRoster: argv.includes('--recon-roster'),
    reconGoals: argv.includes('--recon-goals'),
    reconSocialSkills: argv.includes('--recon-social-skills'),
    report: argv.includes('--report') ? reportArg() : null,
  };
  const anyRecon = flags.reconRoster || flags.reconGoals || flags.reconSocialSkills || flags.report != null;
  const dryRun = flags.dryRun;
  const teacherLedOnly = flags.teacherLedOnly;
  if (flags.studentLed && teacherLedOnly) fail('--student-led and --teacher-led are separate modes — pass one.');
  if (flags.subject != null && !flags.studentLed) fail('--subject only applies to --student-led.');
  // --login is a warmup other modes subsume (every mode runs the sign-in
  // chain first) — the more specific mode wins, instead of silently
  // discarding the mode's actual work.
  flags.loginOnly = argv.includes('--login') && !anyRecon && !teacherLedOnly && !flags.studentLed && !dryRun;
  const loginImplied = argv.includes('--login') && !flags.loginOnly;

  const config = loadConfig(flags);

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const logger = new Logger(path.join(LOGS_DIR, `session-${fileStamp()}.txt`));
  state.logger = logger;

  process.on('SIGINT', () => shutdown(130));
  process.on('SIGTERM', () => shutdown(143));
  process.on('SIGBREAK', () => shutdown(130)); // Windows Ctrl+Break; never fires elsewhere
  process.on('SIGHUP', () => shutdown(129)); // closing the console window (Windows gives ~10 s to clean up)

  // UI mode: the STOP button sends "stop" over stdin — the SAME clean
  // shutdown as Ctrl+C. A signal can't do this portably: on Windows,
  // child.kill('SIGINT') terminates without running handlers, which would
  // orphan the browser mid-session. stdin stays unref'd so a finished run
  // still exits naturally.
  if (process.env.TT_UI === '1') {
    const uiRl = readline.createInterface({ input: process.stdin });
    uiRl.on('line', (l) => {
      if (l.trim() === 'stop' && !state.shuttingDown) {
        logger.event('STOP pressed in the UI — cleaning up');
        shutdown(130);
      }
    });
    if (process.stdin.unref) process.stdin.unref();
  }

  if (loginImplied) {
    logger.event('NOTE --login is implied by this mode — the sign-in chain runs first; continuing with the full run.');
  }
  const modeTag = anyRecon
    ? ' (recon)'
    : flags.loginOnly
      ? ' (login only)'
      : `${dryRun ? ' (dry run)' : ''}${teacherLedOnly ? ' (teacher-led only)' : ''}${flags.studentLed ? ' (student-led)' : ''}`;
  logger.event(
    `SESSION START${modeTag} — ` +
      (anyRecon
        ? `district=${config.district || '(legacy)'}, flags=${[
            flags.reconRoster && '--recon-roster',
            flags.reconGoals && '--recon-goals',
            flags.reconSocialSkills && '--recon-social-skills',
            flags.report != null && '--report',
          ].filter(Boolean).join(' ')}`
        : flags.loginOnly
          ? `district=${config.district || '(legacy)'}, flags=--login`
          : flags.studentLed && socialSkillsApp.usesSocialSkillsApp(config.studentLed.subject)
          ? `Social Skills app, learner "${config.studentLed.learnerPseudonym}", subject=${config.studentLed.subject}`
          : flags.studentLed
          ? `enCORE Student-Led, learner "${config.studentLed.learnerPseudonym}", subject=${config.studentLed.subject}, ` +
            `lessonSource=${config.studentLed.lessonSource}, autoBegin=${config.studentLed.autoBegin}`
          : teacherLedOnly
          ? `enCORE ${config.teacherLed.group ? `group "${config.teacherLed.group}"` : `${config.teacherLed.students.length} student(s)`}, ` +
            `length=${config.teacherLed.sessionLengthMin}min, autoBegin=${config.teacherLed.autoBegin}`
          : `${config.students.length} student(s), ` +
            (config.playlist.length
              ? `playlist=${config.playlist.length} step(s), `
              : `mode=${config.mode}, target=${config.targetActivity || '(first activity not at 100%)'}, `) +
            `afterRotation=${config.afterRotation}`)
  );

  const profileDir = resolveProfileDir(config.profileDir);
  state.profileDir = profileDir;
  logger.event(`Browser profile: ${profileDir}`);
  fs.mkdirSync(profileDir, { recursive: true });
  if (
    profileDir.startsWith(PROJECT_DIR + path.sep) &&
    !/[\\/](\.profiles|profile|\.teachtown-runner)([\\/]|$)/.test(profileDir)
  ) {
    logger.event(
      `WARN profileDir "${profileDir}" is inside the project but not a gitignored path — ` +
        'browser cookies/session data could get committed. Use .profiles/<name> or move it outside the repo.'
    );
  }

  // Recon mode = any recon flag, or the first run on this browser profile
  // (fresh district → the SSO chain is unverified; screenshot every hop and
  // stop on anything unrecognized instead of guessing).
  const firstRunMarker = path.join(profileDir, 'ttrunner-first-run-done');
  state.reconMode = anyRecon || !fs.existsSync(firstRunMarker);
  if (state.reconMode) {
    logger.event('Recon mode: auth hops are screenshotted to recon/; an unrecognized page stops the run.');
  }

  try {
    // launchBrowser is inside this try deliberately: it's the one await in
    // main() before the try block used to start, so ANY rejection from it —
    // Chrome not installed, or the profile already locked by another
    // session — was an unhandled promise rejection, not a caught error.
    // Node's default for that is a bare stack trace on stderr and exit,
    // completely bypassing Logger: no FATAL line, nothing in logs/. That's
    // exactly what happened running two Student-Led sessions against the
    // same district profile at once — the second one's own friendly
    // "profile is already in use" message (thrown below) never made it to
    // the log or the console the human was watching.
    await takeSessionLock(
      profileDir,
      {
        subject: flags.studentLed ? config.studentLed.subject : null,
        mode: anyRecon
          ? 'recon'
          : flags.loginOnly
            ? 'login'
            : teacherLedOnly
              ? 'teacher-led'
              : flags.studentLed
                ? 'student-led'
                : 'rotation',
        learner: flags.studentLed ? config.studentLed.learnerPseudonym : null,
        source: process.env.TT_UI === '1' ? 'ui' : 'shortcut',
      },
      logger,
      { canHandOff: flags.studentLed && !dryRun }
    );
    state.config = config;
    const context = await launchBrowser(profileDir);
    state.context = context;
    context.on('close', () => {
      if (!state.shuttingDown && !state.finished) {
        logger.event('Browser window was closed — exiting.');
        releaseSessionLock();
        process.exit(0);
      }
    });

    const portal = context.pages()[0] || (await context.newPage());
    let tt;
    if (config.loginMode === 'direct') {
      tt = await ensureTeachTownDirect(portal, config, logger);
    } else {
      await ensureCleverPortal(portal, config, logger);
      tt = null;
    }
    try {
      fs.writeFileSync(firstRunMarker, ts() + '\n'); // login chain verified for this profile
    } catch (err) {
      logger.event(`WARN could not write the first-run marker (${err.message}) — recon mode will stay on every run until it can be written`);
    }
    if (!tt) tt = await openTeachTown(context, portal, logger);
    state.ttPage = tt;
    noteProfileAuthenticated(logger);
    if (state.reconMode || flags.loginOnly) await inventoryHub(tt, logger);

    if (flags.loginOnly) {
      // enCORE keeps its own session — warm it too, or "zero-touch later"
      // would only be true for half the day-one surface.
      logger.event('Warming the enCORE session (it signs in separately)...');
      try {
        await enterEncore(tt, config, logger);
        logger.event('enCORE session ready.');
      } catch (err) {
        if (err instanceof ReconStopError || err instanceof ManualSignInTimeoutError || state.shuttingDown) {
          throw err;
        }
        logger.event(
          `WARN enCORE warmup failed (${err.message.split('\n')[0]}) — TeachTown itself is authenticated; enCORE may ask to sign in when first used.`
        );
      }
      noteProfileAuthenticated(logger);
      if (!state.manualSignInHappened) {
        logger.event(
          state.autoSubmitHappened
            ? 'Profile re-authenticated hands-off (the browser had the form filled; nothing was typed).'
            : 'Profile already authenticated — zero-touch confirmed (no sign-in was needed).'
        );
      }
      logger.event('LOGIN SETUP COMPLETE');
      return;
    }

    if (anyRecon) {
      if (flags.reconRoster) await reconRoster(tt, config, logger);
      if (flags.reconGoals) await reconGoals(tt, config, logger);
      if (flags.reconSocialSkills) await reconSocialSkills(tt, logger, config.studentLed && config.studentLed.studentName);
      if (flags.report != null) await reportScrape(tt, config, flags.report, logger);
      noteProfileAuthenticated(logger); // an enCORE-leg sign-in counts too
      logger.event('RECON COMPLETE');
      return;
    }

    if (teacherLedOnly) {
      await runTeacherLed(tt, config, dryRun, logger); // idles until Ctrl+C / window close
      return;
    }

    if (flags.studentLed) {
      // Each pass idles at READY; a later shortcut click can retarget this
      // same window (same browser, still signed in) and the loop runs the new
      // subject. Dry runs and Ctrl+C never loop.
      for (;;) {
        // Social Skills is its own app, not an enCORE subject box.
        if (socialSkillsApp.usesSocialSkillsApp(config.studentLed.subject)) {
          await runSocialSkillsApp(tt, config, dryRun, logger); // live: idles at READY; dry run: logs out and returns
        } else {
          await runStudentLed(tt, config, dryRun, logger); // live: idles; dry run: verifies and returns
        }
        const next = state.pendingRetarget;
        if (!next || dryRun || state.shuttingDown) break;
        state.pendingRetarget = null;
        const sl = config.studentLed;
        sl.subject = next.subject;
        sl.learnerPseudonym = next.learner;
        sl.studentName = next.studentName;
        sessionLock.updateHolder(state.profileDir, { subject: sl.subject, learner: sl.learnerPseudonym });
        await logOutOfStudentView(tt).catch(() => false); // leaving a Social Skills student view first
        logger.event(`SWITCHED — now ${subjects.studentLedLabel(sl.subject)} for "${sl.learnerPseudonym}" in the same window`);
      }
      if (dryRun) {
        noteProfileAuthenticated(logger);
        logger.event('SESSION COMPLETE');
      }
      return;
    }

    await gotoSocialSkills(tt);

    const results = [];
    let pass = 0;
    do {
      pass += 1;
      let launchedThisPass = 0;
      for (const name of config.students) {
        if (state.shuttingDown) return;
        const r = await runStudent(tt, name, config, dryRun, logger);
        results.push(r);
        if (r.launched) launchedThisPass += 1;
      }
      if (dryRun || config.afterRotation !== 'repeat') break;
      if (launchedThisPass === 0) {
        logger.event('All students at 100% — nothing left to run. Stopping.');
        break;
      }
      logger.event(`ROTATION ${pass} COMPLETE — repeating group`);
    } while (!state.shuttingDown);

    if (state.shuttingDown) return; // Ctrl+C owns the exit from here

    if (config.afterRotation === 'teacherLed') {
      if (dryRun) {
        logger.event('Dry run — skipping the teacher-led handoff.');
      } else {
        await runTeacherLed(tt, config, dryRun, logger); // idles until Ctrl+C / window close
        return;
      }
    }

    if (dryRun) printDryRunTable(results, logger);
    noteProfileAuthenticated(logger);
    logger.event('SESSION COMPLETE');
  } catch (err) {
    if (state.shuttingDown) {
      return; // Ctrl+C owns the exit — an 'interrupted' throw is not a failure
    }
    if (err instanceof SessionHandedOffError) {
      logger.event(err.message);
      process.exitCode = 0; // nothing failed; the open window took over
    } else if (err instanceof SessionBlockedError) {
      logger.event(err.message);
      process.exitCode = 3; // already running / user chose to keep it — not a crash
    } else if (err instanceof ReconStopError) {
      logger.event('SSO RECON STOP — a human needs to look at this:');
      for (const line of err.message.split('\n')) logger.event(line);
      process.exitCode = 2;
    } else if (err instanceof ManualSignInTimeoutError) {
      // Every line — the trailing detail lines name the page we got stuck on,
      // which is the whole point of the message.
      const [head, ...rest] = err.message.split('\n');
      logger.event(`FATAL ${head}`);
      for (const line of rest) logger.event(line);
      process.exitCode = 1; // no screenshot — the page on screen is a live sign-in form
    } else {
      const [head, ...rest] = err.message.split('\n');
      logger.event(`FATAL ${head}`);
      for (const line of rest) logger.event(line);
      await screenshot(state.ttPage || state.context?.pages()[0], 'fatal');
      process.exitCode = 1;
    }
  } finally {
    if (!state.shuttingDown) {
      state.finished = true;
      try {
        await state.context?.close();
      } catch {}
      logger.close();
      releaseSessionLock();
    }
  }
})();
