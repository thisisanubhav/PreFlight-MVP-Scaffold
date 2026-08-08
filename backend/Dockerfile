FROM python:3.11-slim

# ffmpeg: required by app/services/ffmpeg_service.py for audio/keyframe extraction.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# hf_xet (HF Hub's fast-transfer backend) has been observed to hang
# indefinitely on some sandboxed/restricted networks -- force the plain
# HTTP downloader for this one-time build-time model fetch too (matches
# app/services/whisper_service.py's runtime guard).
ENV HF_HUB_DISABLE_XET=1

# Pre-download and cache the faster-whisper "base" model into the image at
# build time, not on first request -- avoids cold-start latency and any
# model-host network flakiness affecting a live demo.
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

COPY app/ app/
COPY storage/demo/ storage/demo/

# Render (and most PaaS hosts) inject the listen port via $PORT at runtime;
# fall back to 8000 for `docker run` outside that context.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
