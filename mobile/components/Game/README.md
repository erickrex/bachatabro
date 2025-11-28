# Game Components

This directory contains game-related UI components for the Bacha Trainer mobile app.

## DualVideoView

The `DualVideoView` component displays the reference dance video and user camera feed side-by-side (or stacked vertically in portrait mode).

### Features

- **Responsive Layout**: Automatically adjusts layout based on device orientation
  - Landscape: Side-by-side display
  - Portrait: Stacked vertically
- **Synchronized Playback**: Video and camera feed are synchronized
- **Frame Capture**: Captures frames from camera at configurable rate (default: 10fps)
- **Aspect Ratio**: Maintains proper aspect ratio for both video feeds
- **Labels**: Clear labels for "Reference" and "You" views

### Properties Validated

- **P-011**: Display videos side-by-side in landscape orientation
- **P-012**: Stack videos vertically in portrait orientation
- **P-013**: Maintain aspect ratio for both videos
- **P-014**: Synchronize video playback

### Usage

```typescript
import { DualVideoView } from '@/components/Game';

function GameScreen() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFrame = (base64Image: string) => {
    // Process frame for pose detection
    console.log('Frame captured');
  };

  const handleVideoEnd = () => {
    console.log('Video ended');
    setIsPlaying(false);
  };

  return (
    <DualVideoView
      videoUri="https://example.com/dance-video.mp4"
      onFrame={handleFrame}
      isPlaying={isPlaying}
      onVideoEnd={handleVideoEnd}
      onVideoReady={() => console.log('Ready')}
      onError={(error) => console.error(error)}
    />
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `videoUri` | `string` | Yes | URI of the reference dance video |
| `isPlaying` | `boolean` | Yes | Controls playback state |
| `onFrame` | `(base64Image: string) => void` | No | Callback when camera captures a frame |
| `onVideoEnd` | `() => void` | No | Callback when video playback ends |
| `onVideoReady` | `() => void` | No | Callback when both video and camera are ready |
| `onError` | `(error: string) => void` | No | Callback when an error occurs |

### Layout Behavior

#### Landscape Mode (width > height)
```
┌─────────────────────────────────┐
│  Reference  │       You         │
│   Video     │     Camera        │
│             │                   │
└─────────────────────────────────┘
```

#### Portrait Mode (height > width)
```
┌───────────────┐
│  Reference    │
│    Video      │
├───────────────┤
│     You       │
│   Camera      │
└───────────────┘
```

### Implementation Details

- Uses `VideoPlayer` component for reference video
- Uses `CameraView` component for user camera feed
- Automatically detects orientation using `useWindowDimensions`
- Applies horizontal mirroring to camera feed for natural user experience
- Captures frames at 10fps by default (configurable in CameraView)

### Dependencies

- `expo-av`: Video playback
- `expo-camera`: Camera access and frame capture
- `react-native`: Core UI components

### Testing

The component has been tested for:
- Layout responsiveness in different orientations
- Proper integration with VideoPlayer and CameraView
- Callback functionality
- Edge cases (small/large dimensions, missing callbacks)

See `__tests__/DualVideoView.test.tsx` for test implementation.

### Example

See `DualVideoView.example.tsx` for a complete working example.

## Future Components

Additional game components will be added in future sprints:
- `ScoreDisplay`: Real-time score display
- `GameTimer`: Game progress timer
- `PoseOverlay`: Visual pose feedback overlay
