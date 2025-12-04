#!/usr/bin/env python3
"""
Video processing tools for Bacha Trainer
- Convert to 720p
- Cut/trim video segments
- Convert MKV to MP4
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run_ffmpeg(cmd: list, input_file: Path, output_file: Path) -> bool:
    """Run ffmpeg command and show results"""
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ Success! Saved to: {output_file}")
            input_size = input_file.stat().st_size / (1024 * 1024)
            output_size = output_file.stat().st_size / (1024 * 1024)
            print(f"   Input: {input_size:.1f} MB → Output: {output_size:.1f} MB")
            return True
        else:
            print(f"❌ Error:")
            print(result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)
            return False
            
    except FileNotFoundError:
        print("❌ ffmpeg not found. Install with: sudo apt install ffmpeg")
        sys.exit(1)


def convert_to_720p(input_path: str, output_path: str = None) -> None:
    """Convert video to 720p resolution"""
    input_file = Path(input_path)
    
    if not input_file.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)
    
    if output_path is None:
        output_file = input_file.parent / f"{input_file.stem}_720p{input_file.suffix}"
    else:
        output_file = Path(output_path)
    
    print(f"Converting to 720p: {input_file.name}")
    
    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-vf', 'scale=-2:720',
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        str(output_file)
    ]
    
    run_ffmpeg(cmd, input_file, output_file)


def cut_video(input_path: str, start: str, end: str, output_path: str = None) -> None:
    """
    Cut video from start to end time
    
    Args:
        input_path: Path to input video
        start: Start time (format: HH:MM:SS or MM:SS or SS)
        end: End time (format: HH:MM:SS or MM:SS or SS)
        output_path: Output path (optional)
    
    Examples:
        cut_video("video.mp4", "00:30", "02:45")  # 30s to 2m45s
        cut_video("video.mp4", "1:30:00", "1:45:00")  # 1h30m to 1h45m
        cut_video("video.mp4", "90", "180")  # 90s to 180s
    """
    input_file = Path(input_path)
    
    if not input_file.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)
    
    if output_path is None:
        output_file = input_file.parent / f"{input_file.stem}_cut{input_file.suffix}"
    else:
        output_file = Path(output_path)
    
    print(f"Cutting: {input_file.name}")
    print(f"   From: {start} → To: {end}")
    
    # Use -ss before -i for fast seeking, -to for end time
    cmd = [
        'ffmpeg',
        '-ss', start,           # Start time (before -i for fast seek)
        '-i', str(input_file),
        '-to', end,             # End time (relative to start after -ss before -i)
        '-c:v', 'libx264',      # Re-encode for accurate cuts
        '-crf', '23',
        '-preset', 'fast',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        str(output_file)
    ]
    
    # Calculate duration for -to (end relative to new start)
    # When -ss is before -i, -to is relative to the seeked position
    # So we need to calculate: duration = end - start
    try:
        start_seconds = parse_time(start)
        end_seconds = parse_time(end)
        duration = end_seconds - start_seconds
        
        if duration <= 0:
            print(f"Error: End time must be after start time")
            sys.exit(1)
        
        # Use -t (duration) instead of -to for clarity
        cmd = [
            'ffmpeg',
            '-ss', start,
            '-i', str(input_file),
            '-t', str(duration),
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'fast',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-y',
            str(output_file)
        ]
    except ValueError as e:
        print(f"Error parsing time: {e}")
        sys.exit(1)
    
    run_ffmpeg(cmd, input_file, output_file)


def convert_to_mp4(input_path: str, output_path: str = None) -> None:
    """Convert video to MP4 format (works for MKV, AVI, MOV, etc.)"""
    input_file = Path(input_path)
    
    if not input_file.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)
    
    if output_path is None:
        output_file = input_file.parent / f"{input_file.stem}.mp4"
    else:
        output_file = Path(output_path)
    
    print(f"Converting to MP4: {input_file.name}")
    
    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        str(output_file)
    ]
    
    run_ffmpeg(cmd, input_file, output_file)


def parse_time(time_str: str) -> float:
    """
    Parse time string to seconds
    
    Formats:
        SS (e.g., "90" = 90 seconds)
        MM:SS (e.g., "1:30" = 90 seconds)
        HH:MM:SS (e.g., "1:30:00" = 5400 seconds)
    """
    parts = time_str.split(':')
    
    if len(parts) == 1:
        return float(parts[0])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    else:
        raise ValueError(f"Invalid time format: {time_str}")


def main():
    parser = argparse.ArgumentParser(
        description='Video processing tools',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  720p    Convert video to 720p resolution
  cut     Cut video from start to end time
  mp4     Convert video to MP4 format

Examples:
  python video_tools.py 720p video.mp4
  python video_tools.py 720p video.mp4 -o output.mp4
  
  python video_tools.py cut video.mp4 -s 00:30 -e 02:45
  python video_tools.py cut video.mp4 -s 1:30 -e 5:00 -o clip.mp4
  
  python video_tools.py mp4 video.mkv
  python video_tools.py mp4 video.mkv -o output.mp4
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # 720p command
    p_720p = subparsers.add_parser('720p', help='Convert to 720p')
    p_720p.add_argument('input', help='Input video file')
    p_720p.add_argument('-o', '--output', help='Output file path')
    
    # cut command
    p_cut = subparsers.add_parser('cut', help='Cut video segment')
    p_cut.add_argument('input', help='Input video file')
    p_cut.add_argument('-s', '--start', required=True, help='Start time (HH:MM:SS or MM:SS or SS)')
    p_cut.add_argument('-e', '--end', required=True, help='End time (HH:MM:SS or MM:SS or SS)')
    p_cut.add_argument('-o', '--output', help='Output file path')
    
    # mp4 command
    p_mp4 = subparsers.add_parser('mp4', help='Convert to MP4 format')
    p_mp4.add_argument('input', help='Input video file (MKV, AVI, MOV, etc.)')
    p_mp4.add_argument('-o', '--output', help='Output file path')
    
    args = parser.parse_args()
    
    if args.command == '720p':
        convert_to_720p(args.input, args.output)
    elif args.command == 'cut':
        cut_video(args.input, args.start, args.end, args.output)
    elif args.command == 'mp4':
        convert_to_mp4(args.input, args.output)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
