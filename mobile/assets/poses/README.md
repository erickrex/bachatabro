# Pose Data

Pre-computed pose data JSON files generated using **YOLOv8s-pose** (64.0 AP on COCO).

## Files

Each song has a corresponding JSON file:
- `cheapthrills.json`
- `uptownfunk.json`
- `dontstartnow.json`
- `callmemaybe.json`
- `ghungroo.json`

## Generating Pose Data

### Quick Start (YOLOv8s-pose)

```bash
cd python-tools
uv sync
uv run python regenerate_poses.py --videos ../songs/
```

### Batch Process

```bash
uv run python batch_process_yolov8.py ../songs/ --output ../mobile/assets/poses/
```

### Single Video

```bash
uv run python preprocess_video_yolov8.py path/to/video.mp4 --output ../mobile/assets/poses/
```

## Model Info

| Property | Value |
|----------|-------|
| Model | YOLOv8s-pose |
| Accuracy | 64.0 AP (COCO) |
| Input Size | 256×256 |
| Keypoints | 17 (COCO format) |

## JSON Format

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

## Regenerating All Poses

To regenerate all pose files with the latest model:

```bash
cd python-tools
uv run python regenerate_poses.py --videos ../songs/
```

This will:
1. Backup existing JSON files
2. Delete old JSON files
3. Process all videos with YOLOv8s-pose
4. Generate new JSON files with improved accuracy
