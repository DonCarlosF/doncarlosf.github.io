'use strict';
/*
 * The para page's view of config.json: which learners get buttons, and what
 * each button runs. Pure — the UI server hands it the parsed config.
 *
 * Learners are addressed by PSEUDONYM, exactly like Student-Led already is:
 *
 *   "studentLed": {
 *     "learnerPseudonym": "Luis",                 // listed first on the page
 *     "learners": { "Luis": "<display name>", "<pseudonym>": "<display name>" }
 *   },
 *   "socialSkillsRoutines": {
 *     "<pseudonym>": { "target": "Tell the Truth", "movieTimes": 5, "thenActivity": true }
 *   }
 *
 * Every learner gets the four enCORE Student-Led subject buttons. A learner
 * with a routine also gets one Social Skills button: log in as the learner
 * in Social Skills, watch `target` `movieTimes` times, then (thenActivity)
 * Do the Activity once. The display name is used for both apps and must
 * match what each shows (exact first, substring fallback — same as the
 * rest of the runner).
 *
 * Both maps live ONLY in the gitignored config.json. The page itself is
 * served pseudonyms and curriculum words; display names never leave the
 * server except inside the runner's own log lines.
 */

const { SUBJECTS, SUBJECT_KEYS } = require('./subjects');

// Button order on the para page (the planner's SUBJECT_KEYS order is ELA-first).
const PARA_SUBJECT_ORDER = ['social-studies', 'ela', 'math', 'science'];
const MAX_MOVIE_TIMES = 20;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function primaryPseudonym(cfg) {
  const sl = isObj(cfg && cfg.studentLed) ? cfg.studentLed : {};
  return str(sl.learnerPseudonym) || 'Luis';
}

// pseudonym → display name ('' when not filled in yet).
function displayNameFor(cfg, pseudonym) {
  const sl = isObj(cfg && cfg.studentLed) ? cfg.studentLed : {};
  const learners = isObj(sl.learners) ? sl.learners : {};
  const name = str(learners[pseudonym]);
  // The pre-build stub kept the primary learner's name in "student"; the
  // runner honors it, so the page does too.
  if (!name && pseudonym === primaryPseudonym(cfg)) return str(sl.student);
  return name;
}

// Primary learner first, then the rest of studentLed.learners, then anyone
// who only has a routine — each pseudonym once.
function learnerPseudonyms(cfg) {
  const out = [primaryPseudonym(cfg)];
  const sl = isObj(cfg && cfg.studentLed) ? cfg.studentLed : {};
  const add = (k) => {
    const p = str(k);
    if (p && !out.includes(p)) out.push(p);
  };
  if (isObj(sl.learners)) Object.keys(sl.learners).forEach(add);
  if (isObj(cfg && cfg.socialSkillsRoutines)) Object.keys(cfg.socialSkillsRoutines).forEach(add);
  return out;
}

// Problems with one routine entry, as human-readable strings ([] = valid).
function routineErrors(r, where) {
  if (!isObj(r)) return [`${where} must be an object`];
  const errs = [];
  if (!str(r.target)) errs.push(`${where}.target must be the movie/activity name exactly as Social Skills lists it`);
  if (r.movieTimes !== undefined && !(Number.isInteger(r.movieTimes) && r.movieTimes >= 0 && r.movieTimes <= MAX_MOVIE_TIMES)) {
    errs.push(`${where}.movieTimes must be a whole number from 0 to ${MAX_MOVIE_TIMES}`);
  }
  if (r.thenActivity !== undefined && typeof r.thenActivity !== 'boolean') errs.push(`${where}.thenActivity must be true or false`);
  if (Number.isInteger(r.movieTimes) && r.movieTimes === 0 && r.thenActivity === false) {
    errs.push(`${where} plays nothing — set movieTimes above 0 or thenActivity to true`);
  }
  return errs;
}

// Normalized routine for a pseudonym, or null. Invalid entries are null too
// (the UI server refuses to save them; a hand-edited one just shows no button).
function routineFor(cfg, pseudonym) {
  const all = isObj(cfg && cfg.socialSkillsRoutines) ? cfg.socialSkillsRoutines : {};
  const r = all[pseudonym];
  if (routineErrors(r, 'routine').length) return null;
  return {
    target: str(r.target),
    movieTimes: Number.isInteger(r.movieTimes) ? r.movieTimes : 5,
    thenActivity: r.thenActivity !== false,
  };
}

// Routine → the runner's existing playlist format (one entry per launch).
function routinePlaylist(routine) {
  const list = [];
  for (let i = 0; i < routine.movieTimes; i++) list.push({ mode: 'movie', target: routine.target });
  if (routine.thenActivity) list.push({ mode: 'activity', target: routine.target });
  return list;
}

// What GET /api/para returns. No display names — only whether one is set.
function paraInfo(cfg, { configMissing = false } = {}) {
  const learners = learnerPseudonyms(cfg).map((p) => ({
    pseudonym: p,
    ready: !configMissing && !!displayNameFor(cfg, p),
    routine: routineFor(cfg, p),
  }));
  return {
    configMissing,
    learners,
    subjects: PARA_SUBJECT_ORDER.map((key) => ({ key, label: SUBJECTS[key].label })),
  };
}

// Sanity: the page order must name every subject exactly once.
if (PARA_SUBJECT_ORDER.slice().sort().join() !== SUBJECT_KEYS.slice().sort().join()) {
  throw new Error('PARA_SUBJECT_ORDER is out of sync with lib/subjects.js');
}

module.exports = {
  PARA_SUBJECT_ORDER,
  MAX_MOVIE_TIMES,
  primaryPseudonym,
  displayNameFor,
  learnerPseudonyms,
  routineErrors,
  routineFor,
  routinePlaylist,
  paraInfo,
};
