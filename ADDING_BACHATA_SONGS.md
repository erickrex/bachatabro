# Adding Bachata Choreographies to Bachata Bro

## Overview

This guide explains how to add bachata dance videos to the Bachata Bro app using YOLOv8s-pose for accurate pose detection.

---

## Understanding the System

### Current Model: YOLOv8s-pose

**State-of-the-art pose estimation (2023)**:
- **Accuracy**: 64.0 AP on COCO benchmark
- **Pre-trained**: Trained on COCO pose dataset (200K+ images)
- **Output**: 17 COCO keypoints with confidence scores
- **Performance**: ~50ms inference on modern phones

**Advantages**:
- ✅ Purpose-built for pose estimation
- ✅ Handles occlusions and varied poses well
- ✅ Works with multiple people (auto-selects best detection)
- ✅ No training needed - works out of the box

---

## Prerequisites

- Python 3.12+ with UV package manager
- Bachata dance videos (MP4 format recommended)
- Audio files extracted from videos (MP3 format)
- ~5-10 minutes per video for processing

---

## Step-by-Step Guide

### 1. Prepare Your Bachata Videos

**Video Requirements:**
- Format: MP4, AVI, MOV, or MKV
- Resolution: 720p recommended (higher = slower processing)
- Frame rate: 30fps recommended
- Duration: Any length (typical: 2-4 minutes)
- Content: Full-body shot of dancer, good lighting

**Naming Convention:**
Use lowercase with underscores, no spaces:
- ✅ `bachata_sensual.mp4`
- ✅ `bachata_dominicana.mp4`
- ✅ `bachata_moderna.mp4`
- ❌ `Bachata Sensual.mp4` (spaces, capitals)

**Extract Audio:**
```bash
# Using ffmpeg (install if needed: sudo apt install ffmpeg)
ffmpeg -i bachata_sensual.mp4 -vn -acodec libmp3lame -q:a 2 bachata_sensual.mp3
```

### 2. Process Video with AI

```bash
cd ~/RRR/bachatabro/python-tools

# Process single video
uv run python preprocess_video_yolov8.py "bailando_bachata.mp4"

# Or batch process all videos
uv run python batch_process_yolov8.py ../songs/ --output ../mobile/assets/poses/

# IMPORTANT: Visualize tracking to verify quality
uv run python visualize_tracking.py "bailando_bachata.mp4" --show-all
```

**What this does:**
- Downloads YOLOv8s-pose model automatically (first run only)
- Processes every frame with state-of-the-art AI
- Detects 17 body keypoints per frame
- Calculates 8 joint angles (arms, elbows, legs, thighs)
- Saves as JSON file: `mobile/assets/poses/bailando_bachata.json`

