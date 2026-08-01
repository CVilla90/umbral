# Umbral — HANDOFF

> ## ⚠️ Read this banner first
>
> - **The student path works end to end, all four levels, and now includes
>   listening and speaking.** Design is in `PLAN.md`; this file tracks state.
> - **🔴 The entry window opens 2026-08-10.**
> - ⚠️ **Replit's agent restructures this repo on import unless told not to.**
>   The first attempt moved the app under `artifacts/`, replaced npm with a pnpm
>   workspace, and rewrote `package.json` and `next.config.ts` — none of which
>   was needed, since `.replit` ships with the repo. `replit.md` and `AGENTS.md`
>   exist to say so, and `DEPLOY.md` §1 has the phrase to paste into the chat.
>   A restructured import is faster to delete and re-import than to untangle.
> - ✅ **`maxTotal` is SETTLED at 37** (Carlos, 2026-07-31): listening was
>   authored, not deleted. `bank.test.ts` asserts 37 on all eight forms.
>   **Do not change it again this semester** — an instrument whose maximum differs
>   between its two windows cannot compare them, and the gain score is the point.
> - ✅ **Speaking is PROVEN live** (2026-07-31): `tools/smoke-speaking.mjs` passes
>   on **webm, ogg and mp4**, on `gemini-3.5-flash` and independently on the
>   `gemini-2.5-flash` fallback. Re-run it after any model change.
> - ⚠️ **`SPEAKING_ENABLED=false` is indistinguishable from "speaking was never
>   built".** The kill switch fires *before* Gemini and records a zero-scoring
>   skip, so the student sees "no están disponibles ahora" and finishes normally
>   — by design during an outage, but it cost a session's confusion locally on
>   2026-07-31. It must be **unset** (not `"false"`) on the host: shipped as
>   `false` it would silently drop 2 of the 37 points for every student, in both
>   windows, with no error anywhere. `.env.example` ships `"true"`.
> - ⚠️ **The thinking parameter differs by model generation, and getting it wrong
>   kills the fallback silently.** `thinkingLevel` is Gemini 3.x; sending it to
>   `gemini-2.5-flash` is a **400 INVALID_ARGUMENT**, so the fallback had never
>   worked — and it would only ever run when the primary was already failing.
>   `thinkingFor()` now derives it from the model NAME, never its position.
> - ⚠️ **Speaking has two wall-clock guards and they are only correct relative to
>   each other**: `CALL_TIMEOUT_MS` (20 s) < `TRANSCRIBE_DEADLINE_MS` (45 s) <
>   `CLIENT_TIMEOUT_MS` (60 s), locked by `waiting.test.ts`. The server must be
>   the one to give up first — only it can say why, record the call against the
>   quota, and leave the student their retry. A timed-out model skips to the next
>   MODEL rather than retrying itself.
> - ⚠️ **Any form control under 16 px makes iOS Safari zoom the page on focus and
>   never zoom back out.** Most students are mobile-first. Audit with a
>   same-origin narrow iframe — `resize_window` does not work in the automation
>   browser, and media queries do evaluate correctly inside an iframe.
> - ⚠️ **Dates are CHIHUAHUA days, never the server's local time** (`lib/zone.ts`).
>   This laptop is UTC−6 and Replit is UTC, so `new Date("2026-08-10")` means two
>   different instants in the two places — at a day boundary, a whole day. The
>   seed was writing UTC midnight, which displayed as **the 9th** in the admin
>   panel and would have opened the window six hours early. `closesAt` is
>   **inclusive**, so a closing day is stored at `23:59:59.999` local; midnight
>   would shut the window a day early on exactly the students who leave it to the
>   last day. `tools/seed.mjs` cannot import TS, so it re-declares the offset and
>   `zone.test.ts` pins the two together.
> - ⚠️ **`Response.raw` for an mcq stores BOTH indices — `{ authored, shown }`.**
>   (An earlier note in this file said it stored only the displayed index and had
>   to be remapped through `optionOrder`. It does not.) Item analysis reads
>   `authored` directly; re-deriving it through the shuffle would risk disagreeing
>   with what was actually graded.
> - ⚠️ **Speaking is scored on INTELLIGIBILITY, not wording** — every speaking
>   item has `accepted: []` and `bank.test.ts` enforces it. Until 2026-07-31 form
>   A demanded a verbatim CLAVE sentence while form B accepted anything, which
>   biased the gain score in opposite directions for AB and BA students. See §2 S4.
> - ✅ **Listening playback and speaking-with-a-real-microphone both confirmed by
>   Carlos in a normal browser** (2026-07-31, S5). These were the last two legs no
>   tool in this environment can walk: the automation browser stalls every
>   `<audio>` at `readyState 0` (even a hand-built WAV) and has no microphone. If
>   either is ever suspected again, that browser **cannot** settle it — it takes a
>   human with a phone.
> - ⚠️ **PGlite serves ONE connection at a time.** `npm run dev` and any
>   `tools/*.mjs` script compete for it; the loser gets "Can't reach database
>   server". Stop the dev server before running a script. A force-killed client
>   wedges it — restart `npm run db:dev` (data survives in `.pgdata/`).
> - ⚠️ **Local `DATABASE_URL` needs `?connection_limit=1&pgbouncer=true`.** Not
>   a tuning choice: without it every query after the first dies with
>   `prepared statement "s0" already exists`. Drop both on Replit.
> - ⚠️ **`DEV_LOGIN` must never be set in production.** `/api/auth/dev` is
>   double-gated (NODE_ENV + the flag) and 404s otherwise. **Confirm it 404s on
>   the deployed host before opening the window.**
> - **`gh` on this laptop is authed as the WORK account `carlosvilla-creai`.**
>   Never `gh`-write to a CVilla90 repo. Push over the `github-personal` SSH
>   alias. Set repo-local git identity to the CVilla90 noreply **before the first
>   commit** — a force-push does *not* erase a commit.
> - **Never commit real secrets.** `.env.example` is placeholders only.
> - **Never use a `-lite` Gemini tier for audio** — it 500s in a way that looks
>   like an outage and isn't.
> - **Do not remove the per-attempt option shuffle** (`PLAN.md §2.3`). It is the
>   only thing preventing the inherited "`c` is never the answer" defect.
> - UACH volunteer track. **Not Creai work.**

