# Game Components

UI components for the Bacha Trainer game screen.

## DualVideoView

Displays reference video and user camera side-by-side.

### Features

- Responsive layout (landscape: side-by-side, portrait: stacked)
- Synchronized playback
- Frame capture for pose detection

### Usage

```typescript
<DualVideoView
  videoUri="path/to/video.mp4"
  isPlaying={true}
  onFrame={(base64) => detectPose(base64)}
  onVideoEnd={() => showScore()}
/>
```

### Layout

```
Landscape:                    Portrait:
┌──────────┬──────────┐      ┌──────────┐
│ Reference│   You    │      │ Reference│
│  Video   │  Camera  │      │  Video   │
└──────────┴──────────┘      ├──────────┤
                             │   You    │
                             │  Camera  │
                             └──────────┘
```
