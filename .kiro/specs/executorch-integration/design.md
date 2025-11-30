# ExecuTorch Integration - Design Document

## 1. Architecture Overview

This document describes the system architecture for integrating PyTorch ExecuTorch into the Bacha Trainer mobile application, enabling real-time pose detection on-device while maintaining backward compatibility with pre-computed pose data.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Mobile App (React Native + Expo)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UI Layer                                             │  │
│  │  - Game Screen (dual video view)                     │  │
│  │  - Settings (mode selection)                         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Detection Mode Manager                               │  │
│  │  - Auto-detect device capabilities                   │  │
│  │  - Switch between real-time/pre-computed             │  │
│  │  - Fallback logic                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌──────────────────┬────────────────────────────────────┐  │
│  │  Real-Time Mode  │  Pre-Computed Mode (Existing)     │  │
│  │                  │                                    │  │
│  │  ExecuTorch      │  JSON Pose Data                   │  │
│  │  Inference       │  Loader                           │  │
│  │  ↓               │  ↓                                │  │
│  │  Keypoints       │  Keypoints                        │  │
│  └──────────────────┴────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Unified Pose Processing                              │  │
│  │  - Angle Calculation (shared)                        │  │
│  │  - Score Calculation (shared)                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                    Native Modules
                          │
┌─────────────────────────┴─────────────────────────────────┐
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │  iOS Native      │         │  Android Native  │        │
│  │  ExecuTorch      │         │  ExecuTorch      │        │
│  │  + CoreML        │         │  + XNNPACK       │        │
│  └──────────────────┘         └──────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│         Python Preprocessing Tools (Development)            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Model Export Pipeline                                │  │
│  │  PyTorch Model → ExecuTorch → Quantization → PTE     │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Video Preprocessing (Updated)                        │  │
│  │  Video → ExecuTorch Inference → JSON (backward compat)│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Dual Mode Architecture**: Support both real-time and pre-computed modes seamlessly
2. **Graceful Degradation**: Automatic fallback to pre-computed mode on errors or poor performance
3. **Unified Processing**: Same angle and score calculation regardless of detection mode
4. **Hardware Acceleration**: Leverage device-specific accelerators (CoreML, XNNPACK)
5. **Minimal Dependencies**: Replace TensorFlow Lite with PyTorch ExecuTorch
6. **Developer Friendly**: Clear APIs and comprehensive error handling

## 2. Component Design

### 2.1 Detection Mode Manager

**Purpose**: Orchestrate detection mode selection and switching

**Interface**:
```typescript
interface DetectionModeManager {
  // Initialization
  initialize(): Promise<void>;
  
  // Mode detection
  detectOptimalMode(): Promise<DetectionMode>;
  
  // Mode management
  getCurrentMode(): DetectionMode;
  setMode(mode: DetectionMode): Promise<void>;
  
  // Capabilities
  isRealTimeSupported(): boolean;
  getDeviceCapabilities(): DeviceCapabilities;
  
  // Fallback
  triggerFallback(reason: string): void;
}

enum DetectionMode {
  REAL_TIME = 'real-time',
  PRE_COMPUTED = 'pre-computed',
  AUTO = 'auto'
}

interface DeviceCapabilities {
  platform: 'ios' | 'android';
  hasGPU: boolean;
  hasNPU: boolean;
  estimatedFPS: number;
  memoryAvailable: number;
}
```

**Behavior**:
- On app startup, detect device capabilities
- Select optimal mode based on hardware
- Monitor performance and trigger fallback if needed
- Persist user's manual mode selection



### 2.2 ExecuTorch Inference Service

**Purpose**: Wrapper for ExecuTorch native modules with unified API

**Interface**:
```typescript
interface ExecuTorchService {
  // Lifecycle
  initialize(modelPath: string): Promise<void>;
  dispose(): void;
  
  // Inference
  detectPose(imageData: ImageData): Promise<PoseResult>;
  detectPoseBatch(images: ImageData[]): Promise<PoseResult[]>;
  
  // Performance
  getInferenceTime(): number;
  getAverageFPS(): number;
  
  // Configuration
  setDelegate(delegate: Delegate): void;
  setNumThreads(threads: number): void;
}

interface PoseResult {
  keypoints: Keypoint[];
  inferenceTime: number;
  confidence: number;
}

interface Keypoint {
  name: string;
  x: number;  // Normalized 0-1
  y: number;  // Normalized 0-1
  confidence: number;  // 0-1
}

enum Delegate {
  CPU = 'cpu',
  COREML = 'coreml',      // iOS
  XNNPACK = 'xnnpack',    // Android
  GPU = 'gpu'
}
```

