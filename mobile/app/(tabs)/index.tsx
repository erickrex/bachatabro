/**
 * Home Screen
 * Main screen showing available songs for selection
 * 
 * Acceptance Criteria: AC-026 to AC-030
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SongList, SONGS } from '@/components/Song';
import { useVoiceCoachStore } from '@/store/voiceCoachStore';

// Lazy load voice coach hook to prevent initialization errors
let useVoiceCoachHook: any = null;
try {
  useVoiceCoachHook = require('@/hooks/useVoiceCoach').useVoiceCoach;
} catch (e) {
  console.warn('Voice coach hook not available:', e);
}

export default function HomeScreen() {
  const router = useRouter();
  const { enabled: voiceCoachEnabled, setEnabled: setVoiceCoachEnabled } = useVoiceCoachStore();
  
  // Voice coach state
  const voiceCoachResult = useVoiceCoachHook ? useVoiceCoachHook() : null;
  const voiceCoachState = voiceCoachResult?.[0] || {
    isEnabled: false,
    isListening: false,
    isAvailable: false,
    currentTranscript: '',
  };
  const voiceCoachActions = voiceCoachResult?.[1] || {
    startListening: async () => {},
    stopListening: () => {},
    processVoiceCommand: async () => {},
  };

  const [isListening, setIsListening] = useState(false);

  const handleSelectSong = useCallback((songId: string) => {
    // Navigate to game screen with selected song
    router.push({
      pathname: '/(tabs)/game',
      params: { songId },
    });
  }, [router]);

  // Toggle voice coach on/off
  const toggleVoiceCoach = useCallback(() => {
    const newState = !voiceCoachEnabled;
    setVoiceCoachEnabled(newState);
    
    if (newState) {
      Alert.alert(
        'Voice Coach Activated',
        'Say "play first song" or "play second song" to start dancing!',
        [{ text: 'Got it!' }]
      );
    }
  }, [voiceCoachEnabled, setVoiceCoachEnabled]);

  // Handle voice input button press
  const handleVoiceInput = useCallback(async () => {
    if (!voiceCoachEnabled) {
      Alert.alert('Voice Coach Disabled', 'Enable Voice Coach first to use voice commands.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      voiceCoachActions.stopListening();
      
      // Process the transcript
      if (voiceCoachState.currentTranscript) {
        const transcript = voiceCoachState.currentTranscript.toLowerCase();
        
        // Check for "play first song" or "play second song" commands
        if (transcript.includes('first') || transcript.includes('1st') || transcript.includes('one')) {
          if (SONGS.length > 0) {
            handleSelectSong(SONGS[0].id);
            return;
          }
        } else if (transcript.includes('second') || transcript.includes('2nd') || transcript.includes('two')) {
          if (SONGS.length > 1) {
            handleSelectSong(SONGS[1].id);
            return;
          }
        }
        
        // Fall back to general voice command processing
        await voiceCoachActions.processVoiceCommand(voiceCoachState.currentTranscript);
      }
    } else {
      setIsListening(true);
      await voiceCoachActions.startListening();
    }
  }, [isListening, voiceCoachEnabled, voiceCoachState.currentTranscript, voiceCoachActions, handleSelectSong]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Bachata Bro</Text>
            <Text style={styles.subtitle}>Choose your song</Text>
          </View>
          
          {/* Voice Coach Toggle Button */}
          <TouchableOpacity
            style={[
              styles.voiceCoachButton,
              voiceCoachEnabled && styles.voiceCoachButtonActive,
            ]}
            onPress={toggleVoiceCoach}
          >
            <Ionicons
              name={voiceCoachEnabled ? 'mic' : 'mic-off'}
              size={24}
              color={voiceCoachEnabled ? '#fff' : '#9ca3af'}
            />
          </TouchableOpacity>
        </View>
        
        {/* Voice Input Button (shown when voice coach is enabled) */}
        {voiceCoachEnabled && (
          <TouchableOpacity
            style={[
              styles.voiceInputButton,
              isListening && styles.voiceInputButtonActive,
            ]}
            onPress={handleVoiceInput}
          >
            <Ionicons
              name={isListening ? 'radio' : 'mic-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.voiceInputText}>
              {isListening ? 'Listening...' : 'Tap to speak'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Song List */}
      <SongList onSelectSong={handleSelectSong} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // gray-900
  },
  header: {
    backgroundColor: '#9333ea', // purple-600
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  voiceCoachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCoachButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  voiceInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 16,
  },
  voiceInputButtonActive: {
    backgroundColor: '#dc2626', // red-600
  },
  voiceInputText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
