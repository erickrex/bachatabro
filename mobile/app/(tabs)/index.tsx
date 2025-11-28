/**
 * Home Screen
 * Main screen showing available songs for selection
 * 
 * Acceptance Criteria: AC-026 to AC-030
 */

import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SongList } from '@/components/Song';

export default function HomeScreen() {
  const router = useRouter();

  const handleSelectSong = (songId: string) => {
    // Navigate to game screen with selected song
    router.push({
      pathname: '/(tabs)/game',
      params: { songId },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bacha Trainer</Text>
        <Text style={styles.subtitle}>Choose your song</Text>
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
});
