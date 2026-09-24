'use strict';
// Pure-logic tests for the Student-Led subject planner. No browser, no
// network: `node --test test/` (or `npm test`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  SUBJECT_KEYS,
  normalizeSubjectKey,
  classifySubjectLabel,
  planSubjectSelection,
  subjectStateIsCorrect,
  describeSubjectState,
} = require('../lib/subjects');

// enCORE domains plus the separate Social Skills box, all checked, plus a
// lesson checklist whose rows mention subjects by name.
const allChecked = () => [
  { label: 'ELA', checked: true },
  { label: 'Math', checked: true },
  { label: 'Science', checked: true },
  { label: 'Social Studies', checked: true },
  { label: 'Social Skills', checked: true },
  { label: 'Math: Add within 20', checked: true },
  { label: 'Science Vocabulary — Weather', checked: false },
  { label: 'Select all lessons', checked: true },
];

const encoreOnly = () => allChecked().filter((b) => b.label !== 'Social Skills');

test('the five launch keys are ELA, Math, Science, Social Studies, and Social Skills', () => {
  assert.deepEqual(SUBJECT_KEYS, ['ela', 'math', 'science', 'social-studies', 'social-skills']);
});

test('normalizeSubjectKey keeps Social Studies and Social Skills apart', () => {
  for (const [raw, key] of [
    ['ela', 'ela'], ['ELA', 'ela'], [' English Language Arts ', 'ela'],
    ['math', 'math'], ['Math', 'math'], ['Mathematics', 'math'],
    ['science', 'science'], ['Science', 'science'],
    ['social-studies', 'social-studies'], ['Social Studies', 'social-studies'],
    ['social_studies', 'social-studies'], ['SocialStudies', 'social-studies'],
    ['social-skills', 'social-skills'], ['Social Skills', 'social-skills'],
    ['social_skills', 'social-skills'], ['SocialSkills', 'social-skills'],
  ]) {
    assert.equal(normalizeSubjectKey(raw), key, `"${raw}"`);
  }
  assert.notEqual(normalizeSubjectKey('Social Studies'), normalizeSubjectKey('Social Skills'));
  assert.notEqual(normalizeSubjectKey('social-studies'), 'social-skills');
  assert.notEqual(normalizeSubjectKey('social-skills'), 'social-studies');
  // A bare "social" is ambiguous — it must not pick either function.
  for (const bad of ['', '  ', 'history', 'ela math', 'social', 'ss', 'studies', 'skills', null, undefined, 42]) {
    assert.equal(normalizeSubjectKey(bad), null, `"${bad}" must not resolve`);
  }
});

test('classifySubjectLabel matches whole labels only — lesson rows never count', () => {
  assert.equal(classifySubjectLabel('ELA'), 'ela');
  assert.equal(classifySubjectLabel(' Math '), 'math');
  assert.equal(classifySubjectLabel('Math (12)'), 'math'); // lesson counters
  assert.equal(classifySubjectLabel('Science:'), 'science');
  assert.equal(classifySubjectLabel('Social Studies'), 'social-studies');
  assert.equal(classifySubjectLabel('Social Studies (4)'), 'social-studies');
  assert.equal(classifySubjectLabel('Social Skills'), 'social-skills');
  assert.equal(classifySubjectLabel('Social Skills (2)'), 'social-skills');
  assert.notEqual(classifySubjectLabel('Social Studies'), classifySubjectLabel('Social Skills'));
  assert.equal(classifySubjectLabel('Math: Add within 20'), null);
  assert.equal(classifySubjectLabel('Science Vocabulary — Weather'), null);
  assert.equal(classifySubjectLabel('Social Studies: Communities'), null);
  assert.equal(classifySubjectLabel('Social Skills: Taking turns'), null);
  assert.equal(classifySubjectLabel('Select all lessons'), null);
  assert.equal(classifySubjectLabel(''), null);
  assert.equal(classifySubjectLabel(undefined), null);
});

for (const key of ['ela', 'math', 'science', 'social-studies', 'social-skills']) {
  test(`plan for "${key}" unchecks the other subjects and leaves lesson rows alone`, () => {
    const boxes = allChecked();
    const plan = planSubjectSelection(boxes, key);
    assert.equal(plan.key, key);
    assert.notEqual(plan.target, null);
    assert.equal(classifySubjectLabel(boxes[plan.target].label), key);
    // The other four subject boxes, none of the lesson rows.
    assert.equal(plan.toggles.length, 4);
    for (const i of plan.toggles) assert.ok(i < 5, `toggle ${i} is not a subject box`);
    assert.ok(!plan.toggles.includes(plan.target));
    assert.deepEqual(plan.expected.slice(0, 5).filter(Boolean).length, 1);
    assert.equal(plan.expected[plan.target], true);
    assert.deepEqual(plan.expected.slice(5), [true, false, true]);
    assert.deepEqual(plan.warnings, []);
  });
}

