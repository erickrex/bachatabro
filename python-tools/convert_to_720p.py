#!/usr/bin/env python3
"""
Convert video to 720p resolution
Maintains aspect ratio and uses H.264 codec for compatibility
"""

import argparse
import subprocess
import sys
from pathlib import Path


def convert_to_720p(input_path: str, output_path: str = None) -> None:
    """
    Convert video to 720p resolution using ffmpeg
    
    Args:
        input_path: Path to input video
        output_path: Path to output video (optional, defaults to input_720p.mp4)
    """
    input_file = Path(input_path)
    
    if not input_file.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Generate output filename if not provided
    if output_path is None:
        output_file = input_file.parent / f"{input_file.stem}_720p{input_file.suffix}"
    else:
        output_file = Path(output_path)
    
    print(f"Converting: {input_file.name}")
    print(f"Output: {output_file.name}")
    
    # FFmpeg command to convert to 720p
    # -vf scale=-2:720 maintains aspect ratio (width auto-calculated, height 720)
    # -c:v libx264 uses H.264 codec
    # -crf 23 quality (lower = better, 18-28 is good range)
    # -preset medium encoding speed
    # -c:a aac audio codec
    # -b:a 192k audio bitrate
    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-vf', 'scale=-2:720',  # Scale to 720p height, maintain aspect ratio
        '-c:v', 'libx264',      # H.264 video codec
        '-crf', '23',           # Quality (lower = better)
        '-preset', 'medium',    # Encoding speed
        '-c:a', 'aac',          # AAC audio codec
        '-b:a', '192k',         # Audio bitrate
        '-y',                   # Overwrite output file
        str(output_file)
    ]
    
    try:
        # Run ffmpeg
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ Success! Saved to: {output_file}")
            
            # Show file sizes
            input_size = input_file.stat().st_size / (1024 * 1024)
            output_size = output_file.stat().st_size / (1024 * 1024)
            print(f"Input size: {input_size:.1f} MB")
            print(f"Output size: {output_size:.1f} MB")
            print(f"Compression: {(1 - output_size/input_size) * 100:.1f}%")
        else:
            print(f"❌ Error converting video:")
            print(result.stderr)
            sys.exit(1)
            
    except FileNotFoundError:
        print("❌ Error: ffmpeg not found. Please install ffmpeg:")
        print("  Ubuntu/Debian: sudo apt install ffmpeg")
        print("  macOS: brew install ffmpeg")
        print("  Windows: Download from https://ffmpeg.org/download.html")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Convert video to 720p resolution',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python convert_to_720p.py video.mp4
  python convert_to_720p.py video.mp4 -o output.mp4
  python convert_to_720p.py *.mp4
        """
    )
    
    parser.add_argument(
        'input',
        nargs='+',
        help='Input video file(s)'
    )
    
    parser.add_argument(
        '-o', '--output',
        help='Output file path (only for single input)'
    )
    
    args = parser.parse_args()
    
    # Check if output is specified with multiple inputs
    if len(args.input) > 1 and args.output:
        print("Error: Cannot specify output path with multiple input files")
        sys.exit(1)
    
    # Process each input file
    for input_file in args.input:
        convert_to_720p(input_file, args.output)
        print()  # Blank line between files


if __name__ == '__main__':
    main()