---

## 1. Current state (2026-07-31)

| Area | State |
|---|---|
| Design | ✅ `PLAN.md` written and agreed |
| Scaffold | ✅ Next 16 · TS · Tailwind 4 · Prisma · vitest |
| Schema + migrations | ✅ `prisma/schema.prisma`, pushed; seed writes the semester + both windows |
| Landing page | ✅ `/` with the `Cinta` signature |
| Auth | ✅ Google OAuth, `@uach.mx`-gated server-side; `/acceso` covers every failure |
| Ficha | ✅ `/ficha` — consent, `formOrder` drawn once |
| Item bank | ✅ all 4 levels × A/B ported, **26 pts each, parity proven** |
| Anchor pool | ✅ 16 items, matched band-for-band |
| Player | ✅ `/prueba` — mcq · tf · match · cloze · reading, resume, per-item save |
| Result | ✅ `/resultado` incl. the gain reveal |
| Skill subscores | ✅ `lib/skills.ts` — derived from `Response.block`, no migration, retroactive |
| Attendance export | ✅ `lib/exports.ts` + `/api/admin/asistencia`, per-professor filter, UTF-8 BOM |
| **Listening** | ✅ **24 clips authored + generated**, registered, validated — takes the instrument to **37** |
| **Speaking** | ✅ route + recorder + UI + ceilings built **and proven live** — webm/ogg/mp4 × both models |
| **Admin dashboard** | ✅ **Phase 3 + 4 complete** — 7 pages, all exercised with data |
| ↳ Participación | ✅ `/admin` — 4 states, per professor, CSV |
| ↳ Puntajes | ✅ `/admin/puntajes` — by level/group/professor/form + histogram |
| ↳ Avance | ✅ `/admin/avance` — gain, direction, **AB-vs-BA form-effect check**, paired CSV |
| ↳ Reactivos | ✅ `/admin/reactivos` — p-value, discrimination, latency, per-option picks, flags |
| ↳ Listas | ✅ `/admin/lista` — paste-first roster, dry-run then save |
| ↳ Continuidad | ✅ `/admin/continuidad` — scaffold, empty by construction until 2027 |
| ↳ Administrar | ✅ `/admin/administrar` — windows, professors, groups, attempt reopen, audited |
| Repo | ✅ `github.com/CVilla90/umbral`, branch `main` |
| Deployment | ⬜ not created — **the only thing left** |

**Verified by walking it and reading the database back, not by inspection**
(2026-07-31): a fresh level-3 student walked to the listening block, and the row
stored afterwards was `l3b-li-1 · block=listening · pts 1/1 · correct=true ·
raw={"shown":2,"authored":2}` — i.e. the per-attempt shuffle mapped the displayed
option back to the authored answer correctly. The attempt carried
`maxTotal=37` and a **28-item** snapshot (was 34 / 25).

Green gate passes: `tsc` · `eslint` · **227 tests** · `next build`.

Live Gemini transcription, measured 2026-07-31 (one clip, three transcodes):

| format | model | calls | latency | heard |
|---|---|--:|--:|---|
| webm/opus | gemini-3.5-flash | 1 | 5.3 s | "Hi. My name is Sofia. I'm 20 years old and I study medicine." |
| ogg/opus | gemini-3.5-flash | 1 | 11.4 s | "…I'm twenty years old…" |
| mp4/aac | gemini-3.5-flash | 1 | 9.7 s | "…I'm twenty years old…" |
| all three | gemini-2.5-flash | 1 each | 0.9–2.6 s | ✅ |

Note **"20" on one call and "twenty" on the next, from the same clip** — which is
by itself the argument against ever scoring speech by exact match.

**What is NOT verified** — measured, not assumed:

- **`<audio>` playback.** The automation browser stalls every `<audio>` element
  at `readyState 0` — including a hand-built WAV blob that never touches the
  server, which is what proves it is the browser and not the clips. Same tab,
  same clip: `AudioContext.decodeAudioData` returns 6.84 s / 1 channel, and
  `fetch` returns 200 with all 41,040 bytes in 3 ms. Click play once in a real
  browser and this closes.

---

## 1b. Start here tomorrow

**Bring it back up** (two terminals; nothing was lost — `.pgdata/` persists, so
the test student, their enrollment and their submitted attempt are all still
there):

```bash
cd Brainstorm/Umbral
npm run db:dev        # terminal 1 — leave running
npm run dev           # terminal 2  ->  http://localhost:3000
```

The app was last left running on **port 3210** because `.env` sets
`NEXT_PUBLIC_APP_URL=http://localhost:3210`. Either keep using
`npx next dev -p 3210`, or change that variable to `:3000` — they must agree, or
the OAuth redirect and the dev-login redirect point at a dead port.

**The entry window is closed again.** `npm run db:seed` restored the real dates
(2026-08-10), so `/inicio` correctly says *"Todavía no abre"*. To walk the
student path before August:

```bash
# stop `npm run dev` first — PGlite serves one connection
node --env-file-if-exists=.env tools/dev-open-window.mjs entry
# ...walk it... then put the real dates back:
npm run db:seed
```

Sign in without Google: `http://localhost:3210/api/auth/dev?email=alumno.prueba@uach.mx`

**Re-testing one screen without clicking through 28**, and without the "ya
terminaste" wall that a submitted attempt puts in front of you:

```
/api/dev/rewind?to=listening    # first listening screen
/api/dev/rewind?to=speaking     # first speaking screen
/api/dev/rewind                 # back to screen 1
```

Deletes the responses from that block onward and reopens the attempt, keeping
`optionSeed` and `itemSnapshot` — so you re-walk **the same paper**, and the
earlier answers stay as given. Works over the browser session you already have,
so it does **not** fight `npm run dev` for the single PGlite connection the way
a `tools/*.mjs` script would.

### Then, in order

