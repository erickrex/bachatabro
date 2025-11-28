# Models

This directory contains PyTorch models and ExecuTorch exports.

## Generated Files
- `lightweight_pose.pt` - PyTorch pose model
- `pose_model.pte` - ExecuTorch export
- `pose_model_quantized.pte` - Quantized ExecuTorch model
- `keypoint_rcnn.pt` - Keypoint R-CNN model
- `keypoint_rcnn_state.pt` - Model state dict

## Usage

Generate models using:
```bash
uv run python create_lightweight_model.py
uv run python export_model.py --quantize
```

**Note**: Model files (.pt, .pte) are not tracked in git due to size (>200MB).
