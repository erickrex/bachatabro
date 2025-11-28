/**
 * Camera Controls Component
 * Provides start/stop/pause controls for camera recording
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface CameraControlsProps {
  isRecording: boolean;
  isPaused?: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause?: () => void;
  disabled?: boolean;
}

export function CameraControls({
  isRecording,
  isPaused = false,
  onStart,
  onStop,
  onPause,
  disabled = false,
}: CameraControlsProps) {
  return (
    <View style={styles.container}>
      {!isRecording ? (
        <TouchableOpacity
          style={[styles.button, styles.startButton, disabled && styles.disabled]}
          onPress={onStart}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.recordingControls}>
          {onPause && (
            <TouchableOpacity
              style={[styles.button, styles.pauseButton]}
              onPress={onPause}
            >
              <Text style={styles.buttonText}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={onStop}
          >
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  recordingControls: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10b981', // green
  },
  stopButton: {
    backgroundColor: '#ef4444', // red
  },
  pauseButton: {
    backgroundColor: '#f59e0b', // orange
  },
  disabled: {
    backgroundColor: '#6b7280', // gray
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