**Implementation Strategy**:
```typescript
// services/executorch/ExecuTorchService.ts
import { NativeModules } from 'react-native';

const { ExecuTorchModule } = NativeModules;

export class ExecuTorchService implements IExecuTorchService {
  private modelLoaded = false;
  private inferenceT times: number[] = [];
  
  async initialize(modelPath: string): Promise<void> {
    try {
      await ExecuTorchModule.loadModel(modelPath);
      await this.configureDelegate();
      this.modelLoaded = true;
    } catch (error) {
      console.error('Failed to initialize ExecuTorch:', error);
      throw new ExecuTorchInitError(error);
    }
  }
  
  private async configureDelegate(): Promise<void> {
    const platform = Platform.OS;
    if (platform === 'ios') {
      await ExecuTorchModule.setDelegate('coreml');
    } else {
      await ExecuTorchModule.setDelegate('xnnpack');
    }
  }
  
  async detectPose(imageData: ImageData): Promise<PoseResult> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }
    
    const startTime = performance.now();
    const result = await ExecuTorchModule.runInference(imageData);
    const inferenceTime = performance.now() - startTime;
    
    this.inferenceT times.push(inferenceTime);
    if (this.inferenceT times.length > 30) {
      this.inferenceT times.shift();
    }
    
    return {
      keypoints: this.parseKeypoints(result),
      inferenceTime,
      confidence: this.calculateConfidence(result)
    };
  }
  
  getAverageFPS(): number {
    if (this.inferenceT times.length === 0) return 0;
    const avgTime = this.inferenceT times.reduce((a, b) => a + b) / this.inferenceT times.length;
    return 1000 / avgTime;
  }
}
```



### 2.3 Unified Pose Detection Service

**Purpose**: Abstract detection mode and provide consistent interface

**Interface**:
```typescript
interface PoseDetectionService {
  // Initialization
  initialize(mode: DetectionMode): Promise<void>;
  
  // Detection
  detectPose(input: DetectionInput): Promise<PoseAngles>;
  
  // Mode management
  switchMode(mode: DetectionMode): Promise<void>;
  getCurrentMode(): DetectionMode;
  
  // Performance
  getPerformanceMetrics(): PerformanceMetrics;
}

type DetectionInput = 
  | { type: 'camera'; imageData: ImageData }
  | { type: 'precomputed'; frameIndex: number; songId: string };

interface PoseAngles {
  leftArm: number;
  rightArm: number;
  leftElbow: number;
  rightElbow: number;
  leftThigh: number;
  rightThigh: number;
  leftLeg: number;
  rightLeg: number;
  confidence: number;
  source: 'real-time' | 'pre-computed';
}
```

**Implementation**:
```typescript
// services/poseDetection.ts (updated)
export class UnifiedPoseDetectionService implements PoseDetectionService {
  private execuTorchService?: ExecuTorchService;
  private precomputedLoader: PrecomputedPoseLoader;
  private currentMode: DetectionMode;
  
  async initialize(mode: DetectionMode): Promise<void> {
    this.currentMode = mode;
    
    if (mode === DetectionMode.REAL_TIME) {
      this.execuTorchService = new ExecuTorchService();
      await this.execuTorchService.initialize('movenet.pte');
    }
    
    // Always initialize precomputed as fallback
    this.precomputedLoader = new PrecomputedPoseLoader();
  }
  
  async detectPose(input: DetectionInput): Promise<PoseAngles> {
    try {
      if (input.type === 'camera' && this.currentMode === DetectionMode.REAL_TIME) {
        return await this.detectRealTime(input.imageData);
      } else if (input.type === 'precomputed') {
        return await this.detectPrecomputed(input.frameIndex, input.songId);
      }
    } catch (error) {
      console.error('Detection failed:', error);
      // Fallback to precomputed if available
      if (input.type === 'camera') {
        throw error; // Can't fallback without frame index
      }
      throw error;
    }
  }
  
  private async detectRealTime(imageData: ImageData): Promise<PoseAngles> {
    const poseResult = await this.execuTorchService!.detectPose(imageData);
    const angles = calculateAngles(poseResult.keypoints);
    
    return {
      ...angles,
      confidence: poseResult.confidence,
      source: 'real-time'
    };
  }
  
  private async detectPrecomputed(frameIndex: number, songId: string): Promise<PoseAngles> {
    const poseData = await this.precomputedLoader.loadFrame(songId, frameIndex);
    
    return {
      ...poseData.angles,
      confidence: 1.0,
      source: 'pre-computed'
    };
  }
}
```



