# ExecuTorch Native Module Setup Guide

This guide walks through setting up the ExecuTorch native modules for iOS and Android.

## Prerequisites

### General
- Node.js 18+
- Expo CLI
- React Native development environment

### iOS
- macOS with Xcode 14+
- CocoaPods
- iOS 13+ deployment target

### Android
- Android Studio
- Android SDK 21+
- Kotlin 1.9+

## Step 1: Obtain ExecuTorch Binaries

### Option A: Download Pre-built Binaries (Recommended)

#### iOS
1. Download ExecuTorch iOS framework from PyTorch releases:
   ```bash
   # Visit: https://github.com/pytorch/executorch/releases
   # Download: executorch-ios-<version>.zip
   ```

2. Extract and place in project:
   ```bash
   unzip executorch-ios-<version>.zip
   mkdir -p mobile/ios/Frameworks
   cp -r ExecuTorch.framework mobile/ios/Frameworks/
   ```

#### Android
1. Download ExecuTorch Android AAR:
   ```bash
   # Visit: https://github.com/pytorch/executorch/releases
   # Download: executorch-android-<version>.aar
   ```

2. Place in project:
   ```bash
   mkdir -p mobile/modules/executorch/android/libs
   cp executorch-android-<version>.aar mobile/modules/executorch/android/libs/executorch-android.aar
   ```

### Option B: Build from Source

#### iOS
```bash
# Clone ExecuTorch
git clone https://github.com/pytorch/executorch.git
cd executorch

# Install dependencies
./install_requirements.sh

# Build iOS framework
python3 build/build_apple_frameworks.py \
  --coreml \
  --output-dir build-ios

# Copy to project
cp -r build-ios/ExecuTorch.framework ../bachatabro/mobile/ios/Frameworks/
```

#### Android
```bash
# Clone ExecuTorch
git clone https://github.com/pytorch/executorch.git
cd executorch

# Install dependencies
./install_requirements.sh

# Build Android AAR
./build/build_android_aar.sh \
  --xnnpack \
  --output-dir build-android

# Copy to project
cp build-android/executorch-android.aar \
  ../bachatabro/mobile/modules/executorch/android/libs/
```

## Step 2: Configure Expo App

1. Update `app.json` to include the ExecuTorch plugin:
   ```json
   {
     "expo": {
       "plugins": [
         "./modules/executorch/plugin"
       ]
     }
   }
   ```

2. Prebuild native projects:
   ```bash
   cd mobile
   npx expo prebuild
   ```

   This generates the `ios/` and `android/` directories with native code.

## Step 3: iOS Setup

1. Install CocoaPods dependencies:
   ```bash
   cd ios
   pod install
   cd ..
   ```

2. Open Xcode project:
   ```bash
   open ios/bachatabro.xcworkspace
   ```

3. Verify ExecuTorch framework:
   - In Xcode, select your project
   - Go to "General" tab
   - Under "Frameworks, Libraries, and Embedded Content"
   - Ensure `ExecuTorch.framework` is listed and set to "Embed & Sign"

4. Configure framework search paths:
   - Select your project → Build Settings
   - Search for "Framework Search Paths"
   - Add: `$(PROJECT_DIR)/Frameworks`

5. Build the project:
   ```bash
   npx expo run:ios
   ```

### Troubleshooting iOS

**Framework not found:**
```bash
# Verify framework exists
ls -la ios/Frameworks/ExecuTorch.framework

# Check Podfile includes ExecuTorch
cat ios/Podfile | grep ExecuTorch

# Reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install
```

**Linker errors:**
- Ensure deployment target is iOS 13+
- Check that C++ standard is set to C++17
- Verify framework is set to "Embed & Sign"

## Step 4: Android Setup

1. Verify module is included in `settings.gradle`:
   ```gradle
   include ':executorch'
   project(':executorch').projectDir = new File(rootProject.projectDir, '../modules/executorch/android')
   ```

2. Verify dependency in `app/build.gradle`:
   ```gradle
   dependencies {
       implementation project(':executorch')
   }
   ```

3. Verify AAR exists:
   ```bash
   ls -la modules/executorch/android/libs/executorch-android.aar
   ```

4. Build the project:
   ```bash
   npx expo run:android
   ```

### Troubleshooting Android

**AAR not found:**
```bash
# Verify AAR exists
ls -la modules/executorch/android/libs/

# Check build.gradle includes AAR
cat modules/executorch/android/build.gradle | grep executorch-android.aar
```

**Build errors:**
```bash
# Clean build
cd android
./gradlew clean

# Rebuild
cd ..
npx expo run:android
```

**Module not registered:**
- Verify `ExecuTorchPackage` is added to `MainApplication.java`
- Check import statement exists
- Rebuild the app

## Step 5: Verify Installation

Create a test component:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import execuTorchModule from './modules/executorch';

export function ExecuTorchTest() {
  const [status, setStatus] = useState('Not loaded');

  const testModule = async () => {
    try {
      // Load model (use actual model path)
      await execuTorchModule.loadModel('movenet.pte');
      setStatus('Model loaded');

      // Set delegate
      const delegate = execuTorchModule.getRecommendedDelegate();
      await execuTorchModule.setDelegate(delegate);
      setStatus(`Delegate set: ${delegate}`);

      // Test inference with mock data
      const result = await execuTorchModule.runInference({
        width: 192,
        height: 192,
        data: 'data:image/jpeg;base64,...',
      });

      setStatus(`Inference successful: ${result.keypoints.length} keypoints`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <View>
      <Text>Status: {status}</Text>
      <Button title="Test ExecuTorch" onPress={testModule} />
    </View>
  );
}
```

## Step 6: Add Model File

1. Export your pose model to PTE format (see python-tools/export_model.py)

2. Add model to assets:
   ```bash
   cp python-tools/movenet.pte mobile/assets/models/
   ```

3. Update `app.json` to include model in bundle:
   ```json
   {
     "expo": {
       "assetBundlePatterns": [
         "assets/**/*",
         "assets/models/*.pte"
       ]
     }
   }
   ```

4. Load model in app:
   ```typescript
   import { Asset } from 'expo-asset';
   
   const modelAsset = Asset.fromModule(require('./assets/models/movenet.pte'));
   await modelAsset.downloadAsync();
   await execuTorchModule.loadModel(modelAsset.localUri);
   ```

## Performance Optimization

### iOS
- Use CoreML delegate for best performance
- Enable Metal acceleration
- Test on physical device (simulator is slower)

### Android
- Use XNNPACK delegate for best performance
- Enable NNAPI if available
- Test on physical device (emulator is slower)

## Next Steps

1. ✅ Native modules set up
2. ✅ Model exported and bundled
3. → Integrate into game screen (Phase 3)
4. → Add detection mode manager
5. → Test on physical devices

## Support

For issues:
1. Check logs: `npx expo start --clear`
2. Verify framework/AAR exists
3. Clean and rebuild
4. Check ExecuTorch documentation: https://pytorch.org/executorch/

## References

- [ExecuTorch Documentation](https://pytorch.org/executorch/)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)
