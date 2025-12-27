# Bachata Bro Modernization - Requirements Document

## 1. Executive Summary

This document specifies the requirements for modernizing the Bachata Bro motion-based dance video game using React Native with Expo for the frontend and Python 3.12.6 with FastAPI for the backend, with specific optimizations for ARM architectures.

### 1.1 Project Goals

1. **Modernize Technology Stack**: Upgrade from Python 3.x + Tkinter to React Native + Expo + Python 3.12.6
2. **ARM Optimization**: Ensure optimal performance on ARM devices (mobile phones, tablets, Raspberry Pi, Apple Silicon)
3. **Maintain Feature Parity**: Preserve 100% of existing functionality
4. **Improve Deployment**: Enable easy distribution via app stores and OTA updates
5. **Enhance User Experience**: Provide native mobile experience with better performance

### 1.2 Success Criteria

- ✅ All 27 original features working on mobile devices
- ✅ 20-30fps pose detection on ARM mobile devices
- ✅ <200MB memory usage on mobile
- ✅ <50MB app download size
- ✅ <15% battery drain per 30-minute session
- ✅ 5-6 week development timeline
- ✅ <$50/month operating costs
- ✅ Deployable to iOS App Store and Google Play Store

## 2. Technology Stack

### 2.1 Frontend: React Native with Expo

**Core Framework**:
- React Native: 0.74+
- Expo SDK: 51+
- React: 18.3.1
- TypeScript: 5.3+ (recommended)
- JavaScript Engine: Hermes (ARM optimized)

**Key Dependencies**:
```json
{
  "expo-camera": "~15.0.0",
  "expo-av": "~14.0.0",
  "expo-sqlite": "~14.0.0",
  "expo-file-system": "~17.0.0",
  "@react-native-ml-kit/pose-detection": "^0.2.0",
  "zustand": "^4.5.0",
  "axios": "^1.7.0",
  "nativewind": "^4.0.0",
  "react-native-reanimated": "~3.10.0",
  "react-native-gesture-handler": "~2.16.0"
}
```

**Rationale**:
- Familiar React ecosystem
- Expo provides managed workflow and easy deployment
- Cross-platform: iOS, Android, Web from single codebase
- OTA updates without app store approval
- Large community and extensive package ecosystem

### 2.2 Backend: Python 3.12.6 with FastAPI

**Core Framework**:
- Python: 3.12.6
- Package Manager: UV
- Web Framework: FastAPI 0.115.0+
- ASGI Server: Uvicorn 0.30.0+ with uvloop 0.20.0+

**Key Dependencies**:
```toml
[project]
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "uvloop>=0.20.0",              # Faster async for ARM
    "httptools>=0.6.0",            # Faster HTTP parsing
    "tflite-runtime>=2.14.0",      # Lightweight TF for ARM
    "opencv-python-headless>=4.10.0",
    "numpy>=2.1.0",
    "mutagen>=1.47.0",
    "python-multipart>=0.0.9",
    "sqlalchemy>=2.0.0",
    "aiosqlite>=0.20.0",
    "pydantic>=2.9.0",
    "pydantic-settings>=2.5.0",
]
```

**Rationale**:
- Familiar Python ecosystem
- FastAPI provides automatic API documentation
- Async support for better performance
- Easy integration with ML/CV libraries
- ARM-optimized packages available

### 2.3 Machine Learning & Computer Vision

**Primary ML Framework**:
- TensorFlow Lite Runtime 2.14.0+ (NOT full TensorFlow)
- XNNPACK delegate for ARM NEON optimization
- Multi-threading support for ARM cores

**Computer Vision**:
- OpenCV (headless) 4.10.0+
- NumPy 2.1.0+

**Rationale**:
- TFLite Runtime is 500x smaller than full TensorFlow (1MB vs 500MB)
- XNNPACK provides 2-4x speedup on ARM via NEON SIMD instructions
- opencv-python-headless removes GUI dependencies (smaller, faster)

### 2.4 Platform Support

