# Day-one expected output (8/13 runbook)

Generated 2026-08-05 against the mock TeachTown stack with **mock student
names** (Alex Test, Tester Bailey, Ace Fake, Missing Kid). Diff your real
terminal against each block. Expected substitutions on the real run:

- `http://localhost:8971/clever` → `https://clever.com/in/slzusd`
- Timestamps, screenshot filenames, and report names will differ.
- Mock roster shape maps to yours: three same-school students (one matched
  exactly, one by name-order tokens, one by nickname/aka) plus a fourth
  `expected: false` entry for the other-school student who may not appear.
- Button text `"San Lorenzo Sign in"` is whatever the district button
  actually says — any `ssoButtonText` candidate can match.

Run the three commands in this order, same terminal, same day.

---

## Command 1 — `npm start -- --recon-roster`

### Healthy run

```text
[ts] SESSION START (recon) — district=slzusd, flags=--recon-roster
[ts] Recon mode: auth hops are screenshotted to recon/; an unrecognized page stops the run.
[ts] Opening Clever portal: http://localhost:8971/clever
[ts] Recon screenshot: .../teachtown-runner/recon/clever-hop1-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/clever-before-sso-click-<n>.png
[ts] SSO hop: clicked "San Lorenzo Sign in"
[ts] Recon screenshot: .../teachtown-runner/recon/clever-hop2-<n>.png
[ts] Clever portal ready (TeachTown tile visible)
[ts] Opening TeachTown from Clever...
[ts] TeachTown home loaded (#/home)
[ts] Recon screenshot: .../teachtown-runner/recon/ss-view-students-<n>.png
[ts] RECON Social Skills: 3 student(s) found
[ts]   SS: Alex Test
[ts]   SS: Tester Bailey
[ts]   SS: Ace Fake
[ts] Recon screenshot: .../teachtown-runner/recon/encore-hop1-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/encore-before-clever-click-<n>.png
[ts] SSO hop: clicked "Login with Clever"
[ts] Recon screenshot: .../teachtown-runner/recon/encore-hop2-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/encore-before-sso-click-<n>.png
[ts] SSO hop: clicked "San Lorenzo Sign in"
[ts] Recon screenshot: .../teachtown-runner/recon/encore-hop3-<n>.png
[ts] Recon screenshot: .../teachtown-runner/recon/encore-before-role-click-<n>.png
[ts] SSO hop: clicked "Log in as a teacher"
[ts] Recon screenshot: .../teachtown-runner/recon/encore-hop4-<n>.png
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

Exit code **0**. Afterward: `recon/` holds the hop screenshots and the
plain-text roster report; fill `students` in `config.json` with the exact
display names the report shows.

### How this block changes when an open item goes the other way

- **F1 — SLZUSD isn't on Clever (ClassLink / direct login):** somewhere in
  the hop sequence you instead get:

  ```text
  [ts] SSO RECON STOP — a human needs to look at this:
  [ts] UNRECOGNIZED AUTH PAGE during Clever portal chain
  [ts]   url: …
  [ts]   title: …
  [ts]   visible buttons/links: … | … | …
  [ts]   Screenshot saved to recon/. No credentials were touched.
  ```

  Exit code **2**, nothing clicked on the unknown page. Send the
  `recon/unrecognized-*.png` screenshot + that block. (A ClassLink URL adds
  a ClassLink-specific hint line.) The same stop can fire during the enCORE
  chain — the header then says `during enCORE auth chain`.
- **Microsoft credential form appears** (fresh profile, likely on day one):
  the run pauses with
  `Microsoft sign-in needs input — waiting for manual login.` and
  `>>> Log in manually in the browser window, then press Enter here to continue...`
  — type your credentials **in the browser**, press Enter in the terminal,
  the run resumes. The runner never touches the form.
- **F4 — rostering hasn't synced:** the Social Skills section shows
  `RECON Social Skills: 0 student(s) found` plus
  `Zero students in Social Skills. Most likely district rostering has not synced to TeachTown yet — a timing fact, not a runner bug. Re-run --recon-roster in a few days.`
  Still exit 0. Same pattern possible on the enCORE side.
- **F3 — the other-school student:** absent = the healthy
  `RECON NOT FOUND: "…" (expected-maybe — OK)` line you see above (that is
  the good outcome for an `expected: false` entry). Present = a MATCH line
  instead — then he's rostered and can join the rotation.
- **F2 — enCORE lands on the wrong app:** a
  `WARN enCORE landed at "…" instead of #/apps/encr …` and/or
  `WARN enCORE header doesn't look like #/apps/encr …` line appears; the
  run continues. Note which app it names.
