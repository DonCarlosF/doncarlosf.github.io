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
 *   2) cp config.template.json config.json   → fill in your students
 *   3) npm start                     full session
 *      npm start -- --dry-run       login + parse roster/eligibility only, launch nothing
 *      npm start -- --teacher-led   skip Social Skills, set up an enCORE Teacher-Led
 *                                   session (stops at Begin Session unless
 *                                   teacherLed.autoBegin is true — autoBegin
 *                                   starts a REAL logged session)
 *      npm start -- --student-led   not implemented yet (prints the recon notes)
 *
 * Privacy: config.json, logs/ and the browser profile are gitignored.
 * Student names exist only on this machine (console + local log file).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const PROJECT_DIR = __dirname;
const CONFIG_PATH = path.join(PROJECT_DIR, 'config.json');
const LOGS_DIR = path.join(PROJECT_DIR, 'logs');

// Generous timeout for navigation / UI waits. Activity waits are unbounded.
const NAV_TIMEOUT = 60_000;

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
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(
      'config.json not found.\n' +
        '  1) cp config.template.json config.json\n' +
        '  2) fill in your students exactly as shown in the View Students list\n' +
        'config.json is gitignored — real names never leave this machine.'
    );
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    fail(`config.json is not valid JSON: ${err.message}`);
  }
  if (!cfg.cleverDistrictUrl || !/^https?:\/\//i.test(cfg.cleverDistrictUrl)) {
    fail('config.cleverDistrictUrl must be an http(s) URL, e.g. "https://clever.com/in/ousd".');
  }
  if (!Array.isArray(cfg.students) || cfg.students.length === 0 ||
      cfg.students.some((s) => typeof s !== 'string' || !s.trim())) {
    fail('config.students must be a non-empty array of student names (exactly as shown in View Students).');
  }
  cfg.students = cfg.students.map((s) => s.trim());
  cfg.targetActivity = cfg.targetActivity || null;
  cfg.mode = cfg.mode || 'activity';
  if (!['activity', 'movie'].includes(cfg.mode)) {
    fail(`config.mode must be "activity" or "movie" (got "${cfg.mode}").`);
  }
  cfg.afterRotation = cfg.afterRotation || 'stop';
  if (!['stop', 'repeat', 'teacherLed'].includes(cfg.afterRotation)) {
    console.warn(
      `afterRotation="${cfg.afterRotation}" is not implemented — treating it as "stop".`
    );
    cfg.afterRotation = 'stop';
  }
  cfg.profileDir = cfg.profileDir || '~/.teachtown-runner/profile';

  // Teacher-Led (enCORE) settings.
  const tl = Object.assign(
    { encoreAppHash: '#/apps/enms', group: '', students: [], sessionLengthMin: 15, autoBegin: false },
    cfg.teacherLed || {}
  );
  if (!Array.isArray(tl.students)) tl.students = [];
  tl.students = tl.students.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  tl.group = typeof tl.group === 'string' ? tl.group.trim() : '';
  if (typeof tl.sessionLengthMin !== 'number' || tl.sessionLengthMin <= 0) tl.sessionLengthMin = 15;
  if (tl.group && tl.students.length) {
    console.warn('teacherLed: both "group" and "students" are set — the group takes precedence.');
  }
  cfg.teacherLed = tl;

  const teacherLedActive =
    process.argv.includes('--teacher-led') || cfg.afterRotation === 'teacherLed';
  if (teacherLedActive && !tl.group && tl.students.length === 0) {
    fail('teacherLed needs either "group" or a non-empty "students" list in config.json.');
  }
  return cfg;
}

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

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => {
      rl.close();
      shutdown(130);
    });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
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

