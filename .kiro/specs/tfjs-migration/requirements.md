# TensorFlow.js Migration - Requirements

## Goal
Migrate from stubbed ExecuTorch native module to TensorFlow.js for real on-device pose inference.

## Background
The current ExecuTorch native module (`ExecuTorchModule.kt`) returns mock keypoints via `generateMockKeypoints()`. This needs to be replaced with actual AI inference using TensorFlow.js MoveNet.

## Requirements

### REQ-1: Install TensorFlow.js Dependencies
- Install `@tensorflow/tfjs` for core TensorFlow.js
- Install `@tensorflow/tfjs-react-native` for React Native backend
- Install `@tensorflow-models/pose-detection` for MoveNet model
- Install `expo-gl` for WebGL support

### REQ-2: Create TFJSPoseService
- Create service that initializes TensorFlow.js
- Load MoveNet SinglePose Lightning model
- Implement `detectPose()` method that returns real keypoints
- Match the interface of existing `ExecuTorchService`

### REQ-3: Update poseDetection.ts
- Replace `ExecuTorchService` import with `TFJSPoseService`
- Update initialization to use TensorFlow.js
- Ensure same output format (17 COCO keypoints + angles)

### REQ-4: Update Metro Config
- Add `.bin` extension for TensorFlow.js model files

### REQ-5: Verify All References Updated
- Check all files that import ExecuTorchService
- Ensure no code paths still use stubbed native module
- Update any hardcoded references to ExecuTorch

### REQ-6: Update Documentation
- Update HACKATHON.md to reflect TensorFlow.js usage
- Update HACKATHON_ANALYSIS.md with new assessment
- Remove misleading claims about ExecuTorch

## Acceptance Criteria
- [ ] TensorFlow.js packages installed
- [ ] Real pose detection returns actual keypoints (not mock data)
- [ ] App builds and runs on Android device
- [ ] Camera feed produces real pose data
- [ ] Documentation accurately describes implementation
