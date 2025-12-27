# Python Tools

ML preprocessing tools for Bachata Bro.

## Quick Start

```bash
cd python-tools
uv sync
uv run python preprocess_video_yolov8.py path/to/video.mp4
```

## Scripts

| Script | Purpose |
|--------|---------|
| `preprocess_video_yolov8.py` | Extract poses from video |
| `batch_process_yolov8.py` | Process multiple videos |
| `visualize_tracking.py` | Debug pose tracking |
| `download_youtube.py` | Download dance videos |

## Model

**YOLOv8s-pose** — 64.0 AP on COCO (downloads automatically)

## Output

JSON files with 17 keypoints + 8 angles per frame:

```json
{
  "songId": "30minutos",
  "fps": 30.0,
  "totalFrames": 5400,
  "frames": [...]
}
```

## Requirements

- Python 3.10+
- UV package manager
- PyTorch 2.1+
