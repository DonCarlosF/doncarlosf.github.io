# teachtown-runner

Automation for TeachTown Social Skills group rotations, enCORE Teacher-Led
sessions, and day-one district recon. All flags and behavior are documented
in the header of `runner.js`.

## Setup on a new machine

1. `npm install` (Google Chrome must be installed — the runner drives it).
2. `npm run init-config` — copies the committed template (which carries every
   real setting **except names**) to the gitignored `config.json` and asks
   for student names right there in the terminal. Names live only in that
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
