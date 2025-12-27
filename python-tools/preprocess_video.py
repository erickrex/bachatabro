#!/usr/bin/env python3
"""
Video Preprocessing Tool for Bachata Bro
Extracts pose data from reference videos and saves as JSON files.
"""

import cv2
import json
import numpy as np
import tensorflow as tf
from pathlib import Path
from typing import Dict, List, Tuple
import argparse
from tqdm import tqdm


def load_tflite_model(model_path: str) -> tf.lite.Interpreter:
    """Load TFLite pose detection model."""
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter


def detect_pose(interpreter: tf.lite.Interpreter, frame: np.ndarray) -> Dict[str, Tuple[float, float, float]]:
    """
    Detect pose keypoints from a frame.
    
    Returns:
        Dictionary of keypoint names to (x, y, confidence) tuples
    """
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Preprocess frame
    input_shape = input_details[0]['shape']
    height, width = input_shape[1], input_shape[2]
    
    # Resize and normalize
    frame_resized = cv2.resize(frame, (width, height))
    frame_rgb = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2RGB)
    input_data = np.expand_dims(frame_rgb, axis=0).astype(np.float32) / 255.0
    
    # Run inference
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    
    # Get keypoints
    keypoints = interpreter.get_tensor(output_details[0]['index'])[0]
    
    # Map to keypoint names (MoveNet format)
    keypoint_names = [
        'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
        'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
        'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
        'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
    ]
    
    result = {}
    for i, name in enumerate(keypoint_names):
        if i < len(keypoints):
            y, x, confidence = keypoints[i]
            result[name] = {
                'x': float(x),
                'y': float(y),
                'confidence': float(confidence)
            }
    
    return result


def calculate_angle(p1: Dict, p2: Dict, p3: Dict) -> float:
    """Calculate angle between three points."""
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
    """Calculate joint angles from keypoints."""
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
    
    # Left elbow angle (shoulder-elbow-wrist)
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
    
    # Left leg angle (same as thigh for simplicity)
    angles['leftLeg'] = angles.get('leftThigh', 0.0)
    
    # Right leg angle
    angles['rightLeg'] = angles.get('rightThigh', 0.0)
    
    return angles


def extract_poses_from_video(
    video_path: str,
    model_path: str,
    output_path: str,
    progress_callback=None
) -> None:
    """Extract pose data from video and save as JSON."""
    
    # Load model
    print(f"Loading model from {model_path}...")
    interpreter = load_tflite_model(model_path)
    
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
            
            # Detect pose
            keypoints = detect_pose(interpreter, frame)
            angles = calculate_angles(keypoints)
            
            frames_data.append({
                "frameNumber": frame_num,
                "timestamp": frame_num / fps,
                "keypoints": keypoints,
                "angles": angles
            })
            
            frame_num += 1
            pbar.update(1)
            
            # Progress callback
            if progress_callback and frame_num % 10 == 0:
                progress_callback(frame_num, total_frames)
    
    cap.release()
    
    # Prepare output
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


def main():
    parser = argparse.ArgumentParser(description='Extract pose data from dance videos')
    parser.add_argument('video', help='Path to input video file')
    parser.add_argument('--model', default='../model/model.tflite', help='Path to TFLite model')
    parser.add_argument('--output', default='../mobile/assets/poses/', help='Output directory for JSON files')
    
    args = parser.parse_args()
    
    # Determine output path
    video_path = Path(args.video)
    output_dir = Path(args.output)
    output_file = output_dir / f"{video_path.stem}.json"
    
    # Process video
    extract_poses_from_video(
        str(video_path),
        args.model,
        str(output_file)
    )


if __name__ == '__main__':
    main()