### 2.4 Native Module Implementation

#### 2.4.1 iOS Native Module (Objective-C++)

**File**: `ios/ExecuTorchModule.mm`

```objc
#import <React/RCTBridgeModule.h>
#import <executorch/extension/module/module.h>
#import <executorch/extension/tensor/tensor.h>

@interface ExecuTorchModule : NSObject <RCTBridgeModule>
@end

@implementation ExecuTorchModule

RCT_EXPORT_MODULE();

std::unique_ptr<torch::executor::Module> module_;

RCT_EXPORT_METHOD(loadModel:(NSString *)modelPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  try {
    module_ = std::make_unique<torch::executor::Module>(
      [modelPath UTF8String]
    );
    resolve(@YES);
  } catch (const std::exception& e) {
    reject(@"LOAD_ERROR", @"Failed to load model", nil);
  }
}

RCT_EXPORT_METHOD(setDelegate:(NSString *)delegateName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Configure CoreML delegate for iOS
  if ([delegateName isEqualToString:@"coreml"]) {
    // Enable CoreML backend
    resolve(@YES);
  } else {
    resolve(@YES);
  }
}

RCT_EXPORT_METHOD(runInference:(NSDictionary *)imageData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  try {
    // Preprocess image
    auto input = preprocessImage(imageData);
    
    // Run inference
    auto outputs = module_->forward({input});
    
    // Parse keypoints
    auto keypoints = parseKeypoints(outputs[0]);
    
    resolve(keypoints);
  } catch (const std::exception& e) {
    reject(@"INFERENCE_ERROR", @"Inference failed", nil);
  }
}

@end
```

#### 2.4.2 Android Native Module (Kotlin)

**File**: `android/src/main/java/com/bachatrainer/ExecuTorchModule.kt`

```kotlin
package com.bachatrainer

import com.facebook.react.bridge.*
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor

class ExecuTorchModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    
    private var module: Module? = null
    
    override fun getName() = "ExecuTorchModule"
    
    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        try {
            module = Module.load(modelPath)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", "Failed to load model", e)
        }
    }
    
    @ReactMethod
    fun setDelegate(delegateName: String, promise: Promise) {
        // Configure XNNPACK delegate for Android
        when (delegateName) {
            "xnnpack" -> {
                // Enable XNNPACK backend
                promise.resolve(true)
            }
            else -> promise.resolve(true)
        }
    }
    
    @ReactMethod
    fun runInference(imageData: ReadableMap, promise: Promise) {
        try {
            // Preprocess image
            val input = preprocessImage(imageData)
            
            // Run inference
            val outputs = module?.forward(input)
            
            // Parse keypoints
            val keypoints = parseKeypoints(outputs?.get(0))
            
            promise.resolve(keypoints)
        } catch (e: Exception) {
            promise.reject("INFERENCE_ERROR", "Inference failed", e)
        }
    }
    
    private fun preprocessImage(imageData: ReadableMap): Tensor {
        // Convert image to tensor (192x192 RGB)
        // Normalize to [0, 1]
        // Return tensor
    }
    
    private fun parseKeypoints(output: Tensor?): WritableArray {
        // Parse model output to keypoints
        // Return array of {name, x, y, confidence}
    }
}
```



## 3. Python Tools Migration

### 3.1 Model Export Pipeline

**Purpose**: Convert PyTorch pose models to ExecuTorch format

**File**: `python-tools/export_model.py`

