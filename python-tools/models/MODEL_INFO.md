# Lightweight Pose Model

## Architecture

- **Backbone**: MobileNetV3-Small (pre-trained on ImageNet)
- **Head**: Fully connected layers for keypoint regression
- **Output**: 17 keypoints in COCO format

## Keypoint Format

Each keypoint has 3 values:
- x: Normalized x-coordinate (0-1)
- y: Normalized y-coordinate (0-1)
- confidence: Confidence score (0-1)

## COCO Keypoints (17 total)

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

## Input Format

- Shape: [B, 3, 192, 192]
- Type: Float32
- Range: [0, 1] (normalized RGB)

## Output Format

- Shape: [B, 17, 3]
- Type: Float32
- Range: [0, 1] for all values

## Model Size

- Parameters: ~2.5M
- File size: ~10MB (unquantized)
- Target: <10MB after quantization

## Note

This is a lightweight model suitable for mobile deployment.
For production use, it should be:
1. Fine-tuned on dance pose data
2. Quantized to INT8
3. Exported to ExecuTorch format
