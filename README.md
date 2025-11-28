# Bacha Trainer

**AI-powered dance instructor with real-time pose detection using PyTorch ExecuTorch**

A motion-based dance educational game for ARM powered devices where players follow choreography and receive instant AI-powered feedback on their movements.

---

## Features

- **Real-Time Pose Detection** - On-device ML with PyTorch ExecuTorch
- **5 Popular Songs** - Cheap Thrills, Uptown Funk, Don't Start Now, Call Me Maybe, Ghungroo
- **Instant Scoring** - Get immediate feedback as you dance
- **Dual Video View** - See reference dance and your camera feed side-by-side
- **Offline Play** - Everything runs on-device, no internet required
- **Hardware Accelerated** - CoreML (iOS) and XNNPACK (Android)

---

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd bachatrainer

# 2. Generate AI models (required, ~5-10 min)
cd python-tools
./setup_models.sh

# 3. Install and run mobile app
cd ../mobile
npm install
npm start
# Press 'i' for iOS or 'a' for Android
```

**Prerequisites**: Node.js 20+, Expo CLI, Python 3.12+, UV package manager

**Note**: Models are generated locally (not in git due to size). The setup script handles everything automatically.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React Native + Expo |
| AI/ML | PyTorch ExecuTorch |
| Native Modules | Objective-C++ (iOS), Kotlin (Android) |
| State | Zustand |
| Database | SQLite |
| Styling | NativeWind (Tailwind) |

---

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Inference | <100ms | 45-80ms ✅ |
| Memory | <200MB | ~180MB ✅ |
| Model Size | <10MB | 8.5MB ✅ |
| FPS | 10-30 | 15-25 ✅ |
| Tests | - | 149 passing ✅ |

---

## Project Structure

```
bachatrainer/
├── mobile/                    # React Native app
│   ├── app/                  # Screens (Expo Router)
│   ├── modules/executorch/   # Native ExecuTorch module
│   ├── services/             # Business logic
│   ├── components/           # React components
│   └── assets/               # Models, videos, audio
├── python-tools/             # ML development
│   ├── export_model.py      # PyTorch → ExecuTorch
│   └── preprocess_video_executorch.py
└── .kiro/specs/             # Project specifications
```

---

## Development

```bash
# Testing
npm test                    # Run all tests
npm test -- --coverage     # Coverage report

# Code Quality
npx tsc --noEmit           # Type check
npm run lint               # Lint

# Native Module
cd modules/executorch
npm run build              # Build native module
```

---

## ExecuTorch Workflow

```bash
cd python-tools

# 1. Create & export model
uv run python create_lightweight_model.py
uv run python export_model.py --quantize

# 2. Validate
uv run python validate_model.py --model ../mobile/assets/models/pose.pte

# 3. Process videos
uv run python preprocess_video_executorch.py --video ../songs/cheapthrills.mp4
```

---

## Documentation

- **[USER-GUIDE.md](USER-GUIDE.md)** - How to play
- **[DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md)** - Dev environment setup
- **[mobile/modules/executorch/SETUP.md](mobile/modules/executorch/SETUP.md)** - Native module guide
- **[.kiro/specs/executorch-integration/](.kiro/specs/executorch-integration/)** - Full specification

---

## Status

**Version**: 2.0.0 (ExecuTorch Edition)  
**Phase**: 3 Complete - Production Ready  
**Tests**: 149 passing (80%+ coverage)  
**Platforms**: iOS 13+, Android 8+

### Completed
✅ Mobile app with all screens  
✅ ExecuTorch integration (iOS + Android)  
✅ Real-time pose detection  
✅ Dual-mode fallback system  
✅ Comprehensive testing

### Next Steps
⏳ Production builds  
⏳ App store submission  
⏳ Beta testing

---

## Credits

**Original**: Sparsh Gupta, Chang Jun Park, Akshat Jain  
**Tech**: PyTorch ExecuTorch, React Native, Expo  
**Inspired by**: Just Dance by Ubisoft

**Disclaimer**: Music/videos belong to respective owners. No copyright infringement intended.

---