```python
import torch
from executorch.exir import to_edge, EdgeCompileConfig
from executorch.exir.backend.backend_api import to_backend
from torch.export import export
from torch.ao.quantization.quantize_pt2e import prepare_pt2e, convert_pt2e

def export_movenet_to_executorch(
    model_path: str,
    output_path: str,
    quantize: bool = True
) -> None:
    """
    Export MoveNet model to ExecuTorch format.
    
    Args:
        model_path: Path to PyTorch model
        output_path: Path to save .pte file
        quantize: Whether to apply quantization
    """
    # Load PyTorch model
    model = load_movenet_model(model_path)
    model.eval()
    
    # Create example input (192x192 RGB image)
    example_input = (torch.randn(1, 3, 192, 192),)
    
    # Export to ExecuTorch IR
    exported_program = export(model, example_input)
    
    # Apply quantization if requested
    if quantize:
        exported_program = quantize_model(exported_program, example_input)
    
    # Convert to Edge dialect
    edge_config = EdgeCompileConfig(_check_ir_validity=False)
    edge_program = to_edge(exported_program, compile_config=edge_config)
    
    # Lower to ExecuTorch
    executorch_program = edge_program.to_executorch()
    
    # Save to file
    with open(output_path, 'wb') as f:
        f.write(executorch_program.buffer)
    
    print(f"Model exported to {output_path}")
    print(f"Model size: {len(executorch_program.buffer) / 1024 / 1024:.2f} MB")

def quantize_model(exported_program, example_input):
    """Apply dynamic quantization to reduce model size."""
    # Prepare for quantization
    prepared_model = prepare_pt2e(exported_program, quantizer)
    
    # Calibrate (run with example data)
    prepared_model(*example_input)
    
    # Convert to quantized model
    quantized_model = convert_pt2e(prepared_model)
    
    return quantized_model

def validate_exported_model(pte_path: str, pytorch_model_path: str) -> None:
    """Validate ExecuTorch model against PyTorch baseline."""
    import executorch.extension.pybindings.portable_lib as exec_lib
    
    # Load both models
    et_module = exec_lib.Module(pte_path)
    pt_model = load_movenet_model(pytorch_model_path)
    
    # Test with random input
    test_input = torch.randn(1, 3, 192, 192)
    
    # Run inference
    et_output = et_module.forward((test_input,))[0]
    pt_output = pt_model(test_input)
    
    # Compare outputs
    diff = torch.abs(et_output - pt_output).mean()
    print(f"Average difference: {diff:.6f}")
    
    if diff < 0.05:  # 5% tolerance
        print("✓ Validation passed")
    else:
        print("✗ Validation failed - accuracy degradation too high")

if __name__ == "__main__":
    export_movenet_to_executorch(
        model_path="models/movenet_pytorch.pt",
        output_path="../mobile/assets/models/movenet.pte",
        quantize=True
    )
    
    validate_exported_model(
        pte_path="../mobile/assets/models/movenet.pte",
        pytorch_model_path="models/movenet_pytorch.pt"
    )
```



### 3.2 Video Preprocessing with ExecuTorch

**Purpose**: Replace TensorFlow Lite with ExecuTorch in preprocessing

**File**: `python-tools/preprocess_video_v2.py`

