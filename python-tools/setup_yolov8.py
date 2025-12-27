#!/usr/bin/env python3
"""
Setup script for YOLOv8s-pose model.

This script:
1. Downloads the YOLOv8s-pose model
2. Tests the model with a sample inference
3. Optionally exports to ExecuTorch format
4. Copies the model to the mobile app assets

Usage:
    uv run python setup_yolov8.py
    uv run python setup_yolov8.py --export-executorch
"""

import argparse
import sys
from pathlib import Path


def check_dependencies():
    """Check that required packages are installed."""
    print("Checking dependencies...")
    
    try:
        import torch
        print(f"  ✓ PyTorch {torch.__version__}")
    except ImportError:
        print("  ✗ PyTorch not found. Install with: pip install torch")
        return False
    
    try:
        import ultralytics
        print(f"  ✓ Ultralytics {ultralytics.__version__}")
    except ImportError:
        print("  ✗ Ultralytics not found. Install with: pip install ultralytics")
        return False
    
    try:
        import cv2
        print(f"  ✓ OpenCV {cv2.__version__}")
    except ImportError:
        print("  ✗ OpenCV not found. Install with: pip install opencv-python")
        return False
    
    return True


def download_model():
    """Download YOLOv8s-pose model."""
    print("\nDownloading YOLOv8s-pose model...")
    
    from ultralytics import YOLO
    
    # This will download the model if not already cached
    model = YOLO('yolov8s-pose.pt')
    
    print("✓ YOLOv8s-pose model downloaded")
    
    # Print model info
    print(f"\nModel Information:")
    print(f"  Name: YOLOv8s-pose")
    print(f"  Accuracy: 64.0 AP on COCO")
    print(f"  Input size: 256x256")
    print(f"  Output: 17 COCO keypoints")
    
    return model


def test_model(model):
    """Test the model with a dummy input."""
    print("\nTesting model inference...")
    
    import torch
    import numpy as np
    
    # Create a dummy image
    dummy_image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
    
    # Run inference
    results = model(dummy_image, verbose=False)
    
    print("✓ Model inference successful")
    
    # Check output
    if len(results) > 0 and results[0].keypoints is not None:
        kpts = results[0].keypoints
        if kpts.data.shape[0] > 0:
            print(f"  Detected {kpts.data.shape[0]} person(s)")
            print(f"  Keypoints shape: {kpts.data.shape}")
        else:
            print("  No person detected (expected for random noise)")
    
    return True


def export_to_executorch():
    """Export model to ExecuTorch format."""
    print("\nExporting to ExecuTorch format...")
    
    try:
        from export_model_yolov8 import export_to_executorch as do_export
        do_export(output_path="models/yolov8s_pose.pte")
        return True
    except ImportError as e:
        print(f"⚠ ExecuTorch export not available: {e}")
        print("  The model can still be used for preprocessing.")
        return False
    except Exception as e:
        print(f"⚠ ExecuTorch export failed: {e}")
        print("  The model can still be used for preprocessing.")
        return False


def copy_to_mobile():
    """Copy model to mobile app assets."""
    print("\nCopying model to mobile app...")
    
    import shutil
    
    source = Path("models/yolov8s_pose.pte")
    dest = Path("../mobile/assets/models/pose.pte")
    
    if not source.exists():
        print(f"⚠ Source model not found: {source}")
        print("  Run with --export-executorch to create the model first.")
        return False
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(source, dest)
    
    print(f"✓ Model copied to {dest}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Setup YOLOv8s-pose model for Bachata Bro"
    )
    parser.add_argument(
        "--export-executorch",
        action="store_true",
        help="Export model to ExecuTorch format for mobile"
    )
    parser.add_argument(
        "--copy-to-mobile",
        action="store_true",
        help="Copy exported model to mobile app assets"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("YOLOv8s-pose Setup for Bachata Bro")
    print("=" * 60)
    
    # Check dependencies
    if not check_dependencies():
        print("\n✗ Missing dependencies. Please install them first.")
        sys.exit(1)
    
    # Download model
    model = download_model()
    
    # Test model
    if not test_model(model):
        print("\n✗ Model test failed.")
        sys.exit(1)
    
    # Export to ExecuTorch if requested
    if args.export_executorch:
        export_to_executorch()
    
    # Copy to mobile if requested
    if args.copy_to_mobile:
        copy_to_mobile()
    
    print("\n" + "=" * 60)
    print("Setup Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Process videos: uv run python batch_process_yolov8.py ../songs/")
    if not args.export_executorch:
        print("  2. Export for mobile: uv run python setup_yolov8.py --export-executorch")
    if not args.copy_to_mobile:
        print("  3. Copy to mobile: uv run python setup_yolov8.py --copy-to-mobile")


if __name__ == "__main__":
    main()
