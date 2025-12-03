#!/usr/bin/env python3
# /// script
# dependencies = ["yt-dlp>=2024.0.0"]
# ///
"""
Download YouTube videos or audio using yt-dlp.

Usage:
    python download_youtube.py <youtube_url> [output_path]
    python download_youtube.py --audio <youtube_url> [output_path]
    
Examples:
    # Download video (720p)
    python download_youtube.py https://www.youtube.com/watch?v=dQw4w9WgXcQ
    
    # Download audio only (mp3)
    python download_youtube.py --audio https://www.youtube.com/watch?v=dQw4w9WgXcQ
    python download_youtube.py --audio https://www.youtube.com/watch?v=dQw4w9WgXcQ ./music/
"""

import argparse
import sys
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    print("Error: yt-dlp is not installed. Please install it with:")
    print("  pip install yt-dlp")
    print("  or")
    print("  uv pip install yt-dlp")
    sys.exit(1)


def download_video(url: str, output_path: str = None) -> None:
    """
    Download a YouTube video using yt-dlp.
    
    Args:
        url: YouTube video URL
        output_path: Optional output directory. If not provided, downloads to current directory.
    """
    # Configure yt-dlp options
    ydl_opts = {
        'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        'outtmpl': str(Path(output_path or '.') / '%(title)s.%(ext)s'),
        'noplaylist': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Get video info first
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Unknown')
            print(f"Downloading video: {video_title}")
            print(f"URL: {url}")
            
            # Download the video
            ydl.download([url])
            
            print(f"\n✓ Successfully downloaded: {video_title}")
            
    except yt_dlp.utils.DownloadError as e:
        print(f"Error downloading video: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


def download_audio(url: str, output_path: str = None) -> None:
    """
    Download audio from a YouTube video as MP3.
    
    Args:
        url: YouTube video URL
        output_path: Optional output directory. If not provided, downloads to current directory.
    """
    # Configure yt-dlp options for audio
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(Path(output_path or '.') / '%(title)s.%(ext)s'),
        'noplaylist': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Get video info first
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Unknown')
            print(f"Downloading audio: {video_title}")
            print(f"URL: {url}")
            print(f"Format: MP3 (192 kbps)")
            
            # Download and convert to MP3
            ydl.download([url])
            
            print(f"\n✓ Successfully downloaded audio: {video_title}.mp3")
            
    except yt_dlp.utils.DownloadError as e:
        print(f"Error downloading audio: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Download YouTube videos or audio using yt-dlp',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'url',
        help='YouTube video URL to download'
    )
    parser.add_argument(
        'output_path',
        nargs='?',
        default=None,
        help='Output directory (default: current directory)'
    )
    parser.add_argument(
        '--audio',
        '-a',
        action='store_true',
        help='Download audio only as MP3 (192 kbps)'
    )
    
    args = parser.parse_args()
    
    # Validate URL
    if 'youtube.com' not in args.url and 'youtu.be' not in args.url:
        print("Warning: This doesn't look like a YouTube URL.", file=sys.stderr)
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Create output directory if it doesn't exist
    if args.output_path:
        output_dir = Path(args.output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path_str = str(output_dir)
    else:
        output_path_str = None
    
    # Download audio or video
    if args.audio:
        download_audio(args.url, output_path_str)
    else:
        download_video(args.url, output_path_str)


if __name__ == '__main__':
    main()