| # | Task | Notes |
|---|---|---|
| 0 | **Finish Phase 3 + Phase 4 locally** | Carlos's call 2026-07-31. **Scope is LOCAL ONLY** — no Replit deploy, no Google OAuth registration yet. Exact remaining work is itemized in §1c below. |
| 1 | **Deploy — only after Phase 4** | ⚠️ repo-local CVilla90 identity **before** the first commit; push over `github-personal`. Then the go-live checklist in §3. ⚠️ `public/audio/listening/*.mp3` (24 files, ~1 MB) must be committed — they are the instrument, not build output. **Ordering rationale:** deploy is the only item with a hard external deadline, and every one of its remaining unknowns lives outside this repo (Google console redirect URI, Replit Postgres, Secrets) where the latency is Carlos's calendar, not build time. Surfacing those blockers early is worth more than having the dashboard ready first — nothing about the dashboard is on the critical path until students have actually submitted. |
| 2 | **Admin dashboard** | Build while deploy blockers are outstanding. **Attendance/participation first** — it is the only page that matters during a live window, and its logic + CSV are already built and tested in `lib/exports.ts`, so the page is a thin wrapper (query → `attendanceRows` → `attendanceCsv`). Then skill subscores (`lib/skills.ts`, aggregated only — see `PLAN.md §2.4b`), scores, item analysis, manage. ⚠️ **Never compute participation % without a roster** (`pct: null`) — unrostered groups would print 100 % beside a rostered group's 58 %, and that gets read as fact. |

Run the green gate before every commit:
`npm run typecheck && npm run lint && npm test && npm run build`

⚠️ **`npm run build` takes the single PGlite connection and clobbers `.next`.**
After building, expect to kill port 3210, `rm -rf .next`, kill/restart port 5433,
then restart both. This happened four times in S6 alone. Sequence that works:

```powershell
Get-NetTCPConnection -LocalPort 3210 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }
Remove-Item -Recurse -Force .next
Get-NetTCPConnection -LocalPort 5433 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }
npm run db:dev      # background
npx next dev -p 3210 # background
```

---

## 1c. Exactly what is left (S7 hand-off)

**All four phases are built and exercised locally. The only thing left is
deployment**, which is Carlos's call and needs a host to exist first.

**The step-by-step procedure now lives in `DEPLOY.md`**, and `.replit` is
committed so the Replit import configures its own build and run commands. The
summary below is the same sequence in one screen.

### The remaining sequence, in order

1. **Push to GitHub** — done each session over the `github-personal` SSH alias.
2. **Deploy to Replit.** Needs `DATABASE_URL` from Replit Postgres, then
   `db:push` and `db:seed`. **Drop `?connection_limit=1&pgbouncer=true`** from
   the URL — that is a PGlite-only workaround.
3. **Set the env vars**: `GEMINI_API_KEY`, `SESSION_SECRET`, `ADMIN_EMAILS`,
   `NEXT_PUBLIC_APP_URL`, `SPEAKING_ENABLED=true`, Google client id/secret.
   **`DEV_LOGIN` must be absent.**
4. **Confirm `/api/auth/dev` and `/api/dev/demo` both 404 on the host** before
   opening the window. They are double-gated, but confirm it rather than assume.
5. **Register the Google OAuth client** inside the `@uach.mx` organisation and
   add the redirect URI. This is why deployment comes first: the URI needs a host.
6. **Re-seed the real window dates.** The local entry window was widened to
   2026-07-30 → 2026-10-03 for testing. Production wants `lib/calendar.ts`'s
   values, or whatever Carlos sets in `/admin/administrar`.
7. **Run `tools/smoke-speaking.mjs` against the host** — the Gemini path is the
   one thing a deploy can break invisibly.

### ⚠️ The dev database contains a FABRICATED cohort

`/api/dev/demo?n=48` created **48 demo students with both windows completed**, so
the dashboard could be verified with data in it rather than shipping in August
having never been seen populated. They are marked two ways:

- every name ends in **`DEMO`**
- `User.googleId` starts with **`demo:`**

**`/api/dev/demo?clean=1` deletes exactly those and everything they wrote**
(enrollments, attempts and responses cascade). Also present from earlier
sessions: `A349021` / `349777` test students and a fictional roster row
`349999 Marta Pérez`. **None of this is real data.**

The route is gated by `devToolsEnabled()` like every other dev route, and it
writes through `gradeItem` and `submitAttempt` — **the real scoring path** — so
the dashboards were checked against the instrument rather than against numbers
the seeder made up.

### Built and verified this session

| Area | Route / file | Verified how |
|---|---|---|
| Gain + form effect | `/admin/avance` | 48-student paired cohort; AB +9.5 vs BA +8.6, difference **+0.9** |
| Paired CSV | `/api/admin/avance` | 52 lines, BOM, `70.3 − 56.8 = 13.5` — the file's own columns agree |
| Item analysis | `/admin/reactivos` | 2 items flagged at n ≈ 48; easy/hard/dead-option flags correctly silent |
| Windows | `/admin/administrar` | saved through the form; close-before-open rejected; date round-tripped |
| Professors | `/admin/administrar` | added; **case-insensitive duplicate rejected** ("ramírez gómez" vs "Ramírez Gómez") |
| Groups | `/admin/administrar` | assigning Inglés 2-B **retroactively reassigned 5 enrolled students** |
| Reopen | `/admin/administrar` | two-step confirm; **28 responses preserved**; coverage moved 48 → 46 |
| Continuity | `/admin/continuidad` | single-semester message; series table populated |
| Mobile | all 7 admin pages | 390 px iframe: no sideways scroll, no sub-16px input, no tap target < 24 px |
| Timezone | `lib/zone.ts` | 10 tests incl. a guard pinning `tools/seed.mjs`'s hardcoded offset |

### Decisions already made — do not relitigate

- Participation % is **null**, never computed, where no roster covers the group.
- Sample SD (n−1); `n < 2` → `sd: null`, never 0. Correlation → `null` when a
  side has no variance, never 0.
- Every percentage divides by the attempt's **own** stored max.
- Only `submitted`/`auto_submitted` attempts count as measurements.
- Gain is computed from the **rounded** percentages, so an analyst subtracting
  the two CSV columns gets the third back.
- Only the **Ancla** column compares across levels *or* across semesters.
- Roster writing and attempt reopening are both **second, explicit actions**.
- Admin reopen **keeps every response** and clears only derived scores. It is
  NOT `/api/dev/rewind`, which deletes responses — right for a developer
  re-walking a screen, catastrophic for a real student.