```python
import cv2
import json
import numpy as np
from pathlib import Path
from typing import Dict, List
import executorch.extension.pybindings.portable_lib as exec_lib

class ExecuTorchVideoPreprocessor:
    """Process videos using ExecuTorch for pose detection."""
    
    def __init__(self, model_path: str):
        """Initialize with ExecuTorch model."""
        self.module = exec_lib.Module(model_path)
        self.input_size = (192, 192)
    
    def process_video(
        self,
        video_path: str,
        output_path: str
    ) -> Dict:
        """
        Process video and extract pose data.
        
        Args:
            video_path: Path to input video
            output_path: Path to save JSON output
            
        Returns:
            Dictionary with pose data
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        frames_data = []
        frame_num = 0
        
        print(f"Processing {total_frames} frames at {fps} fps...")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Detect pose
            keypoints = self.detect_pose(frame)
            
            # Calculate angles
            angles = self.calculate_angles(keypoints)
            
            # Store frame data
            frames_data.append({
                "frameNumber": frame_num,
                "timestamp": frame_num / fps,
                "keypoints": keypoints,
                "angles": angles
            })
            
            frame_num += 1
            if frame_num % 30 == 0:
                print(f"Processed {frame_num}/{total_frames} frames")
        
        cap.release()
        
        # Create output
        output = {
            "songId": Path(video_path).stem,
            "fps": fps,
            "totalFrames": frame_num,
            "frames": frames_data,
            "metadata": {
                "processor": "executorch",
                "model": "movenet",
                "version": "2.0"
            }
        }
        
        # Save JSON
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"✓ Saved pose data to {output_path}")
        return output
    
    def detect_pose(self, frame: np.ndarray) -> Dict:
        """Detect pose in a single frame using ExecuTorch."""
        # Preprocess frame
        input_tensor = self.preprocess_frame(frame)
        
        # Run inference
        outputs = self.module.forward((input_tensor,))
        keypoints_tensor = outputs[0]
        
        # Parse keypoints
        keypoints = self.parse_keypoints(keypoints_tensor)
        
        return keypoints
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Preprocess frame for model input."""
        # Resize to 192x192
        resized = cv2.resize(frame, self.input_size)
        
        # Convert BGR to RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        # Normalize to [0, 1]
        normalized = rgb.astype(np.float32) / 255.0
        
        # Add batch dimension and transpose to NCHW
        tensor = np.transpose(normalized, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)
        
        return tensor
    
    def parse_keypoints(self, output: np.ndarray) -> Dict:
        """Parse model output to keypoint dictionary."""
        keypoint_names = [
            'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
            'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
            'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
            'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
        ]
        
        keypoints = {}
        for i, name in enumerate(keypoint_names):
            keypoints[name] = {
                'x': float(output[0, i, 1]),  # x coordinate
                'y': float(output[0, i, 0]),  # y coordinate
                'confidence': float(output[0, i, 2])  # confidence
            }
        
        return keypoints
    
    def calculate_angles(self, keypoints: Dict) -> Dict:
        """Calculate joint angles from keypoints."""
        from utils.angleCalculator import calculateAngles
        return calculateAngles(keypoints)

# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('video', help='Input video path')
    parser.add_argument('--model', default='../mobile/assets/models/movenet.pte')
    parser.add_argument('--output', default='../mobile/assets/poses/')
    args = parser.parse_args()
    
    preprocessor = ExecuTorchVideoPreprocessor(args.model)
    preprocessor.process_video(args.video, args.output)
```



## 4. Data Models

### 4.1 TypeScript Types

```typescript
// types/executorch.ts

export interface ExecuTorchConfig {
  modelPath: string;
  delegate: Delegate;
  numThreads: number;
  enableProfiling: boolean;
}

export interface DetectionMetrics {
  averageFPS: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  failureRate: number;
  totalInferences: number;
}

export interface FallbackEvent {
  timestamp: number;
  reason: string;
  fromMode: DetectionMode;
  toMode: DetectionMode;
  metrics: DetectionMetrics;
}

export interface ModelInfo {
  name: string;
  version: string;
  size: number;
  format: 'pte';
  quantized: boolean;
  delegates: Delegate[];
}
```

### 4.2 Python Data Models

```python
# python-tools/models.py

from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class Keypoint:
    """Single keypoint detection."""
    x: float  # Normalized 0-1
    y: float  # Normalized 0-1
    confidence: float  # 0-1

@dataclass
class PoseFrame:
    """Pose data for a single frame."""
    frame_number: int
    timestamp: float
    keypoints: Dict[str, Keypoint]
    angles: Dict[str, float]

@dataclass
class VideoMetadata:
    """Video processing metadata."""
    song_id: str
    fps: float
    total_frames: int
    processor: str  # 'executorch' or 'tflite'
    model: str
    version: str

@dataclass
class PoseDataset:
    """Complete pose dataset for a video."""
    metadata: VideoMetadata
    frames: List[PoseFrame]
    
    def to_json(self) -> Dict:
        """Convert to JSON-serializable dict."""
        return {
            'songId': self.metadata.song_id,
            'fps': self.metadata.fps,
            'totalFrames': self.metadata.total_frames,
            'metadata': {
                'processor': self.metadata.processor,
                'model': self.metadata.model,
                'version': self.metadata.version
            },
            'frames': [
                {
                    'frameNumber': frame.frame_number,
                    'timestamp': frame.timestamp,
                    'keypoints': {
                        name: {
                            'x': kp.x,
                            'y': kp.y,
                            'confidence': kp.confidence
                        }
                        for name, kp in frame.keypoints.items()
                    },
                    'angles': frame.angles
                }
                for frame in self.frames
            ]
        }
```