**Target Platforms**:
- iOS 13.0+ (ARM64)
- Android 8.0+ (ARM64)
- Web browsers (progressive web app)
- Raspberry Pi 4/5 (ARM64 Linux)
- Apple Silicon Macs (ARM64 macOS)

**Minimum Hardware Requirements**:
- RAM: 4GB (mobile), 8GB (server)
- Storage: 2GB free space
- Camera: 720p minimum, 1080p recommended
- Processor: ARM64 or x86_64

## 3. Functional Requirements

### 3.1 Core Game Features

#### FR-001: Real-Time Pose Detection
**Priority**: Critical
**Description**: System shall detect user body pose in real-time using device camera

**Acceptance Criteria**:
- AC-001: Detect 17 body keypoints (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles)
- AC-002: Process frames at minimum 20fps on mobile ARM devices
- AC-003: Process frames at minimum 10fps on Raspberry Pi 4
- AC-004: Provide confidence scores for each keypoint
- AC-005: Handle poor lighting conditions gracefully

**Technical Requirements**:
- Use TensorFlow Lite Runtime with MoveNet model
- Enable XNNPACK delegate on ARM devices
- Implement frame sampling (process every 3rd frame if needed)
- Resize frames to 192x192 for model input

#### FR-002: Joint Angle Calculation
**Priority**: Critical
**Description**: System shall calculate angles between body joints for scoring

**Acceptance Criteria**:
- AC-006: Calculate 8 joint angles (left/right arm, elbow, thigh, leg)
- AC-007: Angles shall be in range 0-180 degrees
- AC-008: Calculation shall complete in <10ms
- AC-009: Handle missing keypoints gracefully

**Technical Requirements**:
- Use trigonometry (arctan2) for angle calculation
- Implement angle normalization (0-180 range)
- Cache calculations where possible

#### FR-003: Dual Video Display
**Priority**: Critical
**Description**: System shall display reference dance video and user camera feed simultaneously

**Acceptance Criteria**:
- AC-010: Display reference video on left/top half of screen
- AC-011: Display mirrored user camera feed on right/bottom half
- AC-012: Synchronize both video feeds
- AC-013: Maintain 30fps minimum for UI rendering
- AC-014: Support portrait and landscape orientations

**Technical Requirements**:
- Use expo-av for video playback
- Use expo-camera for camera feed
- Mirror camera feed horizontally
- Implement responsive layout

#### FR-004: Score Calculation
**Priority**: Critical
**Description**: System shall calculate user score based on movement accuracy

**Acceptance Criteria**:
- AC-015: Compare user angles with reference video angles
- AC-016: Use configurable threshold (default: 20 degrees)
- AC-017: Calculate individual scores for each joint
- AC-018: Calculate final score (0-100 range)
- AC-019: Apply +20 bonus to final score (capped at 100)
- AC-020: Complete calculation in <500ms

**Technical Requirements**:
- Store reference video angles in database/cache
- Compare angles frame-by-frame
- Calculate accuracy percentage per joint
- Average all joint scores for final score

#### FR-005: Audio Playback
**Priority**: High
**Description**: System shall play background music synchronized with video

**Acceptance Criteria**:
- AC-021: Play MP3 audio files
- AC-022: Synchronize audio with video playback
- AC-023: Detect audio duration automatically
- AC-024: Support pause/resume functionality
- AC-025: Handle audio playback errors gracefully

**Technical Requirements**:
- Use expo-av for audio playback
- Use mutagen for audio metadata extraction
- Implement audio/video synchronization logic

### 3.2 User Interface Features

#### FR-006: Home Screen
**Priority**: High
**Description**: System shall provide song selection interface

**Acceptance Criteria**:
- AC-026: Display list of available songs
- AC-027: Show song title, duration, and thumbnail
- AC-028: Provide "Start Game" button
- AC-029: Provide "View Leaderboard" button
- AC-030: Provide "Quit" button

**Technical Requirements**:
- Fetch song list from backend API
- Display in scrollable list/grid
- Implement navigation to game screen

#### FR-007: Game Screen
**Priority**: Critical
**Description**: System shall provide main gameplay interface