### Traps hit in S7

- ⚠️ **The seed was writing UTC midnight**, so the admin panel showed a window
  opening on the 9th when the calendar said the 10th. Fixed in `lib/zone.ts` +
  `tools/seed.mjs`. Any date that reaches the database goes through
  `startOfDay`/`endOfDay`.
- ⚠️ **`revalidatePath` in a server action destroys the message that action just
  returned**, if the revalidated markup replaces the client component holding it.
  The reopen action performed its work and reported nothing — including its
  closed-window warning. `reopenAttempt` deliberately does not revalidate.
- ⚠️ A **ref-based click** on the window Guardar button silently did not submit;
  the same button worked by coordinate and by `.click()`. When a browser action
  appears to do nothing, try another way of clicking before suspecting the code.
- ⚠️ My own earlier note in this file claimed `Response.raw` stored only the
  displayed index. **It stores `{ authored, shown }`.** Corrected in the banner.


---

## 2. Session log

### S1 — 2026-07-30 · design

Carlos's brief: entry + exit English check-ins for UACH FCCF, four levels, ~20
minutes, low-friction, admin dashboard with downloadable longitudinal data. A
standalone app — *"this is what `uach_english_progress` should have been."*

Explored `english_test_generator`, `moodle_suite/curriculum`, `WISHUB` (VillaAula)
and the Django predecessor. Three findings shaped the design:

1. **The item content is already data.** `levels/sparkling_{1..4}.py` are pure
   Python literals with a documented contract. And `validate.py` *already asserts*
   the Guía practice items are disjoint from the exam items — which hands us two
   parallel forms with zero re-authoring.
2. **The paper exams carry a real defect** (`PLAN.md §10` there): option `c` is
   correct zero times in levels 1–3. Porting as-is would import it; per-attempt
   option shuffling removes it for free.
3. **VillaAula already solved the four riskiest pieces** — Google OAuth, answer
   normalization, Gemini speaking, edge-tts audio. That decided the stack.

Decisions taken this session (all in `PLAN.md`):

- **Counterbalanced parallel forms** (A = exam bank, B = Guía bank; `formOrder`
  AB/BA assigned 50/50 at enrollment) *instead of* per-student random sampling.
  Carlos proposed random-sample-plus-no-repeat; the change is that random
  sampling puts each student on a different ruler, whereas fixed counterbalanced
  forms fix the ruler, guarantee no-repeat structurally, and let form-difficulty
  bias cancel at cohort level. Carlos's no-repeat requirement is fully preserved.
- **8-item cross-level anchor block**, split Anchor-A / Anchor-B and matched by
  CEFR band, so growth is measurable on one ruler across all four levels — and so
  the anchor itself isn't practice-inflated by being seen twice.
- **Everything graded; blanks and skips score 0**, including speaking, so a dead
  mic caps a student below 100 % (Carlos). `skipReason` recorded to separate
  *couldn't* from *wouldn't*.
- **Windows: entry 08-10 → 10-03, exit 10-04 → 11-27**, admin-editable, pausable,
  and creatable for future semesters. One-window-only students are valid data;
  `daysBetween` is a stored covariate, not a rejection criterion.
- **Professor metric comes from an admin-maintained group→professor mapping**,
  not from student free text (which yields six spellings of one name). The
  student's optional input is kept verbatim as a cross-check only.
- **No writing block in v1** (`PLAN.md §3.4`) — it would eat half the 20 minutes
  and add an AI-grading subjectivity surface.
- **No runtime AI item generation. No timers. No copy-paste blocking.** All three
  reversed from the predecessor, with reasons in `PLAN.md §13`.
- Speaking quota hard-capped at **≤ 4 Gemini calls per attempt** (2 items × 2
  tries), 20 s / 1 MB per clip, plus a `SPEAKING_ENABLED` kill switch.
- Name: **Umbral**, held in one `site.ts` constant. Fallbacks Delta / Pulso / Cota
  if the Replit subdomain collides.

**Open, for Carlos:** cohort sizes per level/group · whether a matrícula roster
exists · whether the entry window should close at three weeks instead of the
midpoint (`PLAN.md §4.1`) · name confirmation.

### S2 — 2026-07-30 · Phase 1 build

Scaffolded and built the whole student path (§1 table). Design direction: the
audience is Ciencias de la Cultura Física, where *measure at preseason, train,
measure again* is already native — so Umbral is styled as a fitness test for your
English, not as a language app. Signature is **`la cinta`**, a measuring tape
whose scale is the real semester, so it doubles as the schedule. Interface is
**Spanish**: English chrome would handicap a level-1 student before the
measurement started.

Things worth knowing that were only learned by building:

- **The A/B parallelism is real, item for item.** `PART_I[k]` and
  `PRACTICE_MC[k]` test the same lesson (`PART_I[0]` = "December is the ______
  month", `PRACTICE_MC[0]` = "September is the ______ month"), so sampling the
  same indices from both yields forms matched slot for slot. All eight forms came
  out at exactly 26 points with no hand-tuning.
- **Two defects were introduced and caught by building the validator.** First,
  the cloze bank ended up with exactly one word per blank, which hands over the
  last blank by elimination — fixed with a fixed 3 distractors on both forms.
  Second, an evenly-spread true/false sample can return four items of the same
  polarity, so the sampler now balances explicitly.
- **A test can be wrong about the data.** "Item ids are globally unique" failed,
  and the data was right: anchor ids appear on all four levels ON PURPOSE, which
  is what pools their responses into one ruler. The invariant became "a shared id
  always means the identical item" plus "only anchor ids may be shared".
- **Three content leaks from the printed exams**, all found by looking at the
  rendered screens rather than the JSON: passage titles carried "Practice
  reading -" (Guía scaffolding shown to a student mid-measurement, now stripped
  in the exporter); the word bank rendered uppercase through the `.label` class,
  destroying the "There is" vs "there are" capitalisation cue; and MCQ stems were
  announced twice by screen readers via a redundant `sr-only` legend.
- **`node` does not read `.env`** the way the Prisma CLI does — scripts need
  `--env-file-if-exists=.env`.

### S3 — 2026-07-30 · skill subscores + attendance export (design & logic)

Three requests from Carlos, all late in the session, none of them shipped as UI:

