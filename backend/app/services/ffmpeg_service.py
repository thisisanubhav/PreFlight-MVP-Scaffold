"""FFmpeg wrappers for audio extraction and keyframe sampling.

Two keyframe sources are combined:
  - Periodic frames (every PERIODIC_INTERVAL_SECONDS) guarantee visual
    coverage even for talking-head videos with few or no hard cuts.
  - Scene-cut frames (FFmpeg's `scene` score filter) mark actual visual
    transitions, which Phase 3's pacing signal counts per time-segment.
"""

import re
import subprocess
from pathlib import Path

SCENE_THRESHOLD = 0.3  # FFmpeg scene score 0..1; empirical cut-detection cutoff
PERIODIC_INTERVAL_SECONDS = 5


def extract_audio(input_path: Path, output_path: Path) -> None:
    """Extract mono 16kHz PCM WAV audio — the format Whisper expects."""
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def _extract_periodic_frames(
    input_path: Path, output_dir: Path, interval_seconds: int = PERIODIC_INTERVAL_SECONDS
) -> list[dict]:
    pattern = output_dir / "periodic_%05d.jpg"
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-vf", f"fps=1/{interval_seconds}",
        "-qscale:v", "2",
        str(pattern),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return [
        {"timestamp": round(i * interval_seconds, 2), "path": str(path), "type": "periodic"}
        for i, path in enumerate(sorted(output_dir.glob("periodic_*.jpg")))
    ]


def _extract_scene_change_frames(
    input_path: Path, output_dir: Path, threshold: float = SCENE_THRESHOLD
) -> list[dict]:
    pattern = output_dir / "scene_%05d.jpg"
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-qscale:v", "2",
        str(pattern),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # FFmpeg's mjpeg encoder fails to initialize (rather than emitting
        # zero frames) when the scene filter matches nothing — expected for
        # low-cut talking-head footage, not a real pipeline error.
        if "Nothing was written into output file" in result.stderr:
            return []
        raise subprocess.CalledProcessError(
            result.returncode, cmd, result.stdout, result.stderr
        )
    timestamps = [float(m) for m in re.findall(r"pts_time:(\d+\.?\d*)", result.stderr)]
    frame_paths = sorted(output_dir.glob("scene_*.jpg"))
    return [
        {"timestamp": round(ts, 2), "path": str(path), "type": "scene_cut"}
        for ts, path in zip(timestamps, frame_paths)
    ]


def extract_keyframes(input_path: Path, output_dir: Path) -> list[dict]:
    periodic = _extract_periodic_frames(input_path, output_dir)
    scene_cuts = _extract_scene_change_frames(input_path, output_dir)
    return sorted(periodic + scene_cuts, key=lambda f: f["timestamp"])
