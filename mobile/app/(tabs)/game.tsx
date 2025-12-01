/**
 * Game Screen
 * Main gameplay screen with video, camera, and scoring
 * 
 * Task 3.2.2: Update Game Screen for Real-Time Mode
 * Acceptance Criteria: AC-001, AC-002, AC-003, AC-031 to AC-036
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DualVideoView } from '@/components/Game/DualVideoView';
import { ScoreDisplay } from '@/components/Game/ScoreDisplay';
import { ModeIndicator } from '@/components/Game/ModeIndicator';
import { useGameStore } from '@/store/gameStore';
import { loadPoseData, loadVideo } from '@/services/assetLoader';
import { calculateFrameScore } from '@/services/scoreCalculator';
import { UnifiedPoseDetectionService } from '@/services/poseDetection';
import { PoseData, Song } from '@/types/game';
import { DetectionMode } from '@/types/detection';
import { SONGS } from '@/components/Song';

export default function GameScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const router = useRouter();
  
  // Game store
  const {
    startGame,
    setReady,
    addFrameScore,
    endGame,
    setError,
    status,
    currentFrame,
    frameScores,
  } = useGameStore();

  // Local state
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>(DetectionMode.AUTO);
  const [fps, setFps] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);

  // Pose detection service
  const poseServiceRef = useRef<UnifiedPoseDetectionService | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  // Initialize pose detection service
  useEffect(() => {
    const initService = async () => {
      try {
        const service = new UnifiedPoseDetectionService();
        await service.initialize();
        poseServiceRef.current = service;
        
        const mode = service.getCurrentMode();
        setDetectionMode(mode);
        console.log('Pose detection service initialized with mode:', mode);
      } catch (error) {
        console.error('Failed to initialize pose detection service:', error);
        // Continue with pre-computed mode as fallback
      }
    };

    initService();
  }, []);

  // Load song and pose data
  useEffect(() => {
    const loadGame = async () => {
      try {
        // Find song
        const song = SONGS.find(s => s.id === songId);
        if (!song) {
          throw new Error('Song not found');
        }

        // Start game
        startGame(song);

        // Load pose data (needed for reference poses and pre-computed mode)
        const data = await loadPoseData(songId);
        setPoseData(data);
        setReady(data);

        // Load video asset
        const videoPath = await loadVideo(songId);
        setVideoUri(videoPath);
        
        // Start playing after a short delay
        setTimeout(() => {
          setIsPlaying(true);
        }, 1000);
      } catch (error) {
        console.error('Failed to load game:', error);
        setError(error instanceof Error ? error.message : 'Failed to load game');
        Alert.alert(
          'Error',
          'Failed to load game data. Please try again.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    };

    if (songId) {
      loadGame();
    }
  }, [songId]);

  // Calculate average score
  useEffect(() => {
    if (frameScores.length > 0) {
      const scores = frameScores.map(fs => fs.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      setAverageScore(avg);
      setCurrentScore(frameScores[frameScores.length - 1].score);
    }
  }, [frameScores]);

  // Handle frame capture from camera
  const handleFrame = async (base64Image: string) => {
    if (!poseData || !isPlaying || !poseServiceRef.current) return;

    const frameIndex = currentFrame % poseData.frames.length;
    const referenceFrame = poseData.frames[frameIndex];

    if (!referenceFrame) return;

    try {
      // Update FPS counter
      frameCountRef.current++;
      const now = Date.now();
      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed >= 1000) {
        const currentFps = (frameCountRef.current * 1000) / elapsed;
        setFps(currentFps);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      // Detect user pose (real-time or pre-computed based on mode)
      const userPose = await poseServiceRef.current.detectPose({
        type: detectionMode === DetectionMode.REAL_TIME ? 'camera' : 'precomputed',
        imageData: base64Image,
        frameIndex,
        songId,
      });

      // Update latency for real-time mode
      if (detectionMode === DetectionMode.REAL_TIME) {
        const metrics = poseServiceRef.current.getPerformanceMetrics();
        if (metrics) {
          setLatency(metrics.averageLatency);
        }
      }

      // Get reference pose (always from pre-computed data)
      const referencePose = await poseServiceRef.current.detectPose({
        type: 'precomputed',
        frameIndex,
        songId,
      });

      // Calculate score by comparing user pose with reference
      const { score, matches } = calculateFrameScore(
        userPose,
        referencePose,
        20 // threshold in degrees
      );

      // Add frame score
      addFrameScore({
        score,
        matches,
        timestamp: frameIndex / poseData.fps,
      });

      setCurrentScore(score);
    } catch (error) {
      console.error('Frame processing failed:', error);
      // Continue with next frame - don't break the game
    }
  };

  // Handle video end
  const handleVideoEnd = () => {
    setIsPlaying(false);
    endGame();
    
    // Navigate to results after a short delay
    setTimeout(() => {
      router.push('/(tabs)/results');
    }, 500);
  };

  // Handle video ready
  const handleVideoReady = () => {
    console.log('Video and camera ready');
  };

  // Handle errors
  const handleError = (error: string) => {
    console.error('Video error:', error);
    Alert.alert('Error', 'Video playback error. Please try again.');
  };

  // Loading state
  if (status === 'loading' || !poseData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9333ea" />
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  // Show loading if video not ready
  if (!videoUri) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9333ea" />
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  // Calculate progress
  const progress = poseData ? currentFrame / poseData.totalFrames : 0;

  return (
    <View style={styles.container}>
      {/* Dual Video View */}
      <DualVideoView
        videoUri={videoUri}
        onFrame={handleFrame}
        isPlaying={isPlaying}
        onVideoEnd={handleVideoEnd}
        onVideoReady={handleVideoReady}
        onError={handleError}
      />

      {/* Mode Indicator */}
      <ModeIndicator 
        mode={detectionMode} 
        fps={detectionMode === DetectionMode.REAL_TIME ? fps : undefined}
        latency={detectionMode === DetectionMode.REAL_TIME ? latency : undefined}
      />

      {/* Score Display */}
      {isPlaying && (
        <ScoreDisplay
          currentScore={currentScore}
          averageScore={averageScore}
          progress={progress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
});
