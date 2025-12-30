# Bachata Bro - Deployment Strategy

## Overview

Bachata Bro is a dance coaching mobile app with two main components:
- **Backend**: FastAPI proxy for ElevenLabs (TTS/STT) and Google Gemini (AI coaching)
- **Mobile**: React Native/Expo app with pose detection and voice coaching

**Deployment Order**: Backend first → Mobile second (mobile depends on backend URL)

---

## Local Development & Verification Workflow

1. **Tooling**
   - Node.js 20.x with npm, `expo-cli` and `eas-cli`.
   - `uv` (Python package manager) for backend + pose tools: `curl -LsSf https://astral.sh/uv/install.sh | sh`.
   - Git LFS installed and initialized (`git lfs install`) to pull bundled media.

2. **Initial setup**
   ```bash
   npm install -g eas-cli
   cd mobile && npm install
   cd ../backend/functions && uv sync --dev
   cd ../../python-tools && uv sync
   ./setup_models.sh   # downloads pose.pte + YOLO weights
   ```

3. **Environment variables**
   - Copy `backend/functions/.env.example` → `.env` and fill `ELEVENLABS_API_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.
   - Copy `mobile/.env.example` → `.env` with `EXPO_PUBLIC_BACKEND_URL`.

4. **Local testing matrix**
   - Backend unit/property tests: `cd backend/functions && uv run pytest --maxfail=1`.
   - Mobile unit/property tests (parallel by default): `cd mobile && npm test`. Override Fast-Check runs via `FC_MAX_RUNS` env vars if needed.
   - Pose scoring calibration: run a simulated game to emit `[PoseScore] Session joint coverage` logs, then adjust `JOINT_CONFIDENCE_THRESHOLD` if required (see `joint_recognition_calibration.md`).

5. **Local services**
   - Backend dev server: `cd backend/functions && uv run uvicorn main:app --reload --port 8000`.
   - Mobile dev client: `cd mobile && npx expo start --dev-client`.
   - Python pose tools (for regenerating JSON poses): `cd python-tools && uv run python regenerate_poses.py --videos ../mobile/assets/videos`.

6. **Smoke testing**
   - Hit `http://localhost:8000/health`, `/elevenlabs/health`, `/gemini/health`.
   - In Expo dev client, open a song and confirm live scores vary (no 0/100% swings) and joint coverage logs show <30% skips.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App                               │
