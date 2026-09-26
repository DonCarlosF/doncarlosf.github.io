# teachtown-runner

Automation for TeachTown Social Skills group rotations, enCORE Teacher-Led
sessions, and day-one district recon. All flags and behavior are documented
in the header of `runner.js`.

## Para page (what a para educator uses)

`npm run para` — or the **TeachTown Buttons** Desktop shortcut on Windows —
opens a deliberately small page at http://127.0.0.1:4317/para:

- A tab per learner (pseudonyms only — Luis, plus whoever you add under
  Settings → Learners). One learner = no tabs, just the name.
- Four big buttons: **Social Studies, ELA, Math, Science**. Each starts an
  enCORE Student-Led session for that learner with only that subject
  checked, and stops at READY — the para presses Next on the enCORE screen.
- A learner with a **Social Skills routine** gets one more button, e.g.
  *Tell the Truth — Movie 5 times, then Do the Activity*: logs the learner
  in to Social Skills, plays the movie N times in a row, then launches Do
  the Activity once (skipped if it's already at 100%, like every other
  run), then logs out and closes the browser.
- While it runs, the page shows four plain steps (Open enCORE → Find Luis →
  Only Math → Your turn), a sign-in prompt when one is needed, and a
  confirm-first *Session over — close enCORE* / *Stop* button. Failures
  get a sentence and *Try again*; the raw log sits under *Details for your
  teacher*.
- No Dry Run toggle, no Teacher-Led, no settings — those stay on the
  dashboard (`npm run ui`). A run started from the dashboard shows as
  "Another TeachTown task is running" and locks the para buttons.
- Double-clicking the shortcut again just reopens the page — one server per
  machine, so two runs can never fight over the browser.

Learners and routines live in the gitignored `config.json`
(`studentLed.learners` = pseudonym → display name, `socialSkillsRoutines` =
pseudonym → `{ target, movieTimes, thenActivity }`) and are edited under
Settings → Learners. The page is served pseudonyms only; display names stay
on the server.

## Button interface (no typing in front of the class)

`npm run ui` starts a local page with big buttons — Run Playlist, Custom
Run, Teacher-Led (Set up only vs the visually distinct START LIVE SESSION),
the four Student-Led subject buttons for Luis (ELA / Math / Social Studies /
Science), Sign In, Refresh Roster, a Dry Run toggle, a Settings screen that edits
config.json with validation + a .bak, and a Run view with the live log and
a STOP button that does the same clean shutdown as Ctrl+C. A *Para page ↗*
link in the header opens the para page.

