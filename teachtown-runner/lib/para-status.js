/*
 * Para page (para.html): the runner's log lines → the few plain-language
 * steps a para educator sees. Pure, so it is unit-tested in Node and runs
 * unchanged in the browser (served at /para-status.js as window.ParaStatus).
 *
 * The UI server's event stream sends a `status` event, replays the current
 * run's log lines, and sends `status` again when the run exits. So `reduce`
 * only collects facts about the run, and `view` derives the screen from
 * them — the result doesn't depend on whether the exit status arrived before
 * or after the replayed lines (it does both, depending on reconnect timing).
 *
 * Only pseudonyms and curriculum words are ever put into titles; the raw
 * lines (which can carry display names) are kept for the collapsed
 * "details" panel.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ParaStatus = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LINES = 400;

  // Any of these means the sign-in hand-off is over.
  const PAST_SIGNIN_RE =
    /PROFILE AUTHENTICATED|home loaded|portal ready|STUDENT-LED — entering enCORE|enCORE session ready|\] Selected learner "|\] LOGIN (?!SETUP)|Sign-in form was already filled/;

  function kindOf(action) {
    if (action === 'studentled-subject') return 'encore';
    if (action === 'social-routine') return 'routine';
    return action ? 'other' : null; // dry runs ("… (dry run)") are the teacher's, not the para's
  }

  function initialState() {
    return {
      runId: null,
      action: null,
      kind: null,
      learner: null,
      subject: null,
      running: false,
      exitCode: null,
      signin: false,
      fatal: null,
      gaveUp: false,
      seen: {
        encore: false,
        learner: false,
        subjectsOk: false,
        ready: false,
        fix: false,
        login: false,
        notFound: false,
        complete: false,
        stop: false,
      },
      movies: 0,
      activity: false,
      skips: [],
      lines: [],
    };
  }

  function clone(s) {
    return Object.assign({}, s, { seen: Object.assign({}, s.seen), skips: s.skips.slice(), lines: s.lines.slice() });
  }

  function reduce(state, ev) {
    if (!ev) return state;
    if (ev.type === 'status') {
      const id = ev.startedAt || null;
      const s = state.runId !== null && id === state.runId ? clone(state) : initialState();
      s.runId = id;
      s.action = ev.action || null;
      s.kind = kindOf(s.action);
      s.learner = ev.learner || s.learner;
      s.subject = ev.subject || s.subject;
      s.running = !!ev.running;
      s.exitCode = ev.exitCode === undefined ? null : ev.exitCode;
      return s;
    }
    if (ev.type !== 'line') return state;

    const t = String(ev.text || '');
    const s = clone(state);
    s.lines.push(t);
    if (s.lines.length > MAX_LINES) s.lines.splice(0, s.lines.length - MAX_LINES);
    let m;

    if (/MANUAL SIGN-IN NEEDED/.test(t)) s.signin = true;
    else if (PAST_SIGNIN_RE.test(t)) s.signin = false;

    // enCORE Student-Led milestones
    if (/STUDENT-LED — entering enCORE/.test(t)) s.seen.encore = true;
    if (/\] Selected learner "/.test(t)) s.seen.learner = true;
    if (/\] SUBJECTS OK —/.test(t)) s.seen.subjectsOk = true;
    if (/\] (READY —|BEGIN clicked —)/.test(t)) s.seen.ready = true;
    if (/\] SUBJECT CHECK FAILED/.test(t)) s.seen.fix = true;

    // Social Skills routine milestones
    if (/\] LOGIN (?!SETUP)/.test(t)) s.seen.login = true;
    if (/\] START /.test(t)) {
      if (/\(movie\)\s*$/.test(t)) s.movies += 1;
      else s.activity = true;
    }
    if ((m = t.match(/\] SKIP .*? — (.+)$/))) {
      if (/not found in View Students/i.test(m[1])) s.seen.notFound = true;
      else s.skips.push(m[1].replace(/^playlist:\s*/, ''));
    }
    if (/\] ERROR .* — giving up/.test(t)) s.gaveUp = true;
    if (/\] SESSION COMPLETE/.test(t)) s.seen.complete = true;

    if (/STOP pressed in the UI|\[ui\] STOP/.test(t)) s.seen.stop = true;
    if (!s.fatal) {
      if ((m = t.match(/\] FATAL (.+)$/))) s.fatal = m[1];
      else if (/SSO RECON STOP/.test(t)) s.fatal = 'SSO RECON STOP';
    }
    return s;
  }

  /* ------------------------------ view ------------------------------ */

  const GENERIC_FAIL = {
    title: "That didn't work",
    detail: 'Tap Try again. If it happens twice, ask your teacher — the details are below.',
  };

  function notInList(who) {
    return { title: `${who} wasn't in the student list`, detail: `Ask your teacher to check ${who}'s name in Settings.` };
  }

  // Plain-language failure for a finished run, or null when it ended fine.
  function failureOf(state, who) {
    const f = state.fatal;
    if (f) {
      if (/SIGN-IN WINDOW EXPIRED/.test(f)) {
        return { title: 'Nobody signed in', detail: 'It waited 5 minutes for the sign-in. Tap Try again when you are ready to sign in.' };
      }
      if (/not in the student list/.test(f)) return notInList(who);
      return GENERIC_FAIL;
    }
    if (state.seen.notFound) return notInList(who);
    if (state.gaveUp) return GENERIC_FAIL;
    const cleanExit = state.exitCode === 0 || state.exitCode === 130;
    const gotSomewhere = state.seen.ready || state.seen.fix || state.seen.complete || state.seen.stop;
    return cleanExit || gotSomewhere ? null : GENERIC_FAIL;
  }

  const pick = (tone, text) => ({ screen: 'pick', note: text ? { tone, text } : null });

  const SIGNIN = {
    tone: 'warn',
    title: 'Please sign in',
    detail: 'Type the sign-in into the browser window. It keeps going by itself after that.',
  };

  function encoreView(state, who, ctx) {
    const subj = (ctx.subjects && ctx.subjects[state.subject]) || 'the subject';
    const seen = state.seen;
    const steps = ['Open enCORE', `Find ${who}`, `Only ${subj}`, 'Your turn'];
    const step = seen.subjectsOk || seen.ready ? 4 : seen.learner ? 3 : seen.encore ? 2 : 1;
    const base = { screen: 'progress', kind: 'encore', learner: who, subject: state.subject, steps, step, retry: false };
    const close = { label: 'Session over — close enCORE', confirm: `Close the enCORE window? ${who}'s session ends.` };
    const cancel = { label: 'Cancel', confirm: null };

    if (state.running) {
      if (seen.stop) return Object.assign(base, { tone: 'info', title: 'Closing enCORE…', detail: 'One moment.', stop: null });
      if (seen.fix) {
        return Object.assign(base, {
          step: 3,
          tone: 'warn',
          title: 'Please fix the subject boxes',
          detail: `In the enCORE window, leave only ${subj} checked, then press Next. Nothing has started yet.`,
          stop: close,
        });
      }
      if (seen.ready) {
        return Object.assign(base, {
          tone: 'ok',
          title: 'Ready! Go to the enCORE window.',
          detail: `Only ${subj} is checked for ${who}. Press Next there and start the session. When it's over, come back here and press the button below.`,
          stop: close,
        });
      }
      if (state.signin) return Object.assign(base, SIGNIN, { stop: cancel });
      const titles = { 1: 'Opening enCORE…', 2: `Finding ${who}…`, 3: `Checking only ${subj}…` };
      return Object.assign(base, {
        tone: 'info',
        title: titles[step],
        detail: "The browser window opens by itself. Please don't click in it until this says Ready.",
        stop: cancel,
      });
    }

    const failure = failureOf(state, who);
    if (failure) return Object.assign(base, { screen: 'failed', tone: 'error', stop: null, retry: true }, failure);
    if (seen.ready || seen.fix) return pick('ok', `${subj} session for ${who} closed.`);
    return pick('info', 'Stopped — nothing was started.');
  }

  function routineView(state, who, ctx) {
    const r = (ctx.routines && ctx.routines[who]) || null;
    const target = r ? r.target : 'the movie';
    const times = r ? r.movieTimes : 0;
    const thenActivity = r ? r.thenActivity : state.activity;
    const seen = state.seen;

    const ids = ['open', 'login'];
    const steps = ['Open Social Skills', `Log in ${who}`];
    if (times > 0 || state.movies > 0) {
      ids.push('movie');
      steps.push(times > 0 ? `Movie ×${times}` : 'Movie');
    }
    if (thenActivity) {
      ids.push('activity');
      steps.push('Do the Activity');
    }
    const at = (id) => ids.indexOf(id) + 1;
    let step = 1;
    if (seen.complete) step = steps.length + 1; // every step done
    else if (state.activity) step = at('activity');
    else if (state.movies > 0) step = at('movie');
    else if (seen.login) step = 3; // logged in; the first launch is loading
    const base = { screen: 'progress', kind: 'routine', learner: who, subject: null, steps, step, retry: false };
    const stop = { label: 'Stop', confirm: `Stop now? ${who} is logged out and the browser closes.` };

    if (state.running) {
      if (seen.stop) return Object.assign(base, { tone: 'info', title: 'Stopping…', detail: `Logging ${who} out and closing the browser.`, stop: null });
      if (seen.complete) return Object.assign(base, { tone: 'ok', title: 'All done!', detail: 'Closing the browser.', stop: null });
      if (state.signin) return Object.assign(base, SIGNIN, { stop: { label: 'Cancel', confirm: null } });
      if (state.activity) {
        return Object.assign(base, {
          tone: 'info',
          title: `${target} — Do the Activity`,
          detail: `${who} does the activity now. This page moves on by itself when it's finished.`,
          stop,
        });
      }
      if (state.movies > 0) {
        const n = times > 0 ? Math.min(state.movies, times) : state.movies;
        const last = times > 0 && state.movies >= times;
        return Object.assign(base, {
          tone: 'info',
          title: times > 0 ? `${target} — movie ${n} of ${times}` : `${target} — movie ${n}`,
          detail: last
            ? thenActivity
              ? 'Last movie. The activity starts by itself after this one.'
              : 'Last movie.'
            : 'Playing now. The next one starts by itself.',
          stop,
        });
      }
      if (seen.login) return Object.assign(base, { tone: 'info', title: `Starting ${target}…`, detail: 'The player opens by itself.', stop });
      return Object.assign(base, {
        tone: 'info',
        title: 'Opening Social Skills…',
        detail: `Then it logs ${who} in by itself. Please don't click in the browser yet.`,
        stop: { label: 'Cancel', confirm: null },
      });
    }

    const failure = failureOf(state, who);
    if (failure) return Object.assign(base, { screen: 'failed', tone: 'error', stop: null, retry: true }, failure);
    if (seen.complete) {
      if (state.movies === 0 && !state.activity) {
        return pick('warn', `Nothing played — ${state.skips.join('; ') || 'there was nothing to run'}. Ask your teacher.`);
      }
      if (state.skips.length) return pick('warn', `Finished, but skipped: ${state.skips.join('; ')}.`);
      return pick('ok', `All done — ${target} finished for ${who}.`);
    }
    return pick('info', 'Stopped.');
  }

  /*
   * ctx: { defaultLearner, subjects: { key: label }, routines: { pseudonym: routine } }
   * Returns { screen: 'pick'|'progress'|'failed'|'busy', ... } — see para.html.
   */
  function view(state, ctx) {
    const c = ctx || {};
    if (!state.runId) return pick();
    if (state.kind === 'other') {
      if (!state.running) return pick();
      return {
        screen: 'busy',
        tone: 'info',
        title: 'Another TeachTown task is running',
        detail: 'The buttons come back by themselves when it finishes.',
        stop: null,
        retry: false,
      };
    }
    const who = state.learner || c.defaultLearner || 'the learner';
    return state.kind === 'encore' ? encoreView(state, who, c) : routineView(state, who, c);
  }

  return { initialState, reduce, view, kindOf };
});