**Acceptance Criteria**:
- AC-031: Display dual video view (reference + user)
- AC-032: Show real-time score display
- AC-033: Show game timer/progress
- AC-034: Provide quit button/gesture
- AC-035: Handle screen rotation
- AC-036: Show loading states

**Technical Requirements**:
- Implement game state management (Zustand)
- Handle camera permissions
- Implement error boundaries
- Show loading indicators

#### FR-008: Results Screen
**Priority**: High
**Description**: System shall display final score after game completion

**Acceptance Criteria**:
- AC-037: Display final score prominently
- AC-038: Show score breakdown by joint
- AC-039: Provide "View Leaderboard" button
- AC-040: Provide "Play Again" button
- AC-041: Provide "Home" button

**Technical Requirements**:
- Fetch final score from backend
- Display score with animations
- Navigate to other screens

#### FR-009: Leaderboard Screen
**Priority**: Medium
**Description**: System shall display top scores

**Acceptance Criteria**:
- AC-042: Display top 5 scores
- AC-043: Show rank, score, and date
- AC-044: Highlight current user's score
- AC-045: Show empty slots if <5 scores
- AC-046: Sort scores in descending order
- AC-047: Provide "Back" button

**Technical Requirements**:
- Fetch leaderboard from backend API
- Display in table/list format
- Implement pull-to-refresh

### 3.3 Data Management Features

#### FR-010: Score Persistence
**Priority**: High
**Description**: System shall store game scores persistently

**Acceptance Criteria**:
- AC-048: Save score after each game
- AC-049: Store score with timestamp
- AC-050: Store score breakdown by joint
- AC-051: Associate score with session ID
- AC-052: Support offline storage (SQLite)

**Technical Requirements**:
- Use expo-sqlite for local storage
- Sync with backend when online
- Implement data migration if needed

#### FR-011: Video Library Management
**Priority**: Medium
**Description**: System shall manage dance video library

**Acceptance Criteria**:
- AC-053: Store video files on backend
- AC-054: Stream videos to mobile app
- AC-055: Cache videos locally (optional)
- AC-056: Support video thumbnails
- AC-057: Support multiple video formats (MP4)

**Technical Requirements**:
- Store videos in backend assets folder
- Implement video streaming endpoint
- Use expo-file-system for caching

### 3.4 Backend API Features

#### FR-012: Game Session Management
**Priority**: High
**Description**: Backend shall manage game sessions

**API Endpoints**:
- `POST /api/game/start` - Start new game session
- `POST /api/game/stop` - End game session
- `GET /api/game/status/{sessionId}` - Get session status

**Acceptance Criteria**:
- AC-058: Generate unique session IDs
- AC-059: Track session state (active, completed, error)
- AC-060: Store session metadata (song, start time, end time)
- AC-061: Clean up old sessions (>24 hours)

#### FR-013: Video Processing
**Priority**: Critical
**Description**: Backend shall process video frames for pose detection

**API Endpoints**:
- `POST /api/video/process-frame` - Process single frame
- `GET /api/video/list` - List available videos
- `GET /api/video/{videoId}` - Stream video file

**Acceptance Criteria**:
- AC-062: Accept base64 encoded frames
- AC-063: Return keypoints and angles
- AC-064: Process frames in <100ms on ARM server
- AC-065: Handle invalid image data
- AC-066: Implement rate limiting (30 req/min per user)

#### FR-014: Score Management
**Priority**: High
**Description**: Backend shall manage score calculation and storage

**API Endpoints**:
- `POST /api/score/calculate` - Calculate final score
- `GET /api/score/current` - Get current session score
- `GET /api/leaderboard` - Get top scores

**Acceptance Criteria**:
- AC-067: Calculate score from angle arrays
- AC-068: Store score in database
- AC-069: Return score breakdown
- AC-070: Support leaderboard queries with pagination

#### FR-015: Audio Streaming
**Priority**: Medium
**Description**: Backend shall stream audio files

**API Endpoints**:
- `GET /api/audio/list` - List available audio files
- `GET /api/audio/{audioId}` - Stream audio file

