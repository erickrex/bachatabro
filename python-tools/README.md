# Python Tools for Bacha Trainer

ML development tools for creating and exporting pose estimation models.

---

## 🚀 Quick Start (For New Developers)

If you just cloned the repo, you need to generate the models:

```bash
cd python-tools
./setup_models.sh
```

This will:
1. Install Python dependencies
2. Create the lightweight pose model
3. Export to ExecuTorch format
4. Validate the models
5. Copy to mobile app

**Time**: ~5-10 minutes  
**Output**: 8.5MB quantized model ready for mobile

---

## 📋 Prerequisites

- **UV Package Manager** (recommended)
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

- **Python 3.12+**
- **PyTorch 2.1+** (installed via uv sync)
- **ExecuTorch** (installed via uv sync)

---

## 🛠️ Manual Setup

If you prefer manual steps:

### 1. Install Dependencies

```bash
cd python-tools
uv sync
```

### 2. Create Pose Model

```bash
uv run python create_lightweight_model.py
```

Creates `models/lightweight_pose.pt` (87MB PyTorch model)

### 3. Export to ExecuTorch

```bash
uv run python export_model.py \
  --input models/lightweight_pose.pt \
  --output models/pose_model.pte \
  --quantize
```

Creates:
- `models/pose_model.pte` (87MB)
- `models/pose_model_quantized.pte` (8.5MB) ⭐ Use this one

### 4. Validate Model

```bash
uv run python validate_model.py \
  --model models/pose_model_quantized.pte
```

### 5. Copy to Mobile App

```bash
cp models/pose_model_quantized.pte ../mobile/assets/models/pose.pte
```

---

## 📁 Generated Files

After running setup, you'll have:

```
python-tools/models/
├── lightweight_pose.pt          # PyTorch model (87MB)
├── pose_model.pte               # ExecuTorch model (87MB)
├── pose_model_quantized.pte     # Quantized model (8.5MB) ⭐
└── README.md

mobile/assets/models/
└── pose.pte                     # Quantized model for app (8.5MB) ⭐
```

**Note**: Model files are gitignored (too large for GitHub). Each developer generates them locally.

---

## 🎬 Video Preprocessing (Optional)

Process reference videos to extract pose data:

```bash
uv run python preprocess_video_executorch.py \
  --video ../songs/cheapthrills.mp4 \
  --output ../mobile/assets/poses/
```

This creates JSON files with pre-computed pose data for fallback mode.

---

## 📜 Available Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `setup_models.sh` | One-command setup | All models ready |
| `create_lightweight_model.py` | Create PyTorch model | `.pt` file |
| `export_model.py` | Export to ExecuTorch | `.pte` files |
| `validate_model.py` | Validate model accuracy | Validation report |
| `preprocess_video_executorch.py` | Process videos | JSON pose data |

---

## 🔧 Troubleshooting

### "UV not found"
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.zshrc  # or ~/.bashrc
```

### "Model validation failed"
- Check PyTorch version: `uv run python -c "import torch; print(torch.__version__)"`
- Should be 2.1+

### "Out of memory"
- Model creation needs ~4GB RAM
- Close other applications

### "ExecuTorch import error"
```bash
cd python-tools
uv sync --reinstall
```

---

## 📊 Model Specifications

| Model | Size | Format | Quantized | Use Case |
|-------|------|--------|-----------|----------|
| lightweight_pose.pt | 87MB | PyTorch | No | Development |
| pose_model.pte | 87MB | ExecuTorch | No | Testing |
| pose_model_quantized.pte | 8.5MB | ExecuTorch | Yes | Production ⭐ |

**Recommended**: Use `pose_model_quantized.pte` for mobile app (8.5MB, <5% accuracy loss)

---

## 🎯 Why Models Aren't in Git

Model files are **not tracked in git** because:
- Too large for GitHub (>100MB limit)
- Binary files don't compress well
- Easy to regenerate from scripts
- Keeps repo size small

Each developer generates models locally using the provided scripts.

---

## 📖 Additional Documentation

- **[../README.md](../README.md)** - Project overview
- **[../.kiro/specs/executorch-integration/](../.kiro/specs/executorch-integration/)** - Full specification
- **[../mobile/modules/executorch/SETUP.md](../mobile/modules/executorch/SETUP.md)** - Native module setup

---

## 🆘 Need Help?

1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Review [.kiro/specs/executorch-integration/design.md](../.kiro/specs/executorch-integration/design.md)
3. Open an issue on GitHub

---

**Last Updated**: November 28, 2025  
**Python**: 3.12+  
**PyTorch**: 2.1+  
**ExecuTorch**: 0.1.0+
