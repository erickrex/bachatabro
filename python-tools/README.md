# Python Tools for Bacha Trainer

ML development tools for creating and exporting pose estimation models.

**Now using YOLOv8s-pose for improved accuracy (64.0 AP vs ~50-55 AP)**

---

## 🚀 Quick Start

```bash
cd python-tools
uv sync
uv run python batch_process_yolov8.py ../songs/
```

This will:
1. Download YOLOv8s-pose model automatically
2. Process all videos in the songs directory
3. Generate JSON pose files in `../mobile/assets/poses/`

---

## 📋 Prerequisites

- **UV Package Manager** (recommended)
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

- **Python 3.10+**
- **PyTorch 2.1+** (installed via uv sync)

---

## 🎯 Model Comparison

| Model | Accuracy (COCO AP) | Year | Status |
|-------|-------------------|------|--------|
| MobileNetV3-Small (old) | ~50-55 | 2019 | Deprecated |
| **YOLOv8s-pose (new)** | **64.0** | 2023 | ✅ Current |

**~20-25% improvement in pose estimation accuracy!**

---

## 🛠️ Available Scripts

### Video Preprocessing (YOLOv8s-pose)

Process a single video:
```bash
uv run python preprocess_video_yolov8.py path/to/video.mp4
```

Process all videos in a directory:
```bash
uv run python batch_process_yolov8.py ../songs/ --output ../mobile/assets/poses/
```

Options:
- `--device auto|cpu|cuda|mps` - Select compute device
- `--model yolov8s-pose.pt` - Model to use (default: yolov8s-pose.pt)

### Export to ExecuTorch (for mobile)

```bash
uv run python export_model_yolov8.py --output models/yolov8s_pose.pte
```

This exports the model for use in the React Native app.

### Legacy Scripts (deprecated)

These still work but use the older, less accurate model:
- `preprocess_video_executorch.py` - MobileNetV3-based preprocessing
- `create_lightweight_model.py` - Creates MobileNetV3-based model
- `export_model.py` - Exports MobileNetV3-based model

---

## 📁 Output Format

The JSON pose files have the same format as before (backward compatible):

```json
{
  "songId": "cheapthrills",
  "fps": 30.0,
  "totalFrames": 1500,
  "modelVersion": "yolov8s-pose",
  "modelAccuracy": "64.0 AP (COCO)",
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0.0,
      "keypoints": {
        "nose": {"x": 0.5, "y": 0.3, "confidence": 0.95},
        "leftShoulder": {"x": 0.4, "y": 0.5, "confidence": 0.92},
        ...
      },
      "angles": {
        "leftArm": 145.5,
        "rightArm": 150.2,
        ...
      }
    }
  ]
}
```

---

## 🔧 Troubleshooting

### "ultralytics not found"
```bash
uv sync
# or
pip install ultralytics
```

### "CUDA out of memory"
Use CPU instead:
```bash
uv run python batch_process_yolov8.py ../songs/ --device cpu
```

### "Model download failed"
YOLOv8s-pose downloads automatically on first use. If it fails:
```bash
# Manual download
uv run python -c "from ultralytics import YOLO; YOLO('yolov8s-pose.pt')"
```

### "ExecuTorch export failed"
ExecuTorch export is optional. The preprocessing works without it.
For mobile, you can use the PyTorch model directly or wait for ExecuTorch support.

---

## 📊 Performance

| Device | Speed (FPS) | Notes |
|--------|-------------|-------|
| NVIDIA GPU | ~100+ | Recommended for batch processing |
| Apple M1/M2 | ~30-50 | Use `--device mps` |
| CPU | ~5-10 | Slower but works everywhere |

---

## 🎬 Workflow

1. **Record dance videos** → Save to `../songs/`
2. **Run preprocessing** → `uv run python batch_process_yolov8.py ../songs/`
3. **JSON files generated** → `../mobile/assets/poses/`
4. **Mobile app uses JSON** → Pre-computed poses for reference

---

## 📖 Additional Documentation

- **[../HOW_POSES_WORK.md](../HOW_POSES_WORK.md)** - How pose detection works
- **[../README.md](../README.md)** - Project overview
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide

---

**Last Updated**: December 2, 2025  
**Model**: YOLOv8s-pose (64.0 AP)  
**Python**: 3.10+  
**PyTorch**: 2.1+