## 5. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

**1.1 Real-time inference completes within 100ms**
Thoughts: This is a performance property that should hold for all frames on modern devices. We can test by running inference on random frames and measuring time.
Testable: yes - property

**1.2 Keypoints extracted with confidence > 0.5**
Thoughts: This is a quality property that should hold for all valid detections. We can test by running inference and checking confidence scores.
Testable: yes - property

**1.3 Angle calculation matches pre-computed mode**
Thoughts: This is a consistency property - same keypoints should produce same angles regardless of source. We can test with identical keypoint data.
Testable: yes - property

**1.4 Automatic fallback on performance degradation**
Thoughts: This is a resilience property. We can test by simulating slow inference and verifying fallback triggers.
Testable: yes - property

**2.1 Model export produces valid PTE file**
Thoughts: This is a validation property. We can test by exporting models and verifying file format.
Testable: yes - property

**2.2 Quantization maintains accuracy within 5%**
Thoughts: This is an accuracy property. We can test by comparing quantized vs non-quantized outputs.
Testable: yes - property

**3.1 ExecuTorch produces same JSON format as TFLite**
Thoughts: This is a compatibility property. We can test by processing same video with both and comparing outputs.
Testable: yes - property

**4.1 Model loads successfully on both platforms**
Thoughts: This is a platform compatibility property. We can test on iOS and Android simulators.
Testable: yes - example (platform-specific)

**5.1 Mode selection persists across app restarts**
Thoughts: This is a persistence property. We can test by setting mode, restarting, and checking mode.
Testable: yes - property

**8.1 Pre-computed mode produces same scores as before**
Thoughts: This is a backward compatibility property. We can test with existing test data.
Testable: yes - property



### Correctness Properties

**Property 1: Inference Performance**
*For any* modern mobile device (2020+), when running real-time pose detection, inference latency SHALL be less than 100ms for 95% of frames
**Validates: Requirements 1.2, 6.1, 6.2**

**Property 2: Keypoint Quality**
*For any* detected pose, all keypoints with confidence > 0.5 SHALL have normalized coordinates in range [0, 1]
**Validates: Requirements 1.3**

**Property 3: Angle Calculation Consistency**
*For any* set of keypoints, calculating angles SHALL produce identical results regardless of whether keypoints came from real-time or pre-computed detection
**Validates: Requirements 1.4, 8.2**

**Property 4: Automatic Fallback**
*For any* sequence of 10 consecutive inference failures, the system SHALL automatically switch to pre-computed mode within 3 seconds
**Validates: Requirements 1.5, 10.3**

**Property 5: Model Export Validity**
*For any* PyTorch pose model, exporting to ExecuTorch format SHALL produce a valid PTE file that can be loaded by ExecuTorch runtime
**Validates: Requirements 2.1**

**Property 6: Quantization Accuracy**
*For any* quantized model, the average keypoint position error compared to non-quantized model SHALL be less than 5%
**Validates: Requirements 2.3**

**Property 7: Model Size Constraint**
*For any* exported and quantized model, the file size SHALL be less than 10MB
**Validates: Requirements 2.2**

**Property 8: JSON Format Compatibility**
*For any* video processed with ExecuTorch, the output JSON format SHALL be identical to TFLite version (same schema, same fields)
**Validates: Requirements 3.2, 8.1**

**Property 9: Processing Speed Parity**
*For any* reference video, processing time with ExecuTorch SHALL be within 20% of TFLite processing time
**Validates: Requirements 3.4**

**Property 10: Cross-Platform Loading**
*For any* valid PTE model file, it SHALL load successfully on both iOS (CoreML) and Android (XNNPACK) platforms
**Validates: Requirements 4.1, 4.2**

**Property 11: Frame Preprocessing Correctness**
*For any* camera frame, preprocessing SHALL produce a tensor of shape [1, 3, 192, 192] with values in range [0, 1]
**Validates: Requirements 4.3**

**Property 12: Mode Persistence**
*For any* user-selected detection mode, the mode SHALL persist across app restarts and be restored on next launch
**Validates: Requirements 5.5**

