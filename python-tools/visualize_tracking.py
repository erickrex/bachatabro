#!/usr/bin/env python3
# /// script
# dependencies = [
#     "opencv-python>=4.10.0",
#     "numpy>=1.24.0",
#     "torch>=2.1.0",
#     "ultralytics>=8.0.0",
#     "tqdm>=4.66.0",
# ]
# ///
"""
Visualize YOLOv8 pose tracking on videos to verify which dancer is being tracked.

Usage:
    python visualize_tracking.py <video_path> [output_path]
    
Examples:
    python visualize_tracking.py dance_video.mp4
    python visualize_tracking.py dance_video.mp4 ./output/tracked_video.mp4
"""

import cv2
import numpy as np
import torch
import argparse
from pathlib import Path
from tqdm import tqdm

try:
    from ultralytics import YOLO
except ImportError:
    print("Error: ultralytics not installed. Install with: pip install ultralytics")
    exit(1)


# COCO keypoint connections for skeleton drawing
SKELETON_CONNECTIONS = [
    (0, 1), (0, 2),  # nose to eyes
    (1, 3), (2, 4),  # eyes to ears
    (0, 5), (0, 6),  # nose to shoulders
    (5, 6),  # shoulders
    (5, 7), (7, 9),  # left arm
    (6, 8), (8, 10),  # right arm
    (5, 11), (6, 12),  # shoulders to hips
    (11, 12),  # hips
    (11, 13), (13, 15),  # left leg
    (12, 14), (14, 16),  # right leg
]

# Colors for visualization
KEYPOINT_COLOR = (0, 255, 0)  # Green
SKELETON_COLOR = (255, 0, 0)  # Blue
BBOX_COLOR = (0, 255, 255)  # Yellow
TEXT_COLOR = (255, 255, 255)  # White


def visualize_tracking(
    video_path: str,
    output_path: str = None,
    model_name: str = 'yolov8s-pose.pt',
    device: str = 'auto',
    show_all: bool = False
):
    """
    Visualize pose tracking on video.
    
    Args:
        video_path: Path to input video
        output_path: Path to save output video (optional)
        model_name: YOLOv8 model name
        device: Device to run on
        show_all: If True, show all detected people; if False, only show the tracked one
    """
    # Determine device
    if device == 'auto':
        if torch.cuda.is_available():
            device = 'cuda'
        elif torch.backends.mps.is_available():
            device = 'mps'
        else:
            device = 'cpu'
    
    print(f"Loading YOLOv8s-pose model on {device}...")
    model = YOLO(model_name)
    model.to(device)
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video: {width}x{height} @ {fps} fps, {total_frames} frames")
    print(f"Device: {device}")
    
    # Set up output video writer if output path provided
    out = None
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))
        print(f"Output will be saved to: {output_path}")
    
    print("\nProcessing video... (Press 'q' to quit)")
    
    with tqdm(total=total_frames, desc="Processing", unit="frame") as pbar:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run inference
            results = model(frame, verbose=False)
            
            if len(results) > 0 and results[0].keypoints is not None:
                result = results[0]
                
                # Get all detections
                if result.keypoints.data.shape[0] > 0:
                    num_people = result.keypoints.data.shape[0]
                    
                    # Find the best detection (highest confidence)
                    if result.boxes is not None and len(result.boxes) > 0:
                        confidences = result.boxes.conf.cpu().numpy()
                        best_idx = confidences.argmax()
                    else:
                        best_idx = 0
                    
                    # Draw all people if show_all is True
                    if show_all:
                        for idx in range(num_people):
                            color = KEYPOINT_COLOR if idx == best_idx else (128, 128, 128)
                            skeleton_color = SKELETON_COLOR if idx == best_idx else (64, 64, 64)
                            draw_pose(frame, result, idx, color, skeleton_color, is_tracked=(idx == best_idx))
                    else:
                        # Only draw the tracked person
                        draw_pose(frame, result, best_idx, KEYPOINT_COLOR, SKELETON_COLOR, is_tracked=True)
                    
                    # Add info text
                    info_text = f"People detected: {num_people} | Tracking: Person {best_idx + 1}"
                    if result.boxes is not None and len(result.boxes) > 0:
                        conf = confidences[best_idx]
                        info_text += f" (conf: {conf:.2f})"
                    
                    cv2.putText(frame, info_text, (10, 30), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, TEXT_COLOR, 2)
            
            # Write or display frame
            if out:
                out.write(frame)
            
            # Display frame (optional - comment out if running headless)
            cv2.imshow('Pose Tracking Visualization', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\nStopped by user")
                break
            
            pbar.update(1)
    
    # Cleanup
    cap.release()
    if out:
        out.release()
    cv2.destroyAllWindows()
    
    if output_path:
        print(f"\n✓ Output saved to: {output_path}")
    print("✓ Done!")


def draw_pose(frame, result, person_idx, keypoint_color, skeleton_color, is_tracked=True):
    """
    Draw pose keypoints and skeleton on frame.
    
    Args:
        frame: Video frame
        result: YOLOv8 result object
        person_idx: Index of person to draw
        keypoint_color: Color for keypoints
        skeleton_color: Color for skeleton lines
        is_tracked: Whether this is the tracked person
    """
    kpts_data = result.keypoints.data[person_idx].cpu().numpy()
    
    # Draw bounding box
    if result.boxes is not None and person_idx < len(result.boxes):
        box = result.boxes.xyxy[person_idx].cpu().numpy()
        x1, y1, x2, y2 = map(int, box)
        thickness = 3 if is_tracked else 1
        color = BBOX_COLOR if is_tracked else (128, 128, 128)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
        
        # Add label
        label = "TRACKED" if is_tracked else f"Person {person_idx + 1}"
        cv2.putText(frame, label, (x1, y1 - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    # Draw skeleton connections
    for connection in SKELETON_CONNECTIONS:
        pt1_idx, pt2_idx = connection
        if pt1_idx < len(kpts_data) and pt2_idx < len(kpts_data):
            x1, y1, conf1 = kpts_data[pt1_idx]
            x2, y2, conf2 = kpts_data[pt2_idx]
            
            if conf1 > 0.5 and conf2 > 0.5:
                pt1 = (int(x1), int(y1))
                pt2 = (int(x2), int(y2))
                thickness = 3 if is_tracked else 1
                cv2.line(frame, pt1, pt2, skeleton_color, thickness)
    
    # Draw keypoints
    for i, (x, y, conf) in enumerate(kpts_data):
        if conf > 0.5:
            center = (int(x), int(y))
            radius = 5 if is_tracked else 3
            cv2.circle(frame, center, radius, keypoint_color, -1)
            cv2.circle(frame, center, radius + 2, (0, 0, 0), 1)


def main():
    parser = argparse.ArgumentParser(
        description='Visualize YOLOv8 pose tracking on videos',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'video',
        help='Path to input video file'
    )
    parser.add_argument(
        'output',
        nargs='?',
        default=None,
        help='Path to save output video (optional)'
    )
    parser.add_argument(
        '--model',
        default='yolov8s-pose.pt',
        help='YOLOv8 model name or path (default: yolov8s-pose.pt)'
    )
    parser.add_argument(
        '--device',
        default='auto',
        choices=['auto', 'cpu', 'cuda', 'mps'],
        help='Device to run inference on'
    )
    parser.add_argument(
        '--show-all',
        action='store_true',
        help='Show all detected people (tracked one highlighted)'
    )
    
    args = parser.parse_args()
    
    visualize_tracking(
        args.video,
        args.output,
        args.model,
        args.device,
        args.show_all
    )


if __name__ == '__main__':
    main()
