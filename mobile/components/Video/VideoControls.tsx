/**
 * Video Controls Component
 * Playback controls for video player
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export interface VideoControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRestart?: () => void;
  currentTime?: number;
  duration?: number;
}

export function VideoControls({
  isPlaying,
  onPlayPause,
  onRestart,
  currentTime = 0,
  duration = 0,
}: VideoControlsProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onPlayPause}>
        <Text style={styles.buttonText}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>

      {onRestart && (
        <TouchableOpacity style={styles.button} onPress={onRestart}>
          <Text style={styles.buttonText}>↻</Text>
        </TouchableOpacity>
      )}

      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9333ea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
  },
});
