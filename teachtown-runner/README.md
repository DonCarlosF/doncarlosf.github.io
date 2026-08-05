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

## Day one at a new district

Follow `docs/day-one-expected-output.md`: run the three commands in order
and diff your terminal against the annotated expected-output blocks.
