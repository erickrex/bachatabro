#!/usr/bin/env python3
"""
Batch Processing Script for Bacha Trainer Videos (YOLOv8s-pose Version)

Process all reference videos in the songs directory using YOLOv8s-pose
for improved pose estimation accuracy.
"""

import sys
from pathlib import Path
from preprocess_video_yolov8 import extract_poses_from_video


def batch_process_videos(
    videos_dir: str = "../songs",
    output_dir: str = "../mobile/assets/poses",
    model_name: str = "yolov8s-pose.pt",
    device: str = "auto"
):
    """
    Process all videos in the songs directory using YOLOv8s-pose.
    
    Args:
        videos_dir: Directory containing video files
        output_dir: Directory to save JSON pose files
        model_name: YOLOv8 model name or path
        device: Device to run inference on
    """
    
    videos_path = Path(videos_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all video files
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(videos_path.glob(f'*{ext}'))
        video_files.extend(videos_path.glob(f'*{ext.upper()}'))
    
    if not video_files:
        print(f"No video files found in {videos_dir}")
        print(f"Supported formats: {', '.join(video_extensions)}")
        return
    
    print("=" * 60)
    print("Bacha Trainer - Batch Video Processing")
    print("Using YOLOv8s-pose (64.0 AP on COCO)")
    print("=" * 60)
    print(f"\nFound {len(video_files)} video(s) to process")
    print(f"Output directory: {output_path.absolute()}")
    print(f"Device: {device}")
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
                str(output_file),
                model_name=model_name,
                device=device
            )
            success_count += 1
        except Exception as e:
            print(f"✗ Error processing {video_file.name}: {e}")
            failed_videos.append((video_file.name, str(e)))
    
    # Summary
    print("\n" + "=" * 60)
    print("BATCH PROCESSING SUMMARY")
    print("=" * 60)
    print(f"Model: YOLOv8s-pose (64.0 AP)")
    print(f"Total videos: {len(video_files)}")
    print(f"Successfully processed: {success_count}")
    print(f"Failed: {len(failed_videos)}")
    
    if failed_videos:
        print("\nFailed videos:")
        for name, error in failed_videos:
            print(f"  - {name}: {error}")
    
    print(f"\nOutput directory: {output_path.absolute()}")
    
    if success_count > 0:
        print("\n✓ Pose data generated with improved accuracy!")
        print("  The JSON files are compatible with the existing mobile app.")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Batch process dance videos using YOLOv8s-pose'
    )
    parser.add_argument(
        'videos_dir',
        nargs='?',
        default='../songs',
        help='Directory containing videos (default: ../songs)'
    )
    parser.add_argument(
        '--output',
        default='../mobile/assets/poses',
        help='Output directory for JSON files'
    )
    parser.add_argument(
        '--model',
        default='yolov8s-pose.pt',
        help='YOLOv8 model name or path'
    )
    parser.add_argument(
        '--device',
        default='auto',
        choices=['auto', 'cpu', 'cuda', 'mps'],
        help='Device to run inference on'
    )
    
    args = parser.parse_args()
    
    batch_process_videos(
        args.videos_dir,
        args.output,
        args.model,
        args.device
    )