// goto the Clever district URL and get to the logged-in portal (the page with
// the TeachTown tile). Cached Microsoft session → fully automatic. If a
// credential form shows up, hand control to the human. Never touch fields.
async function ensureCleverPortal(page, config, logger) {
  logger.event(`Opening Clever portal: ${config.cleverDistrictUrl}`);
  await page.goto(config.cleverDistrictUrl, {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });

  let deadline = Date.now() + NAV_TIMEOUT * 2;
  let lastManualPrompt = 0;
  let ssoClicks = 0;

  while (Date.now() < deadline) {
    if (state.shuttingDown) throw new Error('interrupted');

    if (await findTeachTownTile(page)) {
      logger.event('Clever portal ready (TeachTown tile visible)');
      return;
    }

    // Microsoft "Stay signed in?" — clicking Yes keeps future runs automatic.
    // This is not a credential field.
    try {
      if (await page.getByText(/stay signed in\?/i).first().isVisible()) {
        await page
          .getByRole('button', { name: /^yes$/i })
          .or(page.locator('input[type="submit"][value="Yes"]'))
          .first()
          .click({ timeout: 2000 });
        await sleep(1000);
        continue;
      }
    } catch {}

    // Credential form / account picker → human takes over.
    if ((await microsoftWantsInput(page)) && Date.now() - lastManualPrompt > 20_000) {
      lastManualPrompt = Date.now();
      logger.event('Microsoft sign-in needs input — waiting for manual login.');
      await waitForEnter('>>> Log in manually in the browser window, then press Enter here to continue... ');
      deadline = Date.now() + NAV_TIMEOUT * 2;
      continue;
    }

    // Clever district page may show an SSO button (e.g. "OUSD Sign in").
    // Clicking it with a cached Microsoft session completes silently.
    if (ssoClicks < 2 && /clever\.com/i.test(page.url())) {
      const sso = page
        .getByRole('button', { name: /sign ?in|log ?in with/i })
        .or(page.getByRole('link', { name: /sign ?in|log ?in with/i }))
        .first();
      if (await sso.isVisible().catch(() => false)) {
        ssoClicks += 1;
        await sso.click().catch(() => {});
        await sleep(1500);
        continue;
      }
    }

    await sleep(750);
  }
  throw new Error('timed out waiting for the Clever portal (TeachTown tile never appeared)');
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
  const card = tt
    .getByRole('link', { name: /social skills/i })
    .or(tt.getByRole('button', { name: /social skills/i }))
    .or(tt.getByText(/social skills/i))
    .first();
  await card.waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await card.click();
  // The gate that matters is the teacher list rendering inside the frames.
  await tt.waitForURL(/#\/apps\/ssms/i, { timeout: NAV_TIMEOUT }).catch(() => {});
  await innerLocator(tt)
    .getByText('View Students')
    .first()
    .waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
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

/* -------------------------- student flow --------------------------- */

function menuItem(inner, re) {
  // getByText targets the element that *directly* contains the text — the
  // menu item itself, never a row that merely wraps a hidden menu. Menus may
  // be detached from the row (jQuery appends some to <body>), so search the
  // whole inner frame, visible items only (closed menus keep their text in
  // the DOM).
  return inner.getByText(re).filter({ visible: true }).last();
}

async function findCaretNear(nameEl, name) {
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
    `no dropdown caret found near "${name}" — capture the real selector with \`npx playwright codegen\` and add it to CARET_SELECTORS`
  );
}

// After "Login as..", make sure we actually landed in the right student's
// view (guards against clicking a neighboring row's caret).
async function verifyStudentHeader(tt, name) {
  const frame = getInnerFrame(tt);
  if (!frame) return;
  const txt = await frame.evaluate(() => document.body.innerText).catch(() => '');
  const m = txt.match(/Student:\s*([^\n]+)/i);
  if (!m) return; // header text not found — don't block on cosmetics
  const header = m[1].trim().toLowerCase();
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (tokens.length && !tokens.some((t) => header.includes(t))) {
    throw new Error(`logged into "${m[1].trim()}" but expected "${name}"`);
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
async function loginAsStudent(tt, name, logger) {
  const inner = innerLocator(tt);
  await inner.getByText('View Students').first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });

  // The roster rows render after the view chrome — give them time before
  // concluding the verified selector has drifted (instant count() here would
  // misroute healthy-but-slow loads to the legacy fallback).
  if (!(await visibleSoon(inner.locator(STUDENT_ROW).first(), 10_000))) {
    logger.event(`WARN student rows (${STUDENT_ROW}) not found — using text-based fallback`);
    return loginAsStudentLegacy(tt, name, logger);
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
      await verifyStudentHeader(tt, name);
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        logger.event(`WARN ${name} — login-as attempt ${attempt} failed, retrying (${err.message.split('\n')[0]})`);
      }
      await tt.keyboard.press('Escape').catch(() => {});
      await recoverIfStranded(tt, logger); // e.g. wrong-student login — retry needs the teacher list
      await sleep(700);
    }
  }
  throw new Error(`row → caret → "Login as.." failed after 3 attempts for "${name}": ${lastErr?.message}`);
}

