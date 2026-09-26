'use strict';
// Para page logic without a browser: which learners/buttons config.json
// yields (lib/para-config.js), and how the runner's log lines turn into the
// steps a para sees (lib/para-status.js). `npm test`.
//
// Pseudonyms only — "Tester" stands in for any second learner.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PARA_SUBJECT_ORDER,
  learnerPseudonyms,
  routineErrors,
  routineFor,
  routinePlaylist,
  paraInfo,
} = require('../lib/para-config');
const { initialState, reduce, view } = require('../lib/para-status');

const DISPLAY = 'Display Name Stand-in';
const cfg = () => ({
  studentLed: { learnerPseudonym: 'Luis', learners: { Luis: DISPLAY, Tester: '' } },
  socialSkillsRoutines: { Tester: { target: 'Tell the Truth', movieTimes: 5, thenActivity: true } },
});

/* --------------------------- para-config --------------------------- */

test('the page lays subjects out Social Studies, ELA, Math, Science', () => {
  assert.deepEqual(PARA_SUBJECT_ORDER, ['social-studies', 'ela', 'math', 'science']);
  assert.deepEqual(paraInfo(cfg()).subjects.map((s) => s.label), ['Social Studies', 'ELA', 'Math', 'Science']);
});

test('learners: primary first, then the learner map, then routine-only learners, each once', () => {
  const c = cfg();
  c.socialSkillsRoutines.Solo = { target: 'Wait Your Turn' };
  assert.deepEqual(learnerPseudonyms(c), ['Luis', 'Tester', 'Solo']);
  assert.deepEqual(learnerPseudonyms({}), ['Luis'], 'a config without studentLed still shows the default learner');
});

test('paraInfo never carries display names — only whether one is set', () => {
  const info = paraInfo(cfg());
  assert.ok(!JSON.stringify(info).includes(DISPLAY));
  assert.deepEqual(
    info.learners.map((l) => [l.pseudonym, l.ready]),
    [['Luis', true], ['Tester', false]]
  );
  assert.equal(paraInfo(cfg(), { configMissing: true }).learners[0].ready, false);
});

test('a routine expands to N movie entries then one activity entry, in the runner playlist format', () => {
  const r = routineFor(cfg(), 'Tester');
  assert.deepEqual(r, { target: 'Tell the Truth', movieTimes: 5, thenActivity: true });
  const list = routinePlaylist(r);
  assert.equal(list.length, 6);
  assert.deepEqual(list.slice(0, 5), Array(5).fill({ mode: 'movie', target: 'Tell the Truth' }));
  assert.deepEqual(list[5], { mode: 'activity', target: 'Tell the Truth' });
  assert.deepEqual(routinePlaylist({ target: 'X', movieTimes: 2, thenActivity: false }), [
    { mode: 'movie', target: 'X' },
    { mode: 'movie', target: 'X' },
  ]);
});

test('routine defaults: 5 movies then the activity', () => {
  const c = cfg();
  c.socialSkillsRoutines.Tester = { target: ' Tell the Truth ' };
  assert.deepEqual(routineFor(c, 'Tester'), { target: 'Tell the Truth', movieTimes: 5, thenActivity: true });
  assert.equal(routineFor(c, 'Luis'), null);
});

test('invalid routines are reported and never produce a button', () => {
  assert.match(routineErrors({}, 'r').join(), /target/);
  assert.match(routineErrors({ target: 'X', movieTimes: -1 }, 'r').join(), /movieTimes/);
  assert.match(routineErrors({ target: 'X', movieTimes: 2.5 }, 'r').join(), /movieTimes/);
  assert.match(routineErrors({ target: 'X', thenActivity: 'yes' }, 'r').join(), /thenActivity/);
  assert.match(routineErrors({ target: 'X', movieTimes: 0, thenActivity: false }, 'r').join(), /plays nothing/);
  assert.deepEqual(routineErrors({ target: 'X', movieTimes: 0 }, 'r'), []);
  const c = cfg();
  c.socialSkillsRoutines.Tester = { target: '' };
  assert.equal(routineFor(c, 'Tester'), null);
});

/* --------------------------- para-status --------------------------- */

const CTX = {
  defaultLearner: 'Luis',
  subjects: { 'social-studies': 'Social Studies', ela: 'ELA', math: 'Math', science: 'Science' },
  routines: { Tester: { target: 'Tell the Truth', movieTimes: 5, thenActivity: true } },
};
const L = (msg) => ({ type: 'line', text: `[2026-09-25 09:00:00] ${msg}` });
const status = (over) => Object.assign({ type: 'status', running: true, startedAt: 1000, exitCode: null }, over);
const play = (events, s = initialState()) => events.reduce(reduce, s);