test('Social Studies and Social Skills are different boxes', () => {
  const boxes = allChecked();
  const studies = planSubjectSelection(boxes, 'social-studies');
  const skills = planSubjectSelection(boxes, 'social-skills');
  assert.notEqual(studies.target, skills.target);
  assert.equal(classifySubjectLabel(boxes[studies.target].label), 'social-studies');
  assert.equal(classifySubjectLabel(boxes[skills.target].label), 'social-skills');
  assert.ok(studies.toggles.includes(skills.target), 'Social Studies run unchecks Social Skills');
  assert.ok(skills.toggles.includes(studies.target), 'Social Skills run unchecks Social Studies');
  assert.equal(studies.warnings.length, 0);
  assert.equal(skills.warnings.length, 0);
});

test('an enCORE screen labeled Social Studies is not the Social Skills button', () => {
  const boxes = encoreOnly();
  const studies = planSubjectSelection(boxes, 'social-studies');
  assert.equal(studies.target, 3);
  assert.equal(classifySubjectLabel(boxes[studies.target].label), 'social-studies');
  assert.deepEqual(studies.warnings, []);
  assert.equal(studies.toggles.length, 3);

  const skills = planSubjectSelection(boxes, 'social-skills');
  assert.equal(skills.target, null);
  assert.deepEqual(skills.toggles, [], 'must not click the Social Studies box');
  assert.match(skills.warnings.join('\n'), /no "Social Skills" checkbox/);
  assert.equal(subjectStateIsCorrect(boxes, 'social-skills'), false);
  assert.equal(subjectStateIsCorrect(boxes, 'social-studies'), false); // still all checked
});

test('an already-correct screen plans zero toggles and passes verification', () => {
  const boxes = allChecked();
  boxes[0].checked = false; // ELA
  boxes[2].checked = false; // Science
  boxes[3].checked = false; // Social Studies
  boxes[4].checked = false; // Social Skills
  const plan = planSubjectSelection(boxes, 'math');
  assert.deepEqual(plan.toggles, []);
  assert.equal(subjectStateIsCorrect(boxes, 'math'), true);
  assert.equal(subjectStateIsCorrect(boxes, 'ela'), false);
  assert.equal(subjectStateIsCorrect(boxes, 'social-studies'), false);
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
  assert.deepEqual(plan.toggles, []);
  assert.match(plan.warnings.join('\n'), /no "Science" checkbox/);
  assert.equal(subjectStateIsCorrect(boxes, 'science'), false);
});

test('duplicate-looking target boxes warn and use the first', () => {
  const boxes = [...allChecked(), { label: 'Social Skills', checked: true }];
  const plan = planSubjectSelection(boxes, 'social-skills');
  assert.equal(plan.target, 4);
  assert.match(plan.warnings.join('\n'), /2 checkboxes look like "Social Skills"/);
  assert.ok(plan.toggles.includes(8), 'the second look-alike is unchecked too');
  assert.ok(!plan.warnings.join('\n').includes('Social Studies'), 'Social Studies is not a Social Skills duplicate');
});

test('a missing non-target enCORE subject is only a warning', () => {
  const boxes = allChecked().filter((b) => b.label !== 'ELA');
  const plan = planSubjectSelection(boxes, 'math');
  assert.notEqual(plan.target, null);
  assert.equal(plan.toggles.length, 3);
  assert.match(plan.warnings.join('\n'), /no "ELA" checkbox found \(nothing to uncheck there\)/);
});

test('a missing Social Skills box does not warn when teaching an enCORE subject', () => {
  const plan = planSubjectSelection(encoreOnly(), 'ela');
  assert.equal(plan.target, 0);
  assert.deepEqual(plan.warnings, []);
  assert.equal(plan.toggles.length, 3);
});

test('an unknown subject key throws instead of clicking anything', () => {
  assert.throws(() => planSubjectSelection(allChecked(), 'history'), /unknown subject "history"/);
  assert.throws(() => planSubjectSelection(allChecked(), 'social'), /unknown subject "social"/);
});

test('describeSubjectState lists only the subject boxes with their state', () => {
  const boxes = allChecked();
  boxes[1].checked = false;
  assert.equal(
    describeSubjectState(boxes),
    'ELA [x]  Math [ ]  Science [x]  Social Studies [x]  Social Skills [x]'
  );
  assert.equal(describeSubjectState([]), '(no subject checkboxes recognized)');
});

test('Windows launchers pass distinct subject keys', () => {
  const windows = path.join(__dirname, '..', 'windows');
  const studies = fs.readFileSync(path.join(windows, 'Luis-Social-Studies.cmd'), 'utf8');
  const skills = fs.readFileSync(path.join(windows, 'Luis-Social-Skills.cmd'), 'utf8');
  assert.match(studies, /social-studies/);
  assert.match(skills, /social-skills/);
  assert.doesNotMatch(studies, /social-skills/);
  assert.doesNotMatch(skills, /social-studies/);
  const installer = fs.readFileSync(path.join(windows, 'install-shortcuts.ps1'), 'utf8');
  assert.match(installer, /Luis - Social Studies|Social Studies/);
  assert.match(installer, /Social Skills/);
  assert.match(installer, /Luis-Social-Studies\.cmd/);
  assert.match(installer, /Luis-Social-Skills\.cmd/);
});