// Pre-recon fallback: text-based row/caret discovery. Only used if
// STUDENT_ROW stops matching after a TeachTown update. Mirrors the verified
// sequence as closely as the unknown DOM allows: click the name (row) first,
// then the caret, then the menu item — and watch for the failure toast.
async function loginAsStudentLegacy(tt, name, logger) {
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
        const caret = await findCaretNear(nameEl, name);
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
      await verifyStudentHeader(tt, name);
      return true;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        logger.event(`WARN ${name} — login-as attempt ${attempt} failed, retrying (${err.message.split('\n')[0]})`);
      }
      await tt.keyboard.press('Escape').catch(() => {});
      await recoverIfStranded(tt, logger);
      await sleep(700);
    }
  }
  throw new Error(`caret → "Login as.." failed after 3 attempts for "${name}": ${lastErr?.message}`);
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

async function launchActivity(tt, activity, mode) {
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

  const popupPromise = tt.context().waitForEvent('page', { timeout: NAV_TIMEOUT }).catch(() => null);
  await btn.click();
  const popup = await popupPromise;
  if (!popup) {
    throw new Error(`clicked "${mode === 'movie' ? 'Watch the Movie' : 'Do the Activity!'}" but no player window opened`);
  }
  state.popup = popup;
  await popup.bringToFront().catch(() => {});
  return popup;
}