const ENCORE_TO_READY = [
  { type: 'line', text: '[ui] started: studentled-subject' },
  status({ action: 'studentled-subject', learner: 'Luis', subject: 'math' }),
  L('SESSION START (student-led) — enCORE Student-Led, learner "Luis", subject=math, lessonSource=recommended, autoBegin=false'),
  L('Opening TeachTown directly: https://example.invalid/nav/'),
  L('TeachTown home loaded (#/home) — direct session active'),
  L('STUDENT-LED — entering enCORE (Math for "Luis")'),
  L('Selected learner "Luis"'),
  L('Step 2 opened on the learner click (no Next on step 1)'),
  L('SUBJECTS before: ELA [x]  Math [x]  Science [x]  Social Studies [x]'),
  L('SUBJECTS after:  ELA [ ]  Math [x]  Science [ ]  Social Studies [ ]'),
  L('SUBJECTS OK — only Math is checked for "Luis"'),
  L('READY — Math for "Luis". Press Next on screen and launch when the group is ready.'),
];

test('idle server → the subject buttons', () => {
  const s = play([{ type: 'status', running: false, startedAt: 0, exitCode: null, action: null }]);
  assert.equal(view(s, CTX).screen, 'pick');
  assert.equal(view(s, CTX).note, null);
});

test('enCORE run walks the four steps and ends on "Ready" with a confirm-to-close button', () => {
  const steps = [];
  let s = initialState();
  for (const ev of ENCORE_TO_READY) {
    s = reduce(s, ev);
    const v = view(s, CTX);
    if (v.screen === 'progress') steps.push(v.step);
  }
  assert.deepEqual([...new Set(steps)], [1, 2, 3, 4]);
  const v = view(s, CTX);
  assert.equal(v.tone, 'ok');
  assert.match(v.title, /^Ready/);
  assert.match(v.detail, /Only Math is checked for Luis/);
  assert.deepEqual(v.steps, ['Open enCORE', 'Find Luis', 'Only Math', 'Your turn']);
  assert.match(v.stop.label, /close enCORE/);
  assert.ok(v.stop.confirm, 'closing a live session asks first');
});

test('manual sign-in shows "Please sign in" until the run moves past it', () => {
  let s = play(ENCORE_TO_READY.slice(0, 3));
  s = reduce(s, L("MANUAL SIGN-IN NEEDED — sign in in the open browser window; I'll continue automatically."));
  assert.equal(view(s, CTX).title, 'Please sign in');
  assert.equal(view(s, CTX).stop.confirm, null, 'cancelling before anything started needs no confirm');
  s = reduce(s, L('TeachTown home loaded (#/home) — direct session active'));
  assert.equal(view(s, CTX).title, 'Opening enCORE…');
});

test('the result is the same whether the exit status comes before or after the replayed lines', () => {
  const exit = status({ action: 'studentled-subject', learner: 'Luis', subject: 'math', running: false, exitCode: 130 });
  const stopLine = L('STOP pressed in the UI — cleaning up');
  const live = play([...ENCORE_TO_READY, stopLine, exit]);
  const replay = play([exit, ...ENCORE_TO_READY.filter((e) => e.type === 'line'), stopLine]);
  for (const s of [live, replay]) {
    const v = view(s, CTX);
    assert.equal(v.screen, 'pick');
    assert.deepEqual(v.note, { tone: 'ok', text: 'Math session for Luis closed.' });
  }
});

test('a new run replaces the previous run\'s facts', () => {
  let s = play([...ENCORE_TO_READY, status({ action: 'studentled-subject', learner: 'Luis', subject: 'math', running: false, exitCode: 130 })]);
  s = reduce(s, status({ action: 'studentled-subject', learner: 'Luis', subject: 'ela', startedAt: 2000 }));
  const v = view(s, CTX);
  assert.equal(v.step, 1);
  assert.equal(v.title, 'Opening enCORE…');
  assert.deepEqual(s.lines, []);
});

test('SUBJECT CHECK FAILED asks the para to fix the boxes by hand', () => {
  const s = play([
    ...ENCORE_TO_READY.slice(0, 7),
    L('SUBJECT CHECK FAILED — no "Math" checkbox was recognized on this screen.'),
  ]);
  const v = view(s, CTX);
  assert.equal(v.tone, 'warn');
  assert.match(v.title, /fix the subject boxes/);
});

test('failures get plain words and a Try again', () => {
  const fatal = (msg, code = 1) =>
    view(
      play([
        ...ENCORE_TO_READY.slice(0, 3),
        L(`FATAL ${msg}`),
        status({ action: 'studentled-subject', learner: 'Luis', subject: 'math', running: false, exitCode: code }),
      ]),
      CTX
    );
  let v = fatal('SIGN-IN WINDOW EXPIRED — the TeachTown hub (#/home) never loaded within the 5-minute manual sign-in window.');
  assert.equal(v.screen, 'failed');
  assert.equal(v.retry, true);
  assert.equal(v.title, 'Nobody signed in');
  v = fatal('Student-Led step 1: the display name configured for "Luis" is not in the student list — check …');
  assert.equal(v.title, "Luis wasn't in the student list");
  v = fatal('page.goto: net::ERR_INTERNET_DISCONNECTED');
  assert.equal(v.title, "That didn't work");

  // No FATAL line at all (e.g. the runner refused config) — exit code decides.
  const bare = play([
    status({ action: 'studentled-subject', learner: 'Luis', subject: 'ela' }),
    { type: 'line', text: 'studentLed.learners["Luis"] is empty in config.json.' },
    status({ action: 'studentled-subject', learner: 'Luis', subject: 'ela', running: false, exitCode: 1 }),
  ]);
  assert.equal(view(bare, CTX).screen, 'failed');
});

