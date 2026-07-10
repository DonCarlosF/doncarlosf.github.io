import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import pytest  # noqa: E402

from clipper.config import Config  # noqa: E402
from clipper.models import Transcript, TranscriptSegment, Word  # noqa: E402


@pytest.fixture
def cfg() -> Config:
    return Config.load(ROOT / "config.yaml")


@pytest.fixture
def transcript() -> Transcript:
    """Small two-thought transcript with word timings (0.5s words)."""
    segments = []
    t = 0.0
    sentences = [
        "Can I talk to somebody who has been holding on by a thread this week today",
        "Turn with me to Mark chapter 4 and watch what Jesus does in that boat right now",
        "That same authority that calmed the storm is living down on the inside of you today",
        "So go and speak to your storm this week and bring a friend with you on Sunday",
    ]
    for s in sentences:
        words = []
        for tok in s.split():
            words.append(Word(text=tok, start=round(t, 3), end=round(t + 0.5, 3), confidence=0.9))
            t = round(t + 0.6, 3)
        segments.append(TranscriptSegment(start=words[0].start, end=words[-1].end, text=s, words=words))
        t += 0.5
    return Transcript(segments=segments)
