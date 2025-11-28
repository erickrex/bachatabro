#!/usr/bin/env python3
"""
Validation Script for Pose Data JSON Files
Validates the format and content of generated pose data files.
"""

import json
from pathlib import Path
from typing import Dict, List, Any


def validate_pose_json(json_path: str) -> tuple[bool, List[str]]:
    """
    Validate a pose data JSON file.
    
    Returns:
        (is_valid, errors) tuple
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
        errors.append("frames must be an array")
    else:
        # Validate frames array
        if len(data['frames']) != data['totalFrames']:
            errors.append(f"frames array length ({len(data['frames'])}) doesn't match totalFrames ({data['totalFrames']})")
        
        # Validate first frame structure
        if len(data['frames']) > 0:
            frame = data['frames'][0]
            
            required_frame_fields = ['frameNumber', 'timestamp', 'keypoints', 'angles']
            for field in required_frame_fields:
                if field not in frame:
                    errors.append(f"Frame missing required field: {field}")
            
            # Validate keypoints
            if 'keypoints' in frame:
                if not isinstance(frame['keypoints'], dict):
                    errors.append("keypoints must be an object")
                else:
                    # Check for expected keypoint names
                    expected_keypoints = [
                        'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
                        'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
                        'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
                        'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
                    ]
                    
                    for kp_name in expected_keypoints:
                        if kp_name in frame['keypoints']:
                            kp = frame['keypoints'][kp_name]
                            if not all(k in kp for k in ['x', 'y', 'confidence']):
                                errors.append(f"Keypoint {kp_name} missing x, y, or confidence")
            
            # Validate angles
            if 'angles' in frame:
                if not isinstance(frame['angles'], dict):
                    errors.append("angles must be an object")
                else:
                    expected_angles = [
                        'leftArm', 'rightArm', 'leftElbow', 'rightElbow',
                        'leftThigh', 'rightThigh', 'leftLeg', 'rightLeg'
                    ]
                    
                    for angle_name in expected_angles:
                        if angle_name in frame['angles']:
                            angle = frame['angles'][angle_name]
                            if not isinstance(angle, (int, float)):
                                errors.append(f"Angle {angle_name} must be a number")
                            elif angle < 0 or angle > 180:
                                errors.append(f"Angle {angle_name} out of range (0-180): {angle}")
    
    return len(errors) == 0, errors


def validate_directory(poses_dir: str) -> None:
    """Validate all JSON files in a directory."""
    
    poses_path = Path(poses_dir)
    
    if not poses_path.exists():
        print(f"Directory not found: {poses_dir}")
        return
    
    json_files = list(poses_path.glob('*.json'))
    
    if not json_files:
        print(f"No JSON files found in {poses_dir}")
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
    
    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Total files: {len(json_files)}")
    print(f"Valid: {valid_count}")
    print(f"Invalid: {invalid_count}")
    
    if invalid_count == 0:
        print("\n✓ All files are valid!")
    else:
        print(f"\n✗ {invalid_count} file(s) have errors")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate pose data JSON files')
    parser.add_argument('--dir', default='../mobile/assets/poses', help='Directory containing JSON files')
    
    args = parser.parse_args()
    
    validate_directory(args.dir)
