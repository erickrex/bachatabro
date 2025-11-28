#!/usr/bin/env python3
"""
Unit tests for model export functionality.
"""

import torch
import unittest
from pathlib import Path
import tempfile
import shutil

from create_lightweight_model import LightweightPoseModel
from export_model import load_pytorch_model, export_to_executorch


class TestModelExport(unittest.TestCase):
    """Test cases for model export."""
    
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
    
    def test_load_pytorch_model(self):
        """Test loading PyTorch model from checkpoint."""
        model = load_pytorch_model(str(self.model_path))
        
        self.assertIsInstance(model, LightweightPoseModel)
        self.assertFalse(model.training)  # Should be in eval mode
    
    def test_model_output_shape(self):
        """Test that model outputs correct shape."""
        model = load_pytorch_model(str(self.model_path))
        
        # Test input
        test_input = torch.randn(1, 3, 192, 192)
        
        # Run inference
        with torch.no_grad():
            output = model(test_input)
        
        # Check output shape
        self.assertEqual(output.shape, (1, 17, 3))
    
    def test_model_output_range(self):
        """Test that model outputs are in valid range [0, 1]."""
        model = load_pytorch_model(str(self.model_path))
        
        # Test input
        test_input = torch.randn(1, 3, 192, 192)
        
        # Run inference
        with torch.no_grad():
            output = model(test_input)
        
        # Check value ranges
        self.assertTrue((output >= 0).all())
        self.assertTrue((output <= 1).all())
    
    def test_export_to_executorch(self):
        """Test exporting model to ExecuTorch format."""
        model = load_pytorch_model(str(self.model_path))
        output_path = self.test_dir / "test_model.pte"
        
        # Export model
        export_to_executorch(model, str(output_path), quantize=False)
        
        # Check that file was created
        self.assertTrue(output_path.exists())
        
        # Check that file is not empty
        self.assertGreater(output_path.stat().st_size, 0)
    
    def test_exported_model_file_size(self):
        """Test that exported model file exists and has reasonable size."""
        model = load_pytorch_model(str(self.model_path))
        output_path = self.test_dir / "test_model_size.pte"
        
        # Export model
        export_to_executorch(model, str(output_path), quantize=False)
        
        # Check file size
        file_size_mb = output_path.stat().st_size / (1024 * 1024)
        
        # Should be less than 200MB (unquantized)
        self.assertLess(file_size_mb, 200)
        
        # Should be greater than 1MB (sanity check)
        self.assertGreater(file_size_mb, 1)


class TestLightweightPoseModel(unittest.TestCase):
    """Test cases for the lightweight pose model."""
    
    def test_model_creation(self):
        """Test that model can be created."""
        model = LightweightPoseModel()
        self.assertIsInstance(model, torch.nn.Module)
    
    def test_model_forward_pass(self):
        """Test model forward pass."""
        model = LightweightPoseModel()
        model.eval()
        
        # Test input
        test_input = torch.randn(2, 3, 192, 192)  # Batch size 2
        
        # Run inference
        with torch.no_grad():
            output = model(test_input)
        
        # Check output shape
        self.assertEqual(output.shape, (2, 17, 3))
    
    def test_model_keypoint_count(self):
        """Test that model outputs exactly 17 keypoints."""
        model = LightweightPoseModel()
        model.eval()
        
        test_input = torch.randn(1, 3, 192, 192)
        
        with torch.no_grad():
            output = model(test_input)
        
        # Should have 17 keypoints
        self.assertEqual(output.shape[1], 17)
    
    def test_model_keypoint_format(self):
        """Test that each keypoint has 3 values (x, y, confidence)."""
        model = LightweightPoseModel()
        model.eval()
        
        test_input = torch.randn(1, 3, 192, 192)
        
        with torch.no_grad():
            output = model(test_input)
        
        # Each keypoint should have 3 values
        self.assertEqual(output.shape[2], 3)


if __name__ == "__main__":
    # Run tests
    unittest.main(verbosity=2)
