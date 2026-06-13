"""Generate fixtures/sample_transcript.json — a synthetic KBCF-style sermon
transcript with word-level timings, so the score->select->captions->package
stages can be exercised end-to-end without ffmpeg/WhisperX.

Run: python fixtures/make_sample.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from clipper.models import Transcript, TranscriptSegment, Word  # noqa: E402

# Four self-contained "movements," each a candidate clip: a hook, a Scripture
# moment, an emotional peak, and a clear call to application — the moment types
# the tool hunts for. Light filler is included so leading-filler trimming has
# something to do.
SENTENCES = [
    # --- Movement 1: the hook / common pain ---
    "Um, so, can I talk to somebody who's been holding on by a thread this week?",
    "You smiled at work, you posted the picture, you said you were fine.",
    "But on the inside, behind the door nobody sees, you were quietly breaking.",
    "Here's what nobody tells you about the storm: the storm is not your enemy.",
    "The storm is the very thing God is using to wake something up on the inside of you.",
    "Because a faith that has never been tested is a faith that cannot be trusted.",
    "And some of you are about to find out exactly what you are made of.",
    # --- Movement 2: the Scripture moment ---
    "Turn with me to Mark chapter 4, verse 38, and watch the scene very closely.",
    "Jesus is asleep in the back of the boat while the disciples are panicking for their lives.",
    "And they ask him the question every one of us has asked God at midnight.",
    "Do you not care, Lord, do you not care that we are perishing out here?",
    "But watch this, watch this: the peace was already in the boat the whole time.",
    "They were screaming for a rescue while their rescue was sleeping right beside them.",
    "Sometimes you are crying out for a peace that is already sleeping on the inside of you.",
    # --- Movement 3: the emotional peak / declaration ---
    "When Jesus finally stood up and said peace, be still, the wind did not argue with him.",
    "The wind that was bullying the disciples heard one word and immediately sat down.",
    "That same voice, that same authority, that same power is living down on the inside of you.",
    "You have been talking about the storm, but God says it is time to talk to the storm.",
    "Hallelujah, somebody in this room ought to give God a real praise right about now.",
    "Because the breakthrough you have been begging for is the breakthrough you already carry.",
    "Grace did not bring you this far just to abandon you at the edge of your miracle.",
    # --- Movement 4: the application / call ---
    "So here is your assignment, church, before you leave this place today.",
    "Stop negotiating with the storm, and stop rehearsing the fear over and over again.",
    "Open your mouth and speak to it the way Jesus did, with the authority you've been given.",
    "Say to that situation, peace, be still, and then watch how fast heaven backs you up.",
    "And listen, if this word found you in the right place today, do not keep it to yourself.",
    "Somebody you love is in a storm right now and they are waiting on your invitation.",
    "Bring them with you next Sunday, and let's grow together as a family in this faith.",
]

WORD_DUR = 0.42
WORD_GAP = 0.07
SENT_GAP = 0.6


def build() -> Transcript:
    segments: list[TranscriptSegment] = []
    t = 0.0
    for sent in SENTENCES:
        words: list[Word] = []
        for tok in sent.split():
            start = round(t, 3)
            end = round(t + WORD_DUR, 3)
            words.append(Word(text=tok, start=start, end=end, confidence=0.92, speaker="SPEAKER_00"))
            t = end + WORD_GAP
        segments.append(
            TranscriptSegment(
                start=words[0].start, end=words[-1].end, text=sent, speaker="SPEAKER_00", words=words
            )
        )
        t += SENT_GAP
    return Transcript(language="en", backend="fixture", segments=segments)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "sample_transcript.json"
    build().save(out)
    print(f"wrote {out} (total {build().segments[-1].end:.1f}s)")
