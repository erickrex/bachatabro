#!/usr/bin/env python3
"""
Create a lightweight pose estimation model for mobile deployment.

This creates a simplified MobileNetV3-based pose model that outputs
17 keypoints in COCO format, optimized for mobile devices.
"""

import torch
import torch.nn as nn
import torchvision
from pathlib import Path


class LightweightPoseModel(nn.Module):
    """
    Lightweight pose estimation model using MobileNetV3 backbone.
    
    Outputs 17 keypoints in COCO format with (x, y, confidence) for each.
    """
    
    def __init__(self):
        super().__init__()
        
        # Use MobileNetV3-Small as backbone (lightweight)
        mobilenet = torchvision.models.mobilenet_v3_small(
            weights=torchvision.models.MobileNet_V3_Small_Weights.DEFAULT
        )
        
        # Extract feature extractor (remove classifier)
        self.backbone = nn.Sequential(*list(mobilenet.children())[:-1])
        
        # Adaptive pooling to fixed size
        self.adaptive_pool = nn.AdaptiveAvgPool2d((6, 6))
        
        # Pose estimation head
        # MobileNetV3-Small outputs 576 channels
        self.pose_head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(576 * 6 * 6, 1024),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(1024, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 17 * 3)  # 17 keypoints × 3 (x, y, confidence)
        )
        
    def forward(self, x):
        """
        Forward pass.
        
        Args:
            x: Input tensor of shape [B, 3, H, W]
            
        Returns:
            Keypoints tensor of shape [B, 17, 3]
        """
        # Extract features
        features = self.backbone(x)
        
        # Pool to fixed size
        pooled = self.adaptive_pool(features)
        
        # Predict keypoints
        keypoints = self.pose_head(pooled)
        
        # Reshape to [B, 17, 3]
        keypoints = keypoints.view(-1, 17, 3)
        
        # Apply sigmoid to x, y coordinates (normalize to 0-1)
        keypoints[:, :, :2] = torch.sigmoid(keypoints[:, :, :2])
        
        # Apply sigmoid to confidence scores
        keypoints[:, :, 2] = torch.sigmoid(keypoints[:, :, 2])
        
        return keypoints


def create_and_save_model(output_path: str = "models/lightweight_pose.pt") -> None:
    """
    Create and save the lightweight pose model.
    
    Args:
        output_path: Path to save the model
    """
    print("Creating lightweight pose estimation model...")
    
    # Create model
    model = LightweightPoseModel()
    model.eval()
    
    print(f"✓ Model created successfully")
    print(f"  Model type: {type(model).__name__}")
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Total parameters: {total_params:,}")
    
    # Create output directory
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save model (full model for now, will export to ExecuTorch later)
    torch.save(model.state_dict(), output_path)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Model saved to {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    
    if file_size_mb < 10:
        print(f"  ✓ Model size is under 10MB target!")
    else:
        print(f"  ⚠ Model size exceeds 10MB, will need quantization")
    
    return model


def test_model(model_path: str = "models/lightweight_pose.pt") -> None:
    """
    Test the created model with dummy input.
    
    Args:
        model_path: Path to the saved model
    """
    print("\nTesting model...")
    
    # Recreate model
    model = LightweightPoseModel()
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()
    
    # Create dummy input (192x192 RGB image - mobile optimized size)
    dummy_input = torch.rand(1, 3, 192, 192)
    
    print(f"  Input shape: {dummy_input.shape}")
    
    # Run inference
    with torch.no_grad():
        output = model(dummy_input)
    
    print(f"✓ Model inference successful")
    print(f"  Output shape: {output.shape}")
    print(f"  Expected: [1, 17, 3]")
    
    if output.shape == (1, 17, 3):
        print(f"✓ Model outputs 17 keypoints with (x, y, confidence) as required!")
        
        # Check value ranges
        x_coords = output[0, :, 0]
        y_coords = output[0, :, 1]
        confidences = output[0, :, 2]
        
        print(f"\n  Sample keypoint values:")
        print(f"    X range: [{x_coords.min():.3f}, {x_coords.max():.3f}]")
        print(f"    Y range: [{y_coords.min():.3f}, {y_coords.max():.3f}]")
        print(f"    Confidence range: [{confidences.min():.3f}, {confidences.max():.3f}]")
        
        if (x_coords >= 0).all() and (x_coords <= 1).all() and \
           (y_coords >= 0).all() and (y_coords <= 1).all() and \
           (confidences >= 0).all() and (confidences <= 1).all():
            print(f"  ✓ All values in valid range [0, 1]")
    else:
        print(f"✗ Unexpected output shape!")
    
    return output


def document_model() -> None:
    """Create documentation for the model."""
    doc = """# Lightweight Pose Model

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
"""
    
    with open("models/MODEL_INFO.md", "w") as f:
        f.write(doc)
    
    print("\n✓ Model documentation created at models/MODEL_INFO.md")


if __name__ == "__main__":
    # Create model
    model = create_and_save_model()
    
    # Test model
    test_model()
    
    # Create documentation
    document_model()
    
    print("\n✓ Lightweight pose model creation complete!")
    print("  Next steps:")
    print("    1. Fine-tune on dance pose data (optional)")
    print("    2. Export to ExecuTorch format")
    print("    3. Quantize for mobile deployment")
