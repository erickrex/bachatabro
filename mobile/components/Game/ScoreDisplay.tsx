/**
 * Real-Time Score Display Component
 * Shows current score, average, and joint match indicators during gameplay
 * 
 * Acceptance Criteria: AC-021 to AC-025
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface ScoreDisplayProps {
  currentScore: number;
  averageScore: number;
  matches?: Record<string, boolean>;
  progress?: number; // 0-1 for progress bar
}

export function ScoreDisplay({
  currentScore,
  averageScore,
  matches = {},
  progress = 0,
}: ScoreDisplayProps) {
  const scoreScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  // Animate score when it changes
  useEffect(() => {
    scoreScale.value = withSpring(1.2, {}, () => {
      scoreScale.value = withSpring(1);
    });
  }, [currentScore]);

  // Animate progress bar
  useEffect(() => {
    progressWidth.value = withTiming(progress, { duration: 300 });
  }, [progress]);

  const scoreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const jointEntries = Object.entries(matches);
  const hasMatches = jointEntries.length > 0;

  return (
    <View style={styles.container}>
      {/* Main Score */}
      <Animated.View style={[styles.scoreContainer, scoreAnimatedStyle]}>
        <Text style={styles.scoreText}>
          {Math.round(currentScore)}%
        </Text>
      </Animated.View>

      {/* Average Score */}
      <View style={styles.averageContainer}>
        <Text style={styles.averageLabel}>Avg:</Text>
        <Text style={styles.averageText}>
          {Math.round(averageScore)}%
        </Text>
      </View>

      {/* Joint Match Indicators */}
      {hasMatches && (
        <View style={styles.matchesContainer}>
          <Text style={styles.matchesLabel}>Joints:</Text>
          <View style={styles.matchIndicators}>
            {jointEntries.map(([joint, matched]) => (
              <View
                key={joint}
                style={[
                  styles.matchDot,
                  matched ? styles.matchDotSuccess : styles.matchDotFail,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Progress Bar */}
      {progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, progressAnimatedStyle]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  averageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  averageLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginRight: 4,
  },
  averageText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  matchesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  matchesLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  matchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchDotSuccess: {
    backgroundColor: '#10b981', // green-500
  },
  matchDotFail: {
    backgroundColor: '#ef4444', // red-500
  },
  progressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9333ea', // purple-600
    borderRadius: 2,
  },
});
