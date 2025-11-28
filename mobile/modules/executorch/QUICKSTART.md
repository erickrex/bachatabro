# ExecuTorch Module - Quick Start

Get up and running with ExecuTorch pose detection in 5 minutes.

## Prerequisites

- Expo development environment set up
- ExecuTorch binaries (see SETUP.md for details)
- Exported PTE model file

## Quick Setup

### 1. Add ExecuTorch Binaries

**iOS:**
```bash
# Place ExecuTorch.framework in:
mobile/ios/Frameworks/ExecuTorch.framework
```

**Android:**
```bash
# Place executorch-android.aar in:
mobile/modules/executorch/android/libs/executorch-android.aar
```

### 2. Configure Expo

Add to `app.json`:
```json
{
  "expo": {
    "plugins": [
      "./modules/executorch/plugin"
    ]
  }
}
```

### 3. Prebuild Native Projects

```bash
cd mobile
npx expo prebuild
```

### 4. Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 5. Run the App

**iOS:**
```bash
npx expo run:ios
```

**Android:**
```bash
npx expo run:android
```

## Basic Usage

```typescript
import execuTorchModule from './modules/executorch';
import { Asset } from 'expo-asset';

// Load model
const modelAsset = Asset.fromModule(require('./assets/models/movenet.pte'));
await modelAsset.downloadAsync();
await execuTorchModule.loadModel(modelAsset.localUri);

// Set hardware acceleration
const delegate = execuTorchModule.getRecommendedDelegate();
await execuTorchModule.setDelegate(delegate);

// Run inference
const result = await execuTorchModule.runInference({
  width: 192,
  height: 192,
  data: imageBase64, // or file URI
});

console.log(`Detected ${result.keypoints.length} keypoints`);
console.log(`Inference time: ${result.inferenceTime}ms`);

// Get performance metrics
const metrics = await execuTorchModule.getPerformanceMetrics();
console.log(`Average FPS: ${metrics.averageFPS}`);
```

## Example Component

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Image } from 'react-native';
import execuTorchModule from './modules/executorch';

export function PoseDetectionDemo() {
  const [status, setStatus] = useState('Initializing...');
  const [keypoints, setKeypoints] = useState([]);

  useEffect(() => {
    initializeModel();
  }, []);

  const initializeModel = async () => {
    try {
      // Load model
      await execuTorchModule.loadModel('movenet.pte');
      
      // Set delegate
      const delegate = execuTorchModule.getRecommendedDelegate();
      await execuTorchModule.setDelegate(delegate);
      
      setStatus(`Ready (${delegate})`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const detectPose = async () => {
    try {
      setStatus('Detecting...');
      
      const result = await execuTorchModule.runInference({
        width: 192,
        height: 192,
        data: 'data:image/jpeg;base64,...', // Your image data
      });
      
      setKeypoints(result.keypoints);
      setStatus(`Detected in ${result.inferenceTime.toFixed(1)}ms`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Status: {status}</Text>
      <Button title="Detect Pose" onPress={detectPose} />
      <Text>Keypoints: {keypoints.length}</Text>
    </View>
  );
}
```

## Troubleshooting

### iOS: "Framework not found"
```bash
# Verify framework exists
ls -la ios/Frameworks/ExecuTorch.framework

# Reinstall pods
cd ios && rm -rf Pods Podfile.lock && pod install
```

### Android: "AAR not found"
```bash
# Verify AAR exists
ls -la modules/executorch/android/libs/executorch-android.aar

# Clean build
cd android && ./gradlew clean
```

### "Module not found"
```bash
# Rebuild app
npx expo prebuild --clean
npx expo run:ios  # or run:android
```

## Next Steps

- Read [SETUP.md](./SETUP.md) for detailed setup instructions
- Read [README.md](./README.md) for complete API documentation
- See Phase 3 tasks for integration into game screen

## Support

For issues, check:
1. ExecuTorch binaries are in correct locations
2. Expo prebuild completed successfully
3. Native projects built without errors
4. Model file is valid PTE format

See [SETUP.md](./SETUP.md) for comprehensive troubleshooting.
