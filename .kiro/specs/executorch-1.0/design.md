# ExecuTorch 1.0 Implementation - Design

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
├─────────────────────────────────────────────────────────┤
│  poseDetection.ts (UnifiedPoseDetectionService)         │
│    └── ExecuTorchService.ts                             │
├─────────────────────────────────────────────────────────┤
│  Native Module (ExecuTorchModule.kt)                    │
│    └── ExecuTorch 1.0 AAR                               │
│        └── XNNPACK Delegate (Arm NEON optimized)        │
├─────────────────────────────────────────────────────────┤
│  Model: movenet_singlepose.pte                          │
│    └── Exported from PyTorch via ExecuTorch             │
└─────────────────────────────────────────────────────────┘
```

## ExecuTorch 1.0 Android Integration

### Step 1: Get ExecuTorch AAR

**Option A: Maven (Recommended for 1.0 GA)**
```gradle
// In build.gradle
repositories {
    maven { url 'https://oss.sonatype.org/content/repositories/snapshots' }
}

dependencies {
    implementation 'org.pytorch:executorch-android:1.0.0'
}
```

**Option B: Download Pre-built**
```bash
# From PyTorch releases
wget https://github.com/pytorch/executorch/releases/download/v1.0.0/executorch-android-1.0.0.aar
mv executorch-android-1.0.0.aar modules/executorch/android/libs/
```

**Option C: Build from Source**
```bash
git clone https://github.com/pytorch/executorch.git
cd executorch
./install_requirements.sh
./build/build_android_aar.sh --xnnpack
```

### Step 2: Export Pose Model to .pte

```python
# export_movenet_executorch.py
import torch
from executorch.exir import to_edge
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner

# Load MoveNet model
model = torch.hub.load('ultralytics/yolov8', 'yolov8s-pose', pretrained=True)
model.eval()

# Example input
example_input = torch.randn(1, 3, 256, 256)

# Export to ExecuTorch
edge_program = to_edge(
    torch.export.export(model, (example_input,))
)

# Partition for XNNPACK (Arm optimization)
edge_program = edge_program.to_backend(XnnpackPartitioner())

# Save .pte file
with open('movenet.pte', 'wb') as f:
    f.write(edge_program.to_executorch().buffer)
```

### Step 3: Update Native Module

```kotlin
// ExecuTorchModule.kt - Key changes

import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor

class ExecuTorchModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var module: Module? = null

    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        try {
            // REAL ExecuTorch model loading
            module = Module.load(modelPath)
            modelLoaded = true
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", e.message)
        }
    }

    @ReactMethod
    fun runInference(imageData: ReadableMap, promise: Promise) {
        // Convert image to tensor
        val inputTensor = imageToTensor(imageData)
        
        // REAL inference
        val outputTensor = module?.forward(inputTensor)
        
        // Parse keypoints from output
        val keypoints = parseKeypoints(outputTensor)
        
        promise.resolve(keypoints)
    }
}
```

## Model Options

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| MoveNet Lightning | ~3MB | ~30ms | Good |
| MoveNet Thunder | ~6MB | ~60ms | Better |
| YOLOv8s-pose | ~23MB | ~80ms | Best |

**Recommendation**: MoveNet Lightning for real-time, YOLOv8s-pose for accuracy.

## File Structure

```
mobile/
├── assets/
│   └── models/
│       └── movenet.pte          # ExecuTorch model
├── modules/
│   └── executorch/
│       └── android/
│           ├── libs/
│           │   └── executorch-android.aar  # ExecuTorch library
│           └── src/main/java/
│               └── ExecuTorchModule.kt     # Native module
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Inference | <100ms | On mid-range Arm device |
| FPS | >10 | Real-time viable |
| Memory | <200MB | Including model |
| Model size | <10MB | For app bundle |
