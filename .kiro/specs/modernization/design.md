# Bacha Trainer Modernization - Design Document

## 1. Architecture Overview

This document describes the system architecture for the modernized Bacha Trainer application using React Native with Expo for the frontend and Python 3.12.6 with FastAPI for the backend, optimized for ARM architectures.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Mobile App (React Native + Expo)         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Presentation Layer                               │  │
│  │  - Home Screen                                    │  │
│  │  - Game Screen                                    │  │
│  │  - Results Screen                                 │  │
│  │  - Leaderboard Screen                             │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                             │  │
│  │  - Game State Management (Zustand)                │  │
│  │  - Camera Management                              │  │
│  │  - Video/Audio Playback                           │  │
│  │  - Local Storage (SQLite)                         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Service Layer                                    │  │
│  │  - API Client (Axios)                             │  │
│  │  - Pose Detection Service (ML Kit - Optional)     │  │
│  │  - Storage Service                                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                    HTTP/REST API
                          │
┌─────────────────────────────────────────────────────────┐
│          Backend Server (Python + FastAPI)              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  API Layer (FastAPI)                              │  │
│  │  - Game Routes                                    │  │
│  │  - Video Routes                                   │  │
│  │  - Score Routes                                   │  │
│  │  - Audio Routes                                   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                             │  │
│  │  - Pose Engine (TFLite + XNNPACK)                 │  │
│  │  - Score Engine                                   │  │
│  │  - Video Processor (OpenCV)                       │  │
│  │  - Angle Calculator                               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Data Access Layer                                │  │
│  │  - SQLAlchemy ORM                                 │  │
│  │  - SQLite/PostgreSQL                              │  │
│  │  - File Storage                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                    TFLite Model
                          │
┌─────────────────────────────────────────────────────────┐
│              ML Model (Pose Estimation)                 │
│              model.tflite (MoveNet)                     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Separation of Concerns**: Clear boundaries between presentation, business logic, and data layers
2. **ARM Optimization**: Use ARM-specific optimizations at every layer
3. **Offline-First**: Core gameplay works without backend (leaderboard requires connection)
4. **Stateless API**: Backend API is stateless for horizontal scaling
5. **Progressive Enhancement**: Basic features work everywhere, advanced features on capable devices



## 2. Frontend Architecture (React Native + Expo)

### 2.1 Project Structure

```
mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigation layout
│   │   ├── index.tsx            # Home screen
│   │   ├── game.tsx             # Game screen
│   │   ├── results.tsx          # Results screen
│   │   └── leaderboard.tsx      # Leaderboard screen
│   ├── _layout.tsx              # Root layout
│   ├── +not-found.tsx           # 404 page
│   └── +html.tsx                # HTML template
├── components/
│   ├── Camera/
│   │   ├── CameraView.tsx       # Camera component
│   │   ├── CameraControls.tsx   # Camera controls
│   │   └── PoseOverlay.tsx      # Pose visualization
│   ├── Video/
│   │   ├── VideoPlayer.tsx      # Video player
│   │   ├── VideoControls.tsx    # Playback controls
│   │   └── VideoProgress.tsx    # Progress bar
│   ├── Game/
│   │   ├── DualVideoView.tsx    # Side-by-side videos
│   │   ├── ScoreDisplay.tsx     # Real-time score
│   │   └── GameTimer.tsx        # Game timer
│   ├── Leaderboard/
│   │   ├── LeaderboardTable.tsx # Score table
│   │   └── ScoreEntry.tsx       # Single score row
│   └── UI/
│       ├── Button.tsx           # Custom button
│       ├── Card.tsx             # Card component
│       ├── Loading.tsx          # Loading indicator
│       └── ErrorBoundary.tsx    # Error boundary
├── hooks/
│   ├── useCamera.ts             # Camera hook
│   ├── usePoseDetection.ts     # Pose detection hook
│   ├── useGameState.ts          # Game state hook
│   ├── useAudio.ts              # Audio hook
│   └── useAPI.ts                # API hook
├── services/
│   ├── api.ts                   # API client
│   ├── poseDetection.ts         # Pose detection service
│   ├── storage.ts               # Local storage service
│   └── analytics.ts             # Analytics service
├── store/
│   ├── gameStore.ts             # Game state (Zustand)
│   ├── scoreStore.ts            # Score state
│   └── settingsStore.ts         # Settings state
├── types/
│   ├── game.ts                  # Game types
│   ├── pose.ts                  # Pose types
│   ├── api.ts                   # API types
│   └── index.ts                 # Type exports
├── utils/
│   ├── angleCalculator.ts       # Angle calculations
│   ├── constants.ts             # Constants
│   ├── helpers.ts               # Helper functions
│   └── validation.ts            # Validation functions
├── assets/
│   ├── images/                  # Image assets
│   ├── fonts/                   # Custom fonts
│   └── videos/                  # Local videos (optional)
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── tailwind.config.js           # Tailwind config
└── README.md                    # Documentation
```

