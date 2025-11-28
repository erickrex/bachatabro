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

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, useWindowDimensions } from 'react-native';
import { VideoPlayer } from '../Video/VideoPlayer';
import { CameraView } from '../Camera/CameraView';
import { AVPlaybackStatus } from 'expo-av';

export interface DualVideoViewProps {
  videoUri: string;
  onFrame?: (base64Image: string) => void;
  isPlaying: boolean;
  onVideoEnd?: () => void;
  onVideoReady?: () => void;
  onError?: (error: string) => void;
}

export function DualVideoView({
  videoUri,
  onFrame,
  isPlaying,
  onVideoEnd,
  onVideoReady,
  onError,
}: DualVideoViewProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [videoReady, setVideoReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(true); // Camera is ready immediately

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
    // Can be used for synchronization or progress tracking
    if (status.isLoaded) {
      // Video is playing and loaded
    }
  };

  return (
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
            onFrame={onFrame}
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