**Acceptance Criteria**:
- AC-071: Stream MP3 files
- AC-072: Support range requests (for seeking)
- AC-073: Return audio metadata (duration, bitrate)

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

#### NFR-001: Response Time
- API endpoints: <100ms (non-video processing)
- Video frame processing: <100ms on ARM server
- Pose detection: <50ms per frame on mobile
- Score calculation: <500ms
- App startup: <3 seconds

#### NFR-002: Throughput
- Backend: Support 100 concurrent users
- Frame processing: 10-30 fps depending on device
- Video streaming: Support 10 concurrent streams

#### NFR-003: Resource Usage
- Mobile app memory: <200MB
- Mobile app storage: <50MB
- Backend memory: <1GB per instance
- Backend CPU: <70% on ARM devices

#### NFR-004: Battery Efficiency
- Mobile battery drain: <15% per 30-minute session
- Optimize camera usage
- Optimize ML inference frequency

### 4.2 Scalability Requirements

#### NFR-005: Horizontal Scaling
- Backend shall support multiple instances
- Use stateless API design
- Store session data in database

#### NFR-006: Data Growth
- Support unlimited score history
- Implement data archival for old sessions
- Support video library up to 100 songs

### 4.3 Reliability Requirements

#### NFR-007: Availability
- Backend uptime: 99% (allows ~7 hours downtime/month)
- Graceful degradation if backend unavailable
- Offline mode for local gameplay (no leaderboard)

#### NFR-008: Error Handling
- All errors logged with context
- User-friendly error messages
- Automatic retry for transient failures
- Fallback mechanisms for critical features

#### NFR-009: Data Integrity
- Validate all API inputs
- Prevent SQL injection
- Sanitize file uploads
- Verify score calculations

### 4.4 Security Requirements

#### NFR-010: Authentication (Future)
- Support for user accounts (Phase 2)
- Secure password storage
- JWT-based authentication

#### NFR-011: Data Protection
- HTTPS for all API communication
- Encrypt sensitive data at rest
- Comply with GDPR/privacy regulations

#### NFR-012: Input Validation
- Validate all API inputs
- Limit file upload sizes (10MB max)
- Rate limiting on all endpoints
- Prevent injection attacks

### 4.5 Usability Requirements

#### NFR-013: User Experience
- Intuitive navigation
- Clear visual feedback
- Loading indicators for long operations
- Smooth animations (60fps)

#### NFR-014: Accessibility
- Support screen readers (future)
- Adjustable text sizes
- High contrast mode (future)
- Keyboard navigation (web)

#### NFR-015: Internationalization
- Support multiple languages (future)
- Locale-aware date/time formatting
- RTL language support (future)

### 4.6 Maintainability Requirements

#### NFR-016: Code Quality
- Type hints for all Python code
- TypeScript for frontend (recommended)
- Code coverage >80%
- Linting with Ruff (Python) and ESLint (JS)

#### NFR-017: Documentation
- API documentation (OpenAPI/Swagger)
- Code comments for complex logic
- README with setup instructions
- Architecture diagrams

#### NFR-018: Testing
- Unit tests for core logic
- Integration tests for API
- E2E tests for critical flows
- Performance tests on ARM devices

### 4.7 Deployment Requirements

#### NFR-019: Containerization
- Docker support for backend
- Multi-architecture builds (ARM64, x86_64)
- Docker Compose for local development

#### NFR-020: CI/CD
- Automated testing on push
- Automated builds for mobile apps
- Automated deployment to staging

#### NFR-021: Monitoring
- Application logging
- Error tracking (Sentry or similar)
- Performance monitoring
- Usage analytics

## 5. ARM Optimization Requirements

### 5.1 Python Backend Optimization

#### ARM-001: TensorFlow Lite Runtime
- Use tflite-runtime instead of full TensorFlow
- Enable XNNPACK delegate for ARM NEON
- Set num_threads=4 for multi-core ARM CPUs
- Verify performance: <100ms per frame on Raspberry Pi 4

#### ARM-002: Async Performance
- Use uvloop for faster async operations
- Use httptools for faster HTTP parsing
- Benchmark: 2-4x faster than standard asyncio