### 2.2 Component Design

#### 2.2.1 CameraView Component

**Purpose**: Capture user video feed and extract frames

**Props**:
```typescript
interface CameraViewProps {
  onFrame: (frameBase64: string, frameNumber: number) => void;
  isRecording: boolean;
  mirror?: boolean;
  quality?: number;
}
```

**State**:
- Camera permission status
- Camera ready state
- Frame counter
- Error state

**Behavior**:
- Request camera permissions on mount
- Capture frames at configurable rate (default: 10fps)
- Mirror video horizontally
- Handle camera errors gracefully
- Clean up resources on unmount

**Properties**:
- **P-001**: Shall request camera permissions on mount
- **P-002**: Shall capture frames at 10fps minimum
- **P-003**: Shall mirror video feed horizontally
- **P-004**: Shall handle camera errors with user-friendly messages
- **P-005**: Shall clean up camera resources on unmount



#### 2.2.2 VideoPlayer Component

**Purpose**: Play reference dance video

**Props**:
```typescript
interface VideoPlayerProps {
  videoUrl: string;
  onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
  shouldPlay: boolean;
  onEnd: () => void;
}
```

**State**:
- Playback status (playing, paused, buffering)
- Current time
- Duration
- Error state

**Behavior**:
- Load video from URL
- Synchronize with audio
- Handle playback errors
- Report playback status

**Properties**:
- **P-006**: Shall load video from backend URL
- **P-007**: Shall synchronize with audio playback
- **P-008**: Shall report playback status every 100ms
- **P-009**: Shall handle video loading errors
- **P-010**: Shall support pause/resume

#### 2.2.3 DualVideoView Component

**Purpose**: Display reference video and camera feed side-by-side

**Props**:
```typescript
interface DualVideoViewProps {
  videoUrl: string;
  isPlaying: boolean;
  onFrame: (frameBase64: string) => void;
  onVideoEnd: () => void;
}
```

**Layout**:
- Portrait: Videos stacked vertically
- Landscape: Videos side-by-side
- Responsive sizing based on screen dimensions

**Properties**:
- **P-011**: Shall display videos side-by-side in landscape
- **P-012**: Shall stack videos vertically in portrait
- **P-013**: Shall maintain aspect ratio for both videos
- **P-014**: Shall synchronize video playback

#### 2.2.4 ScoreDisplay Component

**Purpose**: Show real-time score during gameplay

**Props**:
```typescript
interface ScoreDisplayProps {
  currentScore: number;
  breakdown?: JointScores;
  animated?: boolean;
}
```

**Behavior**:
- Display score with smooth animations
- Show score breakdown on tap
- Update in real-time

**Properties**:
- **P-015**: Shall display score with smooth animations
- **P-016**: Shall update score in real-time (<100ms delay)
- **P-017**: Shall show score breakdown on user interaction

