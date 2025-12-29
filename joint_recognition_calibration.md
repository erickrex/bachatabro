# Joint Recognition Calibration Guide

This document explains the recent pose-scoring improvements and how you can continue tuning the dance recognizer.

## What Changed
- **Per-joint confidence tracking**: Angle calculations now carry a `angleConfidence` map so we know how trustworthy each joint measurement is.
- **Confidence-aware scoring**: `calculateFrameScore` skips any joint whose confidence drops below `JOINT_CONFIDENCE_THRESHOLD` (currently `0.3`), preventing low-signal detections from forcing scores to 0% or 100%.
- **Session coverage logging**: When a session ends, `useGameStore` logs attempted vs. skipped joints. This makes it easy to see how often the detector fails per device/song.
- **Reference assets updated**: All JSON files under `mobile/assets/poses/` now include `angleConfidence` data (re-generated via `python-tools/backfill_pose_confidence.py`). Any new pose exports must include this metadata.

## How to Calibrate Further
1. **Collect coverage samples**  
   - Run dance sessions on multiple devices.  
   - Check Metro logs for `[PoseScore] Session joint coverage` entries.  
   - Export logs and calculate the average `skipFraction` per device/song.

2. **Adjust the confidence threshold**  
   - Edit `JOINT_CONFIDENCE_THRESHOLD` in `mobile/services/scoreCalculator.ts`.  
   - Lowering it (<0.3) accepts noisier joints (more matches, but riskier).  
   - Raising it ignores more joints (safer scoring, but fewer comparisons).  
   - After each change, rerun `npm test -- scoreCalculator` to ensure property suites still pass.

3. **Inspect joint-level data**  
   - Add temporary logging inside `calculateFrameScore` to print which joints get skipped most often.  
   - Use this to decide whether specific joints need different thresholds (e.g., ankles vs. shoulders). Avoid committing verbose logs—keep them local.

4. **Refresh reference poses when scripts change**  
   - If you modify `python-tools/preprocess_video_yolov8.py`, rerun:  
     ```bash
     cd python-tools
     uv run python regenerate_poses.py --videos ../mobile/assets/videos
     ```  
   - This ensures the shipped assets match the new calculation logic.

5. **Validate end-to-end**  
   - Run `npm test` plus a real device session per calibration round.  
   - Record resulting session scores and skipped fractions before/after each tweak to build intuition on how the threshold impacts game feel.

Following these steps keeps the recognizer accurate while giving us actionable telemetry for future tuning.***