│  (Expo/React Native - EAS Build)                                │
│  - Pose detection (ExecuTorch)                                  │
│  - Voice coaching UI                                            │
│  - Camera integration                                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Proxy (Google Cloud Run)                    │
│  FastAPI + Mangum                                               │
│  ├── /elevenlabs/* → ElevenLabs API (TTS/STT)                  │
│  └── /gemini/*     → Vertex AI Gemini (Coaching)               │
└─────────────────────┬───────────────┬───────────────────────────┘
                      │               │
                      ▼               ▼
              ┌───────────┐   ┌──────────────┐
              │ ElevenLabs│   │  Vertex AI   │
              │    API    │   │   Gemini     │
              └───────────┘   └──────────────┘
```

---

## Phase 1: Backend Deployment (Google Cloud)

### 1.1 Prerequisites

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Create new project (replace 'bachatabro' with your desired project ID)
gcloud projects create bachatabro --name="Bachata Bro"

# Set project as active
gcloud config set project bachatabro

# Fix quota project warning
gcloud auth application-default set-quota-project bachatabro

# Verify project is set correctly
gcloud config get-value project
gcloud projects describe bachatabro
```

### 1.1.1 Enable Billing (Required)

```bash
# List available billing accounts
gcloud billing accounts list

# Link billing to your project (replace BILLING_ACCOUNT_ID with actual ID)
gcloud billing projects link bachatabro --billing-account=BILLING_ACCOUNT_ID
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com
```

### 1.3 Store Secrets in Secret Manager

```bash
# Store ElevenLabs API key (get from https://elevenlabs.io/app/settings/api-keys)
echo -n "your_actual_elevenlabs_api_key" | \
  gcloud secrets create ELEVENLABS_API_KEY --data-file=-

# Grant Cloud Run access to secrets (automatically gets project number)
PROJECT_NUMBER=$(gcloud projects describe bachatabro --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding ELEVENLABS_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.4 Prepare Backend Files

#### 1.4.1 Create Dockerfile

Create `backend/functions/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install UV
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./
COPY uv.lock ./

# Install dependencies
RUN uv sync --no-dev

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Run with uvicorn
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### 1.4.2 Update .gitignore

Edit `backend/functions/.gitignore` to allow `uv.lock` for Docker builds:

```gitignore
# UV
.venv/
# uv.lock  # Commented out - needed for Docker builds
```

#### 1.4.3 Create .dockerignore

Create `backend/functions/.dockerignore`:

```dockerignore
# Environment variables
.env
.env.local
.env.*.local

# Python cache
__pycache__/
*.py[cod]
*$py.class

# Virtual environment
.venv/

# Testing
.pytest_cache/
.coverage
htmlcov/
tests/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Git
.git/
.gitignore

# Documentation
README.md

# Logs
*.log

# Hypothesis
.hypothesis/
```

#### 1.4.4 Regenerate Lock File

```bash
cd backend/functions
uv lock  # This updates the lock file with the correct project name
```

### 1.5 Deploy to Cloud Run

```bash
cd backend/functions

# Set default region (optional but recommended)
gcloud config set run/region europe-west1

# Deploy with secrets (adjust region as needed)
gcloud run deploy bachatabro-backend \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=bachatabro,GOOGLE_CLOUD_LOCATION=europe-west1,LOG_LEVEL=INFO,CORS_ORIGINS=*" \
  --set-secrets "ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60
```

**Expected Output:**
```
Service [bachatabro-backend] revision [bachatabro-backend-00001-555] has been deployed and is serving 100 percent of traffic.
Service URL: https://bachatabro-backend-327513783440.europe-west1.run.app
```

**Save this URL** - you'll need it for mobile app configuration!

### 1.6 Verify Deployment

```bash
# Get the service URL (adjust region as needed)
BACKEND_URL=$(gcloud run services describe bachatabro-backend \
  --region europe-west1 \
  --format 'value(status.url)')

echo "Backend URL: $BACKEND_URL"

# Test health endpoint
curl $BACKEND_URL/health

# Test ElevenLabs health
curl $BACKEND_URL/elevenlabs/health

# Test Gemini health
curl $BACKEND_URL/gemini/health
```

**Expected responses:**
- `/health`: `{"status": "healthy", "service": "bachatabro-backend"}`
- `/elevenlabs/health`: `{"status": "healthy", "service": "elevenlabs"}`
- `/gemini/health`: `{"status": "healthy", "service": "gemini"}`

### 1.7 Expected Backend URL Format

```
https://bachatabro-backend-[PROJECT_NUMBER].[REGION].run.app
```

Example: `https://bachatabro-backend-327513783440.europe-west1.run.app`

**Important:** Save this exact URL - you'll need it for the mobile app configuration!

---

## Phase 2: Mobile App Deployment (Expo EAS)

### 2.1 Prerequisites

```bash
cd mobile

# Install EAS CLI globally (if not installed)
npm install -g eas-cli

# Login to Expo
eas login
```

### 2.2 Configure Backend URL

#### 2.2.1 Create Local Environment File

Create `mobile/.env` (for local development):

```bash
EXPO_PUBLIC_BACKEND_URL=https://bachatabro-backend-327513783440.europe-west1.run.app
```

**Replace with your actual backend URL from step 1.5**

#### 2.2.2 Update EAS Configuration

Update `mobile/eas.json` to include the backend URL in all build profiles:

```json
{
  "cli": {
    "version": ">= 16.28.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-327513783440.europe-west1.run.app"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-327513783440.europe-west1.run.app"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-327513783440.europe-west1.run.app"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Replace all instances with your actual backend URL from step 1.5**

### 2.3 Build for Android

```bash
cd mobile

# Development build (for testing with Expo Go alternative)
eas build --platform android --profile development

# Preview build (internal testing APK)
eas build --platform android --profile preview

# Production build (for Play Store)
eas build --platform android --profile production
```

### 2.4 Build for iOS

```bash
# Requires Apple Developer account
eas build --platform ios --profile development
eas build --platform ios --profile production
```

### 2.5 What Gets Uploaded to EAS

| Uploaded | NOT Uploaded |
|----------|--------------|
| Source code (~few MB) | node_modules/ |
| package.json | .env files |
| Config files | Local builds |
| Assets (images, fonts) | Test files |

**Total upload size**: ~10-50MB (not 1.3GB)

### 2.6 Pre-release QA checklist

- `cd mobile && npm test` → should be green before every EAS build.
- On a physical device (iOS + Android):
  - Confirm onboarding + song selection.
  - Start a practice session and observe real-time scoring; ensure the session coverage log shows <0.35 skipped fraction.
  - Trigger voice coach feedback (scores <70% produce coaching tips, >90% produce encouragement).
- If pose accuracy drifts, rerun the pose pipeline (Phase 4) before shipping.

---

## Phase 3: Environment Configuration

### 3.1 Environment Variables Summary

**Backend (Cloud Run)**:
| Variable | Description | Required |
|----------|-------------|----------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key | Yes |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | Yes |
| `GOOGLE_CLOUD_LOCATION` | Region (us-central1) | Yes |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Rate limit (default: 100) | No |
| `LOG_LEVEL` | Logging level (INFO) | No |
| `CORS_ORIGINS` | Allowed origins (* for all) | No |

**Mobile (EAS Build)**:
| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_BACKEND_URL` | Cloud Run URL | Yes |

### 3.2 API Keys Required

1. **ElevenLabs API Key**
   - Get from: https://elevenlabs.io/app/settings/api-keys
   - Used for: Text-to-Speech, Speech-to-Text

2. **Google Cloud (Vertex AI)**
   - Automatically authenticated via Cloud Run service account
   - Ensure Vertex AI API is enabled
   - No separate API key needed

---

## Phase 4: CI/CD Pipeline (Optional)

### 4.1 GitHub Actions for Backend

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        run: |
          cd backend/functions
          gcloud run deploy bachatabro-backend \
            --source . \
            --region us-central1 \
            --allow-unauthenticated
```

### 4.2 GitHub Actions for Mobile

Create `.github/workflows/build-mobile.yml`:

```yaml
name: Build Mobile

on:
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: cd mobile && npm ci

      - name: Build Android
        run: cd mobile && eas build --platform android --profile preview --non-interactive
```

---

## Phase 5: Post-Deployment Checklist

### 5.1 Backend Verification

- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] ElevenLabs TTS endpoint works (test with curl)
- [ ] Gemini coaching endpoint works
- [ ] Rate limiting is active
- [ ] Logs appear in Cloud Logging

### 5.2 Mobile Verification

- [ ] App connects to backend successfully
- [ ] Voice coaching features work
- [ ] Camera/pose detection works
- [ ] No API keys exposed in app bundle

### 5.3 Security Checklist

- [ ] API keys stored in Secret Manager (not env vars)
- [ ] CORS configured appropriately for production
- [ ] Rate limiting enabled
- [ ] HTTPS only (Cloud Run default)
- [ ] No sensitive data in mobile app bundle

---

## Cost Estimation

### Google Cloud Run (Backend)

| Resource | Free Tier | Estimated Cost |
|----------|-----------|----------------|
| Requests | 2M/month | $0.40/million after |
| CPU | 180,000 vCPU-sec | $0.000024/vCPU-sec |
| Memory | 360,000 GB-sec | $0.0000025/GB-sec |
| **Estimated** | - | **~$5-20/month** (low traffic) |

### ElevenLabs

| Plan | Characters/month | Cost |
|------|------------------|------|
| Free | 10,000 | $0 |
| Starter | 30,000 | $5/month |
| Creator | 100,000 | $22/month |

### Vertex AI (Gemini)

| Model | Input | Output |
|-------|-------|--------|
| Gemini 1.5 Flash | $0.075/1M tokens | $0.30/1M tokens |
| **Estimated** | - | **~$1-5/month** (low traffic) |

### Expo EAS

| Plan | Builds/month | Cost |
|------|--------------|------|
| Free | 30 | $0 |
| Production | Unlimited | $99/month |

---

## Troubleshooting

### Backend Issues

**"Service not configured" error**:
```bash
# Check if secret is accessible
gcloud run services describe bachatabro-backend --region europe-west1
# Verify ELEVENLABS_API_KEY secret binding
```

**"uv.lock needs to be updated" error during build**:
```bash
cd backend/functions
uv lock  # Regenerate lock file
# Then redeploy
```

**"file not found: uv.lock" error during build**:
- Check that `uv.lock` is not in `.gitignore`
- Ensure `.dockerignore` doesn't exclude `uv.lock`
- Verify the file exists in `backend/functions/`

**Vertex AI permission denied**:
```bash
# Grant Vertex AI access to service account
PROJECT_NUMBER=$(gcloud projects describe bachatabro --format="value(projectNumber)")
gcloud projects add-iam-policy-binding bachatabro \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

**Billing not enabled error**:
```bash
# Enable billing for the project
gcloud billing accounts list
gcloud billing projects link bachatabro --billing-account=BILLING_ACCOUNT_ID
```

### Mobile Issues

**"Network error" in app**:
- Verify `EXPO_PUBLIC_BACKEND_URL` is set correctly in eas.json
- Check Cloud Run service is running
- Test backend URL directly with curl

**Build fails on EAS**:
- Check `eas.json` configuration
- Verify all dependencies in package.json
- Review build logs on expo.dev

---

## Quick Start Commands

```bash
# === SETUP ===
# 1. Create and configure project
gcloud projects create bachatabro --name="Bachata Bro"
gcloud config set project bachatabro
gcloud auth application-default set-quota-project bachatabro

# 2. Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com aiplatform.googleapis.com secretmanager.googleapis.com

# 3. Store secrets
echo -n "your_elevenlabs_api_key" | gcloud secrets create ELEVENLABS_API_KEY --data-file=-
PROJECT_NUMBER=$(gcloud projects describe bachatabro --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding ELEVENLABS_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# === BACKEND ===
cd backend/functions

# Prepare files
uv lock  # Regenerate lock file

# Deploy backend
gcloud run deploy bachatabro-backend \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=bachatabro,GOOGLE_CLOUD_LOCATION=europe-west1,LOG_LEVEL=INFO,CORS_ORIGINS=*" \
  --set-secrets "ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 --timeout 60

# === MOBILE ===
cd mobile

# Update eas.json with backend URL first, then:
eas build --platform android --profile preview
```

---

## Summary

1. **Create GCP project** and enable billing
2. **Enable required APIs** (Cloud Run, Cloud Build, Vertex AI, Secret Manager)
3. **Store ElevenLabs API key** in Secret Manager
4. **Prepare backend files** (Dockerfile, .dockerignore, regenerate uv.lock)
5. **Deploy backend** to Google Cloud Run
6. **Get the Cloud Run URL** from deployment output
7. **Update mobile configuration** (.env and eas.json) with backend URL
8. **Build mobile app** with EAS
9. **Test end-to-end** (backend health checks + mobile app functionality)

## Common Pitfalls to Avoid

1. **Don't ignore uv.lock** - It's needed for Docker builds
2. **Always regenerate uv.lock** after renaming the project
3. **Save the exact backend URL** - You'll need it multiple times
4. **Test health endpoints** before proceeding to mobile deployment
5. **Enable billing** - Cloud Run requires a billing account
6. **Use consistent regions** - Keep backend and mobile configs aligned

---

## Pose Asset Pipeline & Calibration

Use this when choreography changes or score calibration drifts.

1. **Regenerate poses**
   ```bash
   cd python-tools
   uv sync
   uv run python regenerate_poses.py \
     --videos ../mobile/assets/videos \
     --output ../mobile/assets/poses
   ```
2. **Backfill joint confidence into existing assets**
   ```bash
   uv run python backfill_pose_confidence.py --poses-dir ../mobile/assets/poses
   ```
   This script recalculates angles from saved keypoints so older JSON files gain `angleConfidence` data.
3. **Ship updated assets**
   - Verify JSON diffs (`git diff mobile/assets/poses`).
   - Re-run `cd mobile && npm test -- scoreCalculator angleCalculator`.
4. **Tune recognition**
   - Dance a full song on a dev build.
   - Check Metro logs for `[PoseScore] Session joint coverage`. If `skipFraction` exceeds 0.35 consistently, lower pose threshold (see `joint_recognition_calibration.md`) or investigate camera lighting/device.
   - Once satisfied, commit pose changes with notes on the source videos + regression data.
