'use strict';
/*
 * enCORE Student-Led, step 2 (the lesson picker — subject checkboxes).
 * The stepper can still say "Select Session Mode" on every step; that title
 * is not how the runner detects this screen (see lib/student-led.js).
 *
 * The runner's job on that screen is exactly what a human does today by hand
 * after Start Session — uncheck every subject except the one being taught.
 * This module owns that decision so it can be unit-tested without a browser:
 *
 *   planSubjectSelection(boxes, key)  pure: which boxes to click, and why
 *   selectOnlySubject(root, key, …)   Playwright: read → plan → click → verify
 *
 * Only the four subject boxes are ever touched. Anything else with a
 * checkbox on that screen (the lesson checklist, "select all" rows) is left
 * exactly as found — `match` is anchored against the WHOLE label, so a lesson
 * called "Math: Add within 20" never counts as the Math subject box.
 */

// Keys are what the CLI / UI / Windows launchers pass (`--subject KEY`).
// Order = the order the buttons are laid out (ELA, Math, Social Skills,
// Science). "Social Skills" also accepts the "Social Studies" spelling the
// 2026-07 recon captured; a tenant shows one or the other, never both.
const SUBJECTS = {
  ela: { label: 'ELA', match: /^(ela|english language arts)$/i },
  math: { label: 'Math', match: /^math(ematics)?$/i },
  'social-skills': { label: 'Social Skills', match: /^social[ -]?(skills|studies)$/i },
  science: { label: 'Science', match: /^science$/i },
};
const SUBJECT_KEYS = Object.keys(SUBJECTS);

// Loose user input → canonical key (null when it isn't a subject we know).
// "ELA", "ela", "Math", "social skills", "social_skills", "SocialSkills",
// "social", "Social Studies", "science" all resolve.
function normalizeSubjectKey(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (!s) return null;
  if (s === 'ela' || s === 'english-language-arts' || s === 'english') return 'ela';
  if (s === 'math' || s === 'mathematics' || s === 'maths') return 'math';
  if (s === 'science' || s === 'sci') return 'science';
  if (/^social(-?(skills|studies))?$/.test(s) || s === 'socialskills' || s === 'socialstudies' || s === 'ss') return 'social-skills';
  return null;
}

// Whole-label classification. Trailing counters ("Math (12)") and colons are
// stripped first; anything longer than a short subject label is not a
// subject box by definition.
function classifySubjectLabel(text) {
  if (typeof text !== 'string') return null;
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/\s*[(\[]\s*\d+\s*[)\]]\s*$/, '') // "(12)" / "[3]" counters
    .replace(/\s*:\s*$/, '')
    .trim();
  if (!t || t.length > 32) return null;
  for (const key of SUBJECT_KEYS) {
    if (SUBJECTS[key].match.test(t)) return key;
  }
  return null;
}

/*
 * boxes: [{ label, checked }] in on-screen order.
 * Returns:
 *   target    index of the box that must end up checked (null if not found)
 *   toggles   indices to click, in order, to reach "only target checked"
 *   subjects  index → key for every box recognized as a subject box
 *   warnings  human-readable notes (no target / duplicates / missing subjects)
 *   expected  the checked-state the boxes should show after the toggles
 */
function planSubjectSelection(boxes, wantKey) {
  const key = normalizeSubjectKey(wantKey);
  if (!key) throw new Error(`unknown subject "${wantKey}" — use one of: ${SUBJECT_KEYS.join(', ')}`);
  const list = Array.isArray(boxes) ? boxes : [];
  const subjects = {};
  const byKey = {};
  list.forEach((b, i) => {
    const k = classifySubjectLabel(b && b.label);
    if (!k) return;
    subjects[i] = k;
    (byKey[k] = byKey[k] || []).push(i);
  });

  const warnings = [];
  const matches = byKey[key] || [];
  let target = null;
  if (matches.length === 0) {
    warnings.push(`no "${SUBJECTS[key].label}" checkbox found on this screen`);
  } else {
    target = matches[0];
    if (matches.length > 1) {
      warnings.push(`${matches.length} checkboxes look like "${SUBJECTS[key].label}" — using the first (position ${target + 1})`);
    }
  }
  for (const k of SUBJECT_KEYS) {
    if (k !== key && !byKey[k]) warnings.push(`no "${SUBJECTS[k].label}" checkbox found (nothing to uncheck there)`);
  }

  const toggles = [];
  const expected = list.map((b) => !!(b && b.checked));
  Object.keys(subjects).forEach((iStr) => {
    const i = Number(iStr);
    const want = i === target;
    if (!!list[i].checked !== want) toggles.push(i);
    expected[i] = want;
  });
  return { key, target, toggles, subjects, warnings, expected };
}

// True when every recognized subject box is checked iff it is the target.
function subjectStateIsCorrect(boxes, wantKey) {
  const plan = planSubjectSelection(boxes, wantKey);
  return plan.target != null && plan.toggles.length === 0;
}

