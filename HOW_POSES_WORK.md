# How Pose Data Works in Bachata Bro

## The Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. PREPROCESSING (Done Once, Offline)                  │
│                                                          │
│  Reference Video (30minutos.mp4)                        │
│         ↓                                                │
│  Python Script: preprocess_video_yolov8.py              │
│         ↓                                                │
│  YOLOv8s-pose analyzes EVERY frame                      │
│         ↓                                                │
│  Extracts 17 keypoints + 8 angles per frame             │
│         ↓                                                │
│  Saves to: 30minutos.json                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  2. GAMEPLAY (Real-time, On Device)                     │
│                                                          │
│  User dances in front of camera                         │
│         ↓                                                │
│  ExecuTorch detects user's pose (17 keypoints)          │
│         ↓                                                │
│  Calculate user's 8 joint angles                        │
│         ↓                                                │
│  Load REFERENCE pose from JSON (same frame #)           │
│         ↓                                                │
│  COMPARE: User angles vs Reference angles               │
│         ↓                                                │
│  Calculate Score: 0-100 based on similarity             │
└─────────────────────────────────────────────────────────┘
```

---

## Model: YOLOv8s-pose

- **Accuracy**: 64.0 AP on COCO benchmark
- **Output**: 17 COCO keypoints with (x, y, confidence)
- **Speed**: ~45-80ms on Arm devices

---

## JSON Format

```json
{
  "songId": "30minutos",
  "fps": 29.97,
  "totalFrames": 6426,
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0.0,
      "keypoints": {
        "nose": {"x": 0.499, "y": 0.474, "confidence": 0.95},
        "leftShoulder": {"x": 0.506, "y": 0.479, "confidence": 0.92},
        ...
      },
      "angles": {
        "leftArm": 145.2,
        "rightArm": 132.8,
        "leftElbow": 145.2,
        "rightElbow": 132.8,
        "leftThigh": 178.5,
        "rightThigh": 176.3,
        "leftLeg": 178.5,
        "rightLeg": 176.3
      }
    }
  ]
}
```

---

## Scoring Algorithm

```
Reference: leftArm = 145°
User:      leftArm = 140°
Difference: 5°

Score = 100 - (avgDifference / 20) × 100
      = 100 - (5 / 20) × 100
      = 75 → "Great!"
```

| Score | Feedback |
|-------|----------|
| 90+ | Perfect! |
| 75+ | Great! |
| 60+ | Good! |
| <60 | Miss! |

---

## Current Songs

| Song | Frames |
|------|--------|
| 30 Minutos | ~5,400 |
| How Deep Is Your Love | ~4,800 |

---

## Why Pre-Compute?

1. **Consistency** — Same reference for all users
2. **Performance** — No AI needed on reference video during gameplay
3. **Accuracy** — Professional dancer captured perfectly
4. **Offline** — All data is local
