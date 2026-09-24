# Day-one expected output (8/13 runbook — DIRECT TeachTown login)

Generated 2026-08-23 against the mock TeachTown stack with **mock student
names** (Alex Test, Tester Bailey, Ace Fake, Missing Kid). F1 is resolved:
SLZUSD signs in **directly on the TeachTown site** — there is no Clever
portal in this flow (`loginMode: "direct"` in the slzusd profile). Diff your
real terminal against each block. Expected substitutions on the real run:

- `http://localhost:8971/nav/index.html#/home` → `https://www.teachtown.com/nav/#/home`
- Timestamps, screenshot filenames, report names, and the profile path will
  differ.
- Mock roster shape maps to yours: three same-school students (one matched
  exactly, one by name-order tokens, one by nickname/aka) plus a fourth
  `expected: false` entry for the other-school student who may not appear.

Run the three commands in this order, same terminal, same day. (Optional
warm-up: `npm start -- --login` runs the sign-in chain plus the separate
enCORE sign-in and exits with `LOGIN SETUP COMPLETE` — useful the night
before. If you do that, command 1 below simply won't show the sign-in
lines.)

---

## Command 1 — `npm start -- --recon-roster`

### Healthy first run (a manual sign-in is EXPECTED — the profile is fresh)

```text
[ts] SESSION START (recon) — district=slzusd, flags=--recon-roster
[ts] Recon mode: auth hops are screenshotted to recon/; an unrecognized page stops the run.
[ts] Opening TeachTown directly: https://www.teachtown.com/nav/#/home
[ts] Recon screenshot: .../teachtown-runner/recon/teachtown-hop1-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/teachtown-login-form-<n>.png
[ts] MANUAL SIGN-IN NEEDED — sign in in the open browser window; I'll continue automatically.
[ts] (Waiting up to 5 minutes. Pressing Enter here also re-checks immediately.)
[ts] Recon screenshot: .../teachtown-runner/recon/teachtown-hop2-<n>.png
[ts] TeachTown home loaded (#/home) — direct session active
[ts] PROFILE AUTHENTICATED — future runs should be zero-touch. Profile: .../teachtown-runner/.profiles/slzusd
[ts] Recon screenshot: .../teachtown-runner/recon/ss-view-students-<n>.png
[ts] RECON Social Skills: 3 student(s) found
[ts]   SS: Alex Test
[ts]   SS: Tester Bailey
[ts]   SS: Ace Fake
[ts] Recon screenshot: .../teachtown-runner/recon/encore-hop1-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/encore-my-students-<n>.png
[ts] RECON enCORE: 3 student(s) found
[ts]   EN: Alex Test
[ts]   EN: Tester Bailey
[ts]   EN: Ace Fake
[ts] RECON MATCH (exact): "Alex Test"
[ts] RECON POSSIBLE (name tokens): "Bailey Tester" ↔ "Tester Bailey"
[ts] RECON MATCH (aka): "Jaye Fake" ↔ "Ace Fake"
[ts] RECON NOT FOUND: "Missing Kid" (expected-maybe — OK)
[ts] (…the same four diff lines repeat — once for Social Skills, once for enCORE…)
[ts] RECON report written: .../teachtown-runner/recon/roster-report-<stamp>.txt
[ts] RECON COMPLETE
```

Exit code **0**. At the `MANUAL SIGN-IN NEEDED` line: type your TeachTown
credentials **into the browser window** (the runner never touches that
form) and just finish the sign-in — the runner notices on its own and
keeps going. You never have to touch the terminal; Enter is only a
"re-check now" nudge. If Microsoft asks **"Stay signed in?"** the runner
answers **Yes** itself (you'd see
`Answered "Stay signed in?" → Yes (keeps future runs zero-touch).`).
The `PROFILE AUTHENTICATED` line means this was the one-time handoff —
commands 2 and 3 (and every later day) should need no sign-in at all.
Afterward: `recon/` holds the screenshots and the plain-text roster
report; fill `students` in `config.json` with the exact display names the
report shows.

### How this block changes when things go the other way

- **The sign-in page looks unfamiliar to the runner** (a redesign, or an
  unexpected SSO redirect): after ~20s with nothing it recognizes you get:

  ```text
  [ts] SSO RECON STOP — a human needs to look at this:
  [ts] UNRECOGNIZED AUTH PAGE during TeachTown direct login
  [ts]   url: …
  [ts]   title: …
  [ts]   visible buttons/links: … | … | …
  [ts]   Screenshot saved to recon/. No credentials were touched.
  ```

  Exit code **2**, nothing clicked. Send the `recon/unrecognized-*.png`
  screenshot + that block. (The same stop can fire during the enCORE chain —
  the header then says `during enCORE auth chain`.) Note: a page that shows a
  password field does NOT trip this stop — it waits for you instead.
- **enCORE asks to sign in again** (its session is separate): the same
  `MANUAL SIGN-IN NEEDED` banner appears mid-chain — log in in the browser
  and the recon continues on its own. Usually the TeachTown session
  carries through and you never see this.
- **You couldn't get to the browser within 5 minutes:** the run exits with
  `SIGN-IN WINDOW EXPIRED — … Nothing was typed by the runner`. Nothing is
  broken — re-run the same command when you're ready.
