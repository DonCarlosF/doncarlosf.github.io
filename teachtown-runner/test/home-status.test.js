'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { describeRun, classifyLine, parentStatus } = require('../lib/home-status');

test('describeRun names Social Studies and Social Skills separately', () => {
  assert.equal(
    describeRun({ action: 'studentled-subject', subject: 'social-studies', dry: true }),
    'Social Studies for Luis — practice only'
  );
  assert.equal(
    describeRun({ action: 'studentled-subject', subject: 'social-skills', dry: false }),
    'Social Skills for Luis'
  );
  assert.notEqual(
    describeRun({ action: 'studentled-subject', subject: 'social-studies' }),
    describeRun({ action: 'studentled-subject', subject: 'social-skills' })
  );
  assert.equal(describeRun({ action: 'playlist', dry: true }), 'Group playlist — practice only');
  assert.equal(describeRun({ action: 'login' }), 'Sign in');
  assert.equal(describeRun({ action: 'teacherled-live', dry: false }), 'Teacher-Led — live session');
});

test('a quiet Home screen is Waiting', () => {
  const view = parentStatus({ running: false, exitCode: null, actionLabel: '—', lines: [] });
  assert.equal(view.phase, 'waiting');
  assert.equal(view.phaseLabel, 'Waiting');
  assert.match(view.detail, /Pick a lesson/);
});

test('READY is Ready, a failed subject check needs a look, and a clean end is Finished', () => {
  assert.equal(classifyLine('[ui] started: Math for Luis — practice only').phase, 'working');
  assert.equal(classifyLine('[2026-09-24 12:00:00] READY — Math for "Luis"').phase, 'ready');
  assert.equal(classifyLine('[2026-09-24 12:00:00] SUBJECT CHECK FAILED — fix the boxes').phase, 'attention');
  assert.equal(classifyLine('[2026-09-24 12:00:00] MANUAL SIGN-IN NEEDED — type it in the browser').phase, 'attention');
  assert.match(classifyLine('[2026-09-24 12:00:00] MANUAL SIGN-IN NEEDED').detail, /never stores a password/);
  assert.equal(classifyLine('[2026-09-24 12:00:00] SESSION COMPLETE').phase, 'finished');
  assert.equal(classifyLine('[ui] runner exited (0)').phase, 'finished');
  assert.equal(classifyLine('[ui] runner exited (1)').phase, 'attention');

  const ready = parentStatus({
    running: true,
    exitCode: null,
    actionLabel: 'Math for Luis — practice only',
    lines: ['[ui] started: Math for Luis — practice only', '[2026-09-24 12:00:00] READY — Math for "Luis"'],
  });
  assert.equal(ready.phase, 'ready');
  assert.equal(ready.lastAction, 'Math for Luis — practice only');

  const done = parentStatus({
    running: false,
    exitCode: 0,
    actionLabel: 'Social Studies for Luis — practice only',
    lines: ['[ui] started: Social Studies for Luis — practice only', '[2026-09-24 12:01:00] SESSION COMPLETE', '[ui] runner exited (0)'],
  });
  assert.equal(done.phase, 'finished');
  assert.match(done.lastAction, /Social Studies/);
  assert.doesNotMatch(done.lastAction, /Social Skills/);
});

test('a run that stops with an error is Needs a look', () => {
  const view = parentStatus({
    running: false,
    exitCode: 1,
    actionLabel: 'Social Skills for Luis',
    lines: ['[ui] started: Social Skills for Luis'],
  });
  assert.equal(view.phase, 'attention');
  assert.equal(view.phaseLabel, 'Needs a look');
});
