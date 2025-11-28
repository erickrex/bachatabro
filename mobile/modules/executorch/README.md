# ExecuTorch Native Module

This module provides React Native bindings for PyTorch ExecuTorch, enabling real-time pose detection on iOS and Android.

## Architecture

```
mobile/modules/executorch/
├── ios/                    # iOS native implementation
│   ├── ExecuTorchModule.h
│   ├── ExecuTorchModule.mm
│   └── ExecuTorch.podspec
├── android/                # Android native implementation
│   ├── src/main/java/
│   │   └── com/bachatrainer/executorch/
│   │       ├── ExecuTorchModule.kt
│   │       └── ExecuTorchPackage.kt
│   └── build.gradle
├── src/                    # TypeScript interface
│   ├── index.ts
│   └── types.ts
└── plugin/                 # Expo config plugin
    └── src/
        └── index.ts
```

## Setup

### Prerequisites

- ExecuTorch iOS framework (download or build from source)
- ExecuTorch Android AAR (download or build from source)

### Installation

1. Add the module to your Expo app:
```json
{
  "plugins": [
    "./modules/executorch/plugin"
  ]
}
```

2. Prebuild the native projects:
```bash
npx expo prebuild
```

3. Add ExecuTorch frameworks:
   - iOS: Place `ExecuTorch.framework` in `ios/Frameworks/`
   - Android: Place `executorch-android.aar` in `android/libs/`

## Usage

```typescript
import { ExecuTorchModule } from './modules/executorch';

// Initialize
await ExecuTorchModule.loadModel('movenet.pte');
await ExecuTorchModule.setDelegate('coreml'); // iOS: 'coreml', Android: 'xnnpack'

// Run inference
const result = await ExecuTorchModule.runInference({
  width: 192,
  height: 192,
  data: imageData, // base64 or array
});

// Result format
{
  keypoints: [
    { x: 0.5, y: 0.3, confidence: 0.9 },
    // ... 17 keypoints total
  ],
  inferenceTime: 45.2 // milliseconds
}
```

## API

### `loadModel(modelPath: string): Promise<void>`
Loads the ExecuTorch model from the specified path.

### `setDelegate(delegate: 'coreml' | 'xnnpack'): Promise<void>`
Configures hardware acceleration delegate.

### `runInference(imageData: ImageData): Promise<PoseResult>`
Runs pose detection inference on the provided image.

### `getPerformanceMetrics(): Promise<PerformanceMetrics>`
Returns performance statistics (FPS, latency, etc.).

## Development

### Building iOS Module

```bash
cd ios
pod install
xcodebuild -workspace ExecuTorch.xcworkspace -scheme ExecuTorch
```

### Building Android Module

```bash
cd android
./gradlew assembleRelease
```

## Testing

```bash
npm test
```

## Troubleshooting

### iOS: Framework not found
- Ensure ExecuTorch.framework is in `ios/Frameworks/`
- Check framework search paths in Xcode

### Android: AAR not found
- Ensure executorch-android.aar is in `android/libs/`
- Check dependencies in `build.gradle`

### Inference errors
- Verify model file is valid PTE format
- Check model input dimensions (192x192)
- Ensure delegate is supported on device

## License

MIT
