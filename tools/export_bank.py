"""
Port the printed exam bank into Umbral's item bank.

Run ONCE per level, review the output by hand, and commit it. This is not a live
dependency: after this runs, `english_test_generator` and Umbral are independently
buildable, and the JSON in `src/content/bank/` is owned by this repo.

    ../english_test_generator/venv/Scripts/python.exe tools/export_bank.py --level 1,2

WHY THIS WORKS AT ALL
---------------------
`english_test_generator/levels/sparkling_N.py` is pure data with a documented
contract, and its `validate.py` already asserts the Guia's practice items never
duplicate the exam's. That gives two disjoint, curriculum-parallel halves for
free:

    Form A  <-  PART_I..PART_VI          (the exam)
    Form B  <-  PRACTICE_* + PRACTICE_READING   (the Guia)

They are parallel item-by-item, not merely in aggregate: PART_I[k] and
PRACTICE_MC[k] test the same lesson (verified 2026-07-30 — PART_I[0] is
"December is the ______ month", PRACTICE_MC[0] is "September is the ______
month"). So sampling the SAME indices from both yields two forms matched slot for
slot, which is what makes an entry score and an exit score comparable.

TWO THINGS THIS DELIBERATELY DOES NOT DO
----------------------------------------
1. It does not reorder options to fix the answer-letter skew documented in
   `english_test_generator/PLAN.md` §10 (option `c` is correct zero times in
   levels 1-3). Umbral shuffles options per attempt from a stored seed instead —
   fixing it here would mean editing already-delivered content, and the shuffle
   is strictly better anyway because it also defeats answer-sharing between
   students.
2. It does not truncate cloze passages to hit a point budget. Blanks beyond the
   budget are emitted as `filled` segments — the prose stays whole and the
   scoring stays parallel.
"""

from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
import unicodedata
from pathlib import Path

GENERATOR = Path(__file__).resolve().parents[2] / "english_test_generator"
OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "content" / "bank"

# The §3.2 blueprint. Identical for both forms and all four levels — that identity
# IS the parallel-forms guarantee, so changing a number here changes it for every
# form at once and can never desynchronise A from B.
BLUEPRINT = {
    "grammar": 6,
    "truefalse": 4,
    "match": 6,      # pairs in the single block
    "gapfill": 5,    # scored blanks
    "reading_mc": 2,
    "reading_open": 1,
    "speaking": 2,
}

# Extra words in the cloze bank beyond the answers, identical for both forms so
# the elimination difficulty is matched.
GAP_DISTRACTORS = 3

GAP_RE = re.compile(r"\[\[(\d+)\|([^\]]+)\]\]")


# --------------------------------------------------------------------------- #
# selection helpers
# --------------------------------------------------------------------------- #

def spread(n_total: int, k: int) -> list[int]:
    """`k` indices spread evenly across `n_total`, endpoints included.

    Evenly spread rather than "first k" so a 6-item sample still touches all four
    units — Part I is one item per lesson in lesson order, so the first six items
    would all come from Unit 1 and the form would silently stop covering the
    course.
    """
    if k >= n_total:
        return list(range(n_total))
    if k == 1:
        return [0]
    return [round(i * (n_total - 1) / (k - 1)) for i in range(k)]


def balanced_tf(items: list, k: int) -> list[int]:
    """`k` true/false indices, half true and half false.

    Evenly spreading over the whole list can hand back four items that are all
    false, and a student who answers "false" to everything would take the block.
    Balance is a property of the *sample*, so it has to be enforced here.
    """
    trues = [i for i, it in enumerate(items) if it[1]]
    falses = [i for i, it in enumerate(items) if not it[1]]
    want_t = k // 2
    want_f = k - want_t
    picked = [trues[i] for i in spread(len(trues), want_t)]
    picked += [falses[i] for i in spread(len(falses), want_f)]
    return sorted(picked)


