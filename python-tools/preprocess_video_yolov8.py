#!/usr/bin/env python3
"""
Video Preprocessing Tool for Bachata Bro (YOLOv8s-pose Version)

Extracts pose data from reference videos using YOLOv8s-pose and saves as JSON files.
This replaces the older MobileNetV3-based model with YOLOv8s-pose for improved accuracy.

YOLOv8s-pose improvements:
- 64.0 AP on COCO (vs ~50-55 for MobileNetV3-based)
- Purpose-built pose estimation model
- Better handling of occlusions and varied poses
- Same 17 COCO keypoints output format
"""

import cv2
import json
import numpy as np
import torch
from pathlib import Path
from typing import Dict, List, Optional
import argparse
from tqdm import tqdm


# COCO keypoint names (17 keypoints)
KEYPOINT_NAMES = [
    'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
    'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
    'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
]


class YOLOv8PoseDetector:
    """Pose detector using YOLOv8s-pose model."""
    
    INPUT_SIZE = 256
    
    def __init__(self, model_name: str = 'yolov8s-pose.pt', device: str = 'auto'):
        """
        Initialize YOLOv8s-pose detector.
        
        Args:
            model_name: Model name or path (default: yolov8s-pose.pt)
            device: Device to run on ('auto', 'cpu', 'cuda', 'mps')
        """
        try:
            from ultralytics import YOLO
        except ImportError:
            raise ImportError(
                "ultralytics package not found. Install with: pip install ultralytics"
            )
        
        # Determine device
        if device == 'auto':
            if torch.cuda.is_available():
                self.device = 'cuda'
            elif torch.backends.mps.is_available():
                self.device = 'mps'
            else:
                self.device = 'cpu'
        else:
            self.device = device
        
        print(f"Loading YOLOv8s-pose model on {self.device}...")
        self.model = YOLO(model_name)
        self.model.to(self.device)
        print(f"✓ Loaded YOLOv8s-pose model")
    
    def detect_pose(self, frame: np.ndarray) -> Dict[str, Dict[str, float]]:
        """
        Detect pose keypoints from a frame.
        
        Args:
            frame: Input frame (BGR format from OpenCV)
            
        Returns:
            Dictionary of keypoint names to {x, y, confidence} dicts
        """
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Run inference with YOLOv8
        results = self.model(frame_rgb, verbose=False)
        
        # Parse results
        keypoints = self._parse_results(results, frame.shape[:2])
        
        return keypoints
    
    def _parse_results(
        self, 
        results, 
        original_shape: tuple
    ) -> Dict[str, Dict[str, float]]:
        """
        Parse YOLOv8 results to keypoint dictionary.
        
        Args:
            results: YOLOv8 inference results
            original_shape: Original frame shape (height, width)
            
        Returns:
            Dictionary mapping keypoint names to {x, y, confidence}
        """
        keypoints = {}
        orig_h, orig_w = original_shape
        
        # Initialize with zero confidence
        for name in KEYPOINT_NAMES:
            keypoints[name] = {'x': 0.0, 'y': 0.0, 'confidence': 0.0}
        
        # Check if any detections
        if len(results) == 0 or results[0].keypoints is None:
            return keypoints
        
        result = results[0]
        
        # Get keypoints data
        if result.keypoints.data.shape[0] == 0:
            return keypoints
        
        # Get the detection with highest confidence
        if result.boxes is not None and len(result.boxes) > 0:
            confidences = result.boxes.conf
            best_idx = confidences.argmax().item()
        else:
            best_idx = 0
        
        # Extract keypoints for best detection
        kpts_data = result.keypoints.data[best_idx].cpu().numpy()  # [17, 3]
        
        for i, name in enumerate(KEYPOINT_NAMES):
            if i < len(kpts_data):
                x, y, conf = kpts_data[i]
                # Normalize to [0, 1]
                keypoints[name] = {
                    'x': float(x / orig_w),
                    'y': float(y / orig_h),
                    'confidence': float(conf)
                }
        
        return keypoints


def calculate_angle(p1: Dict, p2: Dict, p3: Dict, min_confidence: float = 0.3) -> float:
    """
    Calculate angle between three points.
    
    Args:
        p1, p2, p3: Points with 'x', 'y', 'confidence' keys
        min_confidence: Minimum confidence threshold (default 0.3 for better coverage)
        
    Returns:
        Angle in degrees
    """
    # Lower threshold to 0.3 to capture more poses, especially wrists
    if not all(p['confidence'] > min_confidence for p in [p1, p2, p3]):
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
    
    Uses the SAME algorithm as previous versions to ensure
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
    output_path: str,
    model_name: str = 'yolov8s-pose.pt',
    device: str = 'auto',
    progress_callback=None
) -> None:
    """
    Extract pose data from video and save as JSON.
    
    Args:
        video_path: Path to input video
        output_path: Path to save JSON output
        model_name: YOLOv8 model name or path
        device: Device to run on
        progress_callback: Optional callback for progress updates
    """
    # Load model
    detector = YOLOv8PoseDetector(model_name, device)
    
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
                # Add empty frame data
                frames_data.append({
                    "frameNumber": frame_num,
                    "timestamp": frame_num / fps,
                    "keypoints": {name: {'x': 0, 'y': 0, 'confidence': 0} for name in KEYPOINT_NAMES},
                    "angles": {}
                })
            
            frame_num += 1
            pbar.update(1)
            
            # Progress callback
            if progress_callback and frame_num % 10 == 0:
                progress_callback(frame_num, total_frames)
    
    cap.release()
    
    # Prepare output (SAME FORMAT as previous versions)
    song_id = Path(video_path).stem
    output = {
        "songId": song_id,
        "fps": fps,
        "totalFrames": frame_num,
        "modelVersion": "yolov8s-pose",
        "modelAccuracy": "64.0 AP (COCO)",
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
    print(f"✓ Using YOLOv8s-pose (64.0 AP) for improved accuracy")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Extract pose data from dance videos using YOLOv8s-pose'
    )
    parser.add_argument(
        'video',
        help='Path to input video file'
    )
    parser.add_argument(
        '--model',
        default='yolov8s-pose.pt',
        help='YOLOv8 model name or path (default: yolov8s-pose.pt)'
    )
    parser.add_argument(
        '--output',
        default='../mobile/assets/poses/',
        help='Output directory for JSON files'
    )
    parser.add_argument(
        '--device',
        default='auto',
        choices=['auto', 'cpu', 'cuda', 'mps'],
        help='Device to run inference on'
    )
    
    args = parser.parse_args()
    
    # Determine output path
    video_path = Path(args.video)
    output_dir = Path(args.output)
    output_file = output_dir / f"{video_path.stem}.json"
    
    # Process video
    extract_poses_from_video(
        str(video_path),
        str(output_file),
        model_name=args.model,
        device=args.device
    )


if __name__ == '__main__':
    main()
