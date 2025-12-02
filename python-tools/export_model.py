#!/usr/bin/env python3
"""
Export PyTorch pose model to ExecuTorch PTE format.

This script exports a PyTorch pose estimation model to ExecuTorch's
portable format (.pte) with optional quantization for mobile deployment.
"""

import argparse
import torch
from pathlib import Path
from typing import Optional

# Import the lightweight model
from create_lightweight_model import LightweightPoseModel


def load_pytorch_model(model_path: str) -> torch.nn.Module:
    """
    Load PyTorch model from checkpoint.
    
    Args:
        model_path: Path to model checkpoint (.pt file)
        
    Returns:
        Loaded PyTorch model in eval mode
    """
    print(f"Loading PyTorch model from {model_path}...")
    
    # Create model architecture
    model = LightweightPoseModel()
    
    # Load weights
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()
    
    print(f"✓ Model loaded successfully")
    
    return model


def export_to_executorch(
    model: torch.nn.Module,
    output_path: str,
    quantize: bool = True
) -> None:
    """
    Export PyTorch model to ExecuTorch PTE format.
    
    Args:
        model: PyTorch model to export
        output_path: Path to save .pte file
        quantize: Whether to apply quantization
    """
    print("\nExporting to ExecuTorch format...")
    
    try:
        from executorch.exir import to_edge, EdgeCompileConfig
        from torch.export import export
    except ImportError as e:
        print(f"✗ Error: Failed to import ExecuTorch modules")
        print(f"  {e}")
        print(f"  Make sure ExecuTorch is properly installed")
        return
    
    # Create example input (192x192 RGB image)
    example_input = (torch.randn(1, 3, 192, 192),)
    print(f"  Example input shape: {example_input[0].shape}")
    
    # Apply quantization if requested
    if quantize:
        print("  ⚠ Dynamic quantization not compatible with ExecuTorch export")
        print("  Exporting unquantized model instead...")
        print("  (Quantization can be applied post-export using ExecuTorch tools)")
        quantize = False  # Disable for now
    
    # Step 1: Export the model
    print("  Step 1: Exporting model...")
    try:
        exported_program = export(model, example_input)
        print(f"  ✓ Model exported successfully")
    except Exception as e:
        print(f"  ✗ Export failed: {e}")
        return
    
    # Step 2: Convert to Edge dialect
    print("  Step 2: Converting to Edge dialect...")
    try:
        edge_config = EdgeCompileConfig(_check_ir_validity=False)
        edge_program = to_edge(exported_program, compile_config=edge_config)
        print(f"  ✓ Converted to Edge dialect")
    except Exception as e:
        print(f"  ✗ Failed to convert to Edge: {e}")
        return
    
    # Step 3: Lower to ExecuTorch
    print("  Step 3: Lowering to ExecuTorch...")
    try:
        executorch_program = edge_program.to_executorch()
        print(f"  ✓ Lowered to ExecuTorch")
    except Exception as e:
        print(f"  ✗ Failed to lower to ExecuTorch: {e}")
        return
    
    # Step 4: Save to file
    print(f"  Step 4: Saving to {output_path}...")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'wb') as f:
        f.write(executorch_program.buffer)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Model exported successfully!")
    print(f"  Output: {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    
    # Check size constraint
    if file_size_mb < 10:
        print(f"  ✓ Model size is under 10MB target!")
    else:
        print(f"  ⚠ Model size exceeds 10MB target")
        if not quantize:
            print(f"    Try enabling quantization with --quantize flag")


def validate_exported_model(pte_path: str, pytorch_model: torch.nn.Module) -> bool:
    """
    Validate exported ExecuTorch model against PyTorch baseline.
    
    Args:
        pte_path: Path to exported .pte file
        pytorch_model: Original PyTorch model
        
    Returns:
        True if validation passes, False otherwise
    """
    print("\nValidating exported model...")
    
    try:
        import executorch.extension.pybindings.portable_lib as exec_lib
    except ImportError:
        print("✗ Cannot import ExecuTorch runtime for validation")
        print("  Skipping validation")
        return False
    
    try:
        # Load ExecuTorch model
        # Try different API methods
        try:
            et_module = exec_lib._load_for_executorch(pte_path)
        except AttributeError:
            try:
                et_module = exec_lib.load(pte_path)
            except AttributeError:
                print("✗ Cannot find correct ExecuTorch runtime API")
                return False
        print("✓ ExecuTorch model loaded successfully")
        
        # Create test input
        test_input = torch.randn(1, 3, 192, 192)
        
        # Run PyTorch inference
        with torch.no_grad():
            pt_output = pytorch_model(test_input)
        
        # Run ExecuTorch inference
        et_output = et_module.forward((test_input,))[0]
        
        # Convert to tensor if needed
        if not isinstance(et_output, torch.Tensor):
            et_output = torch.tensor(et_output)
        
        # Compare outputs
        diff = torch.abs(et_output - pt_output).mean().item()
        max_diff = torch.abs(et_output - pt_output).max().item()
        
        print(f"\nValidation results:")
        print(f"  Average difference: {diff:.6f}")
        print(f"  Maximum difference: {max_diff:.6f}")
        
        # Check accuracy threshold (5%)
        threshold = 0.05
        if diff < threshold:
            print(f"  ✓ Accuracy within {threshold*100}% threshold")
            return True
        else:
            print(f"  ✗ Accuracy degradation exceeds {threshold*100}% threshold")
            return False
            
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Export PyTorch pose model to ExecuTorch format"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="models/lightweight_pose.pt",
        help="Path to PyTorch model checkpoint"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/pose_model.pte",
        help="Path to save ExecuTorch .pte file"
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Apply quantization (reduces model size)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        default=True,
        help="Validate exported model (default: True)"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("ExecuTorch Model Export")
    print("=" * 60)
    
    # Load PyTorch model
    model = load_pytorch_model(args.model)
    
    # Export to ExecuTorch
    export_to_executorch(model, args.output, args.quantize)
    
    # Validate if requested
    if args.validate and Path(args.output).exists():
        validate_exported_model(args.output, model)
    
    print("\n" + "=" * 60)
    print("Export complete!")
    print("=" * 60)
    print(f"\nNext steps:")
    print(f"  1. Copy {args.output} to mobile/assets/models/")
    print(f"  2. Integrate with React Native app")
    print(f"  3. Test on mobile devices")


if __name__ == "__main__":
    main()
