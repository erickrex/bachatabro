# Reference Videos

This directory contains reference dance videos for each song.

## ✅ Available Videos

1. **callmemaybe.mp4** (14MB) - Call Me Maybe by Carly Rae Jepsen (Easy)
2. **cheapthrills.mp4** (12MB) - Cheap Thrills by Sia (Medium)
3. **dontstartnow.mp4** (22MB) - Don't Start Now by Dua Lipa (Medium)
4. **ghungroo.mp4** (8.2MB) - Ghungroo by Arijit Singh (Hard)
5. **uptownfunk.mp4** (18MB) - Uptown Funk by Bruno Mars (Hard)

**Total**: 5 videos, ~74MB

## Format

- Format: MP4 (H.264)
- Resolution: 720p or 1080p
- Frame rate: 30fps
- Duration: Full song or choreography section

## Usage

These videos are displayed as reference choreography during gameplay. The app shows them side-by-side with the user's camera feed for easy comparison.

## Processing Pose Data

To generate pose data JSON files from these videos:

```bash
cd python-tools

# Process single video
uv run python preprocess_video.py ../mobile/assets/videos/cheapthrills.mp4

# Process all videos
uv run python batch_process.py ../mobile/assets/videos/
```

Generated pose data will be saved to `mobile/assets/poses/`.

## Song Credits

**Disclaimer**: We do not own the rights to any music/videos used in this project. All rights belong to the respective owners. No copyright infringement intended.

1. [Dance Workout] Sia - Cheap Thrills | MYLEE Cardio Dance Workout
2. Call Me Maybe - Carly Rae Jepsen
3. Bruno Mars - Uptown Funk Dance Tutorial
4. Dance on: Ghungroo | WAR
5. Don't Start Now by Dua Lipa - Follow Along Dance Tutorial
