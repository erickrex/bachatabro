# TensorFlow.js Migration - Tasks

## Task 1: Verify Code Changes ✅
- [x] Create TFJSPoseService.ts
- [x] Update poseDetection.ts to use TFJSPoseService
- [x] Update metro.config.js

## Task 2: Check All ExecuTorch References ✅
- [x] Search codebase for "ExecuTorch" imports - None found in .ts files
- [x] Verify no active code paths use stubbed module - Confirmed
- [x] Document any remaining references - Only in native modules (unused)

## Task 3: Install Dependencies
```bash
cd bachatrainer/mobile
npx expo install @tensorflow/tfjs @tensorflow/tfjs-react-native expo-gl
npm install @tensorflow-models/pose-detection
```

## Task 4: Update package.json
Verify these dependencies are added:
- `@tensorflow/tfjs`
- `@tensorflow/tfjs-react-native`
- `@tensorflow-models/pose-detection`
- `expo-gl`

## Task 5: Rebuild App
```bash
eas build --profile development --platform android
```

## Task 6: Test on Device
- [ ] Install APK on Android device
- [ ] Open camera in app
- [ ] Verify real pose detection (not random data)
- [ ] Check console logs for "TensorFlow.js ready"

## Task 7: Update Documentation
- [ ] Update HACKATHON.md - change ExecuTorch claims to TensorFlow.js
- [ ] Update HACKATHON_ANALYSIS.md - reassess winning chances
- [ ] Update HOW_POSES_WORK.md - document TF.js for real-time

## Task 8: Clean Up (Optional)
- [ ] Remove or deprecate ExecuTorchService.ts
- [ ] Remove or deprecate native modules (modules/executorch/)
- [ ] Update comments referencing ExecuTorch

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| TFJSPoseService.ts | ✅ Created | Ready to use |
| poseDetection.ts | ✅ Updated | Uses TFJSPoseService |
| metro.config.js | ✅ Updated | Added .bin extension |
| package.json | ❌ Pending | Need to install packages |
| App build | ❌ Pending | Need to rebuild |
| Device test | ❌ Pending | Need to test |
| Documentation | ❌ Pending | Need to update |