- **Skill subscores** (`PLAN.md §2.4b`, `lib/skills.ts`). Derived from
  `Response.block`, so no migration and it applies retroactively. The judgement
  call: Writing could not honestly absorb grammar MCQ / true-false / matching —
  those are *recognition*, they are 16 of 26 level points, and folding them in
  would both be a category error and swamp the 5 points of real written
  production. Recognition got its own honest name, **Uso del inglés**.
  A test over-claimed here and was corrected by the data: Use of English at 16
  points **is** individually reportable; the other four are cohort-only. The
  threshold also moved from item count to **points**, because a match block is one
  item carrying six independent judgements.
- **Attendance export** (`PLAN.md §9`, `lib/exports.ts`). Four participation
  states, not two — `empezada` is the nudge list and is useless collapsed into
  "did not". I first flagged the missing roster as blocking; Carlos corrected
  that, and he was right: chasing other professors' class lists costs more than
  the feature returns. **Rosters are optional and coverage is per group**
  (`RosterEntry` + `mergeRoster`). The guard that makes partial coverage safe:
  a group with no roster reports `pct: null`, never a number — otherwise every
  unrostered group would show 100 % beside a rostered group's 58 %, and that
  comparison would be read as fact.
- **Short-sentence Writing items** (`PLAN.md §3.4b`) — documented only, at
  Carlos's request. The trap is written up in full: a flat "allow 1–3 wrong
  characters" forgives exactly the errors the items exist to detect (`he live` vs
  `he lives` is one edit). The rule that keeps it valid is *tolerance for spelling,
  never for structure*. Note the design already allows piloting it for free —
  `Response.raw` stores what was typed, so a past semester can be re-scored both
  ways and compared before the rule ever affects a reported number.

### S7 — 2026-07-31 · Phases 3 and 4 finished

