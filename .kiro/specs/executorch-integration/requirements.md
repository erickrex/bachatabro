weqds # ExecuTorch Integration - Requirements Document

## Introduction

This document specifies the requirements for integrating PyTorch ExecuTorch into the Bacha Trainer mobile application to enable real-time pose detection on-device, replacing the current pre-computed pose data approach and reducing dependencies in the Python preprocessing tools.

### Project Goals

1. **Enable Real-Time Pose Detection**: Replace pre-computed JSON pose data with on-device ML inference
2. **Reduce Dependencies**: Replace TensorFlow Lite with PyTorch ExecuTorch in preprocessing tools
3. **Improve Performance**: Leverage hardware acceleration (GPU/NPU) on mobile devices
4. **Maintain Compatibility**: Support both real-time and pre-computed modes for older devices
5. **Unified Framework**: Use PyTorch ecosystem end-to-end (training to deployment)

### Success Criteria

- ✅ Real-time pose detection at 10-30fps on modern mobile devices (2020+)
- ✅ ExecuTorch model size <10MB
- ✅ Memory usage increase <100MB during inference
- ✅ Battery drain <20% per 30-minute session
- ✅ Python tools use ExecuTorch instead of TensorFlow Lite
- ✅ Backward compatibility with pre-computed pose data
- ✅ 2-3 week implementation timeline

## Glossary

- **ExecuTorch**: PyTorch's solution for efficient AI inference on edge devices
- **PTE File**: PyTorch ExecuTorch model file format (.pte extension)
- **MoveNet**: Lightweight pose estimation model from Google
- **Keypoint**: A detected body joint position (x, y, confidence)
- **Inference**: Running a machine learning model to make predictions
- **Delegate**: Hardware acceleration backend (CPU, GPU, NPU, CoreML, XNNPACK)
- **XNNPACK**: Optimized neural network operator library for ARM processors
- **CoreML**: Apple's machine learning framework for iOS/macOS
- **Pre-computed Mode**: Current approach using JSON pose data files
- **Real-time Mode**: New approach using on-device ML inference
- **Fallback Mode**: Automatic switch to pre-computed data if real-time fails

## Requirements

### Requirement 1: Real-Time Pose Detection

**User Story:** As a player, I want the game to detect my poses in real-time using my device's camera, so that I get immediate feedback without pre-processing delays.

#### Acceptance Criteria

1. WHEN the game starts in real-time mode, THE Mobile App SHALL load the ExecuTorch pose model from bundled assets
2. WHEN a camera frame is captured, THE Mobile App SHALL process the frame through ExecuTorch inference within 100ms on modern devices
3. WHEN inference completes, THE Mobile App SHALL extract 17 keypoints with confidence scores above 0.5
4. WHEN keypoints are extracted, THE Mobile App SHALL calculate 8 joint angles using the same algorithm as pre-computed mode
5. WHEN the device cannot maintain 10fps inference, THE Mobile App SHALL automatically switch to pre-computed mode

### Requirement 2: Model Export and Optimization

**User Story:** As a developer, I want to export PyTorch pose models to ExecuTorch format, so that I can deploy optimized models to mobile devices.

#### Acceptance Criteria

1. WHEN exporting a PyTorch pose model, THE Export Tool SHALL convert the model to ExecuTorch PTE format
2. WHEN the model is exported, THE Export Tool SHALL apply quantization to reduce model size below 10MB
3. WHEN quantization is applied, THE Export Tool SHALL validate that accuracy degradation is less than 5%
4. WHEN the model is optimized, THE Export Tool SHALL enable XNNPACK delegate for ARM devices
5. WHEN the model is optimized for iOS, THE Export Tool SHALL enable CoreML delegate for Apple devices

### Requirement 3: Python Preprocessing Tool Migration

**User Story:** As a developer, I want to use ExecuTorch instead of TensorFlow Lite in preprocessing tools, so that I have a unified PyTorch-based workflow.

#### Acceptance Criteria

1. WHEN processing reference videos, THE Preprocessing Tool SHALL use ExecuTorch for pose detection instead of TensorFlow Lite
2. WHEN ExecuTorch is used, THE Preprocessing Tool SHALL produce identical JSON output format as the current TFLite version
3. WHEN dependencies are updated, THE Preprocessing Tool SHALL remove tensorflow-lite-runtime dependency
4. WHEN the tool runs, THE Preprocessing Tool SHALL process videos at the same speed or faster than TFLite version
5. WHEN validation runs, THE Preprocessing Tool SHALL produce pose data with accuracy within 2% of TFLite version

### Requirement 4: Mobile App Integration

**User Story:** As a developer, I want to integrate ExecuTorch into the React Native mobile app, so that I can run pose detection on-device.

#### Acceptance Criteria

