/**
 * VoiceIndicator Component
 *
 * Displays visual feedback for voice coach state (idle, listening, speaking).
 * Includes animated indicators for speaking and listening states.
 *
 * Requirements: 11.1, 11.2
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export interface VoiceIndicatorProps {
  state: 'idle' | 'listening' | 'speaking';
  transcript?: string;
}

/**
 * VoiceIndicator Component
 *
 * Shows the current state of the voice coach with animated visual feedback.
 * - idle: No animation, subtle icon
 * - listening: Pulsing animation to indicate active listening
 * - speaking: Wave animation to indicate speech output
 */
export function VoiceIndicator({ state, transcript }: VoiceIndicatorProps): JSX.Element {
  const pulseScale = useSharedValue(1);
  const waveOpacity1 = useSharedValue(0.3);
  const waveOpacity2 = useSharedValue(0.3);
  const waveOpacity3 = useSharedValue(0.3);

  // Listening animation - pulsing circle
  useEffect(() => {
    if (state === 'listening') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite
        false
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [state]);

  // Speaking animation - wave bars
  useEffect(() => {
    if (state === 'speaking') {
      // Staggered wave animation for three bars
      waveOpacity1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      );

      waveOpacity2.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 200 }),
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 200 })
        ),
        -1,
        false
      );

      waveOpacity3.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 400 }),
          withTiming(1, { duration: 400 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(waveOpacity1);
      cancelAnimation(waveOpacity2);
      cancelAnimation(waveOpacity3);
      waveOpacity1.value = withTiming(0.3, { duration: 200 });
      waveOpacity2.value = withTiming(0.3, { duration: 200 });
      waveOpacity3.value = withTiming(0.3, { duration: 200 });
    }
  }, [state]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const wave1AnimatedStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity1.value,
  }));

  const wave2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity2.value,
  }));

  const wave3AnimatedStyle = useAnimatedStyle(() => ({
    opacity: waveOpacity3.value,
  }));

  const getStateColor = () => {
    switch (state) {
      case 'listening':
        return '#3b82f6'; // blue-500
      case 'speaking':
        return '#10b981'; // green-500
      case 'idle':
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'Speaking...';
      case 'idle':
      default:
        return 'Coach Ready';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.indicatorContainer}>
        {state === 'listening' && (
          <Animated.View
            style={[
              styles.listeningCircle,
              { backgroundColor: getStateColor() },
              pulseAnimatedStyle,
            ]}
          />
        )}

        {state === 'speaking' && (
          <View style={styles.speakingBars}>
            <Animated.View
              style={[
                styles.speakingBar,
                { backgroundColor: getStateColor() },
                wave1AnimatedStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.speakingBar,
                styles.speakingBarTall,
                { backgroundColor: getStateColor() },
                wave2AnimatedStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.speakingBar,
                { backgroundColor: getStateColor() },
                wave3AnimatedStyle,
              ]}
            />
          </View>
        )}

        {state === 'idle' && (
          <View
            style={[
              styles.idleCircle,
              { backgroundColor: getStateColor() },
            ]}
          />
        )}
      </View>

      <View style={styles.labelContainer}>
        <Text style={[styles.stateLabel, { color: getStateColor() }]}>
          {getStateLabel()}
        </Text>
        {transcript && (
          <Text style={styles.transcriptPreview} numberOfLines={1}>
            {transcript}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicatorContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  listeningCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  idleCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  speakingBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  speakingBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  speakingBarTall: {
    height: 20,
  },
  labelContainer: {
    flex: 1,
  },
  stateLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  transcriptPreview: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
});

