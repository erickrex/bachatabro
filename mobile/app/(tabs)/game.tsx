/**
 * Game Screen
 * Main gameplay screen with video, camera, and scoring
 * 
 * Task 3.2.2: Update Game Screen for Real-Time Mode
 * Acceptance Criteria: AC-001, AC-002, AC-003, AC-031 to AC-036
 * 
 * Task 17: Integrate Voice Coach with Game Screen
 * Requirements: 5.1, 5.2, 5.5, 8.1, 11.6
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DualVideoView } from '@/components/Game/DualVideoView';
import { ScoreDisplay } from '@/components/Game/ScoreDisplay';
import { ModeIndicator } from '@/components/Game/ModeIndicator';
import { VoiceIndicator, VoiceButton } from '@/components/VoiceCoach';
import { useGameStore } from '@/store/gameStore';
import { useVoiceCoach } from '@/hooks/useVoiceCoach';
import { loadPoseData, loadVideo } from '@/services/assetLoader';
import { calculateFrameScore } from '@/services/scoreCalculator';
import { UnifiedPoseDetectionService } from '@/services/poseDetection';
import { PoseData, Song } from '@/types/game';
import { DetectionMode } from '@/types/detection';
import { PoseAnalysis } from '@/types/voiceCoach';
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

  // Voice coach hook
  const [voiceCoachState, voiceCoachActions] = useVoiceCoach();

  // Local state
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>(DetectionMode.AUTO);
  const [fps, setFps] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);

  // Track weak and strong points for voice coaching
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [strongPoints, setStrongPoints] = useState<string[]>([]);

  // Pose detection service
  const poseServiceRef = useRef<UnifiedPoseDetectionService | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  // Handle back button press (Android) and cleanup
  const handleGoBack = useCallback(() => {
    setIsPlaying(false);
    endGame();
    router.back();
  }, [endGame, router]);

  // Handle Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isPlaying) {
          // Pause first, then show confirmation
          setIsPlaying(false);
          Alert.alert(
            'Exit Choreography?',
            'Your progress will be lost.',
            [
              { text: 'Continue', onPress: () => setIsPlaying(true) },
              { text: 'Exit', style: 'destructive', onPress: handleGoBack },
            ]
          );
          return true; // Prevent default back behavior
        }
        handleGoBack();
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [isPlaying, handleGoBack])
  );

  // Cleanup when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Stop playback when navigating away
        setIsPlaying(false);
      };
    }, [])
  );

  // Toggle pause/play
  const handleTogglePause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

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
  const handleFrame = async (base64Image: string, videoPositionMs: number) => {
    if (!poseData || !isPlaying || !poseServiceRef.current) return;

    // Calculate frame index from video position (synchronized with video playback)
    const frameIndex = Math.floor((videoPositionMs / 1000) * poseData.fps) % poseData.frames.length;
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

      // Detect user pose - always use camera for real user detection
      // AUTO mode should also use camera when ExecuTorch is available
      const shouldUseCamera = detectionMode === DetectionMode.REAL_TIME || 
                              detectionMode === DetectionMode.AUTO;
      
      const userPose = await poseServiceRef.current.detectPose({
        type: shouldUseCamera ? 'camera' : 'precomputed',
        imageData: base64Image,
        frameIndex,
        songId,
      });

      // Update latency for real-time/auto mode
      if (shouldUseCamera) {
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
      const { score, matches, attemptedJoints, skippedJoints, skippedJointsList } = calculateFrameScore(
        userPose,
        referencePose,
        20 // threshold in degrees
      );

      // Add frame score
      addFrameScore({
        score,
        matches,
        timestamp: videoPositionMs / 1000, // Use actual video position
        attemptedJoints,
        skippedJoints,
        skippedJointsList,
      });

      setCurrentScore(score);

      // Analyze matches to determine weak and strong points for voice coaching
      // Requirements: 5.1, 5.2, 5.5
      const newWeakPoints: string[] = [];
      const newStrongPoints: string[] = [];
      
      if (matches) {
        Object.entries(matches).forEach(([bodyPart, isMatched]) => {
          if (isMatched) {
            newStrongPoints.push(bodyPart);
          } else {
            newWeakPoints.push(bodyPart);
          }
        });
      }

      setWeakPoints(newWeakPoints);
      setStrongPoints(newStrongPoints);

      // Call voice coach for real-time feedback
      // Requirements: 5.1, 5.2 - Score-based feedback triggering
      // Requirement: 5.5 - Voice feedback during pose detection
      if (voiceCoachState.isEnabled && voiceCoachState.isAvailable) {
        const poseAnalysis: PoseAnalysis = {
          score,
          weakPoints: newWeakPoints,
          strongPoints: newStrongPoints,
          timestamp: now,
        };
        
        // Call onPoseAnalysis - this handles cooldown and feedback generation internally
        voiceCoachActions.onPoseAnalysis(poseAnalysis);
      }
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

  // Handle voice input button press (only when paused)
  const handleVoiceInput = useCallback(async () => {
    if (voiceCoachState.isListening) {
      voiceCoachActions.stopListening();
      // Process the transcript as a voice command if available
      if (voiceCoachState.currentTranscript) {
        const transcript = voiceCoachState.currentTranscript.toLowerCase();
        // Handle pause-specific commands
        if (transcript.includes('resume') || transcript.includes('play') || transcript.includes('continue')) {
          setIsPlaying(true);
        } else if (transcript.includes('exit') || transcript.includes('quit') || transcript.includes('back')) {
          handleGoBack();
        } else {
          // Pass to general voice command processor
          await voiceCoachActions.processVoiceCommand(voiceCoachState.currentTranscript);
        }
      }
    } else {
      await voiceCoachActions.startListening();
    }
  }, [voiceCoachState.isListening, voiceCoachState.currentTranscript, voiceCoachActions, handleGoBack]);

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

      {/* Playback Controls */}
      <View style={styles.controlsContainer}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setIsPlaying(false);
            Alert.alert(
              'Exit Choreography?',
              'Your progress will be lost.',
              [
                { text: 'Continue', onPress: () => setIsPlaying(true) },
                { text: 'Exit', style: 'destructive', onPress: handleGoBack },
              ]
            );
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Pause/Play Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseButton]}
          onPress={handleTogglePause}
        >
          <Ionicons 
            name={isPlaying ? 'pause' : 'play'} 
            size={28} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {/* Paused Overlay */}
      {!isPlaying && status !== 'loading' && (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedText}>PAUSED</Text>
          <TouchableOpacity
            style={styles.resumeButton}
            onPress={() => setIsPlaying(true)}
          >
            <Ionicons name="play-circle" size={64} color="#9333ea" />
          </TouchableOpacity>
          
          {/* Voice Input - Only available when paused */}
          {voiceCoachState.isEnabled && voiceCoachState.isAvailable && (
            <View style={styles.pausedVoiceContainer}>
              <Text style={styles.pausedVoiceHint}>Say "resume" or "exit"</Text>
              <VoiceButton
                type="voice-input"
                isListening={voiceCoachState.isListening}
                onPress={handleVoiceInput}
                disabled={!voiceCoachState.isAvailable}
              />
            </View>
          )}
        </View>
      )}

      {/* Mode Indicator */}
      <ModeIndicator 
        mode={detectionMode} 
        fps={detectionMode === DetectionMode.REAL_TIME ? fps : undefined}
        latency={detectionMode === DetectionMode.REAL_TIME ? latency : undefined}
      />

      {/* Voice Coach Speaking Indicator - Shows when coach gives real-time tips */}
      {voiceCoachState.isEnabled && voiceCoachState.isSpeaking && isPlaying && (
        <View style={styles.voiceIndicatorContainer}>
          <VoiceIndicator
            state="speaking"
            transcript={voiceCoachState.spokenText}
          />
        </View>
      )}

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
  controlsContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(147, 51, 234, 0.8)',
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  pausedText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    letterSpacing: 4,
  },
  resumeButton: {
    padding: 8,
  },
  pausedVoiceContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  pausedVoiceHint: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 12,
  },
  voiceIndicatorContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    alignItems: 'flex-start',
    zIndex: 10,
  },
});
