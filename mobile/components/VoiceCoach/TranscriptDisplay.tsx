/**
 * TranscriptDisplay Component
 *
 * Displays transcripts of spoken text (TTS) and user speech (STT).
 * Shows both what the coach is saying and what the user said.
 *
 * Requirements: 11.3, 11.4
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';

export interface TranscriptEntry {
  id: string;
  type: 'coach' | 'user';
  text: string;
  timestamp: number;
}

export interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  currentSpeaking?: string; // Currently being spoken by coach
  currentListening?: string; // Currently being transcribed from user
  maxHeight?: number;
}

/**
 * TranscriptDisplay Component
 *
 * Displays a scrollable list of transcript entries showing the conversation
 * between the user and the voice coach. Automatically scrolls to show the
 * latest entry.
 */
export function TranscriptDisplay({
  entries,
  currentSpeaking,
  currentListening,
  maxHeight = 200,
}: TranscriptDisplayProps): JSX.Element {
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (entries.length > 0 || currentSpeaking || currentListening) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [entries, currentSpeaking, currentListening]);

  // Fade in animation when content appears
  useEffect(() => {
    if (entries.length > 0 || currentSpeaking || currentListening) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [entries.length, currentSpeaking, currentListening]);

  const hasContent = entries.length > 0 || currentSpeaking || currentListening;

  if (!hasContent) {
    return <View style={styles.emptyContainer} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, maxHeight }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Transcript</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {entries.map((entry) => (
          <View
            key={entry.id}
            style={[
              styles.entry,
              entry.type === 'coach' ? styles.coachEntry : styles.userEntry,
            ]}
          >
            <Text
              style={[
                styles.entryLabel,
                entry.type === 'coach' ? styles.coachLabel : styles.userLabel,
              ]}
            >
              {entry.type === 'coach' ? 'Coach' : 'You'}
            </Text>
            <Text
              style={[
                styles.entryText,
                entry.type === 'coach' ? styles.coachText : styles.userText,
              ]}
            >
              {entry.text}
            </Text>
          </View>
        ))}

        {/* Currently speaking (coach) */}
        {currentSpeaking && (
          <View style={[styles.entry, styles.coachEntry, styles.currentEntry]}>
            <Text style={[styles.entryLabel, styles.coachLabel]}>
              Coach
            </Text>
            <Text style={[styles.entryText, styles.coachText]}>
              {currentSpeaking}
            </Text>
          </View>
        )}

        {/* Currently listening (user) */}
        {currentListening && (
          <View style={[styles.entry, styles.userEntry, styles.currentEntry]}>
            <Text style={[styles.entryLabel, styles.userLabel]}>
              You
            </Text>
            <Text style={[styles.entryText, styles.userText]}>
              {currentListening}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyContainer: {
    height: 0,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 8,
  },
  entry: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  coachEntry: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // green with transparency
    borderLeftWidth: 3,
    borderLeftColor: '#10b981', // green-500
  },
  userEntry: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // blue with transparency
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6', // blue-500
  },
  currentEntry: {
    opacity: 0.8,
  },
  entryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coachLabel: {
    color: '#10b981', // green-500
  },
  userLabel: {
    color: '#3b82f6', // blue-500
  },
  entryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  coachText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userText: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
});

