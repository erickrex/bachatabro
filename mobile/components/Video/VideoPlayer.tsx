/**
 * Video Player Component
 * Plays reference dance videos with playback controls
 */

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

export interface VideoPlayerProps {
  videoUri: string;
  shouldPlay: boolean;
  isLooping?: boolean;
  onPlaybackUpdate?: (status: AVPlaybackStatus) => void;
  onEnd?: () => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  onVideoRef?: (ref: Video | null) => void;
}

export function VideoPlayer({
  videoUri,
  shouldPlay,
  isLooping = false,
  onPlaybackUpdate,
  onEnd,
  onReady,
  onError,
  onVideoRef,
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Expose video ref to parent
  useEffect(() => {
    onVideoRef?.(videoRef.current);
  }, [onVideoRef]);

  useEffect(() => {
    if (videoRef.current) {
      if (shouldPlay) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [shouldPlay]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (isLoading) {
        setIsLoading(false);
        onReady?.();
      }

      // Check if video has ended
      if (status.didJustFinish && !status.isLooping) {
        onEnd?.();
      }

      // Pass status to parent
      onPlaybackUpdate?.(status);
    } else if (status.error) {
      setHasError(true);
      setIsLoading(false);
      onError?.(status.error);
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#9333ea" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