**Property 13: Score Equivalence**
*For any* gameplay session, scores calculated using real-time detection SHALL be within 1% of scores using pre-computed detection for the same performance
**Validates: Requirements 8.3**

**Property 14: Memory Constraint**
*For any* inference session, memory usage increase SHALL not exceed 100MB above baseline
**Validates: Requirements 6.4**

**Property 15: Error Recovery**
*For any* inference error, the system SHALL log the error, skip the frame, and continue processing the next frame without crashing
**Validates: Requirements 10.2**

## 6. Testing Strategy

### 6.1 Unit Testing

**ExecuTorch Service Tests**:
```typescript
describe('ExecuTorchService', () => {
  it('should load model successfully', async () => {
    const service = new ExecuTorchService();
    await expect(service.initialize('movenet.pte')).resolves.not.toThrow();
  });
  
  it('should detect pose from image', async () => {
    const service = new ExecuTorchService();
    await service.initialize('movenet.pte');
    
    const result = await service.detectPose(testImage);
    
    expect(result.keypoints).toHaveLength(17);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
  
  it('should measure inference time', async () => {
    const service = new ExecuTorchService();
    await service.initialize('movenet.pte');
    
    await service.detectPose(testImage);
    
    expect(service.getInferenceTime()).toBeLessThan(100);
  });
});
```

**Mode Manager Tests**:
```typescript
describe('DetectionModeManager', () => {
  it('should detect optimal mode based on device', async () => {
    const manager = new DetectionModeManager();
    await manager.initialize();
    
    const mode = await manager.detectOptimalMode();
    
    expect([DetectionMode.REAL_TIME, DetectionMode.PRE_COMPUTED])
      .toContain(mode);
  });
  
  it('should fallback on repeated failures', async () => {
    const manager = new DetectionModeManager();
    await manager.initialize();
    
    // Simulate 10 failures
    for (let i = 0; i < 10; i++) {
      manager.recordFailure();
    }
    
    expect(manager.getCurrentMode()).toBe(DetectionMode.PRE_COMPUTED);
  });
});
```

### 6.2 Property-Based Testing

**Property Test: Angle Calculation Consistency**
```typescript
import fc from 'fast-check';

describe('Property: Angle Calculation Consistency', () => {
  it('should produce same angles for same keypoints regardless of source', () => {
    fc.assert(
      fc.property(
        fc.record({
          leftShoulder: fc.record({ x: fc.float(), y: fc.float(), confidence: fc.float() }),
          leftElbow: fc.record({ x: fc.float(), y: fc.float(), confidence: fc.float() }),
          leftWrist: fc.record({ x: fc.float(), y: fc.float(), confidence: fc.float() }),
          // ... other keypoints
        }),
        (keypoints) => {
          const anglesFromRealTime = calculateAngles(keypoints);
          const anglesFromPrecomputed = calculateAngles(keypoints);
          
          expect(anglesFromRealTime).toEqual(anglesFromPrecomputed);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property Test: Inference Performance**
```typescript
describe('Property: Inference Performance', () => {
  it('should complete inference within 100ms for 95% of frames', async () => {
    const service = new ExecuTorchService();
    await service.initialize('movenet.pte');
    
    const latencies: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await service.detectPose(generateRandomImage());
      const latency = performance.now() - start;
      latencies.push(latency);
    }
    
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    
    expect(p95).toBeLessThan(100);
  });
});
```

### 6.3 Integration Testing

**End-to-End Real-Time Detection**:
```typescript
describe('Integration: Real-Time Detection Flow', () => {
  it('should detect poses in real-time during gameplay', async () => {
    const gameStore = useGameStore.getState();
    const poseService = new UnifiedPoseDetectionService();
    
    await poseService.initialize(DetectionMode.REAL_TIME);
    await gameStore.startGame('cheapthrills');
    
    // Simulate camera frames
    for (let i = 0; i < 30; i++) {
      const frame = captureFrame();
      const pose = await poseService.detectPose({
        type: 'camera',
        imageData: frame
      });
      
      expect(pose.source).toBe('real-time');
      expect(pose.confidence).toBeGreaterThan(0.5);
    }
  });
});
```

### 6.4 Python Tool Testing

**Model Export Tests**:
```python
def test_model_export():
    """Test PyTorch to ExecuTorch export."""
    export_movenet_to_executorch(
        model_path='test_model.pt',
        output_path='test_output.pte',
        quantize=True
    )
    
    assert Path('test_output.pte').exists()
    assert Path('test_output.pte').stat().st_size < 10 * 1024 * 1024  # <10MB

