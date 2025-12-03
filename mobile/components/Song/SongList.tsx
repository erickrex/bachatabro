/**
 * Song List Component
 * Displays a scrollable list of available songs
 * 
 * Acceptance Criteria: AC-026 to AC-030
 */

import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SongCard } from './SongCard';
import { Song } from '@/types/game';

export interface SongListProps {
  onSelectSong: (songId: string) => void;
}

// Available songs in the app
const SONGS: Song[] = [
  {
    id: '30minutos',
    title: '30 Minutos',
    artist: 'Prince Royce',
    difficulty: 'medium',
  },
  {
    id: 'howdeepisyourlove',
    title: 'How Deep Is Your Love',
    artist: 'Prince Royce',
    difficulty: 'medium',
  },
];

export function SongList({ onSelectSong }: SongListProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    // Simulate loading songs from assets
    const loadSongs = async () => {
      try {
        // In a real app, this would load from assets or API
        await new Promise(resolve => setTimeout(resolve, 500));
        setSongs(SONGS);
      } catch (error) {
        console.error('Failed to load songs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSongs();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9333ea" />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No songs available</Text>
        <Text style={styles.emptySubtext}>
          Check back later for new songs!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {songs.map((song) => (
        <SongCard
          key={song.id}
          song={song}
          onPress={() => onSelectSong(song.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827', // gray-900
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af', // gray-400
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827', // gray-900
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
    textAlign: 'center',
  },
});

// Export the songs list for use in other components
export { SONGS };
