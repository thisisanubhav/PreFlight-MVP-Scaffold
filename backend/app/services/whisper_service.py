"""Timestamped transcription via faster-whisper (CTranslate2-backed Whisper).

Runs on CPU with int8 quantization — no GPU required, reasonable speed for
short hackathon demo clips on Apple Silicon.
"""

import os
from pathlib import Path

# hf_xet (HF Hub's fast-transfer backend) hangs indefinitely on some sandboxed
# networks; force the plain HTTP downloader instead. Must be set before the
# huggingface_hub import below.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from faster_whisper import WhisperModel  # noqa: E402

WHISPER_MODEL_SIZE = "base"

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe(audio_path: Path) -> list[dict]:
    """Each returned entry carries Whisper's own sentence/phrase-level
    `start`/`end`/`text`, plus a per-word `words` list (real per-word
    timestamps, not interpolated) so downstream code (signals.py) can slice
    an entry's text precisely at arbitrary segment boundaries instead of
    assigning a whole multi-second sentence to a single bucket.
    """
    model = _get_model()
    segments, _info = model.transcribe(str(audio_path), vad_filter=True, word_timestamps=True)
    return [
        {
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
            "words": [
                {"word": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2)}
                for w in (seg.words or [])
            ],
        }
        for seg in segments
    ]
