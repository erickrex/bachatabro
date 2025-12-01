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

### Platform-Specific
- **iOS**: Xcode + iOS Simulator (Mac only)
- **Android**: Android Studio + Android Emulator
- **Windows/WSL**: See WSL Setup section below

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

**Verify installation:**
```bash
# Check node_modules exists
ls -la node_modules

# Check for missing dependencies
npm list --depth=0
```

### 4. Start Development Server
```bash
npm start
```

### 5. Run on Device
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

**Note**: For native modules (ExecuTorch), you need a development build, not Expo Go:
```bash
npm run android  # For Android device
npm run ios      # For iOS device (Mac only)
```

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

## 🪟 WSL Setup (Windows Users)

If you're developing on Windows with WSL:

### 1. Install Node.js in WSL
```bash
# Check if Node.js is installed in WSL
node --version
npm --version

# If not installed, install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install Python in WSL
```bash
# Check Python version
python3 --version  # Should be 3.12+

# If needed, install Python 3.12
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip
```

### 3. Install UV in WSL
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### 4. Run Setup from WSL Terminal
**Important**: Open a WSL terminal (not PowerShell), then:
```bash
cd /home/rexbox/RRR/bachatrainer  # Adjust to your path
cd python-tools
./setup_models.sh

cd ../mobile
npm install
npm start
```

### 5. Access from Windows
- The Expo dev server will show a QR code
- Scan with Expo Go app on your phone
- Or open the URL in Windows browser for web version

### WSL Troubleshooting
- **UNC path errors**: Always run npm commands from WSL terminal, not PowerShell
- **Permission errors**: Don't use `sudo` with npm in WSL
- **Port issues**: Expo uses port 8081, ensure it's not blocked by Windows firewall

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

### "npm install fails"
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
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

### "Expo Go shows 'Unable to resolve module'"
- You need a development build for native modules
- Run `npm run android` or `npm run ios` instead
- Expo Go doesn't support custom native modules like ExecuTorch

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

**Last Updated**: November 30, 2025  
**Tested on**: macOS (ARM64), Ubuntu 22.04, Windows 11 (WSL2)
