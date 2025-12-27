#!/usr/bin/env python3
"""
Video Preprocessing Tool for Bachata Bro (ExecuTorch Version)
Extracts pose data from reference videos using ExecuTorch and saves as JSON files.

This replaces the TensorFlow Lite version with ExecuTorch for a unified PyTorch workflow.
"""

import cv2
import json
import numpy as np
import torch
from pathlib import Path
from typing import Dict, List, Tuple
import argparse
from tqdm import tqdm

from create_lightweight_model import LightweightPoseModel


class ExecuTorchPoseDetector:
    """Pose detector using ExecuTorch/PyTorch model."""
    
    def __init__(self, model_path: str, use_executorch: bool = False):
        """
        Initialize pose detector.
        
        Args:
            model_path: Path to model (.pt for PyTorch, .pte for ExecuTorch)
            use_executorch: Whether to use ExecuTorch runtime (requires mobile device)
        """
        self.use_executorch = use_executorch
        
        if use_executorch:
            # ExecuTorch runtime (for mobile/production)
            try:
                import executorch.extension.pybindings.portable_lib as exec_lib
                self.module = exec_lib._load_for_executorch(model_path)
                print(f"✓ Loaded ExecuTorch model from {model_path}")
            except Exception as e:
                print(f"⚠ Failed to load ExecuTorch model: {e}")
                print(f"  Falling back to PyTorch model")
                self.use_executorch = False
        
        if not use_executorch:
            # PyTorch model (for development/preprocessing)
            self.model = LightweightPoseModel()
            self.model.load_state_dict(torch.load(model_path, weights_only=True))
            self.model.eval()
            print(f"✓ Loaded PyTorch model from {model_path}")
    
    def detect_pose(self, frame: np.ndarray) -> Dict[str, Dict[str, float]]:
        """
        Detect pose keypoints from a frame.
        
        Args:
            frame: Input frame (BGR format from OpenCV)
            
        Returns:
            Dictionary of keypoint names to {x, y, confidence} dicts
        """
        # Preprocess frame
        input_tensor = self.preprocess_frame(frame)
        
        # Run inference
        if self.use_executorch:
            output = self.module.forward((input_tensor,))[0]
            if not isinstance(output, torch.Tensor):
                output = torch.tensor(output)
        else:
            with torch.no_grad():
                output = self.model(input_tensor)
        
        # Parse keypoints
        keypoints = self.parse_keypoints(output)
        
        return keypoints
    
    def preprocess_frame(self, frame: np.ndarray) -> torch.Tensor:
        """
        Preprocess frame for model input.
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            Preprocessed tensor [1, 3, 192, 192]
        """
        # Resize to 192x192
        resized = cv2.resize(frame, (192, 192))
        
        # Convert BGR to RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        # Normalize to [0, 1]
        normalized = rgb.astype(np.float32) / 255.0
        
        # Convert to tensor and add batch dimension
        tensor = torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0)
        
        return tensor
    
    def parse_keypoints(self, output: torch.Tensor) -> Dict[str, Dict[str, float]]:
        """
        Parse model output to keypoint dictionary.
        
        Args:
            output: Model output tensor [1, 17, 3]
            
        Returns:
            Dictionary mapping keypoint names to {x, y, confidence}
        """
        # COCO keypoint names (17 keypoints)
        keypoint_names = [
            'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
            'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
            'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
            'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
        ]
        
        keypoints = {}
        output_np = output[0].cpu().numpy()  # [17, 3]
        
        for i, name in enumerate(keypoint_names):
            x, y, confidence = output_np[i]
            keypoints[name] = {
                'x': float(x),
                'y': float(y),
                'confidence': float(confidence)
            }
        
        return keypoints


def calculate_angle(p1: Dict, p2: Dict, p3: Dict) -> float:
    """
    Calculate angle between three points.
    
    Args:
        p1, p2, p3: Points with 'x', 'y', 'confidence' keys
        
    Returns:
        Angle in degrees
    """
    if not all(p['confidence'] > 0.5 for p in [p1, p2, p3]):
        return 0.0
    
    # Calculate vectors
    v1 = np.array([p1['x'] - p2['x'], p1['y'] - p2['y']])
    v2 = np.array([p3['x'] - p2['x'], p3['y'] - p2['y']])
    
    # Calculate angle
    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
    angle = np.arccos(np.clip(cos_angle, -1.0, 1.0))
    
    return float(np.degrees(angle))


