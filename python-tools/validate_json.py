#!/usr/bin/env python3
"""
Validation script for pose data JSON files.
"""

import json
import argparse
from pathlib import Path
from typing import Dict, List


def validate_pose_json(json_path: str) -> tuple[bool, List[str]]:
    """
    Validate a pose data JSON file.
    
    Returns:
        (is_valid, list_of_errors)
    """
    errors = []
    
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"]
    except FileNotFoundError:
        return False, [f"File not found: {json_path}"]
    
    # Check required top-level fields
    required_fields = ['songId', 'fps', 'totalFrames', 'frames']
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    
    if errors:
        return False, errors
    
    # Validate data types
    if not isinstance(data['songId'], str):
        errors.append("songId must be a string")
    
    if not isinstance(data['fps'], (int, float)) or data['fps'] <= 0:
        errors.append("fps must be a positive number")
    
    if not isinstance(data['totalFrames'], int) or data['totalFrames'] <= 0:
        errors.append("totalFrames must be a positive integer")
    
    if not isinstance(data['frames'], list):
        errors.append("frames must be a list")
        return False, errors
    
    # Validate frames
    if len(data['frames']) != data['totalFrames']:
        errors.append(f"Frame count mismatch: expected {data['totalFrames']}, got {len(data['frames'])}")
    
    # Validate frame structure (sample first and last frames)
    frames_to_check = [0, len(data['frames']) - 1] if len(data['frames']) > 1 else [0]
    
    for idx in frames_to_check:
        if idx >= len(data['frames']):
            continue
        
        frame = data['frames'][idx]
        
        # Check frame fields
        if 'frameNumber' not in frame:
            errors.append(f"Frame {idx}: missing frameNumber")
        
        if 'timestamp' not in frame:
            errors.append(f"Frame {idx}: missing timestamp")
        
        if 'keypoints' not in frame:
            errors.append(f"Frame {idx}: missing keypoints")
        
        if 'angles' not in frame:
            errors.append(f"Frame {idx}: missing angles")
        
        # Validate keypoints structure
        if 'keypoints' in frame and isinstance(frame['keypoints'], dict):
            for kp_name, kp_data in frame['keypoints'].items():
                if not isinstance(kp_data, dict):
                    errors.append(f"Frame {idx}: keypoint {kp_name} must be a dict")
                    continue
                
                required_kp_fields = ['x', 'y', 'confidence']
                for field in required_kp_fields:
                    if field not in kp_data:
                        errors.append(f"Frame {idx}: keypoint {kp_name} missing {field}")
        
        # Validate angles structure
        if 'angles' in frame and isinstance(frame['angles'], dict):
            expected_angles = ['leftArm', 'rightArm', 'leftElbow', 'rightElbow', 
                             'leftThigh', 'rightThigh', 'leftLeg', 'rightLeg']
            for angle_name in expected_angles:
                if angle_name not in frame['angles']:
                    errors.append(f"Frame {idx}: missing angle {angle_name}")
    
    return len(errors) == 0, errors


def validate_directory(directory: str) -> None:
    """Validate all JSON files in a directory."""
    
    directory = Path(directory)
    json_files = list(directory.glob('*.json'))
    
    if not json_files:
        print(f"No JSON files found in {directory}")
        return
    
    print(f"Validating {len(json_files)} JSON file(s)...")
    print("=" * 60)
    
    valid_count = 0
    invalid_count = 0
    
    for json_file in json_files:
        is_valid, errors = validate_pose_json(str(json_file))
        
        if is_valid:
            print(f"✓ {json_file.name}: VALID")
            valid_count += 1
        else:
            print(f"✗ {json_file.name}: INVALID")
            for error in errors:
                print(f"  - {error}")
            invalid_count += 1
    
    print("=" * 60)
    print(f"Results: {valid_count} valid, {invalid_count} invalid")


def main():
    parser = argparse.ArgumentParser(description='Validate pose data JSON files')
    parser.add_argument('path', help='Path to JSON file or directory')
    
    args = parser.parse_args()
    
    path = Path(args.path)
    
    if path.is_file():
        is_valid, errors = validate_pose_json(str(path))
        if is_valid:
            print(f"✓ {path.name}: VALID")
        else:
            print(f"✗ {path.name}: INVALID")
            for error in errors:
                print(f"  - {error}")
    elif path.is_dir():
        validate_directory(str(path))
    else:
        print(f"Error: {path} is not a valid file or directory")


if __name__ == '__main__':
    main()
