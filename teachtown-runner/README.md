# teachtown-runner

Automation for TeachTown Social Skills group rotations, enCORE Teacher-Led
sessions, and day-one district recon. All flags and behavior are documented
in the header of `runner.js`.

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
  running anything): when a sign-in form appears you'll see
  `MANUAL SIGN-IN NEEDED — sign in in the open browser window; I'll
  continue automatically.` Type your credentials **into the browser**, not
  the terminal. The runner polls and continues on its own (up to 5
  minutes); pressing Enter in the terminal just re-checks immediately.
- If Microsoft asks **"Stay signed in?"**, the runner clicks **Yes** for
  you — that's what makes the session stick.
- On success you'll see `PROFILE AUTHENTICATED — future runs should be
  zero-touch.` and every later run skips sign-in entirely.

**If sign-in starts being required every run**, the profile directory is
being wiped or not written — check permissions on that path (the
`PROFILE AUTHENTICATED` line prints it). Do **not** "fix" it by storing
credentials.

## Day one at a new district

Follow `docs/day-one-expected-output.md`: run the three commands in order
and diff your terminal against the annotated expected-output blocks.