- **F4 — rostering hasn't synced:** the Social Skills section shows
  `RECON Social Skills: 0 student(s) found` plus
  `Zero students in Social Skills. Most likely district rostering has not synced to TeachTown yet — a timing fact, not a runner bug. Re-run --recon-roster in a few days.`
  Still exit 0. Same pattern possible on the enCORE side.
- **F3 — the other-school student:** absent = the healthy
  `RECON NOT FOUND: "…" (expected-maybe — OK)` line (that is the good
  outcome for an `expected: false` entry). Present = a MATCH line instead.
- **F2 — enCORE lands on the wrong app:** a
  `WARN enCORE landed at "…" instead of #/apps/encr …` and/or
  `WARN enCORE header doesn't look like #/apps/encr …` line appears; the
  run continues. Note which app it names.
- **F5 — role picker:** if the tenant shows one you'll see
  `SSO hop: clicked "Log in as a teacher"`; absent is equally healthy.
- **Unmatched display names:** students the app shows who aren't in your
  roster appear as `RECON IN APP, NOT IN CONFIG: "…"`.
- **If SLZUSD ever fronts TeachTown with a portal SSO later** (Clever or
  similar): set `loginMode: "clever"` and the district portal chain from the
  profile takes over — that machinery is still in place and tested.

---

## Command 2 — `npm start -- --recon-goals`

### Healthy run (same terminal — the session is now cookied, no sign-in)

```text
[ts] SESSION START (recon) — district=slzusd, flags=--recon-goals
[ts] Recon mode: auth hops are screenshotted to recon/; an unrecognized page stops the run.
[ts] Opening TeachTown directly: https://www.teachtown.com/nav/#/home
[ts] Recon screenshot: .../recon/teachtown-hop1-<n>.png
[ts] TeachTown home loaded (#/home) — direct session active
[ts] Recon screenshot: .../recon/encore-hop1-<n>.png
[ts] Recon screenshot: .../recon/student-led-step1-<n>.png
[ts] Recon screenshot: .../recon/student-led-step2-<n>.png
[ts] Recon screenshot: .../recon/student-led-iep-goals-<n>.png
[ts] IEP-GOALS: selectable — 2 item(s) listed
[ts]   GOAL/LESSON: Goal: Greets peers appropriately (4/5 opportunities)
[ts]   GOAL/LESSON: Goal: Requests help using words (3/4 opportunities)
[ts] RECON report written: .../recon/iep-goals-report-<stamp>.txt
[ts] RECON COMPLETE
```

Exit code **0**. Notice: no sign-in prompt — command 1's login carried over.
The wizard stops at step 2 and backs out; step 3 is never entered, nothing
launches. Your real goal list replaces the two mock items.

### Variations

- **Goals didn't flow from the district:** `IEP-GOALS: present but DISABLED`
  or a lone "no goals loaded"–style item — enter the goals manually in
  TeachTown from your SEIS pull.
- **IEP Goals missing entirely:** `IEP-GOALS: IEP Goals option NOT FOUND on
  step 2` — the `student-led-step2-*.png` screenshot shows what the radio
  list actually offers.
- **Empty roster (F4):** `IEP-GOALS: No student rows on Student-Led step 1
  (empty roster?) — cannot check IEP Goals yet.` Exit 0.

---

## Command 3 — `npm start -- --dry-run`

Run after filling `students` in `config.json` with display names from the
command-1 report.

### Healthy run

```text
[ts] SESSION START (dry run) — 2 student(s), mode=activity, target=(first activity not at 100%), afterRotation=stop
[ts] Opening TeachTown directly: https://www.teachtown.com/nav/#/home
[ts] TeachTown home loaded (#/home) — direct session active
[ts] LOGIN Alex Test
[ts] NEXT
[ts] LOGIN Tester Bailey
[ts] NEXT

DRY RUN — parsed roster & eligibility (console only, not written to the log file):
┌─────────┬─────────────────┬─────────┬──────────────────────┬───────────────────────────────┐
│ (index) │ Student         │ Status  │ Would run            │ Activities (Last Score)       │
├─────────┼─────────────────┼─────────┼──────────────────────┼───────────────────────────────┤
│ 0       │ 'Alex Test'     │ 'READY' │ 'Making Eye Contact' │ 'Making Eye Contact: no data' │
│ 1       │ 'Tester Bailey' │ 'READY' │ 'Making Eye Contact' │ 'Making Eye Contact: no data' │
└─────────┴─────────────────┴─────────┴──────────────────────┴───────────────────────────────┘
[ts] SESSION COMPLETE
```

Exit code **0**. Notice what's *absent*: no `Recon mode:` line, no
screenshots, no sign-in — the first-run marker was written by command 1 and
the session is cookied, so a plain run is silent and fast. No activity
launches in a dry run.

### Variations

- **Session expired** (days later): the `MANUAL SIGN-IN NEEDED` banner
  simply reappears once — log in in the browser and the run continues by
  itself. If it reappears **every** run, the profile directory is being
  wiped or not written — check permissions on the path the
  `PROFILE AUTHENTICATED` line printed; do not "fix" it by storing
  credentials.
- **A configured student isn't found:** `SKIP <name> — not found in View
  Students list` — fix the spelling to the exact display name from the
  roster report.
- **Real activity lists** replace the single mock activity; each student's
  "Would run" is their first activity not at 100%.
- **Login-as flake:** one or two
  `WARN <name> — login-as attempt N failed, retrying (…)` lines are
  self-healing; three in a row ends in `ERROR <name> — … moving to next
  student` with a screenshot in `logs/`.