### 2.3 State Management (Zustand)

#### 2.3.1 Game Store

```typescript
interface GameState {
  // State
  sessionId: string | null;
  currentSong: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentScore: number;
  userAngles: JointAngles[];
  refAngles: JointAngles[];
  frameCount: number;
  
  // Actions
  startGame: (songId: string) => Promise<void>;
  stopGame: () => Promise<void>;
  pauseGame: () => void;
  resumeGame: () => void;
  processFrame: (frameBase64: string, frameNumber: number) => Promise<void>;
  updateScore: (score: number) => void;
  calculateFinalScore: () => Promise<number>;
  reset: () => void;
}
```

**Properties**:
- **P-018**: Shall maintain game state across components
- **P-019**: Shall persist state to local storage
- **P-020**: Shall handle state updates atomically
- **P-021**: Shall provide type-safe state access



### 2.4 API Client Design

```typescript
// services/api.ts

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000'
  : process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  // Add auth token if available
  // Log requests in dev mode
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally
    // Retry logic for transient failures
    return Promise.reject(error);
  }
);

export const gameAPI = {
  startGame: (songId: string) => 
    api.post('/api/game/start', { songId }),
  
  stopGame: (sessionId: string) => 
    api.post('/api/game/stop', { sessionId }),
  
  getStatus: (sessionId: string) => 
    api.get(`/api/game/status/${sessionId}`),
};

export const videoAPI = {
  processFrame: (data: ProcessFrameRequest) => 
    api.post('/api/video/process-frame', data),
  
  listVideos: () => 
    api.get('/api/video/list'),
  
  getVideoUrl: (videoId: string) => 
    `${API_BASE_URL}/api/video/${videoId}`,
};

export const scoreAPI = {
  calculateScore: (sessionId: string, data: ScoreData) => 
    api.post('/api/score/calculate', { sessionId, ...data }),
  
  getLeaderboard: (limit: number = 5) => 
    api.get(`/api/leaderboard?limit=${limit}`),
};
```

**Properties**:
- **P-022**: Shall handle network errors gracefully
- **P-023**: Shall implement retry logic for failed requests
- **P-024**: Shall timeout requests after 10 seconds
- **P-025**: Shall provide type-safe API methods

## 3. Backend Architecture (Python + FastAPI)

### 3.1 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application
│   ├── config.py                # Configuration
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py              # Dependencies
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── game.py          # Game endpoints
│   │       ├── video.py         # Video endpoints
│   │       ├── score.py         # Score endpoints
│   │       └── audio.py         # Audio endpoints
│   ├── core/
│   │   ├── __init__.py
│   │   ├── pose_engine.py       # TFLite inference
│   │   ├── score_engine.py      # Score calculation
│   │   ├── video_processor.py   # Video processing
│   │   ├── angle_calculator.py  # Angle calculations
│   │   └── arm_optimizer.py     # ARM optimizations
│   ├── models/
│   │   ├── __init__.py
│   │   ├── game.py              # Pydantic models
│   │   ├── score.py
│   │   ├── video.py
│   │   └── schemas.py           # Shared schemas
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py              # Base classes
│   │   ├── session.py           # DB session
│   │   ├── models.py            # SQLAlchemy models
│   │   └── crud.py              # CRUD operations
│   └── utils/
│       ├── __init__.py
│       ├── keypoints.py         # Keypoint definitions
│       ├── helpers.py           # Helper functions
│       └── logging.py           # Logging config
├── assets/
│   ├── models/
│   │   └── model.tflite         # Pose estimation model
│   ├── videos/
│   │   ├── cheapthrills.mp4
│   │   └── ...
│   └── audio/
│       ├── cheapthrills.mp3
│       └── ...
├── tests/
│   ├── __init__.py
│   ├── conftest.py              # Pytest fixtures
│   ├── test_api/
│   │   ├── test_game.py
│   │   ├── test_video.py
│   │   └── test_score.py
│   └── test_core/
│       ├── test_pose_engine.py
│       └── test_score_engine.py
├── scripts/
│   ├── init_db.py               # Initialize database
│   ├── preprocess_videos.py    # Video preprocessing
│   └── benchmark.py             # Performance benchmarks
├── pyproject.toml               # UV configuration
├── Dockerfile                   # Docker image
├── docker-compose.yml           # Docker Compose
└── README.md                    # Documentation
```



### 3.2 Core Components

#### 3.2.1 Pose Engine (ARM Optimized)

```python
# app/core/pose_engine.py