// The group answers live on the touchscreen — the script only waits.
// Resolves when the player window closes (primary, no timeout), or when the
// main window's list shows the activity's Last Attempted/score changed.
async function waitForCompletion(popup, tt, activity, logger) {
  logger.event('WAITING (activity live)');

  const closed = popup
    .waitForEvent('close', { timeout: 0 })
    .catch(() => {})
    .then(() => 'player closed');

  const updated = (async () => {
    while (!popup.isClosed() && !state.shuttingDown) {
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

  const how = await Promise.race([closed, updated]);
  if (!popup.isClosed()) await popup.close().catch(() => {});
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

      const pick = pickActivity(activities, config);
      if (pick.skip) {
        logger.event(`SKIP ${name} — ${pick.skip}`);
        result.status = 'SKIP';
        result.reason = pick.skip;
      } else if (dryRun) {
        result.status = 'READY';
        result.wouldRun = pick.activity.name;
      } else {
        const popup = await launchActivity(tt, pick.activity, config.mode);
        logger.event(`START ${pick.activity.name}`);
        const how = await waitForCompletion(popup, tt, pick.activity, logger);
        if (state.shuttingDown) return result;
        logger.event(`DONE (${how})`);
        result.status = 'RAN';
        result.wouldRun = pick.activity.name;
        result.launched = true;
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
// ("Log in as a teacher") → enCORE home (#/apps/enms) → Start a Session →
// Teacher-Led "Get started" → student/group setup → Begin Session.
// The OAuth return lands on the ACCOUNT-DEFAULT app regardless of which
// enCORE card was clicked — config teacherLed.encoreAppHash is enforced
// afterwards and a mismatch is warned (open item).

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
  await tt.goto(state.ttNavBase + '#/home', { timeout: NAV_TIMEOUT });
  const card = tt.getByText(/enCORE/i).first(); // OAuth return uses the account default app regardless of card
  await card.waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await card.click();

  const deadline = Date.now() + NAV_TIMEOUT * 2;
  let lastManualPrompt = 0;
  while (Date.now() < deadline) {
    if (state.shuttingDown) throw new Error('interrupted');

    // Success: the enCORE app frame is up (its top nav always shows Start a Session).
    if (await encoreLocator(tt).getByText(/start a session/i).first().isVisible().catch(() => false)) {
      break;
    }

    // teachtown.com/Login.aspx → "Login with Clever" (never the credential form).
    if (/login\.aspx/i.test(tt.url())) {
      const btn = tt
        .getByRole('button', { name: /login with clever/i })
        .or(tt.getByRole('link', { name: /login with clever/i }))
        .or(tt.getByText(/login with clever/i))
        .first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await sleep(1200);
        continue;
      }
    }

    // Clever OAuth page → district sign-in button (guard out the TeachTown
    // nav app and Login.aspx so this can't press an unrelated "Sign In").
    if (!/\/nav\/|login\.aspx/i.test(tt.url())) {
      const sso = tt
        .getByRole('button', { name: /sign ?in|log ?in with/i })
        .or(tt.getByRole('link', { name: /sign ?in|log ?in with/i }))
        .first();
      if (await sso.isVisible().catch(() => false)) {
        await sso.click().catch(() => {});
        await sleep(1200);
        continue;
      }
    }

    // Role picker ("Select user") → teacher.
    const teacherRole = tt.getByText(/log ?in as a teacher/i).first();
    if (await teacherRole.isVisible().catch(() => false)) {
      await teacherRole.click().catch(() => {});
      await sleep(1200);
      continue;
    }

    // Fresh profile: Microsoft may want a human (same stance as the portal).
    if ((await microsoftWantsInput(tt)) && Date.now() - lastManualPrompt > 20_000) {
      lastManualPrompt = Date.now();
      logger.event('Microsoft sign-in needs input — waiting for manual login.');
      await waitForEnter('>>> Log in manually in the browser window, then press Enter here to continue... ');
      continue;
    }

    await sleep(750);
  }

  // Land on the configured enCORE app (routing may use the account default).
  const wantHash = config.teacherLed.encoreAppHash || '#/apps/enms';
  if (!tt.url().includes(wantHash)) {
    await tt.goto(state.ttNavBase + wantHash, { timeout: NAV_TIMEOUT }).catch(() => {});
  }
  await encoreLocator(tt)
    .getByText(/start a session/i)
    .first()
    .waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  if (!tt.url().includes(wantHash)) {
    logger.event(
      `WARN enCORE landed at "${tt.url().split('#')[1] || tt.url()}" instead of ${wantHash} — continuing (open item: Elementary vs Middle School routing)`
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

// Start a Session → Teacher-Led → add group/students → set length → stop at
// Begin Session (autoBegin clicks it — that creates a REAL logged session).
async function teacherLedSetup(tt, tl, dryRun, logger) {
  const frame = encoreLocator(tt);

  await frame
    .getByRole('button', { name: /start a session/i })
    .or(frame.getByText(/start a session/i))
    .first()
    .click({ timeout: NAV_TIMEOUT });
  await frame.getByText(/select a format/i).first().waitFor({ state: 'visible', timeout: NAV_TIMEOUT });
  await dismissOnboarding(tt, logger);

  // "Get started" under the Teacher-Led card specifically.
  const tlCard = frame
    .locator('div, section, article')
    .filter({ hasText: /teacher-led/i })
    .filter({ has: frame.getByRole('button', { name: /get started/i }) })
    .last();
  try {
    await tlCard.getByRole('button', { name: /get started/i }).first().click({ timeout: 10_000 });
  } catch {
    logger.event('WARN could not scope "Get started" to the Teacher-Led card — clicking the first one');
    await frame.getByRole('button', { name: /get started/i }).first().click({ timeout: 10_000 });
  }
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
      await teacherLedSetup(tt, config.teacherLed, dryRun, logger);
      return; // unreachable (setup idles) — kept for shape
    } catch (err) {
      if (state.shuttingDown) return;
      logger.event(`WARN teacher-led — ${err.message.split('\n')[0]}`);
      await screenshot(tt, `teacherled-attempt${attempt}`);
      if (attempt >= 2) throw err;
      // Recovery reset: hub → re-enter enCORE (cookied SSO skips the hops).
      // enterEncore starts from the hub, so looping is the reset. Never back.
      logger.event('Recovering: hub → re-enter enCORE');
    }
  }
}

// TODO(--student-led): recon'd 2026-07-17, unbuilt. Start a Session →
// Student-Led "Get started" → 3-step wizard: 1) Select Student (single,
// Next) → 2) Select Session Mode — lesson-source radios: IEP Goals /
// Facilitator-Selected Lessons / Recommended Lessons (default) / Benchmark
// Assessments; right panel: subject checkboxes (ELA, Math, Science, Social
// Studies) + lesson checklist → 3) Prepare Session (NOT entered — assumed
// confirm-and-launch; codegen it first). Config stub "studentLed" ships in
// config.template.json. Same never-past-the-launch-button rule as
// Teacher-Led: stop at step 3 unless studentLed.autoBegin.

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
    if (state.ttPage && !state.ttPage.isClosed()) {
      const inner = innerLocator(state.ttPage);
      // Log out only if we're impersonating a student right now.
      if (await visibleSoon(inner.getByText('My Activities').first(), 1_500)) {
        const logout = inner.getByText(/log ?out/i).first();
        if (await visibleSoon(logout, 1_500)) {
          await logout.click({ timeout: 3_000 }).catch(() => {});
          await state.ttPage.waitForURL(/#\/home/, { timeout: 8_000 }).catch(() => {});
          log?.event('Logged the student out before exiting.');
        }
      }
    }
  } catch {}
  try {
    await state.context?.close();
  } catch {}
  log?.event('Clean exit.');
  log?.close();
  process.exit(code);
}

(async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const teacherLedOnly = process.argv.includes('--teacher-led');

  if (process.argv.includes('--student-led')) {
    console.error(
      '--student-led is not implemented yet.\n' +
        'Recon (2026-07-17): Start a Session → Student-Led "Get started" → wizard:\n' +
        '  1) Select Student (single-select, Next)\n' +
        '  2) Select Session Mode — lesson source: IEP Goals / Facilitator-Selected /\n' +
        '     Recommended (default) / Benchmark Assessments; subjects: ELA, Math,\n' +
        '     Science, Social Studies; lesson checklist\n' +
        '  3) Prepare Session (unverified — codegen before building)\n' +
        'The "studentLed" config stub is already in config.template.json.'
    );
    process.exit(1);
  }

  const config = loadConfig();

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const logger = new Logger(path.join(LOGS_DIR, `session-${fileStamp()}.txt`));
  state.logger = logger;

  process.on('SIGINT', () => shutdown(130));
  process.on('SIGTERM', () => shutdown(143));

  logger.event(
    `SESSION START${dryRun ? ' (dry run)' : ''}${teacherLedOnly ? ' (teacher-led only)' : ''} — ` +
      (teacherLedOnly
        ? `enCORE ${config.teacherLed.group ? `group "${config.teacherLed.group}"` : `${config.teacherLed.students.length} student(s)`}, ` +
          `length=${config.teacherLed.sessionLengthMin}min, autoBegin=${config.teacherLed.autoBegin}`
        : `${config.students.length} student(s), mode=${config.mode}, ` +
          `target=${config.targetActivity || '(first activity not at 100%)'}, afterRotation=${config.afterRotation}`)
  );

  const profileDir = resolveProfileDir(config.profileDir);
  fs.mkdirSync(profileDir, { recursive: true });

  const context = await launchBrowser(profileDir);
  state.context = context;
  context.on('close', () => {
    if (!state.shuttingDown && !state.finished) {
      logger.event('Browser window was closed — exiting.');
      process.exit(0);
    }
  });

  try {
    const portal = context.pages()[0] || (await context.newPage());
    await ensureCleverPortal(portal, config, logger);

    const tt = await openTeachTown(context, portal, logger);
    state.ttPage = tt;

    if (teacherLedOnly) {
      await runTeacherLed(tt, config, dryRun, logger); // idles until Ctrl+C / window close
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
    logger.event('SESSION COMPLETE');
  } catch (err) {
    logger.event(`FATAL ${err.message.split('\n')[0]}`);
    await screenshot(state.ttPage || state.context?.pages()[0], 'fatal');
    process.exitCode = 1;
  } finally {
    if (!state.shuttingDown) {
      state.finished = true;
      try {
        await state.context?.close();
      } catch {}
      logger.close();
    }
  }
})();
