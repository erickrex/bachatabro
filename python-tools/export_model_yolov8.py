#!/usr/bin/env python3
"""
Export YOLOv8s-pose to ExecuTorch PTE format.

This script exports YOLOv8s-pose to ExecuTorch's portable format (.pte)
for mobile deployment in React Native.

The exported model:
- Input: [1, 3, 256, 256] RGB tensor normalized to [0, 1]
- Output: [1, 17, 3] keypoints tensor (x, y, confidence)
"""

import argparse
import torch
import torch.nn as nn
from pathlib import Path
from typing import Optional


class YOLOv8PoseForExport(nn.Module):
    """
    YOLOv8s-pose wrapper optimized for ExecuTorch export.
    
    This wrapper simplifies the YOLOv8 output to a fixed [B, 17, 3] tensor,
    making it compatible with ExecuTorch's static shape requirements.
    """
    
    INPUT_SIZE = 256
    NUM_KEYPOINTS = 17
    
    def __init__(self):
        super().__init__()
        
        from ultralytics import YOLO
        
        # Load pretrained YOLOv8s-pose
        print("Loading YOLOv8s-pose model...")
        yolo = YOLO('yolov8s-pose.pt')
        
        # Get the underlying PyTorch model
        self.model = yolo.model
        self.model.eval()
        
        # Disable gradient computation
        for param in self.model.parameters():
            param.requires_grad = False
        
        print("✓ YOLOv8s-pose model loaded")
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass with simplified output.
        
        Args:
            x: Input tensor [B, 3, 256, 256]
            
        Returns:
            Keypoints tensor [B, 17, 3]
        """
        batch_size = x.shape[0]
        
        # Run YOLOv8 model
        pred = self.model(x)
        
        # Handle output format
        if isinstance(pred, (list, tuple)):
            pred = pred[0]
        
        # pred shape: [B, 56, num_anchors]
        # 56 = 4 (bbox) + 1 (obj_conf) + 51 (17 keypoints * 3)
        
        # Transpose to [B, num_anchors, 56]
        pred = pred.transpose(1, 2)
        
        # Get confidence scores (index 4)
        confidences = pred[:, :, 4]
        
        # Get best detection per batch
        best_indices = confidences.argmax(dim=1)
        
        # Gather best detections using advanced indexing
        batch_indices = torch.arange(batch_size, device=x.device)
        best_dets = pred[batch_indices, best_indices]  # [B, 56]
        
        # Extract keypoints (indices 5:56 = 51 values)
        kpts_flat = best_dets[:, 5:56]  # [B, 51]
        kpts = kpts_flat.reshape(batch_size, self.NUM_KEYPOINTS, 3)  # [B, 17, 3]
        
        # Normalize x, y coordinates to [0, 1]
        kpts_normalized = kpts.clone()
        kpts_normalized[:, :, 0] = kpts[:, :, 0] / self.INPUT_SIZE  # x
        kpts_normalized[:, :, 1] = kpts[:, :, 1] / self.INPUT_SIZE  # y
        # confidence (index 2) is already normalized
        
        # Clamp to valid range
        kpts_normalized = torch.clamp(kpts_normalized, 0.0, 1.0)
        
        return kpts_normalized


def export_to_executorch(
    output_path: str = "models/yolov8s_pose.pte",
    quantize: bool = False,
    validate: bool = True
) -> None:
    """
    Export YOLOv8s-pose to ExecuTorch format.
    
    Args:
        output_path: Path to save .pte file
        quantize: Whether to apply INT8 quantization
        validate: Whether to validate the exported model
    """
    print("=" * 60)
    print("YOLOv8s-pose ExecuTorch Export")
    print("=" * 60)
    
    # Create model
    model = YOLOv8PoseForExport()
    model.eval()
    
    # Create example input
    example_input = torch.randn(1, 3, 256, 256)
    print(f"\nExample input shape: {example_input.shape}")
    
    # Test PyTorch inference
    print("\nTesting PyTorch inference...")
    with torch.no_grad():
        pt_output = model(example_input)
    print(f"✓ PyTorch output shape: {pt_output.shape}")
    print(f"  Expected: [1, 17, 3]")
    
    # Export to ExecuTorch
    print("\n" + "-" * 60)
    print("Exporting to ExecuTorch...")
    print("-" * 60)
    
    try:
        from torch.export import export
        from executorch.exir import to_edge, EdgeCompileConfig
    except ImportError as e:
        print(f"✗ Failed to import ExecuTorch: {e}")
        print("\nTo install ExecuTorch:")
        print("  pip install executorch")
        
        # Save PyTorch model as fallback
        fallback_path = output_path.replace('.pte', '.pt')
        torch.save(model.state_dict(), fallback_path)
        print(f"\n✓ Saved PyTorch model to {fallback_path}")
        print("  Use this for preprocessing, export to ExecuTorch when available")
        return
    
    # Step 1: Export model
    print("\nStep 1: Exporting model with torch.export...")
    try:
        exported_program = export(model, (example_input,))
        print("✓ Model exported successfully")
    except Exception as e:
        print(f"✗ Export failed: {e}")
        print("\nTrying alternative export method...")
        
        # Try tracing instead
        try:
            traced = torch.jit.trace(model, example_input)
            traced_path = output_path.replace('.pte', '_traced.pt')
            traced.save(traced_path)
            print(f"✓ Saved traced model to {traced_path}")
            print("  Note: This is a TorchScript model, not ExecuTorch")
        except Exception as e2:
            print(f"✗ Tracing also failed: {e2}")
        return
    
    # Step 2: Convert to Edge dialect
    print("\nStep 2: Converting to Edge dialect...")
    try:
        edge_config = EdgeCompileConfig(_check_ir_validity=False)
        edge_program = to_edge(exported_program, compile_config=edge_config)
        print("✓ Converted to Edge dialect")
    except Exception as e:
        print(f"✗ Edge conversion failed: {e}")
        return
    
    # Step 3: Apply quantization if requested
    if quantize:
        print("\nStep 3: Applying INT8 quantization...")
        try:
            from executorch.exir import EdgeProgramManager
            # Note: Quantization API may vary by ExecuTorch version
            print("⚠ Quantization not yet implemented for this model")
            print("  Proceeding without quantization")
        except Exception as e:
            print(f"⚠ Quantization failed: {e}")
            print("  Proceeding without quantization")
    
    # Step 4: Lower to ExecuTorch
    print("\nStep 4: Lowering to ExecuTorch...")
    try:
        executorch_program = edge_program.to_executorch()
        print("✓ Lowered to ExecuTorch")
    except Exception as e:
        print(f"✗ ExecuTorch lowering failed: {e}")
        return
    
    # Step 5: Save to file
    print(f"\nStep 5: Saving to {output_path}...")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'wb') as f:
        f.write(executorch_program.buffer)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Model exported successfully!")
    print(f"  Output: {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    
    # Validate if requested
    if validate:
        print("\n" + "-" * 60)
        print("Validating exported model...")
        print("-" * 60)
        validate_exported_model(str(output_path), model, example_input, pt_output)
    
    print("\n" + "=" * 60)
    print("Export complete!")
    print("=" * 60)
    print(f"\nNext steps:")
    print(f"  1. Copy {output_path} to mobile/assets/models/pose.pte")
    print(f"  2. The React Native app will automatically use the new model")
    print(f"  3. Test on mobile devices")


def validate_exported_model(
    pte_path: str,
    pytorch_model: nn.Module,
    example_input: torch.Tensor,
    expected_output: torch.Tensor
) -> bool:
    """
    Validate exported ExecuTorch model against PyTorch baseline.
    """
    try:
        import executorch.extension.pybindings.portable_lib as exec_lib
    except ImportError:
        print("⚠ Cannot import ExecuTorch runtime for validation")
        print("  Skipping validation (model should still work on mobile)")
        return False
    
    try:
        # Load ExecuTorch model
        try:
            et_module = exec_lib._load_for_executorch(pte_path)
        except AttributeError:
            et_module = exec_lib.load(pte_path)
        
        print("✓ ExecuTorch model loaded")
        
        # Run ExecuTorch inference
        et_output = et_module.forward((example_input,))[0]
        
        if not isinstance(et_output, torch.Tensor):
            et_output = torch.tensor(et_output)
        
        # Compare outputs
        diff = torch.abs(et_output - expected_output).mean().item()
        max_diff = torch.abs(et_output - expected_output).max().item()
        
        print(f"\nValidation results:")
        print(f"  Average difference: {diff:.6f}")
        print(f"  Maximum difference: {max_diff:.6f}")
        
        threshold = 0.05
        if diff < threshold:
            print(f"✓ Accuracy within {threshold*100}% threshold")
            return True
        else:
            print(f"⚠ Accuracy degradation: {diff*100:.2f}%")
            print(f"  This may be acceptable for pose estimation")
            return False
            
    except Exception as e:
        print(f"⚠ Validation failed: {e}")
        print("  Model may still work on mobile")
        return False


def export_to_onnx(output_path: str = "models/yolov8s_pose.onnx") -> None:
    """
    Export YOLOv8s-pose to ONNX format (alternative export).
    
    This can be useful for:
    - Debugging
    - Using with ONNX Runtime
    - Converting to other formats
    """
    print("Exporting to ONNX format...")
    
    from ultralytics import YOLO
    
    model = YOLO('yolov8s-pose.pt')
    model.export(format='onnx', imgsz=256, simplify=True)
    
    print(f"✓ ONNX model exported")


def main():
    parser = argparse.ArgumentParser(
        description="Export YOLOv8s-pose to ExecuTorch format"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/yolov8s_pose.pte",
        help="Path to save ExecuTorch .pte file"
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Apply INT8 quantization (reduces size, may affect accuracy)"
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip validation step"
    )
    parser.add_argument(
        "--onnx",
        action="store_true",
        help="Also export to ONNX format"
    )
    
    args = parser.parse_args()
    
    # Export to ExecuTorch
    export_to_executorch(
        output_path=args.output,
        quantize=args.quantize,
        validate=not args.no_validate
    )
    
    # Optionally export to ONNX
    if args.onnx:
        export_to_onnx()


if __name__ == "__main__":
    main()