test('closing the browser by hand before Ready is a stop, not a failure', () => {
  const s = play([
    ...ENCORE_TO_READY.slice(0, 5),
    L('Browser window was closed — exiting.'),
    status({ action: 'studentled-subject', learner: 'Luis', subject: 'math', running: false, exitCode: 0 }),
  ]);
  assert.deepEqual(view(s, CTX), { screen: 'pick', note: { tone: 'info', text: 'Stopped — nothing was started.' } });
});

const ROUTINE = (extra = []) => [
  status({ action: 'social-routine', learner: 'Tester' }),
  L('SESSION START — 1 student(s), playlist=6 step(s), afterRotation=stop'),
  L('TeachTown home loaded (#/home) — direct session active'),
  L(`LOGIN ${DISPLAY}`),
  ...extra,
];
const movie = (n) =>
  Array.from({ length: n }, () => [
    L('MOVIE-MODE OBSERVED: popup player window'),
    L('START Tell the Truth (movie)'),
    L('WAITING (activity live)'),
    L('DONE (player closed)'),
  ]).flat();

test('Social Skills routine: movie n of 5, then Do the Activity, then All done', () => {
  let v = view(play(ROUTINE()), CTX);
  assert.deepEqual(v.steps, ['Open Social Skills', 'Log in Tester', 'Movie ×5', 'Do the Activity']);
  assert.equal(v.step, 3);
  assert.equal(v.title, 'Starting Tell the Truth…');

  v = view(play(ROUTINE(movie(2))), CTX);
  assert.equal(v.title, 'Tell the Truth — movie 2 of 5');
  assert.match(v.detail, /next one starts by itself/);
  assert.ok(v.stop.confirm, 'stopping mid-routine asks first');

  v = view(play(ROUTINE(movie(5))), CTX);
  assert.equal(v.title, 'Tell the Truth — movie 5 of 5');
  assert.match(v.detail, /activity starts by itself/);

  v = view(play(ROUTINE([...movie(5), L('START Tell the Truth'), L('WAITING (activity live)')])), CTX);
  assert.equal(v.step, 4);
  assert.equal(v.title, 'Tell the Truth — Do the Activity');

  const done = play(
    ROUTINE([
      ...movie(5),
      L('START Tell the Truth'),
      L('DONE (player closed)'),
      L('NEXT'),
      L('SESSION COMPLETE'),
      status({ action: 'social-routine', learner: 'Tester', running: false, exitCode: 0 }),
    ])
  );
  assert.deepEqual(view(done, CTX), { screen: 'pick', note: { tone: 'ok', text: 'All done — Tell the Truth finished for Tester.' } });
});

test('routine skips are surfaced without the display name', () => {
  const s = play(
    ROUTINE([
      L(`SKIP ${DISPLAY} — playlist: "Tell the Truth" not found in list`),
      L('NEXT'),
      L('SESSION COMPLETE'),
      status({ action: 'social-routine', learner: 'Tester', running: false, exitCode: 0 }),
    ])
  );
  const v = view(s, CTX);
  assert.equal(v.note.tone, 'warn');
  assert.match(v.note.text, /Nothing played — "Tell the Truth" not found in list/);
  assert.ok(!v.note.text.includes(DISPLAY));
});

test('routine learner missing from View Students is a failure with a plain reason', () => {
  const s = play([
    status({ action: 'social-routine', learner: 'Tester' }),
    L(`SKIP ${DISPLAY} — not found in View Students list`),
    L('SESSION COMPLETE'),
    status({ action: 'social-routine', learner: 'Tester', running: false, exitCode: 0 }),
  ]);
  const v = view(s, CTX);
  assert.equal(v.screen, 'failed');
  assert.equal(v.title, "Tester wasn't in the student list");
});

test('a teacher\'s run from the full dashboard locks the para buttons until it ends', () => {
  let s = play([status({ action: 'playlist' })]);
  assert.equal(view(s, CTX).screen, 'busy');
  s = reduce(s, status({ action: 'playlist', running: false, exitCode: 0 }));
  assert.equal(view(s, CTX).screen, 'pick');
  assert.equal(view(play([status({ action: 'studentled-subject (dry run)', subject: 'math' })]), CTX).screen, 'busy');
});