#### ARM-003: OpenCV Optimization
- Use opencv-python-headless (no GUI dependencies)
- Verify NEON support in build
- Use optimized resize operations

#### ARM-004: NumPy Optimization
- Use ARM-compiled NumPy wheels
- Verify BLAS/LAPACK support
- Benchmark matrix operations

### 5.2 React Native Frontend Optimization

#### ARM-005: JavaScript Engine
- Enable Hermes engine in app.json
- Verify bytecode compilation
- Benchmark: 2x faster startup than JSC

#### ARM-006: Image Processing
- Compress images before sending to API
- Use native image processing where possible
- Implement frame sampling (every 3rd frame)

#### ARM-007: Animation Performance
- Use react-native-reanimated for 60fps
- Avoid JavaScript bridge for animations
- Use native driver where possible

#### ARM-008: Memory Management
- Implement image caching with size limits
- Clean up camera resources properly
- Monitor memory usage in production

## 6. Constraints and Assumptions

### 6.1 Technical Constraints

- Must work on ARM64 and x86_64 architectures
- Must support iOS 13.0+ and Android 8.0+
- Backend must run on Linux (Ubuntu 22.04+)
- Must use existing TFLite pose estimation model
- Must maintain compatibility with existing video/audio files

### 6.2 Business Constraints

- Development budget: $18,000 (5-6 weeks)
- Operating budget: <$50/month
- Must launch within 8 weeks
- Must support existing song library

### 6.3 Assumptions

- Users have stable internet connection (for leaderboard)
- Users grant camera permissions
- Backend hosted on ARM-compatible server
- Video files are pre-processed and optimized
- Users have modern smartphones (2020+)

## 7. Out of Scope

The following features are explicitly out of scope for this version:

- Multi-player mode
- Social features (sharing, challenges)
- User authentication system
- In-app purchases
- Custom video uploads
- Advanced analytics
- Cloud video processing
- Real-time multiplayer
- AR/VR features
- Wearable device integration

## 8. Dependencies

### 8.1 External Dependencies

- Expo infrastructure for builds and updates
- App Store and Google Play for distribution
- Cloud hosting for backend (AWS, GCP, or similar)
- Domain name and SSL certificate

### 8.2 Internal Dependencies

- Existing TFLite pose estimation model
- Existing dance video library (5 songs)
- Existing audio track library (5 songs)

## 9. Risks and Mitigation

### 9.1 Technical Risks

**Risk**: TFLite performance insufficient on older ARM devices
**Mitigation**: Implement adaptive frame rate, test on target devices early

**Risk**: Camera API differences between iOS and Android
**Mitigation**: Use Expo's unified camera API, test on both platforms

**Risk**: Video streaming bandwidth issues
**Mitigation**: Implement video quality selection, support offline caching

**Risk**: Backend overload during peak usage
**Mitigation**: Implement rate limiting, horizontal scaling, caching

### 9.2 Schedule Risks

**Risk**: Development takes longer than 6 weeks
**Mitigation**: Prioritize core features, defer nice-to-haves

**Risk**: App store approval delays
**Mitigation**: Submit early, follow guidelines strictly

### 9.3 Resource Risks

**Risk**: ARM test devices unavailable
**Mitigation**: Use cloud device testing services, borrow devices

**Risk**: Backend hosting costs exceed budget
**Mitigation**: Use serverless options, optimize resource usage

## 10. Acceptance Criteria Summary

Total Acceptance Criteria: 73

- Core Game Features: AC-001 to AC-025 (25 criteria)
- UI Features: AC-026 to AC-047 (22 criteria)
- Data Management: AC-048 to AC-057 (10 criteria)
- Backend API: AC-058 to AC-073 (16 criteria)

All acceptance criteria must be met for project completion.

## 11. Approval

This requirements document must be approved by:
- [ ] Technical Lead
- [ ] Project Manager
- [ ] Product Owner

**Version**: 2.0.0
**Date**: November 2024
**Status**: Draft → Ready for Review