1. WHEN the app initializes, THE Mobile App SHALL load ExecuTorch native modules for iOS and Android
2. WHEN a model is loaded, THE Mobile App SHALL initialize the appropriate hardware delegate (CoreML for iOS, XNNPACK for Android)
3. WHEN inference is requested, THE Mobile App SHALL preprocess camera frames to model input format (192x192 RGB)
4. WHEN inference completes, THE Mobile App SHALL parse model output to keypoint format
5. WHEN an error occurs during inference, THE Mobile App SHALL log the error and fallback to pre-computed mode

### Requirement 5: Dual Mode Support

**User Story:** As a player, I want the game to automatically choose the best detection mode for my device, so that I get optimal performance regardless of my hardware.

#### Acceptance Criteria

1. WHEN the app first launches, THE Mobile App SHALL detect device capabilities and select real-time or pre-computed mode
2. WHEN real-time mode is selected, THE Mobile App SHALL display a "Real-time Detection" indicator in the UI
3. WHEN pre-computed mode is selected, THE Mobile App SHALL display a "Smooth Mode" indicator in the UI
4. WHEN in settings, THE Mobile App SHALL allow users to manually override the detection mode
5. WHEN switching modes, THE Mobile App SHALL persist the user's preference in local storage

### Requirement 6: Performance Optimization

**User Story:** As a player, I want the game to run smoothly with real-time detection, so that my gameplay experience is not degraded.

#### Acceptance Criteria

1. WHEN running on iPhone 11 or newer, THE Mobile App SHALL achieve 20-30fps pose detection
2. WHEN running on mid-range Android devices (2020+), THE Mobile App SHALL achieve 15-25fps pose detection
3. WHEN running on older devices, THE Mobile App SHALL maintain 10fps minimum or fallback to pre-computed mode
4. WHEN inference is running, THE Mobile App SHALL keep memory usage increase below 100MB
5. WHEN playing for 30 minutes, THE Mobile App SHALL consume less than 20% battery on modern devices

### Requirement 7: Model Management

**User Story:** As a developer, I want to manage multiple pose models, so that I can test different models and update them without app releases.

#### Acceptance Criteria

1. WHEN the app bundles models, THE Mobile App SHALL include at least one default ExecuTorch pose model
2. WHEN a model is loaded, THE Mobile App SHALL verify the model signature and version
3. WHEN a model fails to load, THE Mobile App SHALL fallback to pre-computed mode and log the error
4. WHERE over-the-air updates are enabled, THE Mobile App SHALL support downloading updated models via Expo Updates
5. WHEN multiple models are available, THE Mobile App SHALL allow selection in developer settings

### Requirement 8: Backward Compatibility

**User Story:** As a developer, I want to maintain backward compatibility with pre-computed pose data, so that existing functionality continues to work.

#### Acceptance Criteria

1. WHEN pre-computed mode is active, THE Mobile App SHALL load pose data from JSON files as before
2. WHEN real-time mode is active, THE Mobile App SHALL use the same angle calculation algorithm as pre-computed mode
3. WHEN comparing scores, THE Mobile App SHALL produce equivalent results between real-time and pre-computed modes
4. WHEN JSON pose data is missing, THE Mobile App SHALL require real-time mode or display an error
5. WHEN both modes are available, THE Mobile App SHALL allow A/B testing to compare accuracy

### Requirement 9: Developer Experience

**User Story:** As a developer, I want clear documentation and tools for ExecuTorch integration, so that I can maintain and extend the system.

#### Acceptance Criteria

1. WHEN setting up the project, THE Documentation SHALL provide step-by-step ExecuTorch installation instructions
2. WHEN exporting models, THE Documentation SHALL include example scripts for model conversion
3. WHEN debugging, THE Mobile App SHALL provide detailed logging for inference performance and errors
4. WHEN profiling, THE Developer Tools SHALL measure and report inference time per frame
5. WHEN testing, THE Test Suite SHALL include unit tests for ExecuTorch integration

### Requirement 10: Error Handling and Resilience

**User Story:** As a player, I want the game to handle errors gracefully, so that I can continue playing even if real-time detection fails.

#### Acceptance Criteria

1. WHEN model loading fails, THE Mobile App SHALL display a user-friendly error message and fallback to pre-computed mode
2. WHEN inference fails for a frame, THE Mobile App SHALL skip that frame and continue with the next frame
3. WHEN inference consistently fails, THE Mobile App SHALL automatically switch to pre-computed mode after 10 consecutive failures
4. WHEN memory pressure is detected, THE Mobile App SHALL reduce inference frequency or switch to pre-computed mode
5. WHEN the app resumes from background, THE Mobile App SHALL reinitialize the ExecuTorch model if needed

## Non-Functional Requirements

### Performance Requirements

#### NFR-001: Inference Latency
- Real-time inference: <100ms per frame on iPhone 11+ and equivalent Android devices
- Model loading: <2 seconds on app startup
- Mode switching: <1 second transition time

