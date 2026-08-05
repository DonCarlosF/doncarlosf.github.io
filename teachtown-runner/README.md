# teachtown-runner

Automation for TeachTown Social Skills group rotations, enCORE Teacher-Led
sessions, and day-one district recon. All flags and behavior are documented
in the header of `runner.js`.

## Privacy gate — set up FIRST, before any commit

Student data never goes in this repo. The gate enforces it mechanically:

1. `cp config/privacy-terms.template.txt config/privacy-terms.txt` and fill
   it with real name fragments, nicknames, school names, and IEP dates. The
   file is gitignored — it never leaves this machine.
2. `npm run install-hooks` (one-time) — after this, `git commit` refuses
   anything whose staged content contains a term.
3. `npm run privacy-check` scans everything committable, any time. The mock
   test harness also runs it as step zero of every validation run.

If `privacy-terms.txt` is missing, the gate warns loudly and checks
nothing — create it before doing anything else.

## Day one at a new district

Follow `docs/day-one-expected-output.md`: run the three commands in order
and diff your terminal against the annotated expected-output blocks.
