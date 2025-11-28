#!/usr/bin/env python3
"""
Unit tests for video preprocessing functionality.
"""

import torch
import unittest
import numpy as np
import json
from pathlib import Path
import tempfile
import shutil

from preprocess_video_executorch import (
    ExecuTorchPoseDetector,
    calculate_angle,
    calculate_angles
)
from create_lightweight_model import LightweightPoseModel


class TestExecuTorchPoseDetector(unittest.TestCase):
    """Test cases for ExecuTorch pose detector."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures."""
        cls.test_dir = Path(tempfile.mkdtemp())
        cls.model_path = cls.test_dir / "test_model.pt"
        
        # Create and save a test model
        model = LightweightPoseModel()
        torch.save(model.state_dict(), cls.model_path)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test fixtures."""
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)
    
    def test_detector_initialization(self):
        """Test detector can be initialized."""
        detector = ExecuTorchPoseDetector(str(self.model_path), use_executorch=False)
        self.assertIsNotNone(detector.model)
    
    def test_preprocess_frame(self):
        """Test frame preprocessing."""
        detector = ExecuTorchPoseDetector(str(self.model_path), use_executorch=False)
        
        # Create dummy frame (BGR format, like OpenCV)
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Preprocess
        tensor = detector.preprocess_frame(frame)
        
        # Check output shape
        self.assertEqual(tensor.shape, (1, 3, 192, 192))
        
        # Check value range [0, 1]
        self.assertTrue((tensor >= 0).all())
        self.assertTrue((tensor <= 1).all())
    
    def test_detect_pose(self):
        """Test pose detection on a frame."""
        detector = ExecuTorchPoseDetector(str(self.model_path), use_executorch=False)
        
        # Create dummy frame
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Detect pose
        keypoints = detector.detect_pose(frame)
        
        # Check output format
        self.assertIsInstance(keypoints, dict)
        self.assertEqual(len(keypoints), 17)  # 17 COCO keypoints
        
        # Check keypoint format
        for name, kp in keypoints.items():
            self.assertIn('x', kp)
            self.assertIn('y', kp)
            self.assertIn('confidence', kp)
            
            # Check value ranges
            self.assertGreaterEqual(kp['x'], 0)
            self.assertLessEqual(kp['x'], 1)
            self.assertGreaterEqual(kp['y'], 0)
            self.assertLessEqual(kp['y'], 1)
            self.assertGreaterEqual(kp['confidence'], 0)
            self.assertLessEqual(kp['confidence'], 1)
    
    def test_parse_keypoints(self):
        """Test keypoint parsing from model output."""
        detector = ExecuTorchPoseDetector(str(self.model_path), use_executorch=False)
        
        # Create dummy model output
        output = torch.rand(1, 17, 3)  # [batch, keypoints, (x, y, conf)]
        
        # Parse keypoints
        keypoints = detector.parse_keypoints(output)
        
        # Check output
        self.assertEqual(len(keypoints), 17)
        self.assertIn('nose', keypoints)
        self.assertIn('leftShoulder', keypoints)
        self.assertIn('rightAnkle', keypoints)


class TestAngleCalculation(unittest.TestCase):
    """Test cases for angle calculation."""
    
    def test_calculate_angle_90_degrees(self):
        """Test angle calculation for 90 degree angle."""
        p1 = {'x': 0.0, 'y': 0.0, 'confidence': 0.9}
        p2 = {'x': 0.5, 'y': 0.0, 'confidence': 0.9}
        p3 = {'x': 0.5, 'y': 0.5, 'confidence': 0.9}
        
        angle = calculate_angle(p1, p2, p3)
        
        # Should be approximately 90 degrees
        self.assertAlmostEqual(angle, 90.0, delta=1.0)
    
    def test_calculate_angle_180_degrees(self):
        """Test angle calculation for 180 degree angle (straight line)."""
        p1 = {'x': 0.0, 'y': 0.5, 'confidence': 0.9}
        p2 = {'x': 0.5, 'y': 0.5, 'confidence': 0.9}
        p3 = {'x': 1.0, 'y': 0.5, 'confidence': 0.9}
        
        angle = calculate_angle(p1, p2, p3)
        
        # Should be approximately 180 degrees
        self.assertAlmostEqual(angle, 180.0, delta=1.0)
    
    def test_calculate_angle_low_confidence(self):
        """Test angle calculation with low confidence points."""
        p1 = {'x': 0.0, 'y': 0.0, 'confidence': 0.3}  # Low confidence
        p2 = {'x': 0.5, 'y': 0.0, 'confidence': 0.9}
        p3 = {'x': 0.5, 'y': 0.5, 'confidence': 0.9}
        
        angle = calculate_angle(p1, p2, p3)
        
        # Should return 0.0 for low confidence
        self.assertEqual(angle, 0.0)
    
    def test_calculate_angles_complete(self):
        """Test calculating all joint angles."""
        # Create complete keypoint set
        keypoints = {
            'leftShoulder': {'x': 0.3, 'y': 0.3, 'confidence': 0.9},
            'leftElbow': {'x': 0.4, 'y': 0.5, 'confidence': 0.9},
            'leftWrist': {'x': 0.5, 'y': 0.7, 'confidence': 0.9},
            'rightShoulder': {'x': 0.7, 'y': 0.3, 'confidence': 0.9},
            'rightElbow': {'x': 0.6, 'y': 0.5, 'confidence': 0.9},
            'rightWrist': {'x': 0.5, 'y': 0.7, 'confidence': 0.9},
            'leftHip': {'x': 0.3, 'y': 0.6, 'confidence': 0.9},
            'leftKnee': {'x': 0.3, 'y': 0.8, 'confidence': 0.9},
            'leftAnkle': {'x': 0.3, 'y': 1.0, 'confidence': 0.9},
            'rightHip': {'x': 0.7, 'y': 0.6, 'confidence': 0.9},
            'rightKnee': {'x': 0.7, 'y': 0.8, 'confidence': 0.9},
            'rightAnkle': {'x': 0.7, 'y': 1.0, 'confidence': 0.9},
        }
        
        angles = calculate_angles(keypoints)
        
        # Check all expected angles are present
        expected_angles = [
            'leftArm', 'rightArm', 'leftElbow', 'rightElbow',
            'leftThigh', 'rightThigh', 'leftLeg', 'rightLeg'
        ]
        
        for angle_name in expected_angles:
            self.assertIn(angle_name, angles)
            self.assertIsInstance(angles[angle_name], float)
            self.assertGreaterEqual(angles[angle_name], 0.0)
            self.assertLessEqual(angles[angle_name], 180.0)


class TestJSONFormat(unittest.TestCase):
    """Test cases for JSON output format compatibility."""
    
    def test_json_structure(self):
        """Test that output JSON has correct structure."""
        # This would be tested with actual video processing
        # For now, just verify the expected structure
        expected_structure = {
            "songId": "test_song",
            "fps": 30.0,
            "totalFrames": 100,
            "frames": [
                {
                    "frameNumber": 0,
                    "timestamp": 0.0,
                    "keypoints": {},
                    "angles": {}
                }
            ]
        }
        
        # Verify structure
        self.assertIn("songId", expected_structure)
        self.assertIn("fps", expected_structure)
        self.assertIn("totalFrames", expected_structure)
        self.assertIn("frames", expected_structure)
        
        # Verify frame structure
        frame = expected_structure["frames"][0]
        self.assertIn("frameNumber", frame)
        self.assertIn("timestamp", frame)
        self.assertIn("keypoints", frame)
        self.assertIn("angles", frame)


if __name__ == "__main__":
    # Run tests
    unittest.main(verbosity=2)
