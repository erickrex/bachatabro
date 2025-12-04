# TensorFlow.js Migration - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
├─────────────────────────────────────────────────────────┤
│  poseDetection.ts (UnifiedPoseDetectionService)         │
│    ├── TFJSPoseService (NEW - real inference)           │
│    └── Pre-computed poses (JSON files)                  │
├─────────────────────────────────────────────────────────┤
│  TensorFlow.js                                          │
│    ├── @tensorflow/tfjs-react-native (backend)          │
│    ├── MoveNet SinglePose Lightning (model)             │
│    └── WebGL/GPU acceleration                           │
└─────────────────────────────────────────────────────────┘
```

## Files to Modify

### 1. NEW: services/executorch/TFJSPoseService.ts
- Drop-in replacement for ExecuTorchService
- Same interface: `initialize()`, `detectPose()`, `isReady()`, etc.
- Uses TensorFlow.js MoveNet for inference

### 2. MODIFY: services/poseDetection.ts
- Change import from `ExecuTorchService` to `TFJSPoseService`
- Update variable names from `execuTorchService` to `poseService`

### 3. MODIFY: metro.config.js
- Add `.bin` to asset extensions for TF.js models

### 4. VERIFY: No other files reference ExecuTorchService directly

## Files to Check

| File | Status | Action |
|------|--------|--------|
| `services/poseDetection.ts` | ✅ Updated | Uses TFJSPoseService |
| `services/executorch/TFJSPoseService.ts` | ✅ Created | New service |
| `services/executorch/ExecuTorchService.ts` | ⚠️ Keep | Legacy, not used |
| `modules/executorch/` | ⚠️ Keep | Native module, not used |
| `metro.config.js` | ✅ Updated | Added .bin extension |
| `package.json` | ❌ Needs update | Add TF.js dependencies |

## Data Flow

### Before (Stubbed)
```
Camera Frame → ExecuTorchModule.kt → generateMockKeypoints() → Random data
```

### After (Real Inference)
```
Camera Frame → TFJSPoseService → MoveNet → Real 17 keypoints
```

## Model Details

- **Model**: MoveNet SinglePose Lightning
- **Input**: Camera frame (any size, auto-resized)
- **Output**: 17 COCO keypoints with (x, y, score)
- **Performance**: ~15-30 fps on modern phones
- **Backend**: WebGL (GPU accelerated on Arm)

## Keypoint Mapping

Both MoveNet and YOLOv8s-pose use COCO format:
```
0: nose, 1: leftEye, 2: rightEye, 3: leftEar, 4: rightEar,
5: leftShoulder, 6: rightShoulder, 7: leftElbow, 8: rightElbow,
9: leftWrist, 10: rightWrist, 11: leftHip, 12: rightHip,
13: leftKnee, 14: rightKnee, 15: leftAnkle, 16: rightAnkle
```

## Risk Mitigation

1. **TensorFlow.js initialization fails**: Fall back to pre-computed mode
2. **Performance issues**: Use Lightning model (fastest variant)
3. **Memory issues**: Dispose tensors after each inference
