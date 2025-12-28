# Bachata Bro - Deployment Strategy

## Overview

Bachata Bro is a dance coaching mobile app with two main components:
- **Backend**: FastAPI proxy for ElevenLabs (TTS/STT) and Google Gemini (AI coaching)
- **Mobile**: React Native/Expo app with pose detection and voice coaching

**Deployment Order**: Backend first → Mobile second (mobile depends on backend URL)

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

# Set project
gcloud config set project YOUR_PROJECT_ID
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
# Store ElevenLabs API key
echo -n "your_elevenlabs_api_key" | \
  gcloud secrets create ELEVENLABS_API_KEY --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding ELEVENLABS_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.4 Create Dockerfile (if not exists)

Create `backend/functions/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install UV
RUN pip install uv

# Copy dependency files
COPY pyproject.toml .

# Install dependencies
RUN uv pip install --system -e .

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 1.5 Deploy to Cloud Run

```bash
cd backend/functions

# Deploy with secrets
gcloud run deploy bachatabro-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,LOG_LEVEL=INFO,CORS_ORIGINS=*" \
  --set-secrets "ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60
```

### 1.6 Verify Deployment

```bash
# Get the service URL
BACKEND_URL=$(gcloud run services describe bachatabro-backend \
  --region us-central1 \
  --format 'value(status.url)')

echo "Backend URL: $BACKEND_URL"

# Test health endpoint
curl $BACKEND_URL/health

# Test ElevenLabs health
curl $BACKEND_URL/elevenlabs/health

# Test Gemini health
curl $BACKEND_URL/gemini/health
```

### 1.7 Expected Backend URL Format

```
https://bachatabro-backend-XXXXXXXXXX-uc.a.run.app
```

Save this URL - you'll need it for the mobile app configuration.

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

Create `mobile/.env` (for local development):

```bash
EXPO_PUBLIC_BACKEND_URL=https://bachatabro-backend-XXXXXXXXXX-uc.a.run.app
```

For EAS builds, set the environment variable in `eas.json`:

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
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-XXXXXXXXXX-uc.a.run.app"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-XXXXXXXXXX-uc.a.run.app"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://bachatabro-backend-XXXXXXXXXX-uc.a.run.app"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

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
gcloud run services describe bachatabro-backend --region us-central1
# Verify ELEVENLABS_API_KEY secret binding
```

**Vertex AI permission denied**:
```bash
# Grant Vertex AI access to service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
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
# === BACKEND ===
cd backend/functions

# Deploy backend
gcloud run deploy bachatabro-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1" \
  --set-secrets "ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest"

# === MOBILE ===
cd mobile

# Update eas.json with backend URL first, then:
eas build --platform android --profile preview
```

---

## Summary

1. **Deploy backend first** to Google Cloud Run
2. **Get the Cloud Run URL** from deployment output
3. **Update mobile eas.json** with the backend URL
4. **Build mobile app** with EAS
5. **Test end-to-end** before production release
