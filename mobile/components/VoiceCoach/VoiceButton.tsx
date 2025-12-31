/**
 * VoiceButton Component
 *
 * Provides buttons for mute/unmute toggle and voice input trigger.
 * Displays appropriate icons and states for each action.
 *
 * Requirements: 11.5, 11.6
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

export interface VoiceButtonProps {
  type: 'mute' | 'voice-input';
  isMuted?: boolean;
  isListening?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * VoiceButton Component
 *
 * Renders a button for voice coach controls:
 * - Mute/Unmute toggle: Controls whether voice feedback is played
 * - Voice Input: Triggers voice input for commands or conversation
 */
export function VoiceButton({
  type,
  isMuted = false,
  isListening = false,
  onPress,
  disabled = false,
}: VoiceButtonProps): JSX.Element {
  const getButtonContent = () => {
    if (type === 'mute') {
      return {
        icon: isMuted ? '🔇' : '🔊',
        label: isMuted ? 'Unmute' : 'Mute',
        color: isMuted ? '#ef4444' : '#10b981', // red-500 : green-500
      };
    } else {
      return {
        icon: isListening ? '⏹️' : '🎤',
        label: isListening ? 'Stop' : 'Speak',
        color: isListening ? '#ef4444' : '#3b82f6', // red-500 : blue-500
      };
    }
  };

  const content = getButtonContent();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? '#6b7280' : content.color },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        <Text style={styles.icon}>{content.icon}</Text>
        <Text style={styles.label}>{content.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * VoiceButtonGroup Component
 *
 * Convenience component for displaying multiple voice buttons together.
 */
export interface VoiceButtonGroupProps {
  isMuted: boolean;
  isListening: boolean;
  onMuteToggle: () => void;
  onVoiceInput: () => void;
  disabled?: boolean;
}

export function VoiceButtonGroup({
  isMuted,
  isListening,
  onMuteToggle,
  onVoiceInput,
  disabled = false,
}: VoiceButtonGroupProps): JSX.Element {
  return (
    <View style={styles.buttonGroup}>
      <View style={styles.buttonWrapper}>
        <VoiceButton
          type="mute"
          isMuted={isMuted}
          onPress={onMuteToggle}
          disabled={disabled}
        />
      </View>
      <VoiceButton
        type="voice-input"
        isListening={isListening}
        onPress={onVoiceInput}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 100,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonWrapper: {
    marginRight: 12,
  },
});

