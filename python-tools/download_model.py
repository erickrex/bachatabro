#!/usr/bin/env python3
"""
Download and prepare PyTorch pose estimation model.

This script downloads a pre-trained KeypointRCNN model from torchvision
and saves it for later export to ExecuTorch format.
"""

import torch
import torchvision
from pathlib import Path


def download_pose_model(output_path: str = "models/keypoint_rcnn_state.pt") -> None:
    """
    Download pre-trained KeypointRCNN model.
    
    Args:
        output_path: Path to save the model state dict
    """
    print("Downloading KeypointRCNN model from torchvision...")
    
    # Load pre-trained model
    model = torchvision.models.detection.keypointrcnn_resnet50_fpn(
        weights=torchvision.models.detection.KeypointRCNN_ResNet50_FPN_Weights.DEFAULT
    )
    model.eval()
    
    print(f"✓ Model loaded successfully")
    print(f"  Model type: {type(model).__name__}")
    
    # Create output directory
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save model state dict (weights only)
    torch.save(model.state_dict(), output_path)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Model state dict saved to {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    print(f"  Note: This is still large. Will need quantization for mobile deployment.")
    
    return model


def test_model(model_path: str = "models/keypoint_rcnn_state.pt") -> None:
    """
    Test the downloaded model with a dummy input.
    
    Args:
        model_path: Path to the saved model state dict
    """
    print("\nTesting model...")
    
    # Recreate model architecture
    model = torchvision.models.detection.keypointrcnn_resnet50_fpn(
        weights=None  # Don't download weights again
    )
    
    # Load saved weights
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()
    
    # Create dummy input (3x256x256 RGB image)
    dummy_input = torch.rand(1, 3, 256, 256)
    
    # Run inference
    with torch.no_grad():
        output = model([dummy_input[0]])
    
    print(f"✓ Model inference successful")
    print(f"  Output type: {type(output)}")
    print(f"  Number of detections: {len(output)}")
    
    if len(output) > 0 and 'keypoints' in output[0]:
        keypoints = output[0]['keypoints']
        print(f"  Keypoints shape: {keypoints.shape}")
        print(f"  Expected: [N, 17, 3] where N is number of detected people")
        
        if keypoints.shape[1] == 17:
            print(f"✓ Model outputs 17 keypoints as required!")
        else:
            print(f"✗ Warning: Model outputs {keypoints.shape[1]} keypoints, expected 17")
    
    return output


if __name__ == "__main__":
    # Download model
    model = download_pose_model()
    
    # Test model
    test_model()
    
    print("\n✓ Model download and testing complete!")
    print("  Next step: Export to ExecuTorch format")