- **Mac (Terminal)**: `cd teachtown-runner && npm run ui`
- **Windows (PowerShell or Git Bash)**: `cd teachtown-runner; npm run ui`
- The browser opens by itself; the URL (http://127.0.0.1:4317/) also prints
  in the terminal. Leave that terminal window open — closing it stops the UI.
- The page is served on **this machine only** (loopback). It is never
  reachable from the school network, by design and by test.
- The footer shows the build version (a content hash — no git needed): two
  machines showing the same code hash are running the same code.
- The UI writes only config.json and config.json.bak (both gitignored). It
  never asks for or stores a password — sign-in stays in the real browser
  window — and everything it does, the CLI flags still do too.

## Student-Led subject buttons (one learner: "Luis")

enCORE Student-Led sessions used to mean Start Session, pick the student,
then hand-uncheck Math / ELA / Science / Social Studies down to the one
being taught. Now that is one button per subject — **ELA, Math, Social
Studies, Science** — each for a single learner. The learner is called
**Luis** everywhere this repo can see (code, flags, buttons, logs); the
display name Luis stands for is typed once into the gitignored
`config.json` (`npm run init-config` asks for it, or `npm run ui` →
Settings → *Student-Led learner*) and never leaves the machine.

What a button does, in order:

1. enCORE → Start a Session → Student-Led → *Get started*.
2. Step 1 *Select Student*: clicks Luis's row, then Next.
3. Step 2 *Select Session Mode*: reads every subject checkbox, unchecks the
   three that aren't the button's subject (checks the button's subject if
   the app had it off), re-reads to **verify**, and logs
   `SUBJECTS after: ELA [ ]  Math [x]  Science [ ]  Social Studies [ ]`.
4. Stops at `READY — Math for "Luis"`. **You** press Next and launch. If
   verification fails it says `SUBJECT CHECK FAILED`, presses nothing
   further, and leaves the screen for you to fix by hand.

Nothing here touches a lesson or a question — between-screen navigation
only, same as every other mode. The lesson checklist under the subjects is
never clicked. `studentLed.autoBegin: true` additionally presses Next and
the step-3 launch button (that screen is unverified — best effort, and it
starts a REAL logged session).

- **Para page**: `npm run para` — every learner, see *Para page* above.
- **UI**: `npm run ui` → the four buttons under *enCORE — Student-Led for
  Luis*. They stay disabled until the learner's display name is saved.
- **CLI**: `npm start -- --student-led --subject ela|math|social-studies|science`
  (`--subject=Math`, `"Social Studies"`, `social_studies` all work, and so
  does the first-shipped `social-skills` key).
- **Dry run** (`--dry-run`, or the Dry Run toggle): walks to step 2, sets and
  verifies the boxes, prints them, backs out to the home screen and exits
  `SESSION COMPLETE`. No session is started even with `autoBegin`. Use it
  the first time on the live tenant — checklist in
  `docs/student-led-dry-run-checklist.md`.
- **Tests**: `npm test` — the checkbox planner (which boxes to click for
  each subject, lesson rows never touched, missing/duplicate boxes), a
  headless-browser run against a mock of the step-2 screen
  (`test/fixtures/student-led-step2.html`, native and `role=checkbox`
  variants), and the para page logic (`test/para.test.js`: learners and
  routines from config, runner log lines → the steps a para sees). The
  browser tests skip with a notice if `npx playwright install chromium`
  was never run.

### Windows desktop shortcuts

`windows\TeachTown-Buttons.cmd` is the para's entry point: it checks for
Node, `node_modules`, and `config.json` (and says what to do if one is
missing), starts the UI server in a minimized **TeachTown helper** window,
and opens the para page. Clicking it again while the helper runs just
reopens the page. Closing the helper window closes the page's server.

`windows/` also keeps one console launcher per subject for the first
learner — `Luis-ELA.cmd`, `Luis-Math.cmd`, `Luis-Social-Studies.cmd`,
`Luis-Science.cmd` — each running
`node runner.js --student-led --subject <key>` in its own console window
(Ctrl+C or closing the window ends the run the usual clean way).

Install on the district PC (Node 18+ and Google Chrome already installed;
`npm install`, `npm run init-config`, `npm start -- --login` done once as
in *Setup on a new machine*):

1. Double-click `windows\Install Desktop Shortcuts.cmd`. It runs
   `install-shortcuts.ps1` for that one process (`-ExecutionPolicy Bypass`,
   no machine-wide policy change) and puts **TeachTown Buttons** on the
   Desktop. Run it as `"Install Desktop Shortcuts.cmd" -PerSubject` to also
   get **Luis - Social Studies / ELA / Math / Science**.
2. If PowerShell is locked down and step 1 reports an error: right-click
   `TeachTown-Buttons.cmd` → *Send to* → *Desktop (create shortcut)*, then
   rename the shortcut as you like. The `.cmd` files must stay in
   `windows\` (they find the runner relative to themselves).
3. First click: the browser may show the TeachTown sign-in — type it in the
   **browser window**, as always; the runner never handles credentials.
4. Re-run the installer after moving the project folder; it overwrites the
   shortcuts. (A **Luis - Social Skills** shortcut from an earlier install
   points at a launcher that is now `Luis-Social-Studies.cmd` — delete it.)

A dry run from a shortcut: drag it to a console window, or run
`windows\Luis-Math.cmd --dry-run` from Git Bash / cmd. The `.cmd`/`.ps1`
files are the one place the repo keeps CRLF line endings (see
`.gitattributes`) — cmd.exe wants them that way.

## Setup on a new machine

1. `npm install` (Google Chrome must be installed — the runner drives it).
2. `npm run init-config` — copies the committed template (which carries every
   real setting **except names**) to the gitignored `config.json` and asks
   for student names right there in the terminal, including the display
   name behind the Student-Led pseudonym Luis. Names live only in that
   local file; the privacy gate blocks them from ever reaching a commit.
3. Set up the privacy gate (next section), then `npm start -- --login` to do
   the one-time sign-in.

### Windows notes

- Use **Git Bash** (installed with Git for Windows), not PowerShell or cmd —
  the privacy hooks are shell scripts and every command in these docs is
  written for a bash prompt.
- A `.gitattributes` keeps the committed sources LF so a Windows checkout
  can't break the hook scripts; your local `config.json` and logs are
  untracked and untouched by git either way.
- `Ctrl+C` ends a session the same way as on Mac (popup closed, student
  logged out, browser closed). On the first Windows run, check the runner's
  browser window actually closed after `Clean exit.` — if a Chrome window
  ever lingers, close it and tell me; that's a bug report I want.
- The browser profile lands under your Windows home folder or the project's
  `.profiles\` — the exact path prints at startup as `Browser profile: …`.

## Privacy gate — set up FIRST, before any commit

Student data never goes in this repo. The gate enforces it mechanically:

1. `cp config/privacy-terms.template.txt config/privacy-terms.txt` and fill
   it with real name fragments, nicknames, school names, and IEP dates. The
   file is gitignored — it never leaves this machine.
2. `npm run install-hooks` (one-time) — installs three layers:
   - **pre-commit**: staged content AND staged file paths (a student name
     in a *filename* is a leak too);
   - **commit-msg**: the commit message itself;
   - **pre-push**: every outgoing commit's message + diff and the pushed
     ref names — the backstop that catches commits made with
     `--no-verify`, cherry-picks/rebases, or GUI clients that skip commit
     hooks.
3. `npm run privacy-check` scans everything committable, any time.

Matching is Unicode-folded (accents, NFC/NFD, zero-width characters) and
UTF-16/latin-1 files are decoded before scanning. Files whose content can't
be scanned (binary, oversize) are named in the output — never skipped
silently. If `privacy-terms.txt` is missing, the plain `npm run
privacy-check` warns loudly; the installed hooks BLOCK until it exists.

## Zero-touch sign-in (no stored credentials — ever)

The runner **never** types a username or password and **never** stores
credentials anywhere — not in config, not in code, not in docs. Instead it
reuses the persistent Chrome profile (`.profiles/<district>`): you sign in
by hand **once**, in the browser window the runner opens, and the session
cookies live in that profile from then on.

- First run (or `npm start -- --login` to warm up the profile without
  running anything — it signs into TeachTown AND the separate enCORE
  session): when a sign-in form appears you'll see
  `MANUAL SIGN-IN NEEDED — sign in in the open browser window; I'll
  continue automatically.` Type your credentials **into the browser**, not
  the terminal. The runner polls and continues on its own (up to 5
  minutes); pressing Enter in the terminal just re-checks immediately. If
  the 5 minutes lapse, the run exits with `SIGN-IN WINDOW EXPIRED` —
  nothing was typed and nothing is lost; just re-run when you're ready.
- If Microsoft asks **"Stay signed in?"**, the runner clicks **Yes** for
  you — that's what makes the session stick.
- **If Chrome has saved your password in this profile**, the form comes up
  already filled and the runner presses the button itself, so a re-auth is
  hands-off too. It checks the fields really are filled first — it will
  never submit a blank form, because failed attempts can lock a district
  account — and if the site rejects the saved password it stops trying and
  hands it back to you. Set `"autoSubmitPrefilledLogin": false` in
  `config.json` to always sign in by hand. The password lives in Chrome's
  own password manager, never in this repo.
- On success you'll see `PROFILE AUTHENTICATED — future runs should be
  zero-touch.` and every later run skips sign-in entirely.
- Sign-in pages are screenshotted to `recon/` on first-run/recon passes for
  diagnosis. Those images can show your account **email** (never a
  password — fields are masked and the runner stops screenshotting a page
  the moment you could be typing). `recon/` and `logs/` are gitignored and
  local-only; when reporting a problem, send only the specific screenshot
  asked for.

**If sign-in starts being required every run**, the profile directory is
being wiped or not written — check permissions on that path (the
`PROFILE AUTHENTICATED` line prints it). Do **not** "fix" it by storing
credentials.

## Day one at a new district

Follow `docs/day-one-expected-output.md`: run the three commands in order
and diff your terminal against the annotated expected-output blocks.
