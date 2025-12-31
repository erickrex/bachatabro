/**
 * Dual Video View Component
 * Displays reference dance video and user camera feed side-by-side
 * 
 * Properties validated:
 * - P-011: Display videos side-by-side in landscape
 * - P-012: Stack videos vertically in portrait
 * - P-013: Maintain aspect ratio for both videos
 * - P-014: Synchronize video playback
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import { VideoPlayer } from '../Video/VideoPlayer';
import { CameraView } from '../Camera/CameraView';

// Error boundary to catch rendering errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DualVideoErrorBoundary extends Component<{ children: ReactNode; onError?: (error: string) => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onError?: (error: string) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DualVideoView error:', error, errorInfo);
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', padding: 20 }}>
            Video playback error. Please restart the app.
          </Text>
          <Text style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 10 }}>
            {this.state.error?.message}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export interface DualVideoViewProps {
  videoUri: string;
  onFrame?: (base64Image: string, videoPositionMs: number) => void;
  isPlaying: boolean;
  onVideoEnd?: () => void;
  onVideoReady?: () => void;
  onError?: (error: string) => void;
  onVideoRef?: (ref: Video | null) => void;
}

export function DualVideoView({
  videoUri,
  onFrame,
  isPlaying,
  onVideoEnd,
  onVideoReady,
  onError,
  onVideoRef,
}: DualVideoViewProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [videoReady, setVideoReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(true); // Camera is ready immediately
  const [videoPositionMs, setVideoPositionMs] = useState(0);

  // Notify parent when both video and camera are ready
  useEffect(() => {
    if (videoReady && cameraReady && onVideoReady) {
      onVideoReady();
    }
  }, [videoReady, cameraReady, onVideoReady]);

  const handleVideoReady = () => {
    setVideoReady(true);
  };

  const handlePlaybackUpdate = (status: AVPlaybackStatus) => {
    // Track video position for frame synchronization
    if (status.isLoaded && status.positionMillis !== undefined) {
      setVideoPositionMs(status.positionMillis);
    }
  };

  // Wrapper to pass video position to onFrame callback
  const handleCameraFrame = (base64Image: string) => {
    if (onFrame) {
      onFrame(base64Image, videoPositionMs);
    }
  };

  return (
    <DualVideoErrorBoundary onError={onError}>
      <View style={styles.container}>
        <View style={[
          styles.videoContainer,
          isLandscape ? styles.landscapeLayout : styles.portraitLayout
        ]}>
          {/* Reference Video */}
          <View style={[
            styles.videoHalf,
            isLandscape ? styles.landscapeHalf : styles.portraitHalf
          ]}>
            <VideoPlayer
              videoUri={videoUri}
              shouldPlay={isPlaying}
              onPlaybackUpdate={handlePlaybackUpdate}
              onEnd={onVideoEnd}
              onReady={handleVideoReady}
              onError={onError}
              onVideoRef={onVideoRef}
            />
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Reference</Text>
            </View>
          </View>

          {/* User Camera Feed */}
          <View style={[
            styles.videoHalf,
            isLandscape ? styles.landscapeHalf : styles.portraitHalf
          ]}>
            <CameraView
              onFrame={handleCameraFrame}
              isRecording={isPlaying}
              mirror={true}
              frameRate={10}
            />
            <View style={styles.labelContainer}>
              <Text style={styles.label}>You</Text>
            </View>
          </View>
        </View>
      </View>
    </DualVideoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  landscapeLayout: {
    flexDirection: 'row',
  },
  portraitLayout: {
    flexDirection: 'column',
  },
  videoHalf: {
    position: 'relative',
    backgroundColor: '#000',
  },
  landscapeHalf: {
    flex: 1,
    width: '50%',
  },
  portraitHalf: {
    flex: 1,
    height: '50%',
  },
  labelContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
