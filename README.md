# PreFlight

> Know whether your YouTube video will hold attention — before you publish it.

[Open the live app](https://preflight-mvp-scaffold.vercel.app/) · [Backend health check](https://preflight-backend-ftv2.onrender.com/health) · [Demo report](https://preflight-mvp-scaffold.vercel.app/report/demo)

PreFlight is an AI-assisted pre-publish copilot for draft YouTube videos. Upload a video to get an explainable, heuristic retention estimate, identify the segment most likely to lose viewers, and receive a concrete edit and a stronger opening-line suggestion.

## UI highlights

- Editorial, YouTube-inspired interface with a distinct PreFlight brand system.
- Drag-and-drop upload experience with backend-status feedback and sample-report access.
- Live, stage-aware processing timeline with elapsed time, estimated time remaining, and contextual descriptions.
- Report dashboard with a readiness gauge, retention chart, highlighted risk window, score breakdown, and hook autopsy.
- Shareable **Creator Checklist** with one-click copy and `.txt` download actions.
- Responsive layout for mobile and desktop.

## How it works

```text
Video upload
  → FFmpeg extracts audio and samples keyframes
  → Faster Whisper produces timestamped transcription
  → heuristic signals score pacing, energy, silence, speech pace, and fluency
  → predicted retention curve + readiness score
  → Gemini writes the creator-facing explanation, fix, and hook rewrite
```

PreFlight's scores are deliberately **heuristic estimates**, not trained predictions from real viewer-behavior data. Gemini creates explanatory copy only; all numeric scoring is calculated locally by the backend heuristics.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts |
| API | FastAPI, Pydantic, SQLAlchemy, SQLite |
| Media analysis | FFmpeg, Faster Whisper |
| Report writing | Google Gemini structured output |
| Deployment | Vercel frontend, Render Docker backend |

## Run locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

Set `GEMINI_API_KEY` in `backend/.env` to run live AI report generation. Set `DEMO_MODE=true` to always return the committed demo analysis without running FFmpeg, Whisper, or Gemini.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

For local development, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001` in `frontend/.env.local`.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Backend availability |
| `POST /analyze` | Upload a video and create an analysis job |
| `GET /status/{job_id}` | Poll processing stage |
| `GET /report/{job_id}` | Retrieve a completed report |
| `GET /report/demo` | Retrieve the built-in demo report |

## Deployment notes

The frontend is configured with `NEXT_PUBLIC_API_BASE_URL` to target the deployed Render API. The backend Docker image includes FFmpeg and pre-downloads the Faster Whisper `base` model to avoid a first-request model download.

For cross-origin browser requests, configure `CORS_ORIGINS` with the Vercel deployment URL (and optionally the local frontend URL) as a comma-separated list or JSON array.
