/**
 * Results Screen
 * Displays final score and provides navigation options
 * Integrates voice coach performance review
 * 
 * Acceptance Criteria: AC-037 to AC-041
 * Requirements: 6.1, 6.6, 12.2
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInUp, FadeInDown } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';
import { saveScore, initDatabase, getBestScore } from '@/services/database';
import { PerformanceReviewer, GameSession } from '@/services/voiceCoach';

export default function ResultsScreen() {
  const router = useRouter();
  const { finalScore, currentSong, reset, frameScores, sessionCoverage } = useGameStore();
  const [scoreSaved, setScoreSaved] = useState(false);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [performanceReviewer] = useState(() => new PerformanceReviewer({
    enabled: true,
    language: 'en',
    voiceId: 'Rachel',
  }));

  // Save score to database and get previous best
  useEffect(() => {
    const saveFinalScore = async () => {
      if (finalScore !== null && currentSong && !scoreSaved) {
        try {
          // Initialize database first
          await initDatabase();
          
          // Get previous best score before saving new one
          const bestScore = await getBestScore(currentSong.id, 'Player');
          setPreviousBest(bestScore?.score ?? null);
          
          // Save new score
          await saveScore(currentSong.id, finalScore, 'Player');
          setScoreSaved(true);
          console.log('Score saved:', finalScore);
        } catch (error) {
          console.error('Failed to save score:', error);
        }
      }
    };

    saveFinalScore();
  }, [finalScore, currentSong, scoreSaved]);

  // Generate performance review when enabled
  useEffect(() => {
    const generateReview = async () => {
      if (reviewEnabled && currentSong && finalScore !== null && frameScores.length > 0 && !isReviewing) {
        setIsReviewing(true);
        
        try {
          const session: GameSession = {
            song: currentSong,
            finalScore,
            previousBest,
            frameScores,
            coverage: sessionCoverage ?? undefined,
          };

          // Setup audio playback listener to display transcript
          performanceReviewer['audioManager'].onPlaybackStart = (clip) => {
            setReviewTranscript(clip.text);
          };

          performanceReviewer['audioManager'].onPlaybackEnd = () => {
            setReviewTranscript('');
          };

          const review = await performanceReviewer.reviewSession(session);
          
          if (review.review) {
            console.log('[Results] Performance review generated:', review.review);
          }
        } catch (error) {
          console.error('[Results] Failed to generate review:', error);
        } finally {
          setIsReviewing(false);
        }
      }
    };

    // Small delay to let the screen render first
    const timer = setTimeout(generateReview, 500);
    return () => clearTimeout(timer);
  }, [reviewEnabled, currentSong, finalScore, frameScores, previousBest, isReviewing, performanceReviewer]);

  // Calculate score breakdown
  const getScoreBreakdown = () => {
    if (frameScores.length === 0) return null;

    const scores = frameScores.map(fs => fs.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    return { min, max, avg, totalFrames: frameScores.length };
  };

  const breakdown = getScoreBreakdown();

  // Get performance message
  const getPerformanceMessage = () => {
    if (!finalScore) return 'Keep practicing!';
    if (finalScore >= 90) return 'Amazing! 🌟';
    if (finalScore >= 80) return 'Great job! 🎉';
    if (finalScore >= 70) return 'Well done! 👏';
    if (finalScore >= 60) return 'Good effort! 💪';
    return 'Keep practicing! 🎯';
  };

  // Handle play again
  const handlePlayAgain = () => {
    reset();
    router.back(); // Go back to home screen
  };

  // Handle go home
  const handleGoHome = () => {
    reset();
    router.push('/(tabs)/');
  };

  // Handle share
  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just scored ${finalScore?.toFixed(0)}% on ${currentSong?.title} in Bachata Bro! 🎵💃`,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* Final Score */}
      <Animated.View entering={FadeIn.duration(800)} style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>Final Score</Text>
        <Text style={styles.scoreText}>
          {finalScore?.toFixed(0) ?? 0}%
        </Text>
        <Text style={styles.performanceText}>
          {getPerformanceMessage()}
        </Text>
      </Animated.View>

      {/* Song Info */}
      {currentSong && (
        <Animated.View entering={FadeInDown.delay(300)} style={styles.songInfo}>
          <Text style={styles.songTitle}>{currentSong.title}</Text>
          <Text style={styles.songArtist}>{currentSong.artist}</Text>
        </Animated.View>
      )}

      {/* Voice Coach Review Section */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.reviewSection}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Voice Coach Review</Text>
          <Switch
            value={reviewEnabled}
            onValueChange={setReviewEnabled}
            trackColor={{ false: '#4b5563', true: '#9333ea' }}
            thumbColor={reviewEnabled ? '#fff' : '#9ca3af'}
          />
        </View>
        
        {reviewTranscript && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptLabel}>Coach is speaking:</Text>
            <Text style={styles.transcriptText}>{reviewTranscript}</Text>
          </View>
        )}
        
        {!reviewEnabled && (
          <Text style={styles.reviewDisabledText}>
            Enable to hear AI coach feedback
          </Text>
        )}
      </Animated.View>

      {/* Score Breakdown */}
      {breakdown && (
        <Animated.View entering={FadeInDown.delay(500)} style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Performance</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Total Frames:</Text>
            <Text style={styles.breakdownValue}>{breakdown.totalFrames}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Average:</Text>
            <Text style={styles.breakdownValue}>{breakdown.avg.toFixed(0)}%</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Best Frame:</Text>
            <Text style={styles.breakdownValue}>{breakdown.max.toFixed(0)}%</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Lowest Frame:</Text>
            <Text style={styles.breakdownValue}>{breakdown.min.toFixed(0)}%</Text>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons */}
      <Animated.View entering={SlideInUp.delay(700)} style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handlePlayAgain}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Share Score</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.tertiaryButton]}
          onPress={handleGoHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, styles.tertiaryButtonText]}>
            Home
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#111827', // gray-900
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#9ca3af', // gray-400
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  performanceText: {
    fontSize: 24,
    color: '#9333ea', // purple-600
    fontWeight: '600',
  },
  songInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 16,
    color: '#9ca3af', // gray-400
  },
  reviewSection: {
    width: '100%',
    backgroundColor: '#1f2937', // gray-800
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  transcriptContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#374151', // gray-700
    borderRadius: 8,
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#9ca3af', // gray-400
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  reviewDisabledText: {
    fontSize: 14,
    color: '#6b7280', // gray-500
    fontStyle: 'italic',
  },
  breakdown: {
    width: '100%',
    backgroundColor: '#1f2937', // gray-800
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#9ca3af', // gray-400
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#9333ea', // purple-600
  },
  secondaryButton: {
    backgroundColor: '#7c3aed', // purple-700
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4b5563', // gray-600
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tertiaryButtonText: {
    color: '#9ca3af', // gray-400
  },
});
