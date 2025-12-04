# ExecuTorch 1.0 Implementation - Requirements

## Goal
Implement real on-device pose inference using ExecuTorch 1.0 GA with Arm optimizations.

## Background
- ExecuTorch 1.0 GA was released in 2024/2025
- Includes Arm-optimized execution via KleidiAI
- Native module structure exists but AAR is missing
- Current implementation returns mock data

## Requirements

### REQ-1: Obtain ExecuTorch 1.0 AAR
- Download pre-built ExecuTorch Android AAR from PyTorch releases
- Or build from source with XNNPACK delegate
- Place in `modules/executorch/android/libs/`

### REQ-2: Export Pose Model to .pte Format
- Export MoveNet or similar pose model to ExecuTorch format
- Use Python tools to convert PyTorch model to .pte
- Bundle .pte file with the app

### REQ-3: Update Native Module
- Remove mock `generateMockKeypoints()` implementation
- Implement actual model loading with ExecuTorch API
- Implement real inference with XNNPACK delegate

### REQ-4: Update TypeScript Service
- Revert from TFJSPoseService back to ExecuTorchService
- Or create new service that uses the real native module

### REQ-5: Test on Arm Device
- Build and deploy to Android device
- Verify real pose detection from camera
- Measure inference performance

## Acceptance Criteria
- [ ] ExecuTorch AAR present in libs folder
- [ ] .pte model file bundled with app
- [ ] Native module loads and runs real inference
- [ ] Camera returns actual pose keypoints
- [ ] Performance: <100ms inference on Arm device