import platform
import numpy as np
try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    import tensorflow.lite as tflite

class PoseEngine:
    """ARM-optimized pose detection engine using TFLite"""
    
    def __init__(self, model_path: str):
        self.interpreter = self._create_interpreter(model_path)
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
    
    def _create_interpreter(self, model_path: str):
        """Create interpreter with ARM optimizations"""
        machine = platform.machine()
        
        if machine in ['arm64', 'aarch64']:
            # ARM: Enable XNNPACK delegate
            interpreter = tflite.Interpreter(
                model_path=model_path,
                experimental_delegates=[
                    tflite.load_delegate('libxnnpack_delegate.so')
                ],
                num_threads=4
            )
        else:
            interpreter = tflite.Interpreter(
                model_path=model_path,
                num_threads=4
            )
        
        interpreter.allocate_tensors()
        return interpreter
    
    def process_frame(self, frame: np.ndarray) -> dict:
        """Process frame and return keypoints"""
        # Resize to 192x192
        # Run inference
        # Parse keypoints
        # Return dict with keypoints and confidence
        pass
```

**Properties**:
- **P-026**: Shall use TFLite Runtime (not full TensorFlow)
- **P-027**: Shall enable XNNPACK delegate on ARM devices
- **P-028**: Shall use 4 threads for multi-core ARM CPUs
- **P-029**: Shall process frames in <100ms on Raspberry Pi 4
- **P-030**: Shall return 17 keypoints with confidence scores

#### 3.2.2 Score Engine

```python
# app/core/score_engine.py

class ScoreEngine:
    """Calculate game scores based on pose comparison"""
    
    @staticmethod
    def compare_angles(
        ref_angles: List[JointAngles],
        user_angles: List[JointAngles],
        threshold: int = 20
    ) -> Dict[str, int]:
        """Compare angles and return scores per joint"""
        pass
    
    @staticmethod
    def calculate_final_score(
        joint_scores: Dict[str, int]
    ) -> int:
        """Calculate final score (0-100)"""
        # Average all joint scores
        # Add +20 bonus
        # Cap at 100
        pass
```

**Properties**:
- **P-031**: Shall compare angles with configurable threshold
- **P-032**: Shall return scores in range 0-100
- **P-033**: Shall apply +20 bonus (capped at 100)
- **P-034**: Shall complete calculation in <500ms

### 3.3 API Design

#### 3.3.1 Game Endpoints

```python
# app/api/routes/game.py

@router.post("/start", response_model=GameStartResponse)
async def start_game(request: GameStartRequest):
    """Start new game session"""
    # Generate session ID
    # Create session in database
    # Return session details
    pass

@router.post("/stop")
async def stop_game(session_id: str):
    """End game session"""
    # Update session status
    # Clean up resources
    pass
```

#### 3.3.2 Video Processing Endpoints

```python
# app/api/routes/video.py

@router.post("/process-frame", response_model=FrameProcessResponse)
async def process_frame(request: FrameProcessRequest):
    """Process single frame for pose detection"""
    # Decode base64 image
    # Run pose detection
    # Calculate angles
    # Return keypoints and angles
    pass
```

**Properties**:
- **P-035**: Shall validate base64 image data
- **P-036**: Shall limit image size to 10MB
- **P-037**: Shall implement rate limiting (30 req/min)
- **P-038**: Shall return results in <100ms

### 3.4 Database Schema

```python
# app/db/models.py

