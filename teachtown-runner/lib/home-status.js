'use strict';
/*
 * Plain-language status for the parent Home screen.
 * The runner log stays available; this module turns it into
 * Waiting / Working / Ready / Needs a look / Finished.
 *
 * Loaded by Node tests and by the browser (ui-server serves this file).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HomeStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PHASE = {
    waiting: 'Waiting',
    working: 'Working',
    ready: 'Ready',
    attention: 'Needs a look',
    finished: 'Finished',
  };

  const SUBJECT_TITLES = {
    ela: 'ELA',
    math: 'Math',
    science: 'Science',
    'social-studies': 'Social Studies',
    'social-skills': 'Social Skills',
  };

  // What the Home "last action" line says. Social Studies and Social Skills
  // stay different phrases so a parent can see which one was pressed.
  function describeRun(body) {
    const action = body && body.action;
    const dry = !!(body && body.dry);
    const practice = dry ? ' — practice only' : '';
    const subject = SUBJECT_TITLES[body && body.subject];
    switch (action) {
      case 'studentled-subject':
        return subject ? `${subject} for Luis${practice}` : `Lesson for Luis${practice}`;
      case 'playlist':
        return `Group playlist${practice}`;
      case 'custom':
        return `Custom group run${practice}`;
      case 'teacherled-setup':
        return `Teacher-Led setup${practice}`;
      case 'teacherled-live':
        return dry ? 'Teacher-Led — practice only' : 'Teacher-Led — live session';
      case 'login':
        return 'Sign in';
      case 'recon-roster':
        return 'Refresh roster';
      default:
        return action ? String(action) : '—';
    }
  }

  // One log line → a phase, or null when the line is just detail.
  function classifyLine(text) {
    const line = String(text || '');
    if (/SUBJECT CHECK FAILED|SIGN-IN WINDOW EXPIRED/i.test(line)) {
      return { phase: 'attention', detail: 'Something needs you. Read the note below, then try again.' };
    }
    if (/MANUAL SIGN-IN NEEDED/i.test(line)) {
      return {
        phase: 'attention',
        detail: 'Sign in yourself in the browser window. This app never stores a password.',
      };
    }
    if (/\] READY — /.test(line)) {
      return { phase: 'ready', detail: 'Ready. Finish the last step on the TeachTown screen.' };
    }
    if (/SESSION COMPLETE|LOGIN SETUP COMPLETE|RECON COMPLETE|Clean exit\./.test(line)) {
      return { phase: 'finished', detail: 'This run is done. You can pick another lesson.' };
    }
    if (/\[ui\] runner exited \((?!0\))/.test(line)) {
      return { phase: 'attention', detail: 'The run stopped before it finished.' };
    }
    if (/\[ui\] runner exited \(0\)/.test(line)) {
      return { phase: 'finished', detail: 'This run is done. You can pick another lesson.' };
    }
    if (/\[ui\] STOP/.test(line)) {
      return { phase: 'working', detail: 'Stopping. The browser will close in a moment.' };
    }
    if (/\[ui\] started:/.test(line)) {
      return { phase: 'working', detail: 'Setting things up. Leave this window open.' };
    }
    return null;
  }

  function parentStatus(state) {
    const running = !!(state && state.running);
    const exitCode = state ? state.exitCode : null;
    const lines = state && Array.isArray(state.lines) ? state.lines : [];
    let phase = 'waiting';
    let detail = 'Nothing is running. Pick a lesson when you are ready.';
    for (const line of lines) {
      const hit = classifyLine(line);
      if (!hit) continue;
      phase = hit.phase;
      detail = hit.detail;
    }
    if (running && phase === 'waiting') {
      phase = 'working';
      detail = 'Setting things up. Leave this window open.';
    }
    const exitedBadly =
      !running && exitCode != null && exitCode !== 0 && exitCode !== '0';
    if (exitedBadly && phase !== 'finished' && phase !== 'ready') {
      phase = 'attention';
      detail = 'The run stopped before it finished.';
    }
    const lastAction = (state && state.actionLabel) || '—';
    return { phase, phaseLabel: PHASE[phase], detail, lastAction };
  }

  return { PHASE, SUBJECT_TITLES, describeRun, classifyLine, parentStatus };
});
