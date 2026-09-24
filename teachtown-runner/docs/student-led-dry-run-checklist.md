# Student-Led subject buttons — dry-run checklist

Run this once on the live enCORE tenant before trusting the four buttons in
front of a class. It is the real screen with the real learner, but the
runner backs out of the wizard on step 2 and starts nothing (no session is
logged, `autoBegin` is ignored in a dry run). Budget: four runs of about a
minute each after sign-in.

The learner is "Luis" in every command and every log line below. The
display name behind that pseudonym lives only in your local `config.json`
— nothing from this checklist goes in the repo. When reporting a problem,
copy the `SUBJECTS` lines only; never paste the screenshot from `logs/`
into a commit or an issue.

## Before you start

- [ ] `config.json` has the display name: `studentLed.learners.Luis` is the
      name **exactly** as enCORE's student list shows it
      (`npm start -- --recon-roster` prints that list into `recon/`).
- [ ] `npm test` passes (32 tests; the browser ones may print a skip notice
      if `npx playwright install chromium` was never run — that's fine).
- [ ] `npm start -- --login` has been done on this machine (zero-touch
      profile). If not, the first dry run below will pause on
      `MANUAL SIGN-IN NEEDED` — sign in **in the browser window**.

## Dry run, one subject at a time

Use whichever entry point you will actually use in class:

| Entry point | Command |
| --- | --- |
| CLI (Git Bash / Terminal) | `npm start -- --student-led --subject math --dry-run` |
| UI | Dry Run toggle ON → Home → *Math* button |
| Windows shortcut | `windows\Luis-Math.cmd --dry-run` (from a console) |

Repeat for `ela`, `social-skills`, `science`. For **each** run tick:

- [ ] `SESSION START (dry run) (student-led) — enCORE Student-Led, learner "Luis", subject=<key> …`
- [ ] `Selected learner "Luis"` — and on screen, exactly one row highlighted,
      Luis's. (Anything else: the display name in `config.json` doesn't
      match the app. Fix it; nothing further happened.)
- [ ] The wizard is on the lesson step: **Select lessons for …'s
      Student-Led Session** (subject boxes and the Recommended Lessons
      radio). The bar at the top can still say "Select Session Mode" — that
      title is on every step. The log either says the learner click
      advanced the wizard, or `Clicked Next on Student-Led step 1`.
- [ ] `SUBJECTS before:` shows four boxes. Note which are `[x]` — on a fresh
      wizard the app checks all four.
- [ ] `SUBJECTS after:` shows **only** this run's subject as `[x]`:

  | Run | Expected `SUBJECTS after:` |
  | --- | --- |
  | `ela` | `ELA [x]  Math [ ]  Science [ ]  Social Skills [ ]` |
  | `math` | `ELA [ ]  Math [x]  Science [ ]  Social Skills [ ]` |
  | `social-skills` | `ELA [ ]  Math [ ]  Science [ ]  Social Skills [x]` |
  | `science` | `ELA [ ]  Math [ ]  Science [x]  Social Skills [ ]` |

  (Box order follows the screen; if the tenant labels the last one
  "Social Studies" the line says so and the button still works.)
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
| `Student-Led step 1: no Next button, and the lesson step did not appear` | The learner click did not open step 2, and there was no Next to press. | Screenshot in `logs/`. The row may not have selected. |
| `MANUAL SIGN-IN NEEDED` | Zero-touch profile not warm on this machine. | Sign in **in the browser**. Normal on a first run. |

## After all four pass

- [ ] Run one subject **without** `--dry-run` at a quiet moment: it should
      end at `READY — <Subject> for "Luis". Press Next on screen…` with the
      right box checked, and idle. Press Next yourself to confirm the
      wizard accepts the state, then Ctrl+C (or STOP in the UI) — a clean
      exit closes the browser. No session was logged unless you launched
      one yourself on step 3.
- [ ] Install the Desktop shortcuts (`windows\Install Desktop Shortcuts.cmd`)
      and click one — same `READY` line expected.
