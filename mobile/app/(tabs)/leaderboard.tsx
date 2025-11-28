/**
 * Leaderboard Screen
 * Displays top scores from local database
 * 
 * Acceptance Criteria: AC-042 to AC-047
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getLeaderboard } from '@/services/database';
import { Score } from '@/types/game';
import { SONGS } from '@/components/Song';

export default function LeaderboardScreen() {
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedSong, setSelectedSong] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load scores
  const loadScores = async () => {
    try {
      const data = await getLeaderboard(selectedSong, 10);
      setScores(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadScores();
  }, [selectedSong]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadScores();
    setRefreshing(false);
  };

  // Get song title by ID
  const getSongTitle = (songId: string) => {
    const song = SONGS.find(s => s.id === songId);
    return song ? song.title : songId;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get rank color
  const getRankColor = (rank: number) => {
    if (rank === 1) return '#fbbf24'; // gold
    if (rank === 2) return '#9ca3af'; // silver
    if (rank === 3) return '#cd7f32'; // bronze
    return '#6b7280'; // gray
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top 10 Scores</Text>
      </View>

      {/* Song Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            !selectedSong && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedSong(undefined)}
        >
          <Text
            style={[
              styles.filterButtonText,
              !selectedSong && styles.filterButtonTextActive,
            ]}
          >
            All Songs
          </Text>
        </TouchableOpacity>

        {SONGS.map((song) => (
          <TouchableOpacity
            key={song.id}
            style={[
              styles.filterButton,
              selectedSong === song.id && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedSong(song.id)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedSong === song.id && styles.filterButtonTextActive,
              ]}
            >
              {song.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Scores List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9333ea" />
        </View>
      ) : scores.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scores yet</Text>
          <Text style={styles.emptySubtext}>
            Play a game to see your scores here!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scoresList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9333ea"
            />
          }
        >
          {scores.map((score, index) => (
            <View key={score.id} style={styles.scoreCard}>
              {/* Rank */}
              <View style={styles.rankContainer}>
                <Text
                  style={[
                    styles.rankText,
                    { color: getRankColor(index + 1) },
                  ]}
                >
                  #{index + 1}
                </Text>
              </View>

              {/* Score Info */}
              <View style={styles.scoreInfo}>
                <Text style={styles.playerName}>{score.playerName}</Text>
                <Text style={styles.songName}>
                  {getSongTitle(score.songId)}
                </Text>
                <Text style={styles.dateText}>
                  {formatDate(score.playedAt)}
                </Text>
              </View>

              {/* Score Value */}
              <View style={styles.scoreValueContainer}>
                <Text style={styles.scoreValue}>
                  {Math.round(score.score)}%
                </Text>
              </View>
            </View>
          ))}

          {/* Fill empty slots */}
          {scores.length < 10 && (
            <View style={styles.emptySlots}>
              {Array.from({ length: 10 - scores.length }).map((_, index) => (
                <View key={`empty-${index}`} style={styles.emptySlot}>
                  <Text style={styles.emptySlotText}>
                    #{scores.length + index + 1}
                  </Text>
                  <Text style={styles.emptySlotSubtext}>Empty</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  filterContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937', // gray-800
  },
  filterButtonActive: {
    backgroundColor: '#9333ea', // purple-600
  },
  filterButtonText: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  scoresList: {
    flex: 1,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937', // gray-800
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  songName: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280', // gray-500
  },
  scoreValueContainer: {
    marginLeft: 12,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#9333ea', // purple-600
  },
  emptySlots: {
    padding: 16,
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937', // gray-800
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    opacity: 0.5,
  },
  emptySlotText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280', // gray-500
    width: 50,
  },
  emptySlotSubtext: {
    fontSize: 14,
    color: '#6b7280', // gray-500
    marginLeft: 12,
  },
});
