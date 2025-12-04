# Pose Data

Pre-computed pose data generated using **YOLOv8s-pose** (64.0 AP on COCO).

## Current Files

- `30minutos.json`
- `howdeepisyourlove.json`

## Generating Pose Data

```bash
cd python-tools
uv run python preprocess_video_yolov8.py path/to/video.mp4
```

## JSON Format

```json
{
  "songId": "30minutos",
  "fps": 30.0,
  "totalFrames": 5400,
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0.0,
      "keypoints": { ... },
      "angles": { "leftArm": 145.5, ... }
    }
  ]
}
```