**Carlos's directive:** *"Long horizon one shot as far as you can… The scope is
to finish all 4 phases (the full project) on a local scenario (we are not pushing
yet to replit nor registering in google's oauth)."* Critical questions were to be
turned architecturally into things that can be changed after the fact.

Built, in the order §1c had recommended:

1. **`/admin/avance` + `/api/admin/avance`** — gain per student, coverage, up/flat/down
   counts, tables by level/group/professor, and the **AB-vs-BA form-effect
   check**. The pure layer is `lib/progress.ts` (24 tests).
2. **`/admin/reactivos`** — `lib/items.ts` (23 tests): p-value generalised to
   proportion-of-points so a 6-point match item sits on the same scale as a
   1-point question, **corrected item–total discrimination**, median latency, and
   per-option pick counts.
3. **`/admin/administrar`** — windows, professors, group mapping and attempt
   reopen, every write audited through a new `audit()` helper.
4. **`/admin/continuidad`** — scaffold, empty by construction until 2027.

**How the "turn questions into post-changeable things" instruction was applied.**
Every question I might have asked became a row instead of a decision: window
dates and status, professor names, group→professor mapping. None of them needs a
deploy to change, so none of them needed an answer today.

**The discrimination number is the one that earns this page its keep.** A
p-value alone cannot tell a hard item from a broken one — both look like "few
students got it right". Discrimination separates them: negative means *the
strongest students are getting it wrong*, which is a miskeyed answer, and it is
the exact defect class the inherited paper banks were already known to carry.
The item's own points are removed from the total before correlating, because
with 28 items an item correlated against a total it belongs to flatters itself
most where it is weakest.

**Fabricated a cohort in order to verify any of it.** Gain, form effect,
discrimination and the distributions are all *unrenderable* until December, so
they would otherwise have shipped in August having never been seen with data in
them. `/api/dev/demo` writes 48 students through `gradeItem` and `submitAttempt`
— **the real scoring path** — because verifying dashboards against numbers the
seeder invented would have proved nothing. Marked `DEMO` / `demo:`; `?clean=1`
removes them.

**The timezone bug the work uncovered.** Building the window editor forced the
question of what a date *means*, and the answer was that the seed had been
writing UTC midnight: the admin panel showed the entry window opening on the 9th
when the calendar said the 10th, and on a UTC host it would have opened six
hours early and closed a day early. `lib/zone.ts` pins everything to
`America/Chihuahua`; `closesAt` is stored at the last instant of its day because
`windowIsOpen` is inclusive. `tools/seed.mjs` is plain node and cannot import
TS, so it re-declares the offset and `zone.test.ts` asserts the two agree —
duplication with a guard rather than a comment asking someone to remember.

**Corrected my own earlier note.** §1c had said `Response.raw` stored only the
displayed index and needed remapping through `optionOrder`. Reading the save path
showed it stores `{ authored, shown }`. Item analysis reads `authored` directly;
re-deriving it could have disagreed with what was actually graded.

**Two defects found by clicking rather than by testing.** A `revalidatePath` in
the reopen action was destroying the very message that action returned — the
admin saw nothing happen, including the warning that the window was closed. And
a ref-based click on the window Guardar button silently failed to submit, which
briefly looked like a broken action and was not.

Green gate: `tsc` · `eslint` · **227 tests** · `next build`. Mobile re-audited at
390 px across all seven admin pages.

### S6 — 2026-07-31 · Phase 3 begins

**Carlos's directive:** get the full app ready before 2026-08-10, ideally today.
Order agreed: **finish Phase 3, then Phase 4, then push + deploy.** He will create
the Google OAuth app inside the `@uach.mx` organization *after* the Replit deploy
exists, because the redirect URIs need the real host. He also wants, eventually,
to be able to generate **Replit-ready projects** so the Replit agent has nothing
left to do — he will bring that documentation back from Replit later.

**Git repo initialized and PUSHED** to `github.com/CVilla90/umbral` (branch
`main`). Identity was set to the CVilla90 noreply **before** the first commit;
staged content was scanned for key-shaped strings; `.env` and `.pgdata/`
excluded; all 24 MP3s committed. Pushed over the `github-personal` SSH alias
(`ssh -T` answers "Hi CVilla90!"), never `gh` — which is authed as the WORK
account here and must never write to a CVilla90 repo. Carlos created the empty
repo by hand, as required.

**Done so far:** participation page (`/admin`) + attendance CSV
(`/api/admin/asistencia`). `lib/admin.ts` gates all of `/admin/*` from the layout.
Verified live: page 200, CSV carries its UTF-8 BOM, endpoint 403s with no session,
and the `pct: null` "lista no cargada" path renders with real data.

**Scores page done** (`/admin/puntajes`) on a new pure, unit-tested `lib/stats.ts`
(14 tests). ⚠️ **Sample SD (n−1)**, and **n < 2 → `sd: null`, never 0** — "0"
reads as "everyone scored identically" instead of "we can't say". Every
percentage divides by the attempt's **own** stored max, never a constant.

**Roster upload done** (`/admin/lista`, parser in `lib/roster.ts`, 11 tests).
⚠️ **Delimiter is DETECTED, not assumed** — Spanish Excel exports `;` because the
comma is its decimal separator. BOM stripped, header optional, quoted fields
survive. ⚠️ **Bad lines are reported with line numbers, never skipped** — a
silently dropped student becomes a false `sin empezar` and gets chased for
something they did. Writing is a **second, separate action**; only the groups
present in the pasted text are replaced. Verified end to end in a browser: the
participation column flipped from `1 (lista no cargada)` to **33.3 %** and a
`sin empezar` row appeared. ⚠️ **Bug found only by clicking both buttons:** an
uncontrolled textarea whose `defaultValue` changed between renders gets **reset
by React**, so Revisar wiped the text and Guardar said "Pega la lista primero".
Controlled now. Neither the type system nor the parser tests could see it.
⚠️ The dev DB now contains 3 test roster rows (incl. a fake `349999 Marta Pérez`).

**Still to do in Phase 3:** gain, items, manage.
**Then Phase 4:** exit window logic, complement-form serving, gain reveal on the
result screen, paired export.

### S5 — 2026-07-31 · waiting UX, wall-clock guards, mobile audit

Three things, all triggered by Carlos walking the app himself.

**The speaking route was never broken — `SPEAKING_ENABLED="false"` was set in
`.env`.** The kill switch fires before Gemini and records a zero-scoring skip, so
the student sees "no están disponibles ahora" and finishes normally. That is
correct behaviour during an outage and completely indistinguishable from "not
built yet". Now called out in the banner: shipped as `false` it would silently
drop 2 of 37 points for every student in both windows, with no error anywhere.

**Waiting UX, and the guard underneath it.** Carlos observed sends taking ~a
minute. Animation alone would have been a nicer face on an unbounded wait —
`transcribe()` had **no timeout at all**, and an overloaded endpoint can take
110–127 s just to return a 500 (measured in `../gemini_computer_use`), so four
underlying requests could have held a student for minutes and failed anyway.
Added `CALL_TIMEOUT_MS` (20 s, per request, via the SDK's `abortSignal`) and
`TRANSCRIBE_DEADLINE_MS` (45 s, the whole fallback walk). ⚠️ **A timed-out model
moves to the next MODEL rather than retrying itself** — retrying is how you build
a system that never reaches its fallback precisely when it is slow enough to need
one. ⚠️ The SDK's `abortSignal` is **client-only**: the service keeps working and
still bills, which is why an aborted request still increments `apiCalls`.
Wait copy escalates 0/8/20/35 s (`waiting.ts`, pure and unit-tested), with an
indeterminate sweep — the one looping animation in Umbral. ⚠️ The blanket
reduced-motion rule would have left that sweep **invisible** (its final frame is
off-screen), so it has an explicit override.
⚠️ Three timeout constants in three files are only correct *relative* to each
other; `waiting.test.ts` locks `CALL < DEADLINE < CLIENT` so the **server** is
always the one to give up first — only it can explain why and record the call.

**Mobile audit, measured not eyeballed.** `resize_window` does not work in the
automation browser (`outerWidth: 0`), so the sweep ran in a **same-origin 390 px
iframe**, where media queries genuinely evaluate as mobile (asserted via
`matchMedia('(min-width: 640px)') === false`). Every page and all eight block
types: **zero horizontal overflow**. Three real defects, all fixed:
- ⚠️ **The `match` selects were 15.2 px, which makes iOS Safari zoom the page on
  focus and never zoom back out** — one tap and a student scrolls a magnified
  page sideways for the rest of the check-in. Any control under **16 px** does
  this; that is a hard floor, not a preference.
- "No sé, pasar" was a **20 px** tap target on every screen. Grown to 44 px
  downward, so it does not start competing with Siguiente.
- "Cerrar sesión" was 20 px. Grown; it stays in the footer, because distance is a
  better guard against accidental logout than smallness.

**`/api/dev/rewind?to=<block>`** (dev-only, same gate as `/api/auth/dev`, now
shared in `lib/dev.ts`): rewinds the signed-in student's own attempt to the start
of a block, keeping `optionSeed`/`itemSnapshot` so it is the same paper. Built
because a submitted attempt correctly refuses re-entry, and re-testing one screen
otherwise meant 28 clicks or hand-editing the database.

**Live finding:** `gemini-3.5-flash` was returning **503 high demand** all
session; all three smoke formats passed on `gemini-2.5-flash` at 3 API calls
each. The fallback fired for real for the first time — had S4 not fixed
`thinkingFor()`, speaking would have been **entirely dead today**.

### S4 — 2026-07-31 · Phase 2 — listening, speaking, design tokens

Carlos settled the blocking decision in one move: **author listening, run at 37**.
Both Phase 2 blocks then shipped.

**Listening (`src/content/listening.ts`, 24 clips).** Three rules drove the
authoring, and two of them are parity rules rather than content rules:

- **The voice is chosen by SLOT, not by a running counter.** Slot 1 is the same
  speaker on form A and form B at every level. A rotating counter would have put
  a different speaker in slot 2 of each form, and a student who drew the form
  whose slot 2 happened to be the fastest voice would have sat a measurably
  harder instrument — which no amount of counterbalancing recovers. Same reason
  the speech **rate is per level** (−20 % at A1 → +0 % at B1–B2) but identical
  across A and B.
- **All MCQ, no true/false.** The blueprint allows either. A single TF item per
  form cannot be polarity-balanced inside its own block, and MCQ gets the
  per-attempt option shuffle for free — which matters most in the one block with
  no printed ancestor to inherit the answer-letter skew from.
- The distractors are all drawn from the clip's own world, so the question stem
  alone does not eliminate anything.

**The trap that cost the most, and would have shipped silently:**
`edge_tts.Communicate.save()` **creates the output file and then raises**. The
free endpoint throttled after 21 clips, so run 1 left a **0-byte
`l4b-li-1.mp3`** on disk — and because the generator skipped files that already
existed, that clip would never have regenerated. A student would have met a
listening question with no audio and no way to answer it. Fixed in two places, on
the principle that a file's existence is not evidence of its contents: the
generator writes to `.part` and only `replace()`s after verifying size, and
`bank.test.ts` now asserts every referenced clip is **> 4 KB on disk**, not
merely present.

**Speaking (`lib/ai/gemini.ts`, `api/speaking/analyze`, `useRecorder`).** Ported
from VillaAula with two deliberate changes:

- **The grading call was removed from the AI module.** The donor bundled
  transcribe-and-grade; here Gemini only returns text and `lib/grading.ts` scores
  it with the same `gradeOpen` that grades a typed answer. `PLAN §7` already
  claimed "the model never assigns the score" — moving the call makes that
  literally true instead of aspirational.
- **The route never returns whether the answer was correct.** It returns the
  transcript ("Escuchamos: …") and nothing else. A retry offered against a
  right/wrong verdict is an answer oracle — record, learn it was wrong, record
  again — and the speaking score would measure persistence. The transcript still
  answers the only question a student legitimately has, which is whether the
  microphone worked.
- `transcribe()` now returns a result union instead of throwing, and reports
  `apiCalls`. One student-facing analysis is up to 4 underlying requests when the
  tier is flaky, so PLAN §7's "≤ 4 calls per attempt" and the real spend are two
  different numbers. Storing both is what keeps "who burned the quota" a query.

**Design tokens** (Carlos's ask). Already 95 % done: zero hex literals and zero
arbitrary colour values in `src/`. The one leak was 7 × `text-white` sitting on
`bg-mark` — invisible until someone paled the marker and the button text
vanished. Now `--color-on-mark`. Re-palletting is genuinely one file.

**The live smoke test then paid for itself twice**, which is the argument for
running one before a window opens rather than after:

1. **The fallback model had never worked.** `thinkingLevel` is a Gemini 3.x
   parameter; `gemini-2.5-flash` answers it with **400 INVALID_ARGUMENT**. Because
   the fallback only runs when the primary is already failing, this would have
   surfaced for the first time during an outage, on a student. Fixed by deriving
   the parameter from the model name (`thinkingFor()`), not from its position in
   the list — the positional version would have reintroduced the same 400 through
   `GEMINI_SPEAKING_MODEL`. The fallback is now exercised directly and passes.
   The first run also hid this behind a misleading "last error": the primary had
   503'd twice before the fallback rejected the parameter, so `Transcription`
   now carries a `trail` of every failed request instead of just the last one.

2. **Form A and form B were grading speaking by different rules.**
   `export_bank.py` set `accepted` from the CLAVE sample *when the source row had
   one* — and only the exam bank (form A) rows do. So form A required the verbatim
   sentence "I am from Chihuahua." while form B, from the Guía bank, accepted any
   intelligible answer: 2 of 37 points near-impossible on one form and free on the
   other. Under counterbalancing an AB student meets hard-then-free and a BA
   student free-then-hard, so it pushed the **gain score** — the one number this
   instrument exists to produce — in opposite directions for the two halves of the
   cohort. Speaking now always scores on intelligibility (the documented PLAN §7
   intent), the sample is preserved as a non-scoring `model`, and `bank.test.ts`
   asserts both the rule and its consequence. The regeneration diff was verified
   to touch **only** the speaking items.

   Worth noting the tests were themselves checked by reintroducing the bug and
   confirming they failed, naming `l1a-sp1`. A test that has never failed is not
   known to detect anything.

**Still NOT verified:** `<audio>` playback, because the automation browser stalls
every `<audio>` element — proven to be the browser by a hand-built WAV blob that
also stalled while `decodeAudioData` on the same clip returned 6.84 s.

---

## 3. Runbook

```bash
npm install
cp .env.example .env         # fill in locally; never commit real values

# Terminal 1 — leave running. Serves ONE connection (see banner).
npm run db:dev

# Terminal 2
npm run db:push              # once, creates the tables
npm run db:seed              # semester + both windows; idempotent
npm run dev

# green gate, before every commit
npm run typecheck && npm run lint && npm test && npm run build
```

Local development helpers (stop `npm run dev` first — one connection):

```bash
# sign in without a registered OAuth redirect URI (dev only, 404s in prod)
open http://localhost:3000/api/auth/dev?email=alumno.prueba@uach.mx

# force a window open before the semester starts; undo with `npm run db:seed`
node --env-file-if-exists=.env tools/dev-open-window.mjs entry

# dump what a walkthrough actually recorded
node --env-file-if-exists=.env tools/dev-inspect.mjs
```

Re-generating the item bank from the printed exams (one-shot; the output is
committed and owned by this repo):

```bash
../english_test_generator/venv/Scripts/python.exe tools/export_bank.py --level 1,2,3,4
```

Re-generating the listening clips (authoring-time only — the MP3s are committed,
and nothing calls a TTS service at runtime):

```bash
# reuses VillaAula's venv, which already has edge-tts
../WISHUB/tools/.ttsenv/Scripts/python tools/generate_listening.py
../WISHUB/tools/.ttsenv/Scripts/python tools/generate_listening.py --force            # all 24
../WISHUB/tools/.ttsenv/Scripts/python tools/generate_listening.py --only l3b-li-2    # one
```

Proving the speaking path actually works (spends ~3 Gemini calls):

```bash
node --env-file-if-exists=.env --experimental-strip-types tools/smoke-speaking.mjs
```

### Before opening the entry window

- [x] `maxTotal` settled at one value — **37** (2026-07-31).
- [x] **`tools/smoke-speaking.mjs` passes on all three formats** (2026-07-31).
      Re-run after any model change; a webm failure is a ship blocker, since it is
      what real browsers send.
- [x] **One listening clip actually plays** in a normal browser, and **speaking
      works from a real microphone** (Carlos, 2026-07-31).
- [ ] `GEMINI_API_KEY` in Replit Secrets, and `SPEAKING_ENABLED` left unset or
      `true`. Setting it to `false` degrades speaking to a recorded skip rather
      than taking the app down.
- [ ] The 24 MP3s in `public/audio/listening/` are present on the deployed host —
      they are content, not build output.
- [ ] `DEV_LOGIN` unset on the host, and **both** dev routes return **404** there:
      `/api/auth/dev` and `/api/dev/rewind`. They share one gate
      (`lib/dev.ts` → `devToolsEnabled()`, unit-tested), so unsetting the flag
      closes every present and future dev route at once — but confirm on the
      real host anyway, because the gate also reads `NODE_ENV`.
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Replit Secrets, and
      `https://<host>/api/auth/google/callback` added as an authorized redirect
      URI in the Google console.
- [ ] `SESSION_SECRET` and `EXPORT_PSEUDO_SALT` generated fresh for production.
      `EXPORT_PSEUDO_SALT` is set **once, forever** — changing it breaks the link
      between semesters.
- [ ] `DATABASE_URL` points at Replit Postgres **without** the local
      `connection_limit`/`pgbouncer` parameters.
- [ ] `npm run db:push` and `npm run db:seed` run against production.
- [ ] Professors and the group→professor mapping loaded (otherwise the
      per-professor metric is empty for the whole semester).
- [ ] One real `@uach.mx` sign-in walked end to end on the deployed host.
- [ ] One non-UACH account tried, and it lands on `/acceso?motivo=dominio`.

---

## 4. Where things live

### Inside this repo

```
src/
  app/
    page.tsx                 landing (the only public page)
    acceso/                  every sign-in failure, in the interface's voice
    inicio/                  the student's one decision point — routes to ficha/prueba/result
    ficha/                   demographics + consent; actions.ts DRAWS formOrder (once, 50/50)
    prueba/                  the check-in; page.tsx is the SECURITY BOUNDARY (strips answers)
    resultado/               score + the gain reveal
    api/auth/{google,dev,salir}/
    api/speaking/analyze/    ⭐ SECOND security boundary — returns the transcript, NEVER correctness
  components/
    Cinta.tsx                the signature: a measuring tape scaled to the real semester
    Shell.tsx · FichaForm.tsx
    player/{Player,Question,Speaking,Stem,types}.tsx
    player/useRecorder.ts    mic capture; caps length, releases the track, splits denied/unsupported
  content/
    anchor.ts                ⭐ the 16-item cross-level ruler, hand-authored
    listening.ts             ⭐ the 24 clips, hand-authored — voice by SLOT, rate by LEVEL
    forms.ts                 assembles anchor + listening + level bank
    bank/level{1..4}.json    GENERATED by tools/export_bank.py — review, don't hand-edit
    bank.test.ts             the blueprint gate (the validate.py analogue) — asserts 37
  lib/
    types.ts                 item/form contract
    grading.ts               normalize() + every grader. NO AI, NO network.
    ai/gemini.ts             transcription ONLY — no scoring logic lives here, on purpose
    shuffle.ts               seeded option order — kills the inherited answer-letter skew
    attempt.ts               window/form/gain rules, pure + unit-tested
    student.ts               the DB side: startOrResume, submitAttempt
    steps.ts                 flattens a form into screens; snapshot round-trip
    calendar.ts              ⭐ semester dates — read by BOTH the seed and the hero tape
    auth/{google,session}.ts
public/audio/listening/      the 24 MP3s. COMMIT THESE — they are the instrument.
tools/
  export_bank.py             one-shot Python -> JSON port
  generate_listening.py      edge-tts; atomic writes (save() creates-then-raises)
  smoke-speaking.mjs         live Gemini probe across webm/ogg/mp4
  seed.mjs · dev-db.mjs · dev-open-window.mjs · dev-inspect.mjs
```

**Two files carry more weight than their size suggests.** `src/lib/calendar.ts`
is read by both the DB seed and the landing-page tape, which is why the page can
never advertise a window that isn't open. And `src/app/prueba/page.tsx`'s
`toClientStep` copies field by field on purpose — it is what keeps `correct` and
`accepted` out of the page source of a live check-in. **It now also strips the
listening transcript**, which is the answer key for those items: only `audioSrc`
crosses to the browser.

### Open, for Carlos — updated

`maxTotal` (§5.1) is **settled**. What replaced it is smaller: the Gemini key,
and one click on a `<audio>` play button in a normal browser.

### Outside

| What | Where |
|---|---|
| Design of record | `PLAN.md` |
| Item bank source | `../english_test_generator/levels/sparkling_{1..4}.py` |
| Curriculum spine | `../moodle_suite/curriculum/sparkling_{1..4}.md` |
| Code donors | `../WISHUB/src/lib/{auth/google,grading,ai/gemini}.ts`, `../WISHUB/tools/generate_audio.py` |
| Credentials to reuse | `../uach_english_progress/.env` — Google client id/secret (lines 2–3), Gemini key (line 15) |
| Predecessor (superseded) | `../uach_english_progress/` |

---

## 5. Open, for Carlos

1. ~~**`maxTotal` 34 or 37**~~ — ✅ **settled at 37, 2026-07-31.** Listening was
   authored rather than deleted. Locked for the semester.
2. **Cohort sizes** per level and group — sets the participation denominators on
   the admin Overview and confirms the speaking quota ceiling.
3. **Rosters — optional, per group. Not blocking** (settled 2026-07-30). Carlos
   will upload his own groups; other professors' are not worth the effort. The
   attendance export works either way: with a roster a group gets `sin empezar`
   rows and a real participation %, without one it lists who showed up and
   reports **no percentage at all**. Nothing to decide — just upload what is easy
   when the dashboard exists.
4. **Entry window close date** — the chosen midpoint (2026-10-03), or the
   three-week close recommended in `PLAN.md §4.1`. Admin-editable either way.
5. **Name** — `Umbral` unless `umbral.replit.app` collides; then Delta, Pulso or
   Cota. One constant in `src/lib/site.ts`.
6. **Professors + group mapping** — needed before the window opens, or the
   per-professor metric is empty for the whole semester.
