#!/usr/bin/env python3
"""
YOLOv8s-Pose Model Wrapper for Bacha Trainer

This module provides a unified interface for YOLOv8s-pose that:
1. Works for both preprocessing (Python) and mobile (ExecuTorch)
2. Outputs 17 COCO keypoints in [B, 17, 3] format
3. Handles single-person detection (no NMS needed for our use case)

YOLOv8s-pose specs:
- Input: 256x256 RGB
- Output: 17 COCO keypoints with (x, y, confidence)
- Accuracy: 64.0 AP on COCO (vs ~50-55 for MobileNetV3-based)
- Size: ~23MB (FP32), ~6MB (INT8 quantized)
"""

import torch
import torch.nn as nn
from pathlib import Path
from typing import Dict, Optional, Tuple


class YOLOv8PoseWrapper(nn.Module):
    """
    Wrapper around YOLOv8s-pose that outputs a fixed [B, 17, 3] tensor.
    
    This wrapper:
    1. Loads the YOLOv8s-pose model
    2. Runs inference
    3. Extracts the highest-confidence person detection
    4. Returns keypoints in [B, 17, 3] format matching the old model interface
    
    This allows drop-in replacement of the old LightweightPoseModel.
    """
    
    # Input size for YOLOv8s-pose
    INPUT_SIZE = 256
    
    # COCO keypoint names (17 keypoints) - same order as before
    KEYPOINT_NAMES = [
        'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
        'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
        'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
        'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
    ]
    
    def __init__(self, pretrained: bool = True):
        """
        Initialize YOLOv8s-pose wrapper.
        
        Args:
            pretrained: Whether to load pretrained weights
        """
        super().__init__()
        
        # Load YOLOv8s-pose model
        try:
            from ultralytics import YOLO
            
            if pretrained:
                # Load pretrained YOLOv8s-pose
                self._yolo_model = YOLO('yolov8s-pose.pt')
                print("✓ Loaded pretrained YOLOv8s-pose model")
            else:
                # Load architecture only (for loading custom weights)
                self._yolo_model = YOLO('yolov8s-pose.yaml')
                print("✓ Created YOLOv8s-pose architecture (no weights)")
                
        except ImportError:
            raise ImportError(
                "ultralytics package not found. Install with: pip install ultralytics"
            )
        
        # Extract the PyTorch model for direct inference
        self.model = self._yolo_model.model
        self.model.eval()
        
        # Store model info
        self.input_size = self.INPUT_SIZE
        self.num_keypoints = 17
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass - returns keypoints in [B, 17, 3] format.
        
        Args:
            x: Input tensor of shape [B, 3, 256, 256], normalized to [0, 1]
            
        Returns:
            Keypoints tensor of shape [B, 17, 3] where each keypoint has (x, y, confidence)
            Coordinates are normalized to [0, 1]
        """
        batch_size = x.shape[0]
        device = x.device
        
        # YOLOv8 expects input in [0, 1] range - already normalized
        # Run YOLO model
        with torch.no_grad():
            # Get raw predictions
            preds = self.model(x)
        
        # Process predictions to extract keypoints
        keypoints = self._extract_keypoints(preds, batch_size, device)
        
        return keypoints
    
    def _extract_keypoints(
        self, 
        preds: torch.Tensor, 
        batch_size: int,
        device: torch.device
    ) -> torch.Tensor:
        """
        Extract keypoints from YOLOv8 predictions.
        
        YOLOv8-pose output format:
        - preds[0] shape: [B, 56, num_anchors] where 56 = 4 (bbox) + 1 (conf) + 51 (17*3 keypoints)
        
        Args:
            preds: Raw model predictions
            batch_size: Batch size
            device: Target device
            
        Returns:
            Keypoints tensor [B, 17, 3]
        """
        # Initialize output tensor
        keypoints_out = torch.zeros(batch_size, 17, 3, device=device)
        
        # Handle different prediction formats
        if isinstance(preds, (list, tuple)):
            pred = preds[0]
        else:
            pred = preds
            
        # pred shape: [B, 56, num_anchors]
        # Transpose to [B, num_anchors, 56]
        if pred.dim() == 3 and pred.shape[1] == 56:
            pred = pred.transpose(1, 2)
        
        for b in range(batch_size):
            batch_pred = pred[b]  # [num_anchors, 56]
            
            if batch_pred.shape[-1] >= 56:
                # Extract confidence scores (index 4)
                confidences = batch_pred[:, 4]
                
                # Get highest confidence detection
                best_idx = confidences.argmax()
                best_det = batch_pred[best_idx]
                
                # Extract keypoints (indices 5:56 = 51 values = 17 keypoints * 3)
                kpts = best_det[5:56].reshape(17, 3)
                
                # Normalize coordinates to [0, 1] (they're in pixel coords relative to input size)
                kpts[:, 0] = kpts[:, 0] / self.INPUT_SIZE  # x
                kpts[:, 1] = kpts[:, 1] / self.INPUT_SIZE  # y
                # confidence is already in [0, 1]
                
                # Clamp to valid range
                kpts[:, :2] = torch.clamp(kpts[:, :2], 0.0, 1.0)
                kpts[:, 2] = torch.clamp(kpts[:, 2], 0.0, 1.0)
                
                keypoints_out[b] = kpts
        
        return keypoints_out
    
    def detect_from_numpy(self, frame_rgb: 'np.ndarray') -> Dict[str, Dict[str, float]]:
        """
        Convenience method for preprocessing - detect pose from numpy array.
        
        Args:
            frame_rgb: RGB image as numpy array, any size
            
        Returns:
            Dictionary of keypoint names to {x, y, confidence} dicts
        """
        import numpy as np
        import cv2
        
        # Resize to model input size
        resized = cv2.resize(frame_rgb, (self.INPUT_SIZE, self.INPUT_SIZE))
        
        # Normalize to [0, 1]
        normalized = resized.astype(np.float32) / 255.0
        
        # Convert to tensor [1, 3, H, W]
        tensor = torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0)
        
        # Run inference
        with torch.no_grad():
            keypoints = self.forward(tensor)
        
        # Convert to dictionary format
        keypoints_np = keypoints[0].cpu().numpy()  # [17, 3]
        
        result = {}
        for i, name in enumerate(self.KEYPOINT_NAMES):
            x, y, conf = keypoints_np[i]
            result[name] = {
                'x': float(x),
                'y': float(y),
                'confidence': float(conf)
            }
        
        return result


class YOLOv8PoseExportable(nn.Module):
    """
    Simplified YOLOv8s-pose model for ExecuTorch export.
    
    This version:
    1. Has a cleaner forward pass without dynamic operations
    2. Returns fixed-size output [B, 17, 3]
    3. Is optimized for torch.export compatibility
    """
    
    INPUT_SIZE = 256
    
    def __init__(self):
        super().__init__()
        
        # Load YOLOv8s-pose backbone and head
        from ultralytics import YOLO
        yolo = YOLO('yolov8s-pose.pt')
        
        # Extract the model
        self.backbone = yolo.model.model[:10]  # Backbone layers
        self.neck = yolo.model.model[10:22]    # Neck/FPN layers  
        self.head = yolo.model.model[22:]      # Detection head
        
        # Store full model for reference
        self._full_model = yolo.model
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass optimized for export.
        
        Args:
            x: Input tensor [B, 3, 256, 256]
            
        Returns:
            Keypoints [B, 17, 3]
        """
        # Run full model
        pred = self._full_model(x)
        
        # pred[0] shape: [B, 56, num_anchors]
        if isinstance(pred, (list, tuple)):
            pred = pred[0]
        
        # Transpose to [B, num_anchors, 56]
        pred = pred.transpose(1, 2)
        
        batch_size = x.shape[0]
        
        # Get best detection per batch (highest confidence)
        confidences = pred[:, :, 4]  # [B, num_anchors]
        best_indices = confidences.argmax(dim=1)  # [B]
        
        # Gather best detections
        batch_indices = torch.arange(batch_size, device=x.device)
        best_dets = pred[batch_indices, best_indices]  # [B, 56]
        
        # Extract keypoints (indices 5:56)
        kpts = best_dets[:, 5:56].reshape(batch_size, 17, 3)
        
        # Normalize coordinates
        kpts[:, :, 0] = kpts[:, :, 0] / self.INPUT_SIZE
        kpts[:, :, 1] = kpts[:, :, 1] / self.INPUT_SIZE
        
        # Clamp to valid range
        kpts = torch.clamp(kpts, 0.0, 1.0)
        
        return kpts


