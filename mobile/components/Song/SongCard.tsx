/**
 * Song Card Component
 * Displays individual song information in a card format
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Image } from 'react-native';
import { Song } from '@/types/game';

export interface SongCardProps {
  song: Song;
  onPress: () => void;
}

export function SongCard({ song, onPress }: SongCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Thumbnail placeholder */}
      <View style={styles.thumbnail}>
        <Text style={styles.thumbnailText}>♪</Text>
      </View>

      {/* Song Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
        </Text>
        {song.difficulty && (
          <View style={[styles.difficultyBadge, styles[`difficulty${song.difficulty}`]]}>
            <Text style={styles.difficultyText}>
              {song.difficulty.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Play Icon */}
      <View style={styles.playIcon}>
        <Text style={styles.playIconText}>▶</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937', // gray-800
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#9333ea', // purple-600
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbnailText: {
    fontSize: 28,
    color: '#fff',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
    marginBottom: 6,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyeasy: {
    backgroundColor: '#10b981', // green-500
  },
  difficultymedium: {
    backgroundColor: '#f59e0b', // amber-500
  },
  difficultyhard: {
    backgroundColor: '#ef4444', // red-500
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  playIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9333ea', // purple-600
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 2, // Optical alignment
  },
});
