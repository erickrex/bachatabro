# Bacha Trainer - Setup Guide

Complete setup guide for new developers.

---

## 📋 Prerequisites

### Required
- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Python** 3.12+ ([Download](https://www.python.org/))
- **UV Package Manager** ([Install](https://github.com/astral-sh/uv))
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- **Expo CLI**
  ```bash
  npm install -g expo-cli
  ```

### Platform-Specific
- **iOS**: Xcode + iOS Simulator (Mac only)
- **Android**: Android Studio + Android Emulator

---

## 🚀 Quick Setup (5 Steps)

### 1. Clone Repository
```bash
git clone https://github.com/erickrex/bachatrainer.git
cd bachatrainer
```

### 2. Generate AI Models
```bash
cd python-tools
./setup_models.sh
```

**What this does:**
- Installs Python dependencies (PyTorch, ExecuTorch)
- Creates lightweight pose estimation model
- Exports to ExecuTorch format
- Generates quantized model (8.5MB)
- Copies to mobile app

**Time**: 5-10 minutes  
**Output**: `mobile/assets/models/pose.pte` (8.5MB)

### 3. Install Mobile Dependencies
```bash
cd ../mobile
npm install
```

### 4. Start Development Server
```bash
npm start
```

### 5. Run on Device
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

---

## 📁 What You Get

After setup, your directory structure:

```
bachatrainer/
├── python-tools/
│   └── models/
│       ├── lightweight_pose.pt (87MB)
│       ├── pose_model.pte (87MB)
│       └── pose_model_quantized.pte (8.5MB) ⭐
├── mobile/
│   ├── assets/
│   │   ├── models/
│   │   │   └── pose.pte (8.5MB) ⭐ Ready for app
│   │   ├── videos/ (5 MP4 files, from git)
│   │   └── audio/ (5 MP3 files, from git)
│   └── node_modules/ (from npm install)
```

---

## 🎯 Why Models Aren't in Git

**Model files are generated locally** because:
- Too large for GitHub (>100MB limit)
- Binary files don't compress well
- Easy to regenerate from scripts
- Keeps repo size small (89MB vs 550MB+)

**Videos/audio ARE in git** because:
- Smaller size (89MB total)
- Harder to regenerate
- Essential for gameplay

---

## 🔧 Troubleshooting

### "UV not found"
```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Reload shell
source ~/.zshrc  # or ~/.bashrc
```

### "Python version mismatch"
```bash
# Check Python version
python --version  # Should be 3.12+

# Or use UV to install Python
uv python install 3.12
```

### "Model generation failed"
```bash
# Try manual steps
cd python-tools
uv sync
uv run python create_lightweight_model.py
uv run python export_model.py --quantize
```

### "Expo CLI not found"
```bash
npm install -g expo-cli
```

### "iOS simulator won't start"
- Open Xcode
- Xcode > Open Developer Tool > Simulator
- Then try `npm run ios` again

### "Android emulator won't start"
- Open Android Studio
- Tools > AVD Manager
- Start an emulator
- Then try `npm run android` again

---

## 📖 Next Steps

After setup:

1. **Read the docs**
   - [README.md](README.md) - Project overview
   - [USER-GUIDE.md](USER-GUIDE.md) - How to play
   - [DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md) - Dev environment

2. **Run tests**
   ```bash
   cd mobile
   npm test
   ```

3. **Start developing**
   - Check [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md)
   - Review [.kiro/specs/](.kiro/specs/) for specifications

---

## 🆘 Need Help?

1. Check [python-tools/README.md](python-tools/README.md) for model issues
2. Check [mobile/modules/executorch/SETUP.md](mobile/modules/executorch/SETUP.md) for native module issues
3. Open an issue on GitHub

---

## ⏱️ Setup Time Estimate

| Step | Time |
|------|------|
| Clone repo | 1-2 min |
| Generate models | 5-10 min |
| Install npm deps | 2-3 min |
| **Total** | **8-15 min** |

---

**Last Updated**: November 28, 2025  
**Tested on**: macOS (ARM64), Ubuntu 22.04, Windows 11