def create_and_save_model(output_path: str = "models/yolov8s_pose.pt") -> None:
    """
    Download and save YOLOv8s-pose model.
    
    Args:
        output_path: Path to save the model
    """
    print("Creating YOLOv8s-pose model...")
    
    # Create wrapper model
    model = YOLOv8PoseWrapper(pretrained=True)
    model.eval()
    
    print(f"✓ Model created successfully")
    print(f"  Model type: YOLOv8s-pose")
    print(f"  Input size: {model.INPUT_SIZE}x{model.INPUT_SIZE}")
    print(f"  Output: 17 COCO keypoints")
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Total parameters: {total_params:,}")
    
    # Create output directory
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save model state dict
    torch.save(model.state_dict(), output_path)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Model saved to {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    
    return model


def test_model(model_path: str = "models/yolov8s_pose.pt") -> None:
    """
    Test the YOLOv8s-pose model with dummy input.
    """
    print("\nTesting model...")
    
    # Create model
    model = YOLOv8PoseWrapper(pretrained=True)
    model.eval()
    
    # Create dummy input (256x256 RGB image)
    dummy_input = torch.rand(1, 3, 256, 256)
    
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
    else:
        print(f"✗ Unexpected output shape!")
    
    return output


if __name__ == "__main__":
    # Create and test model
    model = create_and_save_model()
    test_model()
    
    print("\n✓ YOLOv8s-pose model setup complete!")
    print("  Next steps:")
    print("    1. Run preprocessing with: python preprocess_video_yolov8.py <video>")
    print("    2. Export to ExecuTorch with: python export_model_yolov8.py")
