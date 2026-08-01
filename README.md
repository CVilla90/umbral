# Umbral

**Entry and exit measurement of English proficiency — UACH FCCF.**

Every semester, students arrive into English 1–4 and leave again, and the Facultad
has no instrument that says how good they were on the way in or on the way out.
Umbral is that instrument: two short online check-ins per level per semester, and
an admin dashboard that turns them into scores, trends and downloadable data.

- **Students** get a ~20-minute, no-stakes, no-timer check-in. No grade is owed —
  each professor decides what, if anything, it counts for.
- **Carlos (admin)** gets per-level, per-group and per-professor results, gain
  scores, and CSV exports designed to survive contact with SPSS/R/Jamovi.

Built by **Carlos Villa** under the *CV Labs for Education* byline. UACH volunteer
track (Coordinación de Inglés, FCCF) — **not Creai work**.

---

## What it is not

- Not a course, not a grade book, not a placement certificate.
- Not AI-generated at runtime. Every item is pre-authored, reviewed and
  version-controlled. Gemini is used for exactly one thing: grading spoken answers.
- Not proctored. No countdowns, no copy-paste blocking, no reconnection limits.
  Response latency is *measured*, never *enforced*.

## Status

**The student path works end to end** (2026-07-31): sign-in → ficha → 28-screen
check-in → result, all four levels, both forms, **all eight blocks**. Verified by
walking it and reading back what the database stored, not by inspection.
227 tests, `next build` clean.

The instrument is **37 points**, the number the blueprint always specified: the
24 listening clips were authored on 2026-07-31 rather than deleting the block.
That value is asserted by the test suite and is locked for the semester — an
instrument whose maximum differs between its entry and exit windows cannot
compare them.

**Speaking is proven live**: route, recorder, quota ceilings and kill switch, with
`tools/smoke-speaking.mjs` transcribing correctly on webm, ogg and mp4 across both
models. Spoken answers are scored on **intelligibility, not wording** — the same
clip comes back as "I'm 20" on one call and "I'm twenty" on the next, so exact
matching would score identical students differently.

Listening playback and speaking from a real microphone were both confirmed by
hand in a normal browser on 2026-07-31 — the two legs no automation in this
environment can walk. The student path now has no unverified steps.

**The admin dashboard is complete** (Phases 3 and 4, 2026-07-31) — seven pages:
participación · puntajes · avance · reactivos · listas · continuidad ·
administrar, with per-professor attendance CSV and a paired entry→exit export in
the wide format a paired t-test wants.

Two of them are the ones worth naming. **Avance** carries the AB-vs-BA
form-effect check: half the cohort takes A then B and half takes B then A, so if
the forms are genuinely parallel both halves must show the same mean gain. That
is the instrument auditing itself, and it is why §2.1 chose counterbalanced forms
over per-student random sampling. **Reactivos** reports each question's
difficulty *and* its corrected item–total discrimination — a p-value alone cannot
distinguish a hard question from a miskeyed one, and a negative discrimination is
exactly the defect the inherited paper banks were already measured to carry.

Everything on **Administrar** is a row, not code: window dates and status,
professors, group→professor mapping, attempt reopen. Next semester is typing.

Because gain and item statistics cannot render anything until the exit window
runs in December, a dev-only route fabricates a cohort that has taken both
windows — writing through the real scoring path, so the dashboards were verified
against the instrument rather than against invented numbers. See `HANDOFF.md §1c`.

**Not deployed yet** — the only remaining work in the project. The ordered
procedure is in **`DEPLOY.md`**; `.replit` is committed so the import configures
itself. The host is **`umbral-ingles.replit.app`**, which is what the Google
OAuth redirect URI is built from.

Read **`HANDOFF.md`** first — its banner carries the traps, and §1b is the
resume procedure. **`PLAN.md`** is the design of record. **`AGENTS.md`** (and
`replit.md`, which Replit's agent reads on import) carry the guardrails: this
repo is configured and must not be restructured, ported, or moved into a
workspace layout.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma · Postgres · vitest.
Deployed on Replit Autoscale. Google OAuth restricted to `@uach.mx`.

Chosen because four of the riskiest pieces already exist and are proven in
production in `../WISHUB` (VillaAula) and get lifted rather than rewritten —
see `PLAN.md §11`.

## Quick start

```bash
npm install
cp .env.example .env      # fill in locally; never commit .env

npm run db:dev            # terminal 1 — embedded PGlite, leave running
npm run db:push           # terminal 2 — once
npm run db:seed           # semester + both windows
npm run dev               # http://localhost:3000
```

⚠️ PGlite serves **one connection at a time**: stop `npm run dev` before running
any `tools/*.mjs` script, or the second one gets "Can't reach database server".

Green gate: `npm run typecheck && npm run lint && npm test && npm run build`

## Repo

- Local: `Brainstorm/Umbral/`
- Remote: `CVilla90/umbral` (personal account)

⚠️ `gh` on this laptop is authenticated as the **work** account
`carlosvilla-creai`. Push over the `github-personal` SSH alias, and set the
repo-local git identity to the CVilla90 noreply address **before the first
commit** — a force-push does not erase a commit, GitHub keeps serving the old
SHA until it garbage-collects.

## Related projects

| Project | Relationship |
|---|---|
| `../english_test_generator` | **Source of the item bank.** Paper exams + Guía; its `levels/sparkling_N.py` modules are pure data and port mechanically. |
| `../moodle_suite/curriculum` | Curriculum spine the items are anchored to. |
| `../WISHUB` (VillaAula) | Code donor: Google OAuth, answer normalization, Gemini speaking, edge-tts audio. |
| `../uach_english_progress` | The Django predecessor. Superseded — see `PLAN.md §13`. |
