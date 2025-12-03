#!/usr/bin/env python3
"""
Regenerate Pose JSON Files with YOLOv8s-pose

This script:
1. Backs up existing pose JSON files
2. Deletes old pose JSON files
3. Processes all videos with YOLOv8s-pose
4. Generates new pose JSON files with improved accuracy

Usage:
    uv run python regenerate_poses.py --videos ../songs/
    uv run python regenerate_poses.py --videos ../songs/ --no-backup
    uv run python regenerate_poses.py --videos ../mobile/assets/videos/
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Import the YOLOv8 preprocessing function
from preprocess_video_yolov8 import extract_poses_from_video


def backup_existing_poses(poses_dir: Path, backup_dir: Path) -> int:
    """
    Backup existing pose JSON files.
    
    Args:
        poses_dir: Directory containing pose JSON files
        backup_dir: Directory to store backups
        
    Returns:
        Number of files backed up
    """
    if not poses_dir.exists():
        print(f"No existing poses directory: {poses_dir}")
        return 0
    
    json_files = list(poses_dir.glob("*.json"))
    
    if not json_files:
        print("No existing JSON files to backup")
        return 0
    
    # Create backup directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"poses_backup_{timestamp}"
    backup_path.mkdir(parents=True, exist_ok=True)
    
    print(f"\nBacking up {len(json_files)} files to {backup_path}")
    
    for json_file in json_files:
        dest = backup_path / json_file.name
        shutil.copy(json_file, dest)
        print(f"  ✓ Backed up: {json_file.name}")
    
    return len(json_files)


def delete_old_poses(poses_dir: Path) -> int:
    """
    Delete existing pose JSON files.
    
    Args:
        poses_dir: Directory containing pose JSON files
        
    Returns:
        Number of files deleted
    """
    if not poses_dir.exists():
        return 0
    
    json_files = list(poses_dir.glob("*.json"))
    
    if not json_files:
        print("No JSON files to delete")
        return 0
    
    print(f"\nDeleting {len(json_files)} old pose files...")
    
    for json_file in json_files:
        json_file.unlink()
        print(f"  ✗ Deleted: {json_file.name}")
    
    return len(json_files)


def find_videos(videos_dir: Path) -> list:
    """
    Find all video files in a directory.
    
    Args:
        videos_dir: Directory to search
        
    Returns:
        List of video file paths
    """
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.MP4', '.AVI', '.MOV']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(videos_dir.glob(f"*{ext}"))
    
    return sorted(video_files)


def regenerate_poses(
    videos_dir: Path,
    poses_dir: Path,
    model_name: str = "yolov8s-pose.pt",
    device: str = "auto"
) -> tuple:
    """
    Regenerate pose JSON files from videos.
    
    Args:
        videos_dir: Directory containing video files
        poses_dir: Directory to save pose JSON files
        model_name: YOLOv8 model to use
        device: Device to run inference on
        
    Returns:
        Tuple of (success_count, failed_count)
    """
    video_files = find_videos(videos_dir)
    
    if not video_files:
        print(f"\n⚠ No video files found in {videos_dir}")
        print("  Supported formats: .mp4, .avi, .mov, .mkv, .webm")
        return 0, 0
    
    print(f"\nFound {len(video_files)} video(s) to process")
    
    # Ensure output directory exists
    poses_dir.mkdir(parents=True, exist_ok=True)
    
    success_count = 0
    failed_videos = []
    
    for i, video_file in enumerate(video_files, 1):
        print(f"\n[{i}/{len(video_files)}] Processing: {video_file.name}")
        print("-" * 50)
        
        output_file = poses_dir / f"{video_file.stem}.json"
        
        try:
            extract_poses_from_video(
                str(video_file),
                str(output_file),
                model_name=model_name,
                device=device
            )
            success_count += 1
        except Exception as e:
            print(f"✗ Error: {e}")
            failed_videos.append((video_file.name, str(e)))
    
    return success_count, failed_videos


def main():
    parser = argparse.ArgumentParser(
        description="Regenerate pose JSON files with YOLOv8s-pose"
    )
    parser.add_argument(
        "--videos",
        type=str,
        default="../songs",
        help="Directory containing video files"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../mobile/assets/poses",
        help="Output directory for pose JSON files"
    )
    parser.add_argument(
        "--backup-dir",
        type=str,
        default="../mobile/assets/poses_backups",
        help="Directory to store backups"
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup of existing files"
    )
    parser.add_argument(
        "--no-delete",
        action="store_true",
        help="Keep existing files (add new ones)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8s-pose.pt",
        help="YOLOv8 model to use"
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda", "mps"],
        help="Device to run inference on"
    )
    
    args = parser.parse_args()
    
    # Convert to Path objects
    videos_dir = Path(args.videos)
    poses_dir = Path(args.output)
    backup_dir = Path(args.backup_dir)
    
    print("=" * 60)
    print("Regenerate Pose Files with YOLOv8s-pose")
    print("=" * 60)
    print(f"\nModel: YOLOv8s-pose (64.0 AP on COCO)")
    print(f"Videos: {videos_dir.absolute()}")
    print(f"Output: {poses_dir.absolute()}")
    print(f"Device: {args.device}")
    
    # Check if videos directory exists
    if not videos_dir.exists():
        print(f"\n✗ Videos directory not found: {videos_dir}")
        print("\nPlease specify the correct path with --videos")
        print("Example: uv run python regenerate_poses.py --videos /path/to/videos/")
        sys.exit(1)
    
    # Backup existing poses
    if not args.no_backup:
        backed_up = backup_existing_poses(poses_dir, backup_dir)
        if backed_up > 0:
            print(f"\n✓ Backed up {backed_up} files")
    
    # Delete old poses
    if not args.no_delete:
        deleted = delete_old_poses(poses_dir)
        if deleted > 0:
            print(f"✓ Deleted {deleted} old files")
    
    # Regenerate poses
    success, failed = regenerate_poses(
        videos_dir,
        poses_dir,
        model_name=args.model,
        device=args.device
    )
    
    # Summary
    print("\n" + "=" * 60)
    print("REGENERATION COMPLETE")
    print("=" * 60)
    print(f"\nModel: YOLOv8s-pose (64.0 AP)")
    print(f"Successfully processed: {success}")
    print(f"Failed: {len(failed) if isinstance(failed, list) else failed}")
    
    if isinstance(failed, list) and failed:
        print("\nFailed videos:")
        for name, error in failed:
            print(f"  - {name}: {error}")
    
    print(f"\nOutput directory: {poses_dir.absolute()}")
    
    if success > 0:
        print("\n✓ New pose files generated with improved accuracy!")
        print("  The JSON format is backward compatible with the mobile app.")


if __name__ == "__main__":
    main()