class GameSession(Base):
    __tablename__ = "game_sessions"
    
    id = Column(String, primary_key=True)
    song_id = Column(String, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    status = Column(String, default="active")
    
    scores = relationship("Score", back_populates="session")

class Score(Base):
    __tablename__ = "scores"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String, ForeignKey("game_sessions.id"))
    final_score = Column(Integer, nullable=False)
    left_arm_score = Column(Integer)
    right_arm_score = Column(Integer)
    # ... other joint scores
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("GameSession", back_populates="scores")
```

## 4. ARM Optimization Strategy

### 4.1 Backend Optimizations

1. **TFLite Runtime**: Use 1MB runtime instead of 500MB TensorFlow
2. **XNNPACK Delegate**: Enable ARM NEON SIMD instructions
3. **uvloop**: 2-4x faster async event loop
4. **httptools**: Faster HTTP parsing
5. **opencv-headless**: Remove GUI dependencies
6. **Multi-threading**: Utilize all ARM cores

### 4.2 Frontend Optimizations

1. **Hermes Engine**: 2x faster JavaScript execution
2. **Frame Sampling**: Process every 3rd frame
3. **Image Compression**: Reduce payload size
4. **Native Animations**: Use reanimated for 60fps
5. **Memory Management**: Proper cleanup and caching

## 5. Data Flow

### 5.1 Game Flow

```
1. User selects song → API: GET /api/video/list
2. User starts game → API: POST /api/game/start
3. Video plays + Camera captures frames
4. Every 3rd frame → API: POST /api/video/process-frame
5. Backend returns angles → Frontend calculates score
6. Video ends → API: POST /api/score/calculate
7. Display final score → API: GET /api/leaderboard
```

### 5.2 Frame Processing Flow

```
Camera → Capture Frame → Compress → Base64 Encode
    ↓
Send to Backend API
    ↓
Decode → Resize (192x192) → TFLite Inference
    ↓
Extract Keypoints → Calculate Angles
    ↓
Return to Frontend → Update Score Display
```

## 6. Security Design

### 6.1 API Security

- HTTPS for all communication
- Rate limiting on all endpoints
- Input validation with Pydantic
- File size limits (10MB max)
- CORS configuration

### 6.2 Data Security

- No sensitive user data collected (Phase 1)
- Scores stored with session IDs only
- Video/audio files served with proper headers
- SQL injection prevention via ORM

## 7. Performance Targets

### 7.1 Mobile (ARM64)
- Frame processing: 30-50ms
- UI rendering: 60fps
- Memory: <200MB
- Battery: <15% per 30min

### 7.2 Backend (Raspberry Pi 4)
- Frame processing: 80-120ms
- API response: <200ms
- Memory: <600MB
- CPU: <70%

## 8. Testing Strategy

### 8.1 Unit Tests
- Test all core logic functions
- Mock external dependencies
- Target: >80% code coverage

### 8.2 Integration Tests
- Test API endpoints
- Test database operations
- Test ML model inference

### 8.3 E2E Tests
- Test complete game flow
- Test on real ARM devices
- Performance benchmarks

## 9. Deployment Architecture

### 9.1 Mobile App
- Build with EAS Build
- Distribute via App Store and Google Play
- OTA updates via Expo Updates

### 9.2 Backend
- Docker container (multi-arch)
- Deploy to ARM-compatible server
- Horizontal scaling with load balancer

## 10. Monitoring and Logging

### 10.1 Application Monitoring
- Error tracking (Sentry)
- Performance monitoring
- Usage analytics

### 10.2 Logging
- Structured logging (JSON)
- Log levels: DEBUG, INFO, WARNING, ERROR
- Centralized log aggregation

---

**Version**: 2.0.0
**Status**: Ready for Implementation
**Properties Defined**: P-001 to P-038
