# Python Tools - Quick Start Guide

## Prerequisites

- UV package manager installed
- Reference dance videos in `../songs/` directory
- TFLite pose detection model at `../model/model.tflite`

## Setup (First Time)

```bash
cd python-tools
uv sync
```

This will:
- Install Python 3.12.6 if needed
- Create a virtual environment
- Install all dependencies from pyproject.toml

## Process Videos

### Single Video

```bash
uv run python preprocess_video.py ../songs/cheapthrills.mp4
```

Output: `../mobile/assets/poses/cheapthrills.json`

### All Videos (Batch)

```bash
uv run python batch_process.py ../songs/
```

This processes all `.mp4`, `.avi`, `.mov`, and `.mkv` files in the songs directory.

### Custom Output Directory

```bash
uv run python preprocess_video.py ../songs/cheapthrills.mp4 --output ./output/
```

## Validate Output

```bash
# Validate single file
uv run python validate_json.py ../mobile/assets/poses/cheapthrills.json

# Validate all files in directory
uv run python validate_json.py ../mobile/assets/poses/
```

## Adding Dependencies

Need a new Python package?

```bash
# Add package to pyproject.toml and install
uv add package-name

# Or manually edit pyproject.toml and sync
uv sync
```

## Troubleshooting

### "Model not found" error
- Ensure TFLite model exists at `../model/model.tflite`
- Check the `--model` parameter if using a different location

### "Video not found" error
- Verify video file path is correct
- Ensure video format is supported (MP4, AVI, MOV, MKV)

### "Permission denied" error
- Check write permissions for output directory
- Output directory will be created automatically if it doesn't exist

### Slow processing
- Processing speed depends on:
  - Video resolution (720p recommended)
  - Video length
  - CPU performance
- Typical speed: ~30-60 frames per second on M1/M2 Mac

## Output Format

Each JSON file contains:
- Song metadata (ID, FPS, total frames)
- Frame-by-frame data:
  - 17 keypoints with x, y, confidence
  - 8 joint angles in degrees
  - Timestamp for each frame

## Best Practices

1. **Always use UV**: Run scripts with `uv run python` to ensure correct environment
2. **Validate output**: Always run validation after processing
3. **Batch processing**: Process multiple videos at once for efficiency
4. **Keep originals**: Don't delete source videos after processing
5. **Version control**: Commit JSON files to git for mobile app

## Next Steps

After processing:
1. Validate JSON files
2. Copy to `../mobile/assets/poses/`
3. Rebuild mobile app
4. Test in-game with new songs
