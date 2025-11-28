/**
 * Camera Test Component
 * For testing camera functionality and frame capture
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CameraView } from './CameraView';
import { CameraControls } from './CameraControls';

export function CameraTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameSize, setLastFrameSize] = useState(0);

  const handleFrame = (base64Image: string) => {
    setFrameCount((prev) => prev + 1);
    setLastFrameSize(base64Image.length);
  };

  const handleStart = () => {
    setIsRecording(true);
    setFrameCount(0);
  };

  const handleStop = () => {
    setIsRecording(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          onFrame={handleFrame}
          isRecording={isRecording}
          frameRate={10}
          mirror={true}
        />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Frames captured: {frameCount}</Text>
        <Text style={styles.statsText}>
          Last frame size: {(lastFrameSize / 1024).toFixed(1)} KB
        </Text>
        <Text style={styles.statsText}>
          Status: {isRecording ? 'Recording' : 'Stopped'}
        </Text>
      </View>

      <CameraControls
        isRecording={isRecording}
        onStart={handleStart}
        onStop={handleStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
});