#### NFR-002: Resource Usage
- Model size: <10MB (quantized)
- Memory increase: <100MB during inference
- Battery drain: <20% per 30-minute session
- Storage: <15MB total for models and assets

#### NFR-003: Frame Rate
- Target: 20-30fps on modern devices (2020+)
- Minimum: 10fps on supported devices
- Fallback: Pre-computed mode if below 10fps

### Compatibility Requirements

#### NFR-004: Platform Support
- iOS: 13.0+ (iPhone 8 and newer)
- Android: 8.0+ (ARM64 devices)
- ExecuTorch version: 0.1.0+
- React Native: 0.74+

#### NFR-005: Hardware Acceleration
- iOS: CoreML delegate for Apple Neural Engine
- Android: XNNPACK delegate for ARM NEON
- Fallback: CPU-only inference if delegates unavailable

### Reliability Requirements

#### NFR-006: Accuracy
- Keypoint detection accuracy: Within 5% of TensorFlow Lite baseline
- Angle calculation: Identical to pre-computed mode (0% deviation)
- Score calculation: Equivalent results between modes (<1% difference)

#### NFR-007: Stability
- Crash rate: <0.1% during inference
- Successful inference rate: >95% of frames
- Automatic fallback: Activate within 3 seconds of detection failure

### Maintainability Requirements

#### NFR-008: Code Quality
- TypeScript for all mobile code
- Python type hints for all preprocessing code
- Unit test coverage: >80% for ExecuTorch integration
- Integration tests for both detection modes

#### NFR-009: Documentation
- API documentation for ExecuTorch wrapper
- Model export guide with examples
- Troubleshooting guide for common issues
- Performance tuning guide

### Security Requirements

#### NFR-010: Model Security
- Verify model signatures before loading
- Prevent loading of untrusted models
- Validate model input/output shapes
- Handle malformed model files gracefully

## Dependencies

### External Dependencies

1. **ExecuTorch Framework**
   - Python: executorch package
   - iOS: ExecuTorch.framework
   - Android: libexecutorch.so

2. **React Native Bindings**
   - Custom native modules for iOS/Android
   - Or community package if available

3. **Model Assets**
   - MoveNet or equivalent pose model
   - Converted to ExecuTorch PTE format
   - Quantized for mobile deployment

### Internal Dependencies

1. **Existing Codebase**
   - Current pose detection service interface
   - Angle calculation utilities
   - Score calculation logic
   - Game state management

2. **Development Tools**
   - Python preprocessing tools
   - Model export scripts
   - Testing infrastructure

## Out of Scope

The following features are explicitly out of scope for this version:

- Multi-person pose detection
- 3D pose estimation
- Custom model training
- Cloud-based inference
- Video recording with pose overlay
- Pose-to-pose comparison visualization
- Advanced pose analytics
- Social features integration

## Risks and Mitigation

### Technical Risks

**Risk**: ExecuTorch React Native bindings may not be mature
**Mitigation**: Create custom native modules, contribute to community packages

**Risk**: Performance may not meet targets on older devices
**Mitigation**: Implement automatic fallback to pre-computed mode

**Risk**: Model accuracy may degrade after quantization
**Mitigation**: Validate accuracy before deployment, adjust quantization settings

**Risk**: Battery drain may exceed acceptable limits
**Mitigation**: Implement adaptive frame rate, optimize preprocessing

### Schedule Risks

**Risk**: Integration takes longer than 2-3 weeks
**Mitigation**: Prioritize core functionality, defer advanced features

**Risk**: Platform-specific issues delay release
**Mitigation**: Test on multiple devices early, maintain pre-computed fallback

### Resource Risks

**Risk**: Limited test devices for validation
**Mitigation**: Use cloud device testing services, community beta testing

**Risk**: ExecuTorch documentation may be incomplete
**Mitigation**: Engage with PyTorch community, reference examples

## Acceptance Criteria Summary

Total Acceptance Criteria: 50

- Real-Time Pose Detection: AC-001 to AC-005 (5 criteria)
- Model Export: AC-006 to AC-010 (5 criteria)
- Python Tool Migration: AC-011 to AC-015 (5 criteria)
- Mobile Integration: AC-016 to AC-020 (5 criteria)
- Dual Mode Support: AC-021 to AC-025 (5 criteria)
- Performance: AC-026 to AC-030 (5 criteria)
- Model Management: AC-031 to AC-035 (5 criteria)
- Backward Compatibility: AC-036 to AC-040 (5 criteria)
- Developer Experience: AC-041 to AC-045 (5 criteria)
- Error Handling: AC-046 to AC-050 (5 criteria)

All acceptance criteria must be met for project completion.

## Approval

This requirements document must be approved by:
- [ ] Technical Lead
- [ ] Project Manager
- [ ] Product Owner

**Version**: 1.0.0
**Date**: November 27, 2025
**Status**: Draft → Ready for Review
