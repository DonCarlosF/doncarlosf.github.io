'use strict';
// The step-2 detector must ignore the stepper header. No browser.
const test = require('node:test');
const assert = require('node:assert/strict');

const { isStudentLedStep2Text, STEP2_SOURCE } = require('../lib/student-led');

test('step-2 copy is the lesson picker, not the stepper header', () => {
  assert.equal(STEP2_SOURCE.includes('select session mode'), false);
  for (const chrome of [
    'Select Session Mode',
    'Select Student',
    'Choose one learner, then continue.',
    'Next',
    'Recommended', // the radio label is "Recommended Lessons", not this alone
  ]) {
    assert.equal(isStudentLedStep2Text(chrome), false, chrome);
  }
  for (const hit of [
    "Select lessons for Luis's Student-Led Session",
    'Use the domain selections below to choose what this session covers.',
    'Recommended Lessons',
    '  recommended lessons ',
  ]) {
    assert.equal(isStudentLedStep2Text(hit), true, hit);
  }
});
