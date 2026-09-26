'use strict';
// Pure-logic tests for the Student-Led subject planner. No browser, no
// network: `node --test test/` (or `npm test`).
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SUBJECT_KEYS,
  normalizeSubjectKey,
  classifySubjectLabel,
  planSubjectSelection,
  subjectStateIsCorrect,
  describeSubjectState,
} = require('../lib/subjects');

// The live step-2 panel as recon'd: every subject checked by default, plus a
// lesson checklist whose rows mention subjects by name.
const allChecked = () => [
  { label: 'ELA', checked: true },
  { label: 'Math', checked: true },
  { label: 'Science', checked: true },
  { label: 'Social Studies', checked: true },
  { label: 'Math: Add within 20', checked: true },
  { label: 'Science Vocabulary — Weather', checked: false },
  { label: 'Select all lessons', checked: true },
];

test('the four button keys are exactly ELA, Math, Social Studies, Science', () => {
  assert.deepEqual(SUBJECT_KEYS, ['ela', 'math', 'social-studies', 'science']);
});

test('normalizeSubjectKey accepts the spellings a human or a shortcut will pass', () => {
  for (const [raw, key] of [
    ['ela', 'ela'], ['ELA', 'ela'], [' English Language Arts ', 'ela'],
    ['math', 'math'], ['Math', 'math'], ['Mathematics', 'math'],
    ['science', 'science'], ['Science', 'science'],
    ['social-studies', 'social-studies'], ['Social Studies', 'social-studies'], ['social_studies', 'social-studies'],
    ['SocialStudies', 'social-studies'], ['social', 'social-studies'],
    // the first-shipped key and label keep working (old shortcuts, old notes)
    ['social-skills', 'social-studies'], ['Social Skills', 'social-studies'], ['SocialSkills', 'social-studies'],
  ]) {
    assert.equal(normalizeSubjectKey(raw), key, `"${raw}"`);
  }
  for (const bad of ['', '  ', 'history', 'ela math', null, undefined, 42]) {
    assert.equal(normalizeSubjectKey(bad), null, `"${bad}" must not resolve`);
  }
});

test('classifySubjectLabel matches whole labels only — lesson rows never count', () => {
  assert.equal(classifySubjectLabel('ELA'), 'ela');
  assert.equal(classifySubjectLabel(' Math '), 'math');
  assert.equal(classifySubjectLabel('Math (12)'), 'math'); // lesson counters
  assert.equal(classifySubjectLabel('Science:'), 'science');
  assert.equal(classifySubjectLabel('Social Studies'), 'social-studies'); // 2026-07 recon spelling
  assert.equal(classifySubjectLabel('Social Skills'), 'social-studies');
  assert.equal(classifySubjectLabel('Math: Add within 20'), null);
  assert.equal(classifySubjectLabel('Science Vocabulary — Weather'), null);
  assert.equal(classifySubjectLabel('Select all lessons'), null);
  assert.equal(classifySubjectLabel(''), null);
  assert.equal(classifySubjectLabel(undefined), null);
});

for (const key of SUBJECT_KEYS) {
  test(`plan for "${key}" unchecks the other three and leaves lesson rows alone`, () => {
    const boxes = allChecked();
    const plan = planSubjectSelection(boxes, key);
    assert.equal(plan.key, key);
    assert.notEqual(plan.target, null);
    assert.equal(boxes[plan.target].label.toLowerCase().replace(' ', '-'), key);
    // Exactly three toggles: the three other subject boxes, none of the lesson rows.
    assert.equal(plan.toggles.length, 3);
    for (const i of plan.toggles) assert.ok(i < 4, `toggle ${i} is not a subject box`);
    assert.ok(!plan.toggles.includes(plan.target));
    // Expected end state: target checked, other subjects unchecked, rest untouched.
    assert.deepEqual(plan.expected.slice(0, 4).filter(Boolean).length, 1);
    assert.equal(plan.expected[plan.target], true);
    assert.deepEqual(plan.expected.slice(4), [true, false, true]);
    assert.deepEqual(plan.warnings, []);
  });
}

test('an already-correct screen plans zero toggles and passes verification', () => {
  const boxes = allChecked();
  boxes[0].checked = false; // ELA
  boxes[2].checked = false; // Science
  boxes[3].checked = false; // Social Studies
  const plan = planSubjectSelection(boxes, 'math');
  assert.deepEqual(plan.toggles, []);
  assert.equal(subjectStateIsCorrect(boxes, 'math'), true);
  assert.equal(subjectStateIsCorrect(boxes, 'ela'), false);
});

test('a screen where nothing is checked needs exactly one click — the target', () => {
  const boxes = allChecked().map((b) => ({ ...b, checked: false }));
  const plan = planSubjectSelection(boxes, 'science');
  assert.deepEqual(plan.toggles, [2]);
});

test('a missing target box is reported, not guessed', () => {
  const boxes = allChecked().filter((b) => b.label !== 'Science');
  const plan = planSubjectSelection(boxes, 'science');
  assert.equal(plan.target, null);
  assert.match(plan.warnings.join('\n'), /no "Science" checkbox/);
  assert.equal(subjectStateIsCorrect(boxes, 'science'), false);
});

test('duplicate-looking target boxes warn and use the first', () => {
  const boxes = [...allChecked(), { label: 'Social Skills', checked: true }];
  const plan = planSubjectSelection(boxes, 'social-studies');
  assert.equal(plan.target, 3);
  assert.match(plan.warnings.join('\n'), /2 checkboxes look like "Social Studies"/);
  assert.ok(plan.toggles.includes(7), 'the second look-alike is unchecked too');
});

test('a missing non-target subject is only a warning', () => {
  const boxes = allChecked().filter((b) => b.label !== 'ELA');
  const plan = planSubjectSelection(boxes, 'math');
  assert.notEqual(plan.target, null);
  assert.equal(plan.toggles.length, 2);
  assert.match(plan.warnings.join('\n'), /no "ELA" checkbox found \(nothing to uncheck there\)/);
});

test('an unknown subject key throws instead of clicking anything', () => {
  assert.throws(() => planSubjectSelection(allChecked(), 'history'), /unknown subject "history"/);
});

test('describeSubjectState lists only the subject boxes with their state', () => {
  const boxes = allChecked();
  boxes[1].checked = false;
  assert.equal(describeSubjectState(boxes), 'ELA [x]  Math [ ]  Science [x]  Social Studies [x]');
  assert.equal(describeSubjectState([]), '(no subject checkboxes recognized)');
});
