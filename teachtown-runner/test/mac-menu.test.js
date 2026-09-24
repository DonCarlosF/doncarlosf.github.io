'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SUBJECT_KEYS } = require('../lib/subjects');
const { lessonCommands, menuTemplate } = require('../mac/menu');

function labelsOf(template) {
  const labels = [];
  for (const item of template) {
    if (item.label) labels.push(item.label);
    if (item.submenu) labels.push(...labelsOf(item.submenu));
  }
  return labels;
}

test('the Mac menu lists five separate starts, Dry run, Settings docs, and Quit', () => {
  const commands = lessonCommands();
  assert.deepEqual(
    commands.map((c) => c.id),
    [...SUBJECT_KEYS.map((k) => `start:${k}`), 'dry-run', 'settings-docs', 'quit']
  );
  const labels = commands.map((c) => c.label);
  assert.ok(labels.includes('Start Social Studies'));
  assert.ok(labels.includes('Start Social Skills'));
  assert.notEqual(
    commands.find((c) => c.subject === 'social-studies').label,
    commands.find((c) => c.subject === 'social-skills').label
  );

  const calls = [];
  const template = menuTemplate({
    onStart: (subject) => calls.push(['start', subject]),
    onToggleDryRun: () => calls.push(['dry-run']),
    onOpenSettings: () => calls.push(['settings']),
    onQuit: () => calls.push(['quit']),
  });
  const menuLabels = labelsOf(template);
  for (const label of labels) assert.ok(menuLabels.includes(label), label);
  for (const item of template) {
    for (const child of item.submenu || []) {
      if (typeof child.click === 'function') child.click();
    }
  }
  assert.deepEqual(
    calls.filter((c) => c[0] === 'start').map((c) => c[1]),
    [...SUBJECT_KEYS]
  );
  assert.deepEqual(calls.filter((c) => c[0] !== 'start'), [['settings'], ['quit'], ['dry-run']]);
});

test('Home shows a dry-run switch, a status line, and both social buttons', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');
  for (const key of SUBJECT_KEYS) {
    assert.match(html, new RegExp(`data-subject="${key}"`));
  }
  assert.match(html, /id="homeDry"/);
  assert.match(html, /id="homePhase"/);
  assert.match(html, /id="homeAction"/);
  assert.match(html, /School subjects for/);
  assert.match(html, /Social Skills for/);
  assert.match(html, /This is not Social Skills/);
  assert.match(html, /never stores one/);
  assert.doesNotMatch(html, /Social Studies stays checked · stops at READY/);
});
