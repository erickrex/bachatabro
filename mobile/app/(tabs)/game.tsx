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
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
        timestamp: frameIndex / poseData.fps,
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

  // Handle voice input button press
  // Requirements: 8.1, 11.6 - Voice input trigger and command handling
  const handleVoiceInput = useCallback(async () => {
    if (voiceCoachState.isListening) {
      voiceCoachActions.stopListening();
      // Process the transcript as a voice command if available
      if (voiceCoachState.currentTranscript) {
        await voiceCoachActions.processVoiceCommand(voiceCoachState.currentTranscript);
      }
    } else {
      await voiceCoachActions.startListening();
    }
  }, [voiceCoachState.isListening, voiceCoachState.currentTranscript, voiceCoachActions]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    voiceCoachActions.setMuted(!voiceCoachState.isSpeaking);
  }, [voiceCoachActions]);

  // Determine voice indicator state
  const getVoiceIndicatorState = (): 'idle' | 'listening' | 'speaking' => {
    if (voiceCoachState.isSpeaking) return 'speaking';
    if (voiceCoachState.isListening) return 'listening';
    return 'idle';
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

      {/* Voice Coach Indicator - Requirements: 11.1, 11.2 */}
      {voiceCoachState.isEnabled && (
        <View style={styles.voiceIndicatorContainer}>
          <VoiceIndicator
            state={getVoiceIndicatorState()}
            transcript={voiceCoachState.spokenText || voiceCoachState.currentTranscript}
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

      {/* Voice Input Button - Requirements: 8.1, 11.6 */}
      {voiceCoachState.isEnabled && isPlaying && (
        <View style={styles.voiceButtonContainer}>
          <VoiceButton
            type="voice-input"
            isListening={voiceCoachState.isListening}
            onPress={handleVoiceInput}
            disabled={!voiceCoachState.isAvailable}
          />
        </View>
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
  voiceIndicatorContainer: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    alignItems: 'flex-start',
    zIndex: 10,
  },
  voiceButtonContainer: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    zIndex: 10,
  },
});
