# Python Video Preprocessing Tools

This directory contains Python tools for preprocessing reference dance videos and extracting pose data for the Bacha Trainer mobile app.

## Overview

The preprocessing pipeline extracts pose keypoints and joint angles from reference videos and saves them as JSON files that are bundled with the mobile app.

## Prerequisites

```bash
# Install UV package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
cd python-tools
uv pip install opencv-python tensorflow numpy tqdm
```

## Scripts

### 1. preprocess_video.py

Process a single video file and extract pose data.

**Usage:**
```bash
python preprocess_video.py <video_path> [options]

# Example
python preprocess_video.py ../songs/cheapthrills.mp4 --output ../mobile/assets/poses/

# Options
--model PATH    Path to TFLite model (default: ../model/model.tflite)
--output DIR    Output directory (default: ../mobile/assets/poses/)
```

**Output:**
Creates a JSON file with pose data for each frame:
```json
{
  "songId": "cheapthrills",
  "fps": 30.0,
  "totalFrames": 3600,
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0.0,
      "keypoints": {
        "leftShoulder": {"x": 0.4, "y": 0.3, "confidence": 0.95},
        ...
      },
      "angles": {
        "leftArm": 90.5,
        "rightArm": 85.2,
        ...
      }
    }
  ]
}
```

### 2. batch_process.py

Process all videos in a directory.

**Usage:**
```bash
python batch_process.py [options]

# Process all videos in songs/ directory
python batch_process.py

# Custom directories
python batch_process.py --videos ../songs --output ../mobile/assets/poses

# Options
--videos DIR    Directory containing videos (default: ../songs)
--model PATH    Path to TFLite model (default: ../model/model.tflite)
--output DIR    Output directory (default: ../mobile/assets/poses/)
```

**Features:**
- Processes all video files (.mp4, .avi, .mov, .mkv)
- Progress tracking for each video
- Error handling and summary report
- Automatic output directory creation

### 3. validate_poses.py

Validate generated JSON files.

**Usage:**
```bash
python validate_poses.py [options]

# Validate all JSON files in poses directory
python validate_poses.py

# Custom directory
python validate_poses.py --dir ../mobile/assets/poses

# Options
--dir DIR    Directory containing JSON files (default: ../mobile/assets/poses)
```

**Validation Checks:**
- JSON syntax validity
- Required fields present
- Correct data types
- Frame count matches totalFrames
- Keypoint structure (x, y, confidence)
- Angle values in valid range (0-180°)

## Workflow

### Complete Preprocessing Workflow

```bash
# 1. Process all videos
cd python-tools
python batch_process.py

# 2. Validate output
python validate_poses.py

# 3. Check output files
ls -lh ../mobile/assets/poses/
```

### Processing Individual Videos

```bash
# Process a single video
python preprocess_video.py ../songs/cheapthrills.mp4

# Validate the output
python validate_poses.py
```

## Output Format

### Keypoints
17 keypoints are detected per frame:
- Face: nose, leftEye, rightEye, leftEar, rightEar
- Upper body: leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist
- Lower body: leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle

Each keypoint has:
- `x`: Normalized x-coordinate (0-1)
- `y`: Normalized y-coordinate (0-1)
- `confidence`: Detection confidence (0-1)

### Angles
8 joint angles are calculated:
- `leftArm`: Left shoulder-elbow-wrist angle
- `rightArm`: Right shoulder-elbow-wrist angle
- `leftElbow`: Same as leftArm
- `rightElbow`: Same as rightArm
- `leftThigh`: Left hip-knee-ankle angle
- `rightThigh`: Right hip-knee-ankle angle
- `leftLeg`: Same as leftThigh
- `rightLeg`: Same as rightThigh

All angles are in degrees (0-180°).

## Troubleshooting

### Model Not Found
```bash
# Download the MoveNet model
mkdir -p ../model
cd ../model
wget https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite -O model.tflite
```

### Video Not Opening
- Check video file format (MP4 recommended)
- Ensure video file is not corrupted
- Try converting with ffmpeg: `ffmpeg -i input.mov -c:v libx264 output.mp4`

### Low Confidence Keypoints
- Ensure good lighting in reference videos
- Person should be clearly visible and centered
- Avoid occlusions and motion blur

### Memory Issues
- Process videos one at a time
- Reduce video resolution before processing
- Close other applications

## Performance

Typical processing times (on M1 Mac):
- 30-second video (900 frames): ~2-3 minutes
- 2-minute video (3600 frames): ~8-10 minutes

## Integration with Mobile App

The generated JSON files are automatically loaded by the mobile app:

```typescript
// In mobile app
import { loadPoseData } from '@/services/assetLoader';

const poseData = await loadPoseData('cheapthrills');
// Use poseData.frames for reference poses
```

## Notes

- JSON files are bundled with the mobile app (no network required)
- Pre-processing is done once during development
- End users never run these scripts
- Pose detection in the app uses ML Kit (different from preprocessing)

## Future Improvements

- [ ] Add video preview with skeleton overlay
- [ ] Support for multiple people in frame
- [ ] Automatic video trimming to music
- [ ] Pose quality scoring
- [ ] Compression of JSON output
