# ExecuTorch Native Module

React Native bindings for PyTorch ExecuTorch 1.0 GA.

## Architecture

```
modules/executorch/
├── android/src/.../ExecuTorchModule.kt   # Kotlin implementation
├── ios/ExecuTorchModule.mm               # Objective-C++ implementation
└── (TypeScript wrapper in services/)
```

## Usage

```typescript
import { ExecuTorchService } from '@/services/executorch/ExecuTorchService';

const service = new ExecuTorchService();
await service.initialize('pose.pte');

const result = await service.detectPose(imageData);
// { keypoints: [...], inferenceTime: 45, confidence: 0.92 }
```

## Delegates

- **Android**: XNNPACK (Arm NEON optimized)
- **iOS**: CoreML (Apple Neural Engine)

## Dependencies

- `org.pytorch:executorch-android:1.0.0` (Android)
- ExecuTorch.framework (iOS)
