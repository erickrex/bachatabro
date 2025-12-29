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


def calculate_angle(p1: Dict, p2: Dict, p3: Dict) -> float:
    """
    Calculate angle between three points regardless of confidence.
    """
    v1 = np.array([p1['x'] - p2['x'], p1['y'] - p2['y']])
    v2 = np.array([p3['x'] - p2['x'], p3['y'] - p2['y']])
    
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    cos_angle = np.dot(v1, v2) / (norm1 * norm2)
    angle = np.arccos(np.clip(cos_angle, -1.0, 1.0))
    
    return float(np.degrees(angle))


def joint_confidence(points: List[Dict]) -> float:
    """
    Calculate the minimum confidence across keypoints used for an angle.
    """
    if not points:
        return 0.0
    confidences = [float(p.get('confidence', 0.0)) for p in points]
    return float(min(confidences))


def calculate_angles(keypoints: Dict) -> tuple[Dict[str, float], Dict[str, float]]:
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
    angle_confidence = {}

    def set_angle(name: str, joints: List[str]):
        points = [keypoints[j] for j in joints if j in keypoints]
        if len(points) != 3:
            angle_confidence[name] = 0.0
            angles[name] = 0.0
            return

        confidence = joint_confidence(points)
        angle_confidence[name] = confidence
        if confidence == 0.0:
            angles[name] = 0.0
        else:
            angles[name] = calculate_angle(*points)

    set_angle('leftArm', ['leftShoulder', 'leftElbow', 'leftWrist'])
    angle_confidence['leftElbow'] = angle_confidence.get('leftArm', 0.0)
    angles['leftElbow'] = angles.get('leftArm', 0.0)

    set_angle('rightArm', ['rightShoulder', 'rightElbow', 'rightWrist'])
    angle_confidence['rightElbow'] = angle_confidence.get('rightArm', 0.0)
    angles['rightElbow'] = angles.get('rightArm', 0.0)

    set_angle('leftThigh', ['leftHip', 'leftKnee', 'leftAnkle'])
    angle_confidence['leftLeg'] = angle_confidence.get('leftThigh', 0.0)
    angles['leftLeg'] = angles.get('leftThigh', 0.0)

    set_angle('rightThigh', ['rightHip', 'rightKnee', 'rightAnkle'])
    angle_confidence['rightLeg'] = angle_confidence.get('rightThigh', 0.0)
    angles['rightLeg'] = angles.get('rightThigh', 0.0)

    return angles, angle_confidence


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
                angles, angle_confidence = calculate_angles(keypoints)
                
                frames_data.append({
                    "frameNumber": frame_num,
                    "timestamp": frame_num / fps,
                    "keypoints": keypoints,
                    "angles": angles,
                    "angleConfidence": angle_confidence,
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
