/**
 * Example usage of DualVideoView component
 * This file demonstrates how to use the component in a real scenario
 */

import React, { useState } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { DualVideoView } from './DualVideoView';

export function DualVideoViewExample() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFrame = (base64Image: string) => {
    console.log('Frame captured:', base64Image.substring(0, 50) + '...');
    // Process frame for pose detection
  };

  const handleVideoEnd = () => {
    console.log('Video ended');
    setIsPlaying(false);
  };

  const handleVideoReady = () => {
    console.log('Video and camera ready');
  };

  const handleError = (error: string) => {
    console.error('Error:', error);
  };

  return (
    <View style={styles.container}>
      <DualVideoView
        videoUri="https://example.com/dance-video.mp4"
        onFrame={handleFrame}
        isPlaying={isPlaying}
        onVideoEnd={handleVideoEnd}
        onVideoReady={handleVideoReady}
        onError={handleError}
      />
      <View style={styles.controls}>
        <Button
          title={isPlaying ? 'Pause' : 'Play'}
          onPress={() => setIsPlaying(!isPlaying)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
