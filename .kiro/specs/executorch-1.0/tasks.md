# ExecuTorch 1.0 Implementation - Tasks

## Task 1: Get ExecuTorch 1.0 AAR ✅

Updated `modules/executorch/android/build.gradle` with official Maven Central dependency:
```gradle
// ExecuTorch 1.0 GA - From Maven Central (Official)
// https://docs.pytorch.org/executorch/stable/using-executorch-android.html
implementation 'org.pytorch:executorch-android:1.0.0'

// Required dependencies for ExecuTorch AAR
implementation 'com.facebook.fbjni:fbjni:0.6.0'
implementation 'com.facebook.soloader:soloader:0.11.0'
```

**Status**: [x] Done - Official Maven Central dependency added

---

## Task 2: Export Pose Model to .pte ✅

Created `python-tools/export_executorch.py`:
```bash
cd bachatrainer/python-tools
uv run python export_executorch.py --output ../mobile/assets/models/pose.pte
```

**Status**: [x] Done - Script created

---

## Task 3: Update Native Module (ExecuTorchModule.kt) ✅

Updated with ExecuTorch 1.0 GA API:
- [x] Import `org.pytorch.executorch.Module`, `Tensor`, `EValue`
- [x] Implement real `Module.load(modelPath)` 
- [x] Implement real `module.forward(inputTensor)` inference
- [x] Added `parseExecuTorchOutput()` to convert tensor to keypoints
- [x] Added `isRealInference: true` flag to results

**Status**: [x] Done - Using official ExecuTorch 1.0 API

---

## Task 4: Bundle Model with App

- [ ] Run export script to create .pte file
- [ ] Add .pte file to `mobile/assets/models/`
- [ ] Update `app.json` assetBundlePatterns
- [ ] Update asset loading code

**Status**: [ ] Pending - Need to run export script

---

## Task 5: Revert TypeScript to ExecuTorchService ✅

- [x] Update poseDetection.ts to use ExecuTorchService
- [x] Keep TFJSPoseService as fallback option

**Status**: [x] Done

---

## Task 6: Build and Test

```bash
cd bachatrainer/mobile
npx expo prebuild --clean
eas build --profile development --platform android
# Install on device and test
```

**Status**: [ ] Pending

---

## Next Steps

1. **Export the model**:
   ```bash
   cd bachatrainer/python-tools
   pip install executorch torch torchvision
   python export_executorch.py --output ../mobile/assets/models/pose.pte
   ```

2. **Rebuild the app**:
   ```bash
   cd bachatrainer/mobile
   npx expo prebuild --clean
   eas build --profile development --platform android
   ```

3. **Test on device** and check logs for:
   - "ExecuTorch native library loaded successfully"
   - "isRealInference: true" in inference results

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| build.gradle | ✅ Updated | `org.pytorch:executorch-android:1.0.0` |
| ExecuTorchModule.kt | ✅ Updated | Real API: `Module.load()`, `forward()` |
| poseDetection.ts | ✅ Updated | Uses ExecuTorchService |
| export_executorch.py | ✅ Created | Export script ready |
| pyproject.toml | ✅ Updated | `executorch>=1.0.0` |
| pose.pte model | ❌ Pending | Need to run export |
| App build | ❌ Pending | Need to rebuild |
| Device test | ❌ Pending | Need to test |

---

## Time Remaining

| Task | Time |
|------|------|
| Export model | 15 min |
| Rebuild app | 20-30 min |
| Test on device | 15 min |
| **Total** | **~1 hour** |
