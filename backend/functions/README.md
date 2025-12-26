# Bacha Trainer Backend - Voice Coach Proxy

Backend proxy for Bacha Trainer voice coaching, providing secure API access to ElevenLabs and Google Gemini.

## Prerequisites

- Python 3.11+
- [UV](https://docs.astral.sh/uv/) - Fast Python package manager
- Google Cloud account with Vertex AI enabled
- ElevenLabs account with API key

## Installation

### 1. Install UV

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv

# Or with pip
pip install uv
```

### 2. Set Up Project

```bash
cd backend/functions

# Create virtual environment and install dependencies
uv sync

# For development dependencies
uv sync --dev
```

### 3. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your API keys
# ELEVENLABS_API_KEY=your_key_here
# GOOGLE_CLOUD_PROJECT=your_project_id
# GOOGLE_CLOUD_LOCATION=us-central1
```

## Running Locally

```bash
# Start the FastAPI server
uv run uvicorn main:app --reload --port 8080

# Or with specific host binding
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

The API will be available at `http://localhost:8080` with interactive docs at `/docs`.

## Running Tests

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src

# Run specific test file
uv run pytest tests/test_elevenlabs_property.py

# Run with verbose output
uv run pytest -v
```

## API Endpoints

### Root

#### GET /
API information and available endpoints.

#### GET /health
Global health check.

### ElevenLabs Proxy

#### POST /elevenlabs/tts
Convert text to speech.

```json
{
  "text": "Hello, great dance moves!",
  "voiceId": "Rachel",
  "language": "en"
}
```

Response:
```json
{
  "audio": "base64_encoded_mp3",
  "format": "mp3",
  "durationMs": 1500
}
```

#### POST /elevenlabs/stt
Convert speech to text.

```json
{
  "audio": "base64_encoded_audio",
  "language": "en"
}
```

Response:
```json
{
  "transcript": "Play uptown funk",
  "confidence": 0.95,
  "language": "en"
}
```

#### GET /elevenlabs/voices
Get available voices by language.

#### GET /elevenlabs/health
ElevenLabs service health check.

### Gemini Proxy

#### POST /gemini/coaching-tip
Generate a coaching tip based on pose analysis.

```json
{
  "score": 65,
  "weakPoints": ["arms", "timing"],
  "strongPoints": ["legs"],
  "language": "en"
}
```

Response:
```json
{
  "tip": "Keep those arms higher!",
  "targetBodyPart": "arms"
}
```

#### POST /gemini/performance-review
Generate a performance review after a dance session.

```json
{
  "songTitle": "Uptown Funk",
  "songArtist": "Bruno Mars",
  "finalScore": 78,
  "previousBest": 72,
  "strongestPart": "legs",
  "weakestPart": "arms",
  "totalFrames": 1200,
  "language": "en"
}
```

Response:
```json
{
  "review": "Great job on Uptown Funk! You scored 78%, beating your previous best of 72%...",
  "improvementTip": "Focus on your arms movements next time."
}
```

#### GET /gemini/health
Gemini service health check.

## Deployment

### Deploy to Google Cloud Run (Recommended)

```bash
# Build and deploy
gcloud run deploy bacha-trainer-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars ELEVENLABS_API_KEY=your_key,GOOGLE_CLOUD_PROJECT=your_project
```

### Deploy to AWS Lambda

The app uses Mangum for AWS Lambda compatibility:

```bash
# Package and deploy using your preferred method (SAM, Serverless, etc.)
```

## Rate Limiting

- Default: 100 requests per minute per client IP
- Configurable via `RATE_LIMIT_REQUESTS_PER_MINUTE` environment variable

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid authentication |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - API or server failure |

## Project Structure

```
backend/functions/
├── src/
│   ├── __init__.py
│   ├── elevenlabs.py      # ElevenLabs proxy endpoints (FastAPI router)
│   ├── gemini.py          # Gemini proxy endpoints (FastAPI router)
│   └── middleware/
│       ├── __init__.py
│       ├── rate_limiter.py
│       └── validator.py
├── tests/
│   ├── __init__.py
│   ├── test_elevenlabs_property.py
│   ├── test_gemini_property.py
│   └── test_error_handling_property.py
├── main.py                 # FastAPI app entry point
├── pyproject.toml          # Dependencies (UV)
├── .env.example
└── README.md
```

## Interactive API Documentation

When running locally, FastAPI provides automatic interactive documentation:

- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`