// One-line state summary for the log: "ELA [ ]  Math [x]  Social Skills [ ]  Science [ ]".
function describeSubjectState(boxes) {
  const parts = [];
  for (const b of Array.isArray(boxes) ? boxes : []) {
    if (!classifySubjectLabel(b && b.label)) continue;
    parts.push(`${b.label.replace(/\s+/g, ' ').trim()} [${b.checked ? 'x' : ' '}]`);
  }
  return parts.length ? parts.join('  ') : '(no subject checkboxes recognized)';
}

/* ------------------------- Playwright side --------------------------- */

const CHECKBOX_SELECTOR = 'input[type="checkbox"], [role="checkbox"]';

// Read every checkbox in `root` (Page, Frame, FrameLocator or Locator) with
// the label a human would read for it. Runs in-page so one round trip covers
// the whole screen.
async function readCheckboxes(root) {
  return root.locator(CHECKBOX_SELECTOR).evaluateAll((els) =>
    els.map((el) => {
      const native = el.tagName === 'INPUT';
      const doc = el.ownerDocument;
      let label = el.getAttribute('aria-label') || '';
      if (!label) {
        const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
        label = ids.map((id) => (doc.getElementById(id) || {}).textContent || '').join(' ');
      }
      if (!label.trim()) {
        const wrap = el.closest('label');
        const forLabel = el.id ? doc.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`) : null;
        const l = wrap || forLabel;
        if (l) label = l.textContent || '';
      }
      if (!label.trim() && !native) label = el.textContent || ''; // role=checkbox widgets carry their own text
      if (!label.trim() && el.parentElement) label = el.parentElement.textContent || '';
      const rect = el.getBoundingClientRect();
      return {
        label: label.replace(/\s+/g, ' ').trim(),
        checked: native ? !!el.checked : el.getAttribute('aria-checked') === 'true',
        disabled: native ? !!el.disabled : el.getAttribute('aria-disabled') === 'true',
        visible: rect.width > 0 && rect.height > 0,
      };
    })
  );
}

// Click the i-th checkbox the way a person would: the box itself when it is
// visible, otherwise its label (custom-styled checkboxes hide the input).
// Falls back to a DOM click on the label/input.
async function clickCheckbox(root, i, box) {
  const el = root.locator(CHECKBOX_SELECTOR).nth(i);
  if (box.visible) {
    try {
      await el.click({ timeout: 3_000 });
      return;
    } catch {
      /* fall through to the label */
    }
  }
  const wrap = el.locator('xpath=ancestor::label[1]');
  if (await wrap.isVisible().catch(() => false)) {
    try {
      await wrap.click({ timeout: 3_000 });
      return;
    } catch {}
  }
  await el.evaluate((node) => {
    const doc = node.ownerDocument;
    const l =
      node.closest('label') ||
      (node.id ? doc.querySelector(`label[for="${node.id.replace(/"/g, '\\"')}"]`) : null);
    (l || node).click();
  });
}

/*
 * Leave ONLY the requested subject checked. Reads the screen, plans, clicks,
 * re-reads to verify, and retries once — the app re-renders the lesson list
 * on every toggle, so a click can land mid-redraw.
 *
 * Never throws for "wrong state": returns { ok, boxes, plan, attempts } so the
 * caller decides (the runner stops and hands the screen to the human).
 */
async function selectOnlySubject(root, wantKey, opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const attempts = Number.isInteger(opts.attempts) && opts.attempts > 0 ? opts.attempts : 2;
  const settleMs = Number.isInteger(opts.settleMs) ? opts.settleMs : 350;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let boxes = await readCheckboxes(root);
  let plan = planSubjectSelection(boxes, wantKey);
  for (const w of plan.warnings) log(`WARN subjects: ${w}`);
  if (plan.target == null) return { ok: false, boxes, plan, attempts: 0 };

  let attempt = 0; // click rounds actually performed
  while (plan.toggles.length > 0 && attempt < attempts) {
    attempt += 1;
    for (const i of plan.toggles) {
      if (boxes[i].disabled) {
        log(`WARN subjects: "${boxes[i].label}" is disabled — cannot ${boxes[i].checked ? 'uncheck' : 'check'} it`);
        continue;
      }
      await clickCheckbox(root, i, boxes[i]);
      await sleep(settleMs);
    }
    boxes = await readCheckboxes(root);
    plan = planSubjectSelection(boxes, wantKey);
  }
  const ok = plan.target != null && plan.toggles.length === 0;
  return { ok, boxes, plan, attempts: attempt };
}

module.exports = {
  SUBJECTS,
  SUBJECT_KEYS,
  CHECKBOX_SELECTOR,
  normalizeSubjectKey,
  classifySubjectLabel,
  planSubjectSelection,
  subjectStateIsCorrect,
  describeSubjectState,
  readCheckboxes,
  selectOnlySubject,
};
