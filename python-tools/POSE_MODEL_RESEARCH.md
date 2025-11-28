# PyTorch Pose Model Research

## Available Options

### 1. TorchVision KeypointRCNN
- **Source**: Built into torchvision
- **Pros**: 
  - Native PyTorch implementation
  - Well-maintained
  - Pre-trained on COCO dataset
  - Outputs 17 keypoints (COCO format)
- **Cons**: 
  - Heavier model (~50MB)
  - Slower inference
- **Status**: ✓ Available

### 2. MoveNet (TensorFlow → PyTorch)
- **Source**: Google's MoveNet
- **Pros**: 
  - Lightweight and fast
  - Optimized for mobile
  - Good accuracy
- **Cons**: 
  - Requires conversion from TensorFlow
  - May lose some optimization
- **Status**: Requires conversion

### 3. MediaPipe Pose
- **Source**: Google MediaPipe
- **Pros**: 
  - Very fast
  - Mobile-optimized
- **Cons**: 
  - Primarily TFLite/ONNX
  - Limited PyTorch support
- **Status**: Not ideal for PyTorch

### 4. Lightweight OpenPose
- **Source**: Community implementations
- **Pros**: 
  - Good accuracy
  - Multiple implementations available
- **Cons**: 
  - Heavier than MoveNet
  - May need optimization
- **Status**: Available but heavier

## Recommendation

**Use TorchVision KeypointRCNN for initial implementation**

Reasons:
1. Native PyTorch - no conversion needed
2. Outputs 17 keypoints in COCO format (matches requirements)
3. Pre-trained and ready to use
4. Can be quantized and optimized for ExecuTorch
5. Well-documented and maintained

## COCO Keypoint Format (17 keypoints)

0. nose
1. left_eye
2. right_eye
3. left_ear
4. right_ear
5. left_shoulder
6. right_shoulder
7. left_elbow
8. right_elbow
9. left_wrist
10. right_wrist
11. left_hip
12. right_hip
13. left_knee
14. right_knee
15. left_ankle
16. right_ankle

This matches the requirements perfectly!

## Next Steps

1. Download pre-trained KeypointRCNN model
2. Test inference on sample image
3. Verify 17 keypoint output
4. Prepare for ExecuTorch export
