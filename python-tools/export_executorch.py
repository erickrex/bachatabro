#!/usr/bin/env python3
# /// script
# dependencies = [
#     "torch>=2.4.0",
#     "torchvision>=0.19.0",
#     "executorch>=1.0.0",
# ]
# ///
"""
Export pose detection model to ExecuTorch .pte format for mobile deployment.

This creates an Arm-optimized model using XNNPACK backend.

Usage:
    python export_executorch.py [--output models/pose.pte]
    
Requirements:
    pip install executorch torch torchvision
"""

import argparse
import sys
from pathlib import Path

def export_movenet_to_executorch(output_path: str = "models/pose.pte"):
    """
    Export MoveNet pose model to ExecuTorch format.
    
    Args:
        output_path: Path to save the .pte file
    """
    try:
        import torch
        from executorch.exir import to_edge, EdgeCompileConfig
        from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
    except ImportError as e:
        print(f"Error: Missing dependency - {e}")
        print("\nInstall with:")
        print("  pip install executorch torch torchvision")
        sys.exit(1)
    
    print("ExecuTorch Model Export")
    print("=" * 50)
    
    # Create a simple pose estimation model for testing
    # In production, you'd load YOLOv8s-pose or MoveNet
    print("Creating pose estimation model...")
    
    class SimplePoseModel(torch.nn.Module):
        """
        Simple pose model for testing ExecuTorch export.
        Replace with actual MoveNet or YOLOv8s-pose for production.
        """
        def __init__(self, num_keypoints=17):
            super().__init__()
            self.num_keypoints = num_keypoints
            
            # Simple CNN backbone
            self.backbone = torch.nn.Sequential(
                torch.nn.Conv2d(3, 32, 3, stride=2, padding=1),
                torch.nn.ReLU(),
                torch.nn.Conv2d(32, 64, 3, stride=2, padding=1),
                torch.nn.ReLU(),
                torch.nn.Conv2d(64, 128, 3, stride=2, padding=1),
                torch.nn.ReLU(),
                torch.nn.AdaptiveAvgPool2d((1, 1)),
            )
            
            # Keypoint head: outputs (x, y, confidence) for each keypoint
            self.head = torch.nn.Linear(128, num_keypoints * 3)
        
        def forward(self, x):
            # x: [batch, 3, 192, 192]
            features = self.backbone(x)
            features = features.flatten(1)
            keypoints = self.head(features)
            # Reshape to [batch, num_keypoints, 3]
            keypoints = keypoints.view(-1, self.num_keypoints, 3)
            # Apply sigmoid to normalize outputs to [0, 1]
            keypoints = torch.sigmoid(keypoints)
            return keypoints
    
    model = SimplePoseModel()
    model.eval()
    
    # Example input (batch=1, channels=3, height=192, width=192)
    example_input = torch.randn(1, 3, 192, 192)
    
    print(f"Model created with {sum(p.numel() for p in model.parameters())} parameters")
    
    # Export to ExecuTorch
    print("\nExporting to ExecuTorch format...")
    
    try:
        # Step 1: Export to ATen dialect
        print("  Step 1/3: Exporting to ATen dialect...")
        exported_program = torch.export.export(model, (example_input,))
        
        # Step 2: Convert to Edge dialect
        print("  Step 2/3: Converting to Edge dialect...")
        edge_program = to_edge(
            exported_program,
            compile_config=EdgeCompileConfig(
                _check_ir_validity=False,
            )
        )
        
        # Step 3: Partition for XNNPACK (Arm optimization)
        print("  Step 3/3: Partitioning for XNNPACK (Arm NEON)...")
        edge_program = edge_program.to_backend(XnnpackPartitioner())
        
        # Generate ExecuTorch program
        executorch_program = edge_program.to_executorch()
        
        # Save to file
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'wb') as f:
            f.write(executorch_program.buffer)
        
        file_size = output_file.stat().st_size / 1024 / 1024
        print(f"\n✓ Model exported successfully!")
        print(f"  Output: {output_file}")
        print(f"  Size: {file_size:.2f} MB")
        print(f"  Backend: XNNPACK (Arm NEON optimized)")
        print(f"  Input shape: [1, 3, 192, 192]")
        print(f"  Output shape: [1, 17, 3] (keypoints with x, y, confidence)")
        
    except Exception as e:
        print(f"\n✗ Export failed: {e}")
        print("\nThis may be due to:")
        print("  1. ExecuTorch version mismatch")
        print("  2. Unsupported operations in model")
        print("  3. Missing XNNPACK backend")
        print("\nTry installing the latest ExecuTorch:")
        print("  pip install --upgrade executorch")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Export pose model to ExecuTorch format'
    )
    parser.add_argument(
        '--output',
        default='models/pose.pte',
        help='Output path for .pte file (default: models/pose.pte)'
    )
    
    args = parser.parse_args()
    
    export_movenet_to_executorch(args.output)


if __name__ == '__main__':
    main()
