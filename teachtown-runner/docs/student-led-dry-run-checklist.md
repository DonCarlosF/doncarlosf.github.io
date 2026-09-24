# Lesson buttons — dry-run checklist

Use this before a class, once, on the real TeachTown screen. The runner
walks to the lesson step, checks the boxes, then backs out. It does not
start a lesson.

There are five buttons. Four are school subjects. Social Skills is separate.

| Button | School subject? |
| --- | --- |
| ELA | Yes |
| Math | Yes |
| Science | Yes |
| Social Studies | Yes. History and the world. |
| Social Skills | No. A different activity. Not another name for Social Studies. |

Budget: one short run per button after sign-in.

The learner is "Luis" in every command and every log line below. The
display name behind that pseudonym lives only in your local `config.json`
— nothing from this checklist goes in the repo. When reporting a problem,
copy the `SUBJECTS` lines only; never paste the screenshot from `logs/`
into a commit or an issue.

## Before you start

- [ ] `config.json` has the display name: `studentLed.learners.Luis` is the
      name **exactly** as enCORE's student list shows it
      (`npm start -- --recon-roster` prints that list into `recon/`).
- [ ] `npm test` passes (the browser ones may print a skip notice if
      `npx playwright install chromium` was never run — that's fine).
- [ ] `npm start -- --login` has been done on this machine (zero-touch
      profile). If not, the first dry run below will pause on
      `MANUAL SIGN-IN NEEDED` — sign in **in the browser window**.

## Dry run, one subject at a time

Use whichever entry point you will actually use in class:

| Entry point | Command |
| --- | --- |
| CLI (Git Bash / Terminal) | `npm start -- --student-led --subject math --dry-run` |
| Home page | Turn on the big **Dry run** switch, then press *Math*. The status line should say Working, then Finished. Last action should say Math, not another subject. |
| Windows shortcut | `windows\Luis-Math.cmd --dry-run` (from a console) |
| Mac app | `npm run mac:dev`, then Lesson → Dry run, then press *Math* (or Lesson → Start Math while Dry run is on). |

Repeat for ELA, Science, and Social Studies. For **each** of those runs tick:

- [ ] `SESSION START (dry run) (student-led) — enCORE Student-Led, learner "Luis", subject=<key> …`
- [ ] `Selected learner "Luis"` — and on screen, exactly one row highlighted,
      Luis's. (Anything else: the display name in `config.json` doesn't
      match the app. Fix it; nothing further happened.)
- [ ] The wizard is on the lesson step: **Select lessons for …'s
      Student-Led Session** (subject boxes and the Recommended Lessons
      radio). The bar at the top can still say "Select Session Mode" — that
      title is on every step. On SLZUSD the log says
      `Step 2 opened on the learner click (no Next on step 1)`.
- [ ] `SUBJECTS before:` shows the school-subject boxes. Note which are
      `[x]` — on a fresh wizard the app checks all of them. The usual four
      are ELA, Math, Science, and Social Studies.
- [ ] `SUBJECTS after:` shows **only** this run's subject as `[x]`:

  | Run | Expected `SUBJECTS after:` |
  | --- | --- |
  | `ela` | `ELA [x]  Math [ ]  Science [ ]  Social Studies [ ]` |
  | `math` | `ELA [ ]  Math [x]  Science [ ]  Social Studies [ ]` |
  | `science` | `ELA [ ]  Math [ ]  Science [x]  Social Studies [ ]` |
  | `social-studies` | `ELA [ ]  Math [ ]  Science [ ]  Social Studies [x]` |

  Box order follows the screen. The words must say **Social Studies**, not
  Social Skills. If a Social Skills box is also on the screen, it should
  be `[ ]` for every school-subject run.
- [ ] The screen agrees with the log line — look at the actual boxes before
      the runner backs out.
- [ ] The lesson checklist under the subjects was **not** clicked by the
      runner: whatever rows are listed for the remaining subject carry the
      app's own default state.
- [ ] `SUBJECTS OK — only <Subject> is checked for "Luis"`
- [ ] `STUDENT-LED DRY RUN COMPLETE — … backing out, nothing started.`
- [ ] Browser lands back on the enCORE home screen; the run ends with
      `SESSION COMPLETE` and exit code 0.

## If something does not tick

| You see | Meaning | Do |
| --- | --- | --- |
| `WARN subjects: no "<Subject>" checkbox found on this screen` then `SUBJECT CHECK FAILED` | The label text on the live screen is not one of the spellings the runner knows (`lib/subjects.js` → `SUBJECTS`). | Note the exact label text from the screen. Nothing was clicked. |
| `WARN subjects: 2 checkboxes look like …` | Two boxes carry the same subject label (e.g. a "select all" row reusing the word). The runner keeps the first and unchecks the other. | Check the screen agrees; report the second label's text. |
| `SUBJECTS after:` still has two `[x]` and `SUBJECT CHECK FAILED` | A click didn't register (the app redraws the lesson list on each toggle). The runner already retried once. | Re-run the dry run. If it repeats, the click path needs the live DOM — send the `SUBJECTS` lines. |
| `Student-Led step 1: the display name configured for "Luis" is not in the student list` | Name mismatch. | Copy the name from the `recon/roster-report-*.txt` produced by `--recon-roster`. |
| `WARN Next still looks disabled after selecting the learner` | This tenant still has a Next on step 1, and it stayed disabled. The runner clicks it anyway; if the lesson step never appears the run fails with a screenshot in `logs/`. | Re-run; report if it repeats. |
| `MANUAL SIGN-IN NEEDED` | Zero-touch profile not warm on this machine. | Sign in **in the browser**. Normal on a first run. |

## Social Skills (separate from Social Studies)

Run this only after the four school subjects above look right.

| Entry point | Command |
| --- | --- |
| CLI | `npm start -- --student-led --subject social-skills --dry-run` |
| UI | Dry Run ON → heading *Social Skills for Luis* → *Social Skills* |
| Windows shortcut | `windows\Luis-Social-Skills.cmd --dry-run` |

- [ ] If the lesson screen has a box that says **Social Skills**,
      `SUBJECTS after:` shows only that box as `[x]`, and Social Studies
      is `[ ]`.
- [ ] If the lesson screen has **Social Studies** and no Social Skills box,
      the run stops with `no "Social Skills" checkbox` and does not click
      Social Studies. That is correct. Use the Social Studies button for
      that box. The group Social Skills activity is the *Social Skills —
      group* section on Home (Run Playlist), not this button.

## After the school subjects pass

- [ ] Run one subject **without** `--dry-run` at a quiet moment: it should
      end at `READY — <Subject> for "Luis". Press Next on screen…` with the
      right box checked, and idle. Press Next yourself to confirm the
      wizard accepts the state, then Ctrl+C (or STOP in the UI) — a clean
      exit closes the browser. No session was logged unless you launched
      one yourself on step 3.
- [ ] Install the Desktop shortcuts (`windows\Install Desktop Shortcuts.cmd`)
      and click one — same `READY` line expected. **Luis - Social Studies**
      and **Luis - Social Skills** are two shortcuts.