def test_json_format_compatibility():
    """Test ExecuTorch produces same JSON as TFLite."""
    et_preprocessor = ExecuTorchVideoPreprocessor('movenet.pte')
    et_output = et_preprocessor.process_video('test_video.mp4', 'et_output.json')
    
    tflite_output = load_json('tflite_output.json')
    
    # Compare schemas
    assert et_output.keys() == tflite_output.keys()
    assert et_output['frames'][0].keys() == tflite_output['frames'][0].keys()
```

## 7. Performance Optimization

### 7.1 Model Optimization

**Quantization Strategy**:
- Use INT8 quantization for weights
- Use dynamic quantization for activations
- Target 3-5x size reduction with <5% accuracy loss

**Delegate Selection**:
- iOS: CoreML for Apple Neural Engine
- Android: XNNPACK for ARM NEON
- Fallback: CPU-only inference

### 7.2 Runtime Optimization

**Frame Sampling**:
```typescript
class AdaptiveFrameSampler {
  private targetFPS = 20;
  private currentFPS = 0;
  
  shouldProcessFrame(): boolean {
    if (this.currentFPS < this.targetFPS) {
      return true;
    }
    
    // Skip frames if running too fast
    return Math.random() < (this.targetFPS / this.currentFPS);
  }
  
  updateFPS(fps: number) {
    this.currentFPS = fps;
  }
}
```

**Memory Management**:
```typescript
class MemoryManager {
  private readonly MAX_MEMORY_MB = 200;
  
  async checkMemoryPressure(): Promise<boolean> {
    const usage = await getMemoryUsage();
    return usage > this.MAX_MEMORY_MB;
  }
  
  async handleMemoryPressure() {
    // Reduce inference frequency
    // Clear caches
    // Switch to pre-computed mode if needed
  }
}
```

## 8. Deployment Strategy

### 8.1 Phased Rollout

**Phase 1: Internal Testing (Week 1)**
- Deploy to internal test devices
- Validate performance metrics
- Fix critical bugs

**Phase 2: Beta Testing (Week 2)**
- Release to beta testers (10-20 users)
- Collect performance data
- Monitor crash rates

**Phase 3: Gradual Rollout (Week 3)**
- 10% of users with real-time mode enabled
- Monitor metrics and feedback
- Increase to 50% if stable

**Phase 4: Full Release (Week 4)**
- 100% of users with real-time mode available
- Pre-computed mode as fallback
- Continuous monitoring

### 8.2 Feature Flags

```typescript
interface FeatureFlags {
  enableRealTimeDetection: boolean;
  enableAutoModeSelection: boolean;
  enablePerformanceLogging: boolean;
  minDeviceYear: number;  // Only enable for devices 2020+
}

const featureFlags: FeatureFlags = {
  enableRealTimeDetection: true,
  enableAutoModeSelection: true,
  enablePerformanceLogging: __DEV__,
  minDeviceYear: 2020
};
```

## 9. Monitoring and Metrics

### 9.1 Key Metrics

**Performance Metrics**:
- Average inference latency (p50, p95, p99)
- Frames per second
- Memory usage
- Battery drain rate

**Quality Metrics**:
- Keypoint detection confidence
- Angle calculation accuracy
- Score equivalence (real-time vs pre-computed)

**Reliability Metrics**:
- Inference success rate
- Fallback trigger rate
- Crash rate during inference

### 9.2 Logging Strategy

```typescript
interface InferenceLog {
  timestamp: number;
  mode: DetectionMode;
  latency: number;
  confidence: number;
  success: boolean;
  error?: string;
}

class PerformanceLogger {
  private logs: InferenceLog[] = [];
  
  logInference(log: InferenceLog) {
    this.logs.push(log);
    
    if (this.logs.length > 1000) {
      this.flush();
    }
  }
  
  async flush() {
    // Send logs to analytics service
    // Clear local logs
  }
}
```

---

**Version**: 1.0.0
**Status**: Ready for Implementation
**Properties Defined**: 15 correctness properties
**Last Updated**: November 27, 2025