**Processing time:**
- CPU: ~5-10 fps
- 3-minute video: 2-10 minutes depending on hardware :(

**Output format:**
```json
{
  "songId": "bailando_bachata",
  "fps": 30,
  "totalFrames": 5400,
  "modelVersion": "yolov8s-pose",
  "modelAccuracy": "64.0 AP (COCO)",
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0.0,
      "keypoints": {
        "nose": {"x": 0.5, "y": 0.3, "confidence": 0.95},
        "leftShoulder": {"x": 0.4, "y": 0.4, "confidence": 0.92}
        // ... 17 keypoints total
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

### 3. Add Assets to Mobile App

```bash
# Copy video file
cp /path/to/bachata_sensual.mp4 mobile/assets/videos/

# Copy audio file
cp /path/to/bachata_sensual.mp3 mobile/assets/audio/

# Pose JSON is already in mobile/assets/poses/ from Step 2
```

**Verify files exist:**
```bash
ls -lh mobile/assets/videos/bachata_sensual.mp4
ls -lh mobile/assets/audio/bachata_sensual.mp3
ls -lh mobile/assets/poses/bachata_sensual.json
```

### 4. Update App Configuration

Edit `mobile/services/assetLoader.ts` to register your new song.

**Add to SONGS array:**
```typescript
export const SONGS: Song[] = [
  // ... existing songs ...
  { 
    id: 'bachata_sensual', 
    title: 'Bachata Sensual', 
    artist: 'Your Artist Name', 
    difficulty: 'medium' 
  },
];
```

**Add to loadPoseData switch:**
```typescript
case 'bachata_sensual':
  poseData = require('../assets/poses/bachata_sensual.json');
  break;
```

**Add to loadVideo switch:**
```typescript
case 'bachata_sensual':
  videoModule = require('../assets/videos/bachata_sensual.mp4');
  break;
```

**Add to loadAudio switch:**
```typescript
case 'bachata_sensual':
  audioModule = require('../assets/audio/bachata_sensual.mp3');
  break;
```

**Note**: I've already done this for you as an example! Check the file to see the changes.

### 5. Test the App

```bash
cd mobile

# Rebuild the app (required for new assets)
npm start

# Run on device
npm run android  # or npm run ios
```

**Testing checklist:**
- ✅ Song appears in song selection screen
- ✅ Video plays correctly
- ✅ Audio syncs with video
- ✅ Pose detection works during gameplay
- ✅ Score calculation functions properly

---

## Adding Multiple Bachata Songs

### Batch Processing

Process multiple videos at once:

```bash
cd python-tools

# Process all videos in a directory
uv run python batch_process_yolov8.py ../songs/ --output ../mobile/assets/poses/

# Use GPU for faster processing
uv run python batch_process_yolov8.py ../songs/ --device cuda

# Use Apple Silicon GPU
uv run python batch_process_yolov8.py ../songs/ --device mps
```

### Organizing Your Songs

Suggested bachata song structure:

```
mobile/assets/
├── videos/
│   ├── bachata_sensual.mp4
│   ├── bachata_dominicana.mp4
│   ├── bachata_moderna.mp4
│   ├── bachata_traditional.mp4
│   └── bachata_fusion.mp4
├── audio/
│   ├── bachata_sensual.mp3
│   ├── bachata_dominicana.mp3
│   └── ...
└── poses/
    ├── bachata_sensual.json
    ├── bachata_dominicana.json
    └── ...
```

### Difficulty Levels

Assign difficulty based on:
- **Easy**: Slow tempo, simple steps, basic patterns
- **Medium**: Moderate tempo, some turns, intermediate moves
- **Hard**: Fast tempo, complex footwork, advanced choreography

---

## Troubleshooting

### "Model not found" error
YOLOv8s-pose downloads automatically. If it fails:
```bash
cd python-tools
uv run python -c "from ultralytics import YOLO; YOLO('yolov8s-pose.pt')"
```

### "Video processing failed"
- Check video format (MP4 recommended)
- Ensure video has clear full-body shot
- Try reducing resolution: `ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4`

### "Out of memory"
- Close other applications
- Process shorter video segments
- Reduce video resolution

### "Pose detection inaccurate"
- Ensure good lighting in video
- Dancer should be centered and full-body visible
- Avoid occlusions (dancer blocked by objects)
- Use visualization tool to verify: `uv run python visualize_tracking.py video.mp4 --show-all`

### "Multiple dancers in video"
YOLOv8s-pose automatically selects the most prominent dancer. To verify:
```bash
uv run python visualize_tracking.py video.mp4 --show-all
```
This shows which dancer is being tracked (highlighted in color)

### "App doesn't show new song"
- Verify all 3 files exist (video, audio, JSON)
- Check file names match exactly (case-sensitive)
- Rebuild app: `npm start` then `npm run android/ios`
- Clear cache: `rm -rf node_modules/.cache`

---

## Performance Considerations

### File Sizes

Typical sizes per song:
- Video (MP4, 720p, 3min): ~50-100MB
- Audio (MP3, 192kbps, 3min): ~4-5MB
- Pose JSON (3min @ 30fps): ~5-10MB

**Total per song**: ~60-115MB

### App Size Impact

- 5 songs: ~300-575MB
- 10 songs: ~600-1150MB
- Consider compression or streaming for many songs

### Processing Performance

On-device inference:
- Model size: 8.5MB (quantized)
- Inference time: 45-80ms per frame
- Target FPS: 15-25 (real-time)
- Memory usage: ~180MB

---

## Advanced: Downloading Videos from YouTube

Download bachata videos directly from YouTube:

```bash
# Download video (720p)
uv run python download_youtube.py https://www.youtube.com/watch?v=VIDEO_ID

# Download audio only (MP3)
uv run python download_youtube.py --audio https://www.youtube.com/watch?v=VIDEO_ID

# Specify output directory
uv run python download_youtube.py https://www.youtube.com/watch?v=VIDEO_ID ./videos/
```

**Note**: Requires `ffmpeg` for audio extraction:
```bash
sudo apt install ffmpeg  # Ubuntu/WSL
brew install ffmpeg      # macOS
```

---

## Tips for Best Results

### Video Quality
- ✅ 720p or 1080p resolution
- ✅ 30fps frame rate
- ✅ Good lighting (avoid shadows)
- ✅ Solid background (avoid clutter)
- ✅ Full-body visible throughout

### Choreography
- ✅ Clear, distinct movements
- ✅ Consistent tempo
- ✅ Appropriate difficulty for target audience
- ✅ Engaging and fun to follow

### Testing
- ✅ Test with multiple users
- ✅ Verify scoring feels fair
- ✅ Check performance on target devices
- ✅ Gather feedback and iterate

---

## Summary

To add a bachata song:

1. **Download**: Use `download_youtube.py` or prepare your own video (MP4) and audio (MP3)
2. **Verify**: Run `visualize_tracking.py` to check pose detection quality
3. **Process**: Run `preprocess_video_yolov8.py` to extract poses
4. **Copy**: Move video, audio, and JSON to mobile/assets/
5. **Configure**: Update `assetLoader.ts` with new song
6. **Test**: Rebuild app and verify everything works

YOLOv8s-pose provides state-of-the-art accuracy (64.0 AP) without any training needed.

---

**Questions?** Check the main README.md or open an issue on GitHub.

**Happy dancing! 💃🕺**
