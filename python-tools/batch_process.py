#!/usr/bin/env python3
"""
Batch Processing Script for Bachata Bro Videos
Process all reference videos in the songs directory.
"""

import sys
from pathlib import Path
from preprocess_video import extract_poses_from_video


def batch_process_videos(
    videos_dir: str = "../songs",
    model_path: str = "../model/model.tflite",
    output_dir: str = "../mobile/assets/poses"
):
    """Process all videos in the songs directory."""
    
    videos_path = Path(videos_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all video files
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(videos_path.glob(f'*{ext}'))
    
    if not video_files:
        print(f"No video files found in {videos_dir}")
        return
    
    print(f"Found {len(video_files)} video(s) to process")
    print("=" * 60)
    
    # Process each video
    success_count = 0
    failed_videos = []
    
    for i, video_file in enumerate(video_files, 1):
        print(f"\n[{i}/{len(video_files)}] Processing: {video_file.name}")
        print("-" * 60)
        
        output_file = output_path / f"{video_file.stem}.json"
        
        try:
            extract_poses_from_video(
                str(video_file),
                model_path,
                str(output_file)
            )
            success_count += 1
        except Exception as e:
            print(f"✗ Error processing {video_file.name}: {e}")
            failed_videos.append((video_file.name, str(e)))
    
    # Summary
    print("\n" + "=" * 60)
    print("BATCH PROCESSING SUMMARY")
    print("=" * 60)
    print(f"Total videos: {len(video_files)}")
    print(f"Successfully processed: {success_count}")
    print(f"Failed: {len(failed_videos)}")
    
    if failed_videos:
        print("\nFailed videos:")
        for name, error in failed_videos:
            print(f"  - {name}: {error}")
    
    print(f"\nOutput directory: {output_path.absolute()}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch process dance videos')
    parser.add_argument('--videos', default='../songs', help='Directory containing videos')
    parser.add_argument('--model', default='../model/model.tflite', help='Path to TFLite model')
    parser.add_argument('--output', default='../mobile/assets/poses', help='Output directory')
    
    args = parser.parse_args()
    
    batch_process_videos(args.videos, args.model, args.output)
