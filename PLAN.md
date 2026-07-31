# Umbral — design plan

> **Read this file before writing any code.** It is the design of record.
> Session log and live status live in `HANDOFF.md`.

Owner: Carlos Villa · UACH volunteer track (Coordinación de Inglés, FCCF) ·
byline *CV Labs for Education*. **Not Creai work.**

Written 2026-07-30. **Phase 1 is built** — see `HANDOFF.md §1` for what is and
isn't done. This file stays the design of record; where the build deviated from
it, the deviation is noted inline.

---

## 1. Purpose, and the one thing that must not be compromised

FCCF admits students into English 1–4 every semester and has **no instrument**
that records the level they arrive at or the level they leave with. Umbral
produces that record.

Three questions it must answer, in priority order:

1. **How good are they when they arrive?** (entry, per level)
2. **Did they improve during the semester?** (exit − entry, same student)
3. **Did the previous level deliver?** (this semester's English-N entry vs. last
   semester's English-(N−1) exit)

Question 3 is why this is a longitudinal instrument and not four surveys, and it
is the one that constrains the design hardest — it requires that a score from
English 1 and a score from English 4 mean something on **one ruler** (§2.2).

**The non-negotiable:** the output must be *comparable numbers*. Everything
labelled "short, fun, easy" below is a **data-collection strategy** — low
friction produces high participation produces a representative sample — and not
a licence to make the measurement sloppy. Where the two genuinely conflict,
comparability wins and the conflict gets written down here.

### Non-goals

- No grade is owed. Each professor decides independently whether the check-in
  counts for anything. Umbral never reports a pass/fail.
- No individual placement claims (§2.5 — the anchor is a cohort ruler).
- No proctoring. No AI item generation at runtime (§13).

---

## 2. The measurement design

### 2.1 Two counterbalanced parallel forms

The item bank splits into two disjoint halves that are **already curriculum-parallel
and already proven disjoint** by `english_test_generator/examstyle/validate.py`
(it asserts the Guía's practice items never duplicate the exam's):

- **Form A** ← the exam bank (`PART_I…PART_VI` in `levels/sparkling_N.py`)
- **Form B** ← the Guía bank (`PRACTICE_MC`, `PRACTICE_TF`, `PRACTICE_MATCH`,
  `PRACTICE_GAP`, `PRACTICE_READING`, `PRACTICE_PERSONAL`)

Both are built to the **same blueprint** (§3.2): item *n* of Form A tests the same
lesson and the same target structure as item *n* of Form B.

At enrollment each student is randomly assigned `formOrder ∈ {"AB", "BA"}`, 50/50.
Entry serves `formOrder[0]`, exit serves `formOrder[1]`.

**Why this and not per-student random sampling.** Drawing a different 10 items per
student puts every student on a different ruler: an easy draw and a hard draw
yield different scores from identical ability, so score differences confound
ability with luck of the draw. Fixed forms fix the ruler. And the 50/50
counterbalancing means that if Form B is slightly harder, half the cohort meets
it at entry and half at exit, so **the cohort-level gain estimate is unbiased**,
and the residual form difference is directly measurable (A-at-entry vs.
B-at-entry across the whole cohort) and correctable.

Repeat prevention is therefore **structural**, not a per-student lookup table.

### 2.2 The anchor block — the cross-level ruler

Every form, at every level, opens with **8 anchor items** drawn from a single
cross-level pool spanning A1 → B2 in ascending difficulty. This is what makes an
English-1 score and an English-4 score comparable, and it is the only mechanism
that answers question 3 above.

The anchor is split the same way as everything else: **Anchor-A** and **Anchor-B**,
8 items each, matched pairwise on CEFR band (2 × A1, 2 × A2, 2 × B1, 2 × B2). It
rides with the form. Without this split a student would see the identical anchor
twice, and practice would inflate the exact ruler being used to measure growth.

### 2.3 Option order is randomized; item order is not

Option order within each multiple-choice item is shuffled per attempt from a
**seed stored on the attempt row**, so the shuffle is reproducible for review.

This is not cosmetic. `english_test_generator/PLAN.md §10` documents that in the
paper exams for levels 1–3, option **`c` is correct exactly zero times** and `b`
is correct 59–75 % of the time — a student who circles `b` every time scores most
of Part I knowing nothing. Porting the items as-is would import that defect.
Shuffling removes it by construction, at zero authoring cost, and does not touch
the printed exams.

Item *order* stays fixed so that position effects are constant across students.

### 2.4 Scoring

| Score | Items | What it is for |
|---|---:|---|
| `anchorPct` | 8 | Cross-level ruler. Comparable across all four levels and all semesters. |
| `levelPct` | 29 | Mastery of the course the student is actually enrolled in. |
| `overallPct` | 37 | Headline number shown to the student. |

Every item is graded. **Blank, skipped and unanswered all score 0** — including
speaking. A student with a dead microphone can finish the whole check-in but
cannot reach 100 %. (Carlos, 2026-07-30.) `skipReason` is recorded
(`no_mic` · `permission_denied` · `chose_skip` · `window_closed`) so analysis can
separate *couldn't* from *wouldn't* — that distinction is free here and
impossible to recover later.

Gain = `exit − entry` on each of the three scores, computed at query time, never
stored (so a scoring fix reflows history correctly).

### 2.4b Skill subscores — Reading, Writing, Listening, Speaking, Use of English

Carlos, 2026-07-30: results must also separate by skill, with **Writing inferred
from the existing items** rather than from a free-writing box.

Implemented in `src/lib/skills.ts`, **derived and never stored** — every
`Response` row already carries its `block`, so a breakdown is a pure function of
rows that exist. No migration, it applies retroactively to attempts already
submitted, and re-deciding a mapping reflows history instead of stranding it.

| Skill | Blocks | Points | Individually reportable? |
|---|---|---:|---|
| **Uso del inglés** | grammar, true/false, match | 16 | ✅ yes |
| **Escritura (palabra y frase)** | gap-fill | 5 | ❌ cohort only |
| **Lectura** | reading | 3 | ❌ cohort only |
| **Comprensión auditiva** | listening | 3 | ❌ cohort only |
| **Expresión oral** | speaking | 2 | ❌ cohort only |

The anchor's 8 points are **excluded by default**: its job is to be the
cross-level ruler (§2.2), and folding shared items into a level-specific subscore
would make that subscore neither one thing nor the other. Analyse the anchor
separately, by CEFR band.

**Why "Use of English" exists rather than folding recognition into Writing.**
Grammar multiple-choice, true/false and matching are *recognition* — the student
picks, they do not produce — and they are 16 of the 26 level points. Calling them
Writing would be a category error a thesis reader would attack first, and it
would swamp the 5 points that genuinely are written production, so the Writing
number would move whenever recognition moved and would tell you nothing about
writing. The cloze blanks *are* real written production, which is why the label
says **"palabra y frase"**: it carries its own scope, so nobody reads it as
CEFR discourse writing.

> ⚠️ **Four of the five subscores are cohort-level only** (§2.5 applies here too).
> At 2–5 points, one student's percentage is mostly noise; a group mean over ~100
> students is 200–500 observations and is perfectly usable for trends and for a
> thesis. `isIndividuallyReportable()` encodes the ~10-point floor so the
> dashboard decides this in code rather than leaving it to whoever reads the
> chart. Show skill subscores **aggregated, on the admin dashboard only** — never
> on a student's result screen, and never as "your Reading level is X".

> ⚠️ **The blueprint is not balanced for skill analysis**, and that is a real
> tension with the 20-minute budget. If tracking four skills over semesters
> matters more than the budget, rebalance for **Ene–Jun 2027**, not mid-semester.
> The design permits it: the anchor is the invariant that preserves the
> longitudinal thread, so the level-specific blocks can be rebalanced between
> semesters without losing cross-semester comparability. Changing them *within* a
> semester breaks the entry↔exit comparison and is never acceptable.

### 2.5 Stated limitation — do not over-claim

Eight anchor items is a **cohort-level** instrument. Group means over ~100
students are stable; an individual's anchor score has a confidence interval far
too wide to call them "B1". Report group means, distributions and gains. Never
print a CEFR label next to a student's name.

### 2.6 What the design yields

Per student per semester: entry score ×3, exit score ×3, gain ×3, `daysBetween`,
per-item responses with latency. Per cohort: level × group × professor × semester
means, distributions, gain distributions, and the English-N-entry vs.
English-(N−1)-exit continuity comparison.

`daysBetween` is a deliberate covariate, not an accident (§4.3).

---

## 3. The item bank

### 3.1 Source — the content already exists as data

`english_test_generator/levels/sparkling_{1..4}.py` are pure Python literals with
a documented contract, hand-verified against the curriculum, with the answer key
checked item by item. Nothing needs re-authoring. Counted 2026-07-30:

| Item type | Exam bank (→ A) | Guía bank (→ B) | Per level |
|---|---:|---:|---:|
| MCQ | 20 (22 @ L3) | 20 (22 @ L3) | 40–44 |
| True/False | 10 | 10 | 20 |
| Match pairs | 16 (2 blocks) | 8 | 24 |
| Gap-fill texts | 2 | 1 | 3 |
| Readings | 2 | 1 | 3 |
| Speaking prompts | 6 | 6 | 12 |

A 20-minute form needs ~26 screens. There is comfortably 2×.

**Port mechanism:** a one-shot Python script in `tools/export_bank.py` imports each
`levels/sparkling_N.py`, emits JSON, and a TS codegen step turns that into typed
`src/content/bank/levelN.ts`. It runs **once**, is committed, and the output is
then hand-reviewed and owned by this repo. It is not a live dependency — the two
projects stay independently buildable.

### 3.2 Form blueprint — identical for A and B, all four levels

| # | Block | Screens | Points | Type | Source | ~Time |
|---:|---|---:|---:|---|---|---:|
| 0 | Ficha (demographics + consent) | 1 | — | form | — | 2:00 |
| 1 | Anchor | 8 | 8 | MCQ | new cross-level pool | 3:00 |
| 2 | Listening | 3 | 3 | MCQ / TF | new transcripts + edge-tts | 3:00 |
| 3 | Grammar | 6 | 6 | MCQ | `PART_I` / `PRACTICE_MC` | 3:00 |
| 4 | True/False | 4 | 4 | TF | `PART_III` / `PRACTICE_TF` | 1:30 |
| 5 | Vocabulary match | 1 | 6 | match | `PART_II` / `PRACTICE_MATCH` | 2:00 |
| 6 | Gap-fill | 1 | 5 | open | `PART_IV` / `PRACTICE_GAP` | 2:30 |
| 7 | Reading | 1 (+3 Q) | 3 | MCQ + open | `PART_V` / `PRACTICE_READING` | 3:00 |
| 8 | Speaking | 2 | 2 | speaking | `PART_VI` / `PRACTICE_PERSONAL` | 3:00 |
|  | **Total** | **~26** | **37** | | | **~20:00** |

> ✅ **RECONCILED at 37** (Carlos, 2026-07-31). The instrument was 34 points for
> one day: every block existed except listening, whose three points were declared
> here but had no clips. The choice was to author the 24 clips or delete the row,
> and Carlos chose to author them — so all eight forms are now exactly 37 points,
> asserted by `bank.test.ts` rather than merely documented.
>
> **Do not change this number again this semester.** An instrument whose maximum
> differs between the entry and the exit window cannot compare its own two
> windows, and the gain score — the entire point — becomes uninterpretable. The
> value is locked from the moment the first student submits.

A build-time validator (`bank.test.ts`) asserts the blueprint holds for all 8
forms: exact counts per block, A/B parity per slot, unique ids, every referenced
audio file present, every match block non-degenerate, no gap-fill bank containing
two interchangeable entries.

That last check is not paranoia — `english_test_generator/PLAN.md §7` records that
**word-bank answer ambiguity bit every single level** during authoring. It is the
recurring defect class of this content, so it gets a test.

### 3.3 What is genuinely new (the only authoring work)

1. **The anchor pool** — 16 items (Anchor-A ×8, Anchor-B ×8), matched by CEFR
   band. Written fresh, deliberately *not* level-specific.
2. **Listening** — 24 short clips (4 levels × 2 forms × 3 items). Transcripts are
   1–3 casual everyday sentences, calibrated by level, original wording.
   Generated to MP3 at **build time** with edge-tts (free, no API key, 4 rotating
   voices) using `WISHUB/tools/generate_audio.py` as the template. Listening
   therefore costs nothing at runtime and survives any AI outage.

### 3.4 Deliberate omission — no free-writing block in v1

The paper exam's Part VII (50–100 words) is dropped. It would consume 8–10 of the
20 minutes on its own and would need AI grading, which is both a cost and a
subjectivity surface. Production is already sampled by the gap-fill, the open
reading answers and the two speaking items. Recorded as a decision, not an
oversight — it is an additive change if wanted later.

### 3.4b If we want a real Writing skill: short-sentence input (future, not built)

Carlos, 2026-07-30. The Writing subscore in §2.4b rests on 5 points of
single-word cloze, which is thin. The way to strengthen it **without** a
free-writing box is a block of **short constructed responses — 2 to 5 words** —
normalised and cleaned, with a small tolerance for typing slips.

That is the right instinct: a 2–5 word answer forces *word order, agreement and
morphology* together, which a single-blank cloze cannot. It stays machine-gradable
and it stays inside the 20-minute budget (~30 s per item).

**But a blanket "allow 1–3 wrong characters" would silently break the
instrument**, and this is the part to get right before anyone builds it. In an
English test one character often *is* the construct:

| Answer | Student wrote | Edits | What tolerance would do |
|---|---|---:|---|
| `he lives here` | `he live here` | 1 | forgive the 3rd-person **-s** — the exact point |
| `she was tired` | `she is tired` | 2 | forgive the **tense** |
| `two books` | `two book` | 1 | forgive the **plural** |
| `I have been` | `I has been` | 1 | forgive **subject–verb agreement** |

A flat threshold forgives precisely the errors the item exists to detect, and it
would do so invisibly — scores would look fine and mean less.

**The rule that keeps it valid: tolerance applies to spelling, never to
structure.** Concretely, once `normalize()` has folded case, accents and
punctuation, compare **token by token**:

1. **Function words and inflected forms must match exactly** — articles,
   auxiliaries, pronouns, prepositions, and any token carrying the target
   morphology (`-s`, `-ed`, `-ing`, irregular forms). Zero tolerance.
2. **Content words may differ by ≤ 1 edit** when they are ≥ 6 characters, so
   `restaurent` → `restaurant` and `becuase` → `because` are forgiven. Scale to
   ≈ 10 % of token length, capped at 2.
3. **Reject any fuzzy match that is ambiguous** — if the typed string is within
   tolerance of *two* different accepted answers, or within tolerance of a known
   wrong form listed on the item, mark it wrong rather than guessing. Guessing in
   favour of the student is still guessing, and it is unauditable.

Per-item and opt-in (`tolerance` on the item), never a global setting: some items
legitimately want zero.

**Pilot it on real data before adopting it — the design already allows this for
free.** Because `Response.raw` stores what the student actually typed and nothing
derived (§5), an existing semester's answers can be **re-scored both ways** and
the two distributions compared. If tolerance moves scores materially, that is
evidence about the rule, not a guess. Do that before it ever affects a reported
number.

⚠️ Adding this block changes `maxTotal`, so it lands in **Ene–Jun 2027**, never
mid-semester (§2.4b). The anchor is what keeps the longitudinal thread intact
across such a change.

### 3.5 Copyright

Same rule as the paper exams and VillaAula: follow the **grammar/skill spine**
only. Never name the source book, never reproduce its wording, titles or images.
All prose in Umbral — anchor items, listening transcripts, readings — is original.

---

## 4. Semesters, windows and the attempt lifecycle

### 4.1 Ago–Dic 2026

Semester runs **Mon 10 Aug 2026 → Fri 27 Nov 2026** (109 days). The midpoint is
**Sat 3 Oct 2026**, so:

| Window | Opens | Closes |
|---|---|---|
| Entry | 2026-08-10 | 2026-10-03 |
| Exit | 2026-10-04 | 2026-11-27 |

> ⚠️ **Recommendation on record (Carlos's call, defaults set to his choice).**
> An "entry" score collected in week 8 is not a baseline — it is contaminated by
> the instruction it is meant to precede. I would close the entry window around
> **2026-08-31** (three weeks in) and open the exit window at the midpoint,
> leaving Sep 1 – Oct 3 as a gap. Carlos chose the clean midpoint split; the
> dates are admin-editable, so this is a one-field change if the first cohort
> shows a lot of late entries.

Everything about windows is **data**, not code: admin can edit dates, pause,
resume, cancel, and create the windows for future semesters (Ene–Jun 2027 and
beyond) without a deploy.

### 4.2 One window only is valid

A student who does entry but never exit — or exit but never entry — produces a
complete, usable attempt. It simply has no gain score. Exports carry `hasPair`
so those rows are trivially included or excluded. **No attempt is ever discarded
for being unpaired.** (Carlos, 2026-07-30.)

### 4.3 Two days apart is valid, and is itself a measurement

A student may do entry on the last day of the entry window and exit on the first
day of the exit window. This is allowed and **`daysBetween` is stored as a
covariate** — "does more time between check-ins help or hurt?" is a question the
data should be able to answer, not a case to reject.

### 4.4 Attempt state machine — this is the answer to "what if they never finish?"

```
                ┌──────────────┐
   start  ───►  │ in_progress  │  answers persist per item as they are given
                └──────┬───────┘
        submit ────────┤
                       ├──► window closes ──► auto_submitted  (partial, scored)
                       └──► 14 days idle  ──► auto_submitted  (partial, scored)
                                                     │
                                              ┌──────▼──────┐
                                              │  submitted  │  immutable
                                              └─────────────┘
```

No countdown is ever shown. The **window close date is the only deadline**, which
is exactly what Carlos identified. Two consequences:

- An abandoned attempt cannot strand a student — the 14-day idle sweep closes it
  so they are free to start the exit window.
- Partial attempts are scored on what was answered (unanswered = 0) and flagged
  `completed: false`, so analysis can exclude them without losing them.

Answers persist as they are given, so a dropped connection **resumes** rather than
restarts. No reconnection limit, ever.

### 4.5 One attempt per (student, window)

Enforced by a unique constraint. Admin has a **reopen** action for the inevitable
"my browser died" case, which writes an audit row rather than mutating silently.

---

## 5. Data model (Prisma sketch)

Postgres from day one. The predecessor shipped a 663 KB `db.sqlite3` **inside the
repo**; that is not infrastructure a thesis can rest on.

```
User            id · email(unique, @uach.mx) · googleId · name · role · createdAt
                └ role: "student" | "admin"  (admin also gated by ADMIN_EMAILS)

Semester        id · label("Ago-Dic 2026") · startsOn · endsOn · isActive
Window          id · semesterId · phase("entry"|"exit") · opensAt · closesAt
                  · status("draft"|"open"|"paused"|"closed")

Professor       id · name · email? · isActive
GroupAssignment semesterId · englishLevel(1-4) · group("A".."G") · professorId
                └ @@unique([semesterId, englishLevel, group])   ← authoritative

Enrollment      id · userId · semesterId · matricula · fullName · age · gender
                  · academicSemester(1-8) · group("A".."G") · englishLevel(1-4)
                  · professorRaw?      ← what the student typed/picked, verbatim
                  · professorId?       ← resolved via GroupAssignment (§6.2)
                  · formOrder("AB"|"BA")   ← assigned once, randomly
                  · consentAt · createdAt
                └ @@unique([userId, semesterId])

Attempt         id · enrollmentId · windowId · form("A"|"B") · englishLevel
                  · state · optionSeed · itemSnapshot(Json)
                  · startedAt · submittedAt · lastActivityAt
                  · anchorRaw · levelRaw · totalRaw · maxTotal · durationMs
                  · completed(Bool)
                └ @@unique([enrollmentId, windowId])

Response        id · attemptId · itemId · block · type · raw(Json)
                  · correct(Bool) · points · maxPoints
                  · msElapsed · skipped · skipReason? · triesUsed
                └ @@unique([attemptId, itemId])

SpeakingCall    id · responseId · model · bytes · audioMs · latencyMs
                  · ok · errorCode?   ← quota + abuse audit trail (§7)

AdminAudit      id · actorEmail · action · targetType · targetId · payload(Json) · at
```

Two things worth defending:

- **`itemSnapshot` on the attempt.** The exact item ids and option order served,
  frozen. A content edit in 2027 must never retroactively change what a 2026
  student was asked. This is the single most important field for longitudinal
  integrity.
- **`pseudoKey`** — a salted hash of `matricula`, derived on export. It lets a
  student be followed across four semesters without their name or matrícula
  appearing in a CSV that gets emailed around.

---

## 6. Access

### 6.1 Auth — Google only, `@uach.mx` only

No password path at all. That removes signup, reset and email verification
entirely, and makes the domain restriction airtight.

Ported from `WISHUB/src/lib/auth/google.ts` (hand-rolled on plain `fetch`, no
NextAuth), with two additions:

- `hd=uach.mx` on the authorization URL — a **UX hint** that pre-filters the
  account chooser.
- A **server-side** check on the callback: `email_verified === true` **and**
  `email.endsWith("@uach.mx")`. `hd` is a hint and is never the gate.

A non-UACH account gets a friendly "este instrumento es solo para cuentas
@uach.mx" page, not a stack trace.

**Discoverability:** the landing page is public and reachable. A secret URL is
not a security control, and it makes onboarding 40 students per group miserable.
The page shows the brand, one paragraph of why, and one button.

### 6.2 Admin — `cavilla@uach.mx`, and the professor mapping

Admin is an env allowlist (`ADMIN_EMAILS`), checked server-side on every admin
route and server action. One name for now. No professor-facing view in v1 —
adding one later means roles plus a professor↔group permission surface, and is
out of scope.

**The professor metric** (Carlos wants best/worst performers by professor) does
*not* rely on student input, because free text produces `Ma. Guadalupe`,
`Lupita`, `MTRA GUADALUPE R.` and three other spellings of one person. Instead:

- `GroupAssignment` (semester × level × group → professor), maintained by Carlos
  in the admin, is **authoritative**.
- The student's ficha shows a **dropdown of known professors + "Otro / no sé"**,
  stored verbatim in `professorRaw` — useful for catching a wrong group entry,
  never used as the analytic key.
- `Enrollment.professorId` is resolved from the mapping, and is re-resolvable in
  bulk when Carlos fills in a mapping late.

---

## 7. Speaking — the only runtime AI, and its budget

Ported from `WISHUB/src/lib/ai/gemini.ts`. Model `gemini-3.5-flash`, fallback
`gemini-2.5-flash`, both audio-capable. **Both verified live on webm, ogg and mp4**
(2026-07-31, `tools/smoke-speaking.mjs`).

> ⚠️ **Never a `-lite` tier.** `gemini-*-flash-lite` rejects audio with a
> **500 INTERNAL** that reads like a provider outage and is not one. This has
> cost debugging time twice already.

> ⚠️ **The thinking parameter is per model GENERATION.** `thinkingLevel` is
> Gemini 3.x; `gemini-2.5-flash` rejects it with **400 INVALID_ARGUMENT** and
> wants `thinkingBudget: 0` instead. This silently disabled the fallback until
> 2026-07-31 — and a fallback only runs when the primary is already failing, so
> it would have surfaced for the first time during an outage, on a student.
> `thinkingFor()` derives it from the model name, never from list position.

Grading is lenient by design: Gemini transcribes, then `lib/grading.ts` decides.
The model never assigns the score — it only turns sound into text, and
`lib/ai/gemini.ts` contains no scoring logic at all so that claim is structural
rather than a convention.

**Lenient means INTELLIGIBILITY, not exact wording.** Every speaking item carries
`accepted: []`, which `gradeItem` reads as "any intelligible answer scores", and
`bank.test.ts` enforces it. Two reasons, one principled and one measured:

- These are *personal* questions. There is no enumerable set of right answers to
  "where are you from?", and requiring the CLAVE's "I am from Chihuahua." fails
  every student from Delicias.
- The live smoke test returned **"I'm 20 years old"** and **"I'm twenty years
  old"** for the *same clip* on different calls. Any exact-match rule would score
  identical students differently depending on how the model rendered a number.

⚠️ Until 2026-07-31 this was violated: `export_bank.py` filled `accepted` from the
CLAVE sample when the source row had one, and only the exam bank (form A) rows do.
Form A therefore demanded a verbatim sentence while form B accepted anything —
2 of 37 points near-impossible on one form and free on the other, biasing the gain
score in opposite directions for AB and BA students. The sample is now kept as a
non-scoring `model` field.

**Future improvement, deliberately not built:** score on whether the *target
structure* appears (past continuous, `used to`, …) rather than on intelligibility.
That is a more valid speaking measure, and `Response.raw` stores the transcript,
so a past semester can be re-scored and compared before the rule affects any
reported number — the same escape hatch as §3.4b.

**Abuse and quota controls** (all server-side; the client is never trusted):

| Control | Value |
|---|---|
| Max recording length | 20 s, capped by the recorder **and** re-checked on the server |
| Max upload size | 1 MB (20 s of webm/opus ≈ 60 KB — 1 MB is already generous) |
| Accepted mime | `audio/webm`, `audio/ogg`, `audio/mp4` only |
| Tries per speaking item | **2** (one honest retry; more is abuse) |
| Calls per attempt | ≤ 4 (2 items × 2 tries) — a hard ceiling, not an average |
| Rate limit | per-user, per-route, sliding window |
| Kill switch | `SPEAKING_ENABLED=false` degrades speaking to `skipped` without taking the app down |

Ceiling check: ~500 students × 2 windows × 4 calls = **≤ 4,000 calls per
semester**, each a few seconds of audio. Negligible on flash — and bounded even
under a deliberate attack, because the ceiling is per-attempt and attempts are
capped at one per window.

Every call writes a `SpeakingCall` row, so "who burned the quota" is a query.

---

## 8. Student experience — the 20-minute walk

The word **examen** never appears. It is a **check-in** (entry) and a
**check-out** (exit).

1. **Landing** — brand, one paragraph, one button: *Entrar con tu correo @uach.mx*.
2. **Ficha** (~2 min, untimed, not scored) — email shown greyed out (they are
   already logged in; this is a reminder of which account they used), today's date
   greyed out (server-set), then: confirm name · matrícula · age · gender
   (M / F / Otro / Prefiero no decir) · academic semester 1–8 · group A–G ·
   **English level 1–4** · professor (dropdown, optional) · consent checkbox.
3. **The check-in** — one screen at a time, a soft progress bar, no clock.
   Blocks in blueprint order (§3.2). Every screen is skippable; skipping scores 0.
4. **Result** — `overallPct`, a warm one-line message, and an honest note that
   this does not affect their grade. At exit, if an entry attempt exists, show
   the gain. That reveal is the single best reason a student comes back for the
   second window, so it is a feature, not a nicety.

**English level 1–4 is self-declared and determines which exam is served.** It is
locked after the first submission of the semester and mirrored back for
confirmation before starting. The dashboard **flags** contradictions (a declared
level-1 student who aces the B2 anchor) rather than blocking — flagging keeps the
tone friendly and still surfaces bad data.

Design constraints throughout: mobile-first (most will do this on a phone), works
on a bad connection (answers persist per item), and nothing hostile — no
countdown, no copy-paste blocking, no reconnection limit. Latency is measured;
it is never enforced.

---

## 9. Admin dashboard

Server-rendered, admin-only, one page per concern.

- **Overview** — participation per level/group/window (n, % of expected), live
  during a window. This is the number Carlos will actually watch in week 1.
- **Scores** — distributions of `anchorPct` / `levelPct` / `overallPct`, by level,
  group, professor, semester.
- **Gain** — paired entry→exit deltas, with `daysBetween` as a covariate; the
  form-effect check (A-at-entry vs. B-at-entry) lives here too.
- **Continuity** — this semester's English-N entry vs. last semester's
  English-(N−1) exit, on the anchor scale. Empty until the second semester, by
  construction; the page says so rather than showing a broken chart.
- **Items** — per-item p-value (proportion correct) and mean latency. This is how
  a bad item gets caught: a p-value near 0 or 1, or an option nobody ever picks.
- **Data** — the exports below.
- **Manage** — semesters, windows (edit/pause/cancel/create), professors, group
  assignments, and the attempt-reopen action.

### Exports

**Attendance / participation list — the operational one** (Carlos, 2026-07-30):
*"tell each professor which of their students participated."* Built in
`src/lib/exports.ts`, filterable by professor, level and group, downloadable per
professor so a list can be handed straight over.

Four states, not two — "participated / did not" throws away the distinction a
professor most needs:

| State | Meaning | What the professor does |
|---|---|---|
| `completa` | finished every screen | nothing |
| `incompleta` | submitted with gaps, or auto-closed | nothing; the data counts |
| `empezada` | opened it and stalled | **nudge** |
| `sin empezar` | never opened this window | **chase** |

#### Rosters are optional, and coverage is per group

Umbral only learns a student exists once they sign in and fill the ficha, so
`sin empezar` is only knowable where a class list has been uploaded. Carlos can
upload his own groups easily; other professors' groups are much harder to obtain
and are **not worth blocking the feature on** (Carlos, 2026-07-30). Partial
coverage is therefore the permanent expected state, not a temporary gap.

| Group | Export contains | Participation % |
|---|---|---|
| **Roster uploaded** | everyone, including `sin empezar` | ✅ real denominator |
| **No roster** | only the students Umbral has seen | ❌ **null — never computed** |

The unrostered list is genuinely useful on its own: a professor handed the 23
students who participated can work out the rest from their own class list.

> ⚠️ **Never compute a percentage against an unknown denominator.** Dividing by
> "people who showed up" reports every unrostered group at 100 %, sitting in the
> same table as a rostered group at 58 %. That comparison is fiction and would be
> read as fact. `attendanceSummary` returns `pct: null` plus `rostered: false`, so
> the UI says *"23 participaron (lista no cargada)"* instead of a number.

Two things fall out of having a roster where one exists, both free: an `En lista`
column flagging a participant who is **not** on their group's list (wrong group
declared, or a stale roster), and a sharper version of the §8
mis-declared-level flag.

Upload shape: `matrícula, nombre, nivel, grupo`, per semester
(`RosterEntry` in the schema). Matrículas are normalized (upper-case,
non-alphanumerics stripped) before matching, because they are typed by students
on phones and transcribed by staff into spreadsheets. A genuine prefix difference
(`349021` vs `A349021`) will not reconcile and surfaces as `En lista = no`, which
is a data-quality signal worth seeing rather than papering over.

> ⚠️ Unmapped groups are labelled `sin asignar`, never blank — but the per-professor
> split is only as good as the group→professor mapping (§6.2). **Load it before
> the window opens** or every row lands in `sin asignar` for the whole semester.

Then three analysis CSVs, because the tool decides the shape:

| File | Grain | For |
|---|---|---|
| `responses_long.csv` | one row per response | SPSS/R/Jamovi — item analysis, IRT, mixed models |
| `attempts_wide.csv` | one row per attempt | quick pivots, per-student summaries; carries the §2.4b skill subscores |
| `students_paired.csv` | one row per student-semester | gain analysis; `hasPair`, `daysBetween` |

The three analysis files carry `pseudoKey` and omit name/matrícula/email by
default, with an explicit "include identifiers" toggle that writes an
`AdminAudit` row. **The attendance list is the deliberate exception**: naming
students is its entire purpose, so it always identifies them and always audits
the download.

CSV details that are not incidental: UTF-8 **BOM** by default, or Excel on a
Spanish Windows install renders *Ramírez* as *RamÃ­rez*; RFC 4180 quoting,
because a name like *"Pérez Gómez, Ana"* would otherwise shift every later column
by one and produce a file that opens fine and is silently wrong; and a selectable
`;` delimiter for es-MX Excel.

Charts follow the `dataviz` skill conventions — one visual system, readable in
light and dark.

---

## 10. Ethics

The data is human-subjects data intended for publication. That makes two cheap
things now into expensive things later:

- **Consent + aviso de privacidad** on the ficha: what is collected, what it is
  for, that it does not affect their grade, that reporting is aggregate, and how
  to ask for deletion. One screen, one checkbox, `consentAt` stored.
- **Pseudonymization by default** in every export (§9).

Neither blocks anything. Both are why the dataset stays usable if Carlos ever
takes it to a comité or a journal.

---

## 11. Stack, repo, deployment

**Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma · Postgres ·
vitest · Replit Autoscale.**

Identical to VillaAula, and not out of habit — the four riskiest pieces already
exist in `../WISHUB/src` and are lifted rather than rewritten:

| Need | Donor |
|---|---|
| UACH-only Google login | `src/lib/auth/google.ts` — plain `fetch`, no NextAuth churn |
| Answer normalization | `src/lib/grading.ts` → `normalize()`: NFD accent-strip, punctuation-strip, lowercase, whitespace-collapse. `"Café ÁÉÍÓÚ"` → `cafe aeiou`, `"It's"` → `its`. Handles `'` and `’` alike. Already unit-tested — this **is** the "students type the Spanish apostrophe" requirement, solved. |
| Speaking | `src/lib/ai/gemini.ts` — `transcribeAndGrade` with the audio-capable model list |
| Listening audio | `tools/generate_audio.py` — edge-tts, 4 voices, free, no key |

Plus: one language end to end, so the item bank is **typed TS validated at build
time** — the direct analogue of `validate.py` / `parity_check.py`, which is what
keeps an instrument honest.

Why not Django (the predecessor's stack): not worse in the abstract, worse here —
it means re-solving OAuth, speaking, audio and deployment with zero reuse. The
predecessor's 3,524-line `views.py` is the evidence.

**Repo:** local `Brainstorm/Umbral/`, remote `CVilla90/umbral`.

> ⚠️ `gh` on this laptop is authed as the **work** account `carlosvilla-creai`.
> Never `gh`-write to a CVilla90 repo. Push over the `github-personal` SSH alias,
> and set the repo-local identity to the CVilla90 noreply **before the first
> commit** — a force-push does not erase a commit; GitHub serves the old SHA
> until it GCs.

**Env** (`.env.example` holds placeholders only — real values never leave the
local `.env` / Replit Secrets):

```
DATABASE_URL=
GOOGLE_CLIENT_ID=            # reuse from uach_english_progress/.env line 2
GOOGLE_CLIENT_SECRET=        # reuse from uach_english_progress/.env line 3
GEMINI_API_KEY=              # reuse from uach_english_progress/.env line 15
NEXT_PUBLIC_APP_URL=
ADMIN_EMAILS=cavilla@uach.mx
SESSION_SECRET=
EXPORT_PSEUDO_SALT=
SPEAKING_ENABLED=true
```

Carlos adds the deployed redirect URI to the Google console at go-live:
`https://<host>/api/auth/google/callback`.

Replit gotchas already known: port **5000**, and clear `.next` between `build`
and `dev`.

**Brand in one place:** `src/lib/site.ts` exports `BRAND`. Renaming Umbral →
Delta / Pulso / Cota is a one-line change (`umbral.replit.app` may collide —
Umbral is also an Ethereum privacy protocol).

---

## 12. Phasing — the calendar decides this

Today is **2026-07-30**. The entry window opens **2026-08-10**: eleven days.

The exit window does not open until **2026-10-04**, and the dashboard is worthless
until data exists. So the calendar hands us a clean, low-risk order:

### Phase 1 — student path ✅ **DONE 2026-07-30** (except the deploy)

Auth · ficha · attempt engine · Form A/B assignment · persistence · result
screen · windows seeded · anchor pool authored · item validator green.

Beat its own scope in one respect and missed it in another: **all four level
banks** landed rather than just 1–2 (the port was mechanical once the exporter
existed), but the **deploy** did not happen.

**Still open as of 2026-07-31.** The git repo is now initialized locally with one
commit under the CVilla90 identity, but nothing is pushed and nothing is
deployed. This is the oldest unfinished work in the project and the only work
with a hard deadline — see the warning under Phase 2.

### Phase 2 — completion ✅ **DONE 2026-07-31**, budgeted for ~2026-08-24

Speaking end to end (needs Carlos's live smoke test) · listening clips generated
and registered in `LISTENING` · the `maxTotal` reconciliation.

> Ordering note: the `maxTotal` decision is upstream of both. Settle it first —
> it decides whether listening is a task or a deletion.

Landed roughly three weeks early, which is the only reason there is any slack to
argue about below. `maxTotal` settled at **37** (listening authored, not deleted);
speaking proven against the live API and then by hand with a real microphone.

> **⚠️ Finish Phase 1's deploy before starting Phase 3.** The phases are numbered
> by dependency, not by preference, and the deploy is the one item carrying a
> hard external date (**2026-08-10**). It is also the only remaining work whose
> blockers live *outside this repo* — a GitHub repo that must be created by hand
> on the CVilla90 account, the Google console redirect URI, Replit Postgres and
> Secrets — so its latency is Carlos's calendar rather than build time. The
> dashboard is pure code, blocks nothing, and displays nothing until students have
> submitted. Build it while the external blockers are outstanding, not instead of
> clearing them.

### Phase 3 — dashboard + exports ✅ **DONE 2026-07-31**, budgeted through September

Overview first (participation is what matters during a live window), then scores,
items, exports, manage. Nothing here blocks the entry window.

Landed as seven pages: participación · puntajes · avance · reactivos · listas ·
continuidad · administrar. Two things came out differently from the sketch:

- **Item analysis grew a discrimination column.** A p-value alone cannot tell a
  hard item from a broken one. The corrected item–total correlation can, and a
  negative one is the signature of the exact defect the inherited paper banks
  were already measured to carry (§10 of `english_test_generator/PLAN.md`).
- **Manage turned out to be the phase's real deliverable.** Every question that
  would otherwise have needed a code change in January — window dates, professor
  names, group→professor mapping — is a row edited from that page.

### Phase 4 — exit readiness ✅ **DONE 2026-07-31**, budgeted by 2026-10-04

Exit window logic · complement-form serving · gain reveal on the result screen ·
paired export · continuity page scaffolded.

Most of it was **already built inside Phase 1** and only discovered on
2026-07-31 by reading the code rather than the plan: `formFor()` already served
the complement form at exit, `gain()` and `daysBetween()` already existed, and
`/resultado` already rendered the gain reveal. What remained was the paired
export, the admin gain page and the continuity scaffold.

The gain page carries the **AB-vs-BA form-effect check**, which is the single
most important validity test this instrument can run on itself — and the reason
§2.1 chose counterbalanced forms over per-student random sampling. Random
sampling would have made the check impossible to even define.

> **⚠️ Every phase except the deploy is now done.** Phase 1's deploy is the only
> outstanding item in the whole project, and the only one with a hard external
> date. Its blockers live outside this repo: Replit Postgres and Secrets, and the
> Google console redirect URI, which needs the host to exist first.

---

## 13. Decisions on record

Things deliberately done differently from `uach_english_progress`, so nobody
"restores" them later:

| Predecessor | Umbral | Why |
|---|---|---|
| Gemini generates MCQs per attempt | Pre-authored, version-controlled bank | Per-student generated items destroy comparability — no equating, no item difficulty, no thesis. This alone would have made the old dataset unusable. |
| 30 s countdown per question | No timers; latency measured | No grade is owed, so the cheating incentive is ~0 while the friction cost is real. |
| Copy-paste blocked, max 2 reconnections | Neither | Hostile to the participation the whole design depends on. Answers persist; drops resume. |
| SQLite committed to the repo | Postgres + Prisma migrations | Real exports, real migrations, real backups. |
| Single instrument per level | Counterbalanced A/B + cross-level anchor | Comparability across students, across windows, and across levels. |
| Django + 3,524-line `views.py` | Next.js, code lifted from VillaAula | Four hardest problems already solved next door. |

Carried over deliberately: attempt snapshots, `@uach.mx`-only OAuth, and the
demographics-first flow. Those were right.

---

## 14. Traps inherited from the source projects

- **`c` is never the answer** in levels 1–3 (`english_test_generator/PLAN.md §10`).
  Fixed here by per-attempt option shuffling (§2.3). Do not remove the shuffle.
- **Word-bank ambiguity bit every level.** Two interchangeable entries in one
  gap-fill bank cost two points each time. `bank.test.ts` must check it (§3.2).
- **Sparkling 3 has 22 lessons, not 20.** Any per-lesson loop must read the
  length, never assume 20.
- **`-lite` Gemini tiers cannot hear** (§7).
- **`gh` is authed as the work account** (§11).
- **`.env` changes need a full server restart** — a stale process reading old env
  has burned an afternoon on MUSAI.

---

## 15. Open questions

1. **Expected cohort size per level/group?** Drives the participation
   denominators on the Overview page and confirms the speaking quota ceiling.
2. **Is there a roster** (matrícula list per group) to validate against, or is
   everything self-declared? Self-declared works; a roster would let the flag in
   §8 be much sharper.
3. **Entry window close date** — midpoint as chosen, or the three-week close
   recommended in §4.1? Answerable after seeing week-1 uptake; the field is
   admin-editable either way.
4. **Name** — `Umbral` unless the Replit subdomain collides; then Delta, Pulso or
   Cota (§11).
