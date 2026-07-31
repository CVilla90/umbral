"""
Generate the 24 listening clips with edge-tts (free, no API key, no runtime cost).

These are AUTHORING-TIME assets. Run this once, commit the MP3s, and the app never
touches a TTS service again — listening therefore costs nothing per student and
survives any AI outage (PLAN §3.3). That is the whole reason it is edge-tts at
build time rather than a speech API at request time.

The transcripts are NOT duplicated here. They are read out of
`src/content/listening.ts`, which is the single source of truth for both the audio
and the answer key — a copy in this file would drift, and a clip that no longer
matches its question is a defect no test could see.

Run (Windows, from Umbral/):

    ../WISHUB/tools/.ttsenv/Scripts/python tools/generate_listening.py

or make a local venv:

    py -3 -m venv tools/.ttsenv
    tools/.ttsenv/Scripts/python -m pip install edge-tts
    tools/.ttsenv/Scripts/python tools/generate_listening.py

Flags:
    --force     regenerate clips that already exist
    --only ID   generate one clip (e.g. --only l3b-li-2)
"""

import argparse
import asyncio
import json
import pathlib
import re
import subprocess
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC_FILE = ROOT / "src" / "content" / "listening.ts"
OUT_DIR = ROOT / "public" / "audio" / "listening"


def load_specs() -> list[dict]:
    """Read the specs out of the TypeScript module, via node.

    Parsing TS with a regex would work until the first time someone reformatted
    the file. Asking node to evaluate the real module means the script is reading
    exactly what the app reads, and it fails loudly if the two ever disagree.
    """
    script = """
      const { allListeningSpecs, LISTENING_VOICES, LISTENING_RATE } =
        await import('./src/content/listening.ts');
      console.log(JSON.stringify(allListeningSpecs().map(({ level, form, slot, spec }) => ({
        id: spec.id,
        level,
        form,
        text: spec.transcript,
        voice: LISTENING_VOICES[slot % LISTENING_VOICES.length],
        rate: LISTENING_RATE[level],
      }))));
    """
    result = subprocess.run(
        [
            "node",
            "--experimental-strip-types",
            "--no-warnings",
            "--input-type=module",
            "-e",
            script,
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.exit(f"could not read {SPEC_FILE.name}:\n{result.stderr}")

    # node may print warnings before the JSON; take the last non-empty line.
    line = [ln for ln in result.stdout.splitlines() if ln.strip()][-1]
    return json.loads(line)


MIN_CLIP_BYTES = 4096
MAX_TRIES = 4


async def synth(clip: dict, path: pathlib.Path) -> None:
    """Write one clip ATOMICALLY, with retries.

    ⚠️ Two traps, both hit on the first real run of this script (2026-07-31):

    1. `edge_tts.Communicate.save()` CREATES THE FILE AND THEN RAISES on failure,
       leaving a 0-byte MP3 behind. Combined with the skip-if-exists logic below,
       a silent failure would have been permanent — the file exists, so it is
       never regenerated, and a student gets a listening item with no audio and
       no way to answer it. So: write to a temp file, verify it, and only then
       move it into place.
    2. The free endpoint throttles a burst. 21 clips in a row succeeded and the
       22nd got `NoAudioReceived`, which is transient and looks like a content
       error. Retry with a backoff before believing it.
    """
    tmp = path.with_suffix(".part")
    last_error: Exception | None = None

    for attempt in range(1, MAX_TRIES + 1):
        try:
            communicate = edge_tts.Communicate(clip["text"], clip["voice"], rate=clip["rate"])
            await communicate.save(str(tmp))
            size = tmp.stat().st_size
            if size < MIN_CLIP_BYTES:
                raise RuntimeError(f"clip is only {size} bytes — treating as a failed synth")
            tmp.replace(path)
            return
        except Exception as error:  # noqa: BLE001 — retry anything the service throws
            last_error = error
            tmp.unlink(missing_ok=True)
            if attempt < MAX_TRIES:
                await asyncio.sleep(2 * attempt)

    raise RuntimeError(f"{clip['id']}: gave up after {MAX_TRIES} tries — {last_error}")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate existing clips")
    parser.add_argument("--only", help="generate a single clip id")
    args = parser.parse_args()

    clips = load_specs()
    if args.only:
        clips = [c for c in clips if c["id"] == args.only]
        if not clips:
            sys.exit(f"no clip with id {args.only}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    made = skipped = 0
    for clip in clips:
        # The ids come from a checked-in TS module, but this script writes files —
        # so the id is validated as a filename before it is used as one.
        if not re.fullmatch(r"[a-z0-9-]+", clip["id"]):
            sys.exit(f"refusing to write a clip with a suspicious id: {clip['id']!r}")

        path = OUT_DIR / f"{clip['id']}.mp3"
        # "Exists" is not enough — a previous run may have left a truncated file
        # behind (see synth). A clip too small to be speech is treated as absent.
        if path.exists() and path.stat().st_size >= MIN_CLIP_BYTES and not args.force:
            skipped += 1
            continue

        await synth(clip, path)
        kb = path.stat().st_size / 1024
        print(f"  {clip['id']:<12} {clip['voice']:<28} {clip['rate']:>5}  {kb:6.1f} KB")
        made += 1
        # Pace the burst. The service throttles, and a 250ms gap costs 6 seconds
        # across the whole set while removing most of the retries.
        await asyncio.sleep(0.25)

    print(f"\n{made} generated, {skipped} already present -> {OUT_DIR.relative_to(ROOT)}")
    if skipped and not args.force:
        print("re-run with --force to regenerate the ones that were skipped")


if __name__ == "__main__":
    asyncio.run(main())