- **F5 — role picker:** present = the
  `SSO hop: clicked "Log in as a teacher"` line; absent = that line and its
  two screenshots simply don't appear. Both are healthy.
- **Unmatched display names:** any student the app shows who isn't in your
  roster appears as `RECON IN APP, NOT IN CONFIG: "…"` — normal if the
  district rosters extra students to you.

---

## Command 2 — `npm start -- --recon-goals`

### Healthy run

```text
[ts] SESSION START (recon) — district=slzusd, flags=--recon-goals
[ts] Recon mode: auth hops are screenshotted to recon/; an unrecognized page stops the run.
[ts] Opening Clever portal: http://localhost:8971/clever
[ts] Recon screenshot: .../recon/clever-hop1-<n>.png
[ts] Clever portal ready (TeachTown tile visible)
[ts] Opening TeachTown from Clever...
[ts] TeachTown home loaded (#/home)
[ts] SSO hop: clicked "Login with Clever"
[ts] SSO hop: clicked "San Lorenzo Sign in"
[ts] SSO hop: clicked "Log in as a teacher"
[ts] (…hop screenshots interleaved as in command 1…)
[ts] Recon screenshot: .../recon/student-led-step1-<n>.png
[ts] Recon screenshot: .../recon/student-led-step2-<n>.png
[ts] Recon screenshot: .../recon/student-led-iep-goals-<n>.png
[ts] IEP-GOALS: selectable — 2 item(s) listed
[ts]   GOAL/LESSON: Goal: Greets peers appropriately (4/5 opportunities)
[ts]   GOAL/LESSON: Goal: Requests help using words (3/4 opportunities)
[ts] RECON report written: .../recon/iep-goals-report-<stamp>.txt
[ts] RECON COMPLETE
```

Exit code **0**. Note the Clever hop is already cookied from command 1 (no
district-button line before `Clever portal ready`); the enCORE hops may
also disappear on the real tenant once its session is cookied. The wizard
stops at step 2 and backs out — step 3 is never entered, nothing launches.

### Variations

- **Goals didn't flow from the district:** `IEP-GOALS: present but DISABLED`
  or `IEP-GOALS: selectable — 0 item(s) listed` (or a lone
  "no goals loaded"–style item). That answers the bridge question: enter
  the goals manually in TeachTown from your SEIS pull.
- **IEP Goals missing entirely:** `IEP-GOALS: IEP Goals option NOT FOUND on
  step 2` — screenshot `student-led-step2-*.png` shows what the radio list
  actually offers.
- **Empty roster (F4):** `IEP-GOALS: No student rows on Student-Led step 1
  (empty roster?) — cannot check IEP Goals yet.` Exit 0.

---

## Command 3 — `npm start -- --dry-run`

Run after filling `students` in `config.json` with display names from the
command-1 report.

### Healthy run

```text
[ts] SESSION START (dry run) — 2 student(s), mode=activity, target=(first activity not at 100%), afterRotation=stop
[ts] Opening Clever portal: http://localhost:8971/clever
[ts] Clever portal ready (TeachTown tile visible)
[ts] Opening TeachTown from Clever...
[ts] TeachTown home loaded (#/home)
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

Exit code **0**. Notice what's *absent*: no `Recon mode:` line and no
screenshots — the first-run marker was written by command 1, so a plain run
is out of recon mode, and the SSO hops are cookied. No activity launches in
a dry run.

### Variations

- **A configured student isn't found:** `SKIP <name> — not found in View
  Students list` and status `NOT FOUND` in the table — fix the spelling to
  the exact display name from the roster report.
- **Real activity lists** replace the single mock activity; each student's
  "Would run" is their first activity not at 100% (a real fresh account
  usually shows several `no data` rows).
- **A student already at 100% on everything:** `SKIP <name> — all
  activities at 100%` with status `SKIP` — unlikely on a fresh account.
- **Login-as flake:** one or two
  `WARN <name> — login-as attempt N failed, retrying (…)` lines before
  `LOGIN <name>` are self-healing; three failures in a row ends in
  `ERROR <name> — giving up after retries; moving to next student` with a
  screenshot in `logs/`.