def calculate_angles(keypoints: Dict) -> Dict[str, float]:
    """
    Calculate joint angles from keypoints.
    
    This uses the SAME algorithm as the TFLite version to ensure
    backward compatibility and equivalent results.
    
    Args:
        keypoints: Dictionary of keypoint positions
        
    Returns:
        Dictionary of joint angles
    """
    angles = {}
    
    # Left arm angle (shoulder-elbow-wrist)
    if all(k in keypoints for k in ['leftShoulder', 'leftElbow', 'leftWrist']):
        angles['leftArm'] = calculate_angle(
            keypoints['leftShoulder'],
            keypoints['leftElbow'],
            keypoints['leftWrist']
        )
    
    # Right arm angle
    if all(k in keypoints for k in ['rightShoulder', 'rightElbow', 'rightWrist']):
        angles['rightArm'] = calculate_angle(
            keypoints['rightShoulder'],
            keypoints['rightElbow'],
            keypoints['rightWrist']
        )
    
    # Left elbow angle (same as arm angle)
    angles['leftElbow'] = angles.get('leftArm', 0.0)
    
    # Right elbow angle
    angles['rightElbow'] = angles.get('rightArm', 0.0)
    
    # Left thigh angle (hip-knee-ankle)
    if all(k in keypoints for k in ['leftHip', 'leftKnee', 'leftAnkle']):
        angles['leftThigh'] = calculate_angle(
            keypoints['leftHip'],
            keypoints['leftKnee'],
            keypoints['leftAnkle']
        )
    
    # Right thigh angle
    if all(k in keypoints for k in ['rightHip', 'rightKnee', 'rightAnkle']):
        angles['rightThigh'] = calculate_angle(
            keypoints['rightHip'],
            keypoints['rightKnee'],
            keypoints['rightAnkle']
        )
    
    # Left leg angle (same as thigh)
    angles['leftLeg'] = angles.get('leftThigh', 0.0)
    
    # Right leg angle
    angles['rightLeg'] = angles.get('rightThigh', 0.0)
    
    return angles


def extract_poses_from_video(
    video_path: str,
    model_path: str,
    output_path: str,
    use_executorch: bool = False,
    progress_callback=None
) -> None:
    """
    Extract pose data from video and save as JSON.
    
    Args:
        video_path: Path to input video
        model_path: Path to model file
        output_path: Path to save JSON output
        use_executorch: Whether to use ExecuTorch runtime
        progress_callback: Optional callback for progress updates
    """
    # Load model
    print(f"Loading model from {model_path}...")
    detector = ExecuTorchPoseDetector(model_path, use_executorch)
    
    # Open video
    print(f"Processing video: {video_path}")
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video info: {total_frames} frames at {fps} fps")
    
    frames_data = []
    frame_num = 0
    
    # Progress bar
    with tqdm(total=total_frames, desc="Processing frames", unit="frame") as pbar:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            try:
                # Detect pose
                keypoints = detector.detect_pose(frame)
                angles = calculate_angles(keypoints)
                
                frames_data.append({
                    "frameNumber": frame_num,
                    "timestamp": frame_num / fps,
                    "keypoints": keypoints,
                    "angles": angles
                })
            except Exception as e:
                print(f"\n⚠ Error processing frame {frame_num}: {e}")
                # Continue with next frame
            
            frame_num += 1
            pbar.update(1)
            
            # Progress callback
            if progress_callback and frame_num % 10 == 0:
                progress_callback(frame_num, total_frames)
    
    cap.release()
    
    # Prepare output (SAME FORMAT as TFLite version)
    song_id = Path(video_path).stem
    output = {
        "songId": song_id,
        "fps": fps,
        "totalFrames": frame_num,
        "frames": frames_data
    }
    
    # Save JSON
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Saving pose data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✓ Successfully processed {frame_num} frames")
    print(f"✓ Output saved to {output_file}")
    print(f"✓ JSON format matches TFLite version for backward compatibility")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Extract pose data from dance videos using ExecuTorch'
    )
    parser.add_argument(
        'video',
        help='Path to input video file'
    )
    parser.add_argument(
        '--model',
        default='models/lightweight_pose.pt',
        help='Path to model file (.pt for PyTorch, .pte for ExecuTorch)'
    )
    parser.add_argument(
        '--output',
        default='../mobile/assets/poses/',
        help='Output directory for JSON files'
    )
    parser.add_argument(
        '--executorch',
        action='store_true',
        help='Use ExecuTorch runtime (requires .pte model)'
    )
    
    args = parser.parse_args()
    
    # Determine output path
    video_path = Path(args.video)
    output_dir = Path(args.output)
    output_file = output_dir / f"{video_path.stem}.json"
    
    # Process video
    extract_poses_from_video(
        str(video_path),
        args.model,
        str(output_file),
        use_executorch=args.executorch
    )


if __name__ == '__main__':
    main()