def accepted_forms(answer: str) -> list[str]:
    """Spellings that must be marked correct for a typed answer.

    Students type on phone keyboards that autocapitalise and swap the apostrophe
    for a curly one, and Spanish-first typists reach for the acute accent. The
    runtime `normalize()` already folds case, accents and punctuation; this list
    only has to carry genuine ALTERNATIVES (contractions), not typography.
    """
    out = {answer}
    contractions = {
        "there is": ["there's"],
        "there are": ["there're"],
        "i am": ["i'm"],
        "it is": ["it's"],
        "do not": ["don't"],
        "does not": ["doesn't"],
        "cannot": ["can't", "can not"],
        "is not": ["isn't"],
        "are not": ["aren't"],
    }
    low = answer.strip().lower()
    for k, vs in contractions.items():
        if low == k:
            out.update(vs)
        if low in vs:
            out.add(k)
    return sorted(out)


def ascii_slug(text: str) -> str:
    norm = unicodedata.normalize("NFD", text)
    norm = "".join(c for c in norm if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", norm.lower()).strip("-")[:40]


# --------------------------------------------------------------------------- #
# block builders — one per blueprint row, each returning a FormBlock dict
# --------------------------------------------------------------------------- #

def build_grammar(level: int, form: str, mc_source: list, idx: list[int]) -> dict:
    items = []
    for slot, i in enumerate(idx, start=1):
        row = mc_source[i]
        # PART_I rows carry a lesson tag; PRACTICE_MC rows do not.
        if len(row) == 4:
            tag, stem, choices, correct = row
        else:
            stem, choices, correct = row
            tag = None
        items.append(
            {
                "id": f"l{level}{form.lower()}-gr{slot}",
                "type": "mcq",
                "points": 1,
                "tag": tag or f"lesson {i + 1}",
                "stem": stem,
                "choices": list(choices),
                "correct": correct,
            }
        )
    return {
        "block": "grammar",
        "title": "Gramática",
        "instruction": "Elige la opción correcta.",
        "items": items,
    }


def build_truefalse(level: int, form: str, tf_source: list, idx: list[int]) -> dict:
    items = [
        {
            "id": f"l{level}{form.lower()}-tf{slot}",
            "type": "tf",
            "points": 1,
            "sentence": tf_source[i][0],
            "correct": bool(tf_source[i][1]),
        }
        for slot, i in enumerate(idx, start=1)
    ]
    return {
        "block": "truefalse",
        "title": "¿Está bien escrito?",
        "instruction": "Decide si la oración es correcta en inglés.",
        "items": items,
    }


def build_match(level: int, form: str, pairs: list) -> dict:
    chosen = [pairs[i] for i in spread(len(pairs), BLUEPRINT["match"])]
    return {
        "block": "match",
        "title": "Relaciona",
        "instruction": "Une cada palabra con su definición.",
        "items": [
            {
                "id": f"l{level}{form.lower()}-match1",
                "type": "match",
                "points": len(chosen),
                "pairs": [{"left": w, "right": d} for w, d in chosen],
            }
        ],
    }


def build_gapfill(
    level: int, form: str, word_bank: list, text: str, title: str, spare: list | None = None
) -> dict:
    """Split the marked-up passage into literal runs and blanks.

    Only the first `BLUEPRINT["gapfill"]` blanks are scored; the rest render as
    their own answer (`filled`). Cutting the passage short instead would leave
    half a paragraph and break the reading that makes the cloze answerable.

    The bank then gets exactly `GAP_DISTRACTORS` extra words. Without them the
    bank holds one word per blank, and the final blank is free by elimination —
    which the printed exam avoids only because it scores every blank the passage
    has. Distractors come from the deactivated answers first (same passage, same
    level, guaranteed plausible) and from `spare` after that.
    """
    segments: list[dict] = []
    cursor = 0
    scored = 0
    answers: list[str] = []

    for m in GAP_RE.finditer(text):
        if m.start() > cursor:
            segments.append({"kind": "text", "value": text[cursor : m.start()]})
        answer = m.group(2)
        if scored < BLUEPRINT["gapfill"]:
            scored += 1
            answers.append(answer)
            segments.append(
                {
                    "kind": "blank",
                    "n": scored,
                    "answer": answer,
                    "accepted": accepted_forms(answer),
                }
            )
        else:
            segments.append({"kind": "filled", "value": answer})
        cursor = m.end()
    if cursor < len(text):
        segments.append({"kind": "text", "value": text[cursor:]})

    used_lower = {a.strip().lower() for a in answers}
    bank = list(answers)

    # `spare` comes first: a distractor that is NOT already visible in the passage
    # is the stronger one, because a careful reader can correctly rule out any word
    # they can see is already used. Deactivated answers are the fallback for forms
    # that have no second text to borrow from.
    pool = list(spare or [])
    pool += [w for w in word_bank if w.strip().lower() not in used_lower]
    pool += [s["value"] for s in segments if s["kind"] == "filled"]

    seen = set(used_lower)
    for w in pool:
        if len(bank) - len(answers) >= GAP_DISTRACTORS:
            break
        key = w.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        bank.append(w)

    bank = sorted(bank, key=str.lower)

    assert used_lower <= {w.strip().lower() for w in bank}, "answer missing from bank"
    assert len({w.strip().lower() for w in bank}) == len(bank), "duplicate bank entry"

    return {
        "block": "gapfill",
        "title": "Completa el texto",
        "instruction": "Escribe la palabra que falta. Puedes usar el banco de palabras.",
        "items": [
            {
                "id": f"l{level}{form.lower()}-gap1",
                "type": "gap",
                "points": scored,
                "tag": title,
                "wordBank": bank,
                "segments": segments,
            }
        ],
    }


def clean_title(title: str) -> str:
    """Strip the printed exam's own scaffolding from a passage title.

    The source titles carry their position in the paper document — "Reading 1 — "
    on the exam, "Practice reading - " in the Guia. Shown to a student mid
    check-in, "Practice reading" is a small lie: this is the real measurement, and
    the numbering refers to a document they will never see.
    """
    for prefix in ("Practice reading", "Reading"):
        if title.lower().startswith(prefix.lower()):
            rest = title[len(prefix):].lstrip()
            rest = rest.lstrip("0123456789").lstrip()
            for dash in ("—", "–", "-"):
                if rest.startswith(dash):
                    return rest[len(dash):].strip()
    return title.strip()


def build_reading(level: int, form: str, reading: dict) -> dict:
    items = []
    mc_idx = spread(len(reading["mc"]), BLUEPRINT["reading_mc"])
    for slot, i in enumerate(mc_idx, start=1):
        stem, choices, correct = reading["mc"][i]
        items.append(
            {
                "id": f"l{level}{form.lower()}-rd-mc{slot}",
                "type": "mcq",
                "points": 1,
                "stem": stem,
                "choices": list(choices),
                "correct": correct,
            }
        )
    for slot, i in enumerate(spread(len(reading["open"]), BLUEPRINT["reading_open"]), start=1):
        stem, model = reading["open"][i]
        items.append(
            {
                "id": f"l{level}{form.lower()}-rd-op{slot}",
                "type": "open",
                "points": 1,
                "stem": stem,
                "accepted": accepted_forms(model),
                "model": model,
            }
        )
    return {
        "block": "reading",
        "title": "Lectura",
        "instruction": "Lee el texto y responde.",
        "passage": {"title": clean_title(reading["title"]), "paragraphs": list(reading["text"])},
        "items": items,
    }


def build_speaking(level: int, form: str, source: list, idx: list[int]) -> dict:
    items = []
    for slot, i in enumerate(idx, start=1):
        row = source[i]
        question, target = row[0], row[1]
        sample = row[2] if len(row) > 2 else None
        items.append(
            {
                "id": f"l{level}{form.lower()}-sp{slot}",
                "type": "speaking",
                "points": 1,
                "target": target,
                "stem": question,
                # ALWAYS EMPTY. Do not restore `accepted_forms(sample)` here.
                #
                # `gradeItem` treats an empty `accepted` as "any intelligible
                # answer scores", which is the documented design (PLAN §7): these
                # are PERSONAL questions, so there is no enumerable right answer —
                # requiring "I am from Chihuahua." fails every student from
                # Delicias, and the CLAVE sample is one illustration, not a key.
                #
                # It used to read `accepted_forms(sample) if sample else []`, and
                # that was a measurement bug rather than a style choice: only the
                # EXAM bank rows carry a sample, so form A demanded a verbatim
                # match while form B accepted anything. Two of 37 points were
                # near-impossible on one form and free on the other, and under
                # counterbalancing that biases the gain score in opposite
                # directions for AB and BA students — which is precisely what the
                # parallel-forms design exists to prevent. Found by the live smoke
                # test, 2026-07-31; `bank.test.ts` now asserts A/B parity here.
                "accepted": [],
                # Kept for item analysis and for a future structure-aware rule.
                # Never used for scoring.
                "model": sample or None,
                "maxSeconds": 20,
            }
        )
    return {
        "block": "speaking",
        "title": "Habla",
        "instruction": "Graba tu respuesta. Unos segundos bastan.",
        "items": items,
    }


# --------------------------------------------------------------------------- #

def build_form(level: int, form: str, m) -> dict:
    n_lessons = len(m.PART_I)
    grammar_idx = spread(n_lessons, BLUEPRINT["grammar"])
    speaking_idx = spread(len(m.PART_VI), BLUEPRINT["speaking"])

    if form == "A":
        blocks = [
            build_grammar(level, form, m.PART_I, grammar_idx),
            build_truefalse(level, form, m.PART_III, balanced_tf(m.PART_III, BLUEPRINT["truefalse"])),
            build_match(level, form, m.PART_II[0][1]),
            # Text A's bank has only two spare words once blanks are deactivated,
            # so the second Part IV text supplies the rest.
            build_gapfill(
                level, form, m.PART_IV[0][1], m.PART_IV[0][2], m.PART_IV[0][0],
                spare=list(m.PART_IV[1][1]),
            ),
            build_reading(level, form, m.PART_V[0]),
            build_speaking(level, form, m.PART_VI, speaking_idx),
        ]
    else:
        gap_bank, gap_text = m.PRACTICE_GAP
        blocks = [
            build_grammar(level, form, m.PRACTICE_MC, grammar_idx),
            build_truefalse(level, form, m.PRACTICE_TF, balanced_tf(m.PRACTICE_TF, BLUEPRINT["truefalse"])),
            build_match(level, form, m.PRACTICE_MATCH),
            build_gapfill(level, form, gap_bank, gap_text, "Práctica"),
            build_reading(level, form, m.PRACTICE_READING),
            build_speaking(level, form, m.PRACTICE_PERSONAL, speaking_idx),
        ]

    return {"level": level, "form": form, "blocks": blocks}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", default="1,2,3,4")
    args = ap.parse_args()

    sys.path.insert(0, str(GENERATOR))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for raw in args.level.split(","):
        level = int(raw.strip())
        m = importlib.import_module(f"levels.sparkling_{level}")
        payload = {
            "level": level,
            "course": m.COURSE_TITLE,
            "cefr": m.CEFR,
            "lessons": len(m.PART_I),
            "forms": {f: build_form(level, f, m) for f in ("A", "B")},
        }
        out = OUT_DIR / f"level{level}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

        pts = {
            f: sum(i["points"] for b in payload["forms"][f]["blocks"] for i in b["items"])
            for f in ("A", "B")
        }
        status = "OK " if pts["A"] == pts["B"] else "MISMATCH"
        print(f"  {status} level {level}: A={pts['A']} pts  B={pts['B']} pts  -> {out.name}")
        if pts["A"] != pts["B"]:
            print("       forms are not parallel — the blueprint did not hold, do not ship this")
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
