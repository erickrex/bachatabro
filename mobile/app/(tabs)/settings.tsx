/**
 * Settings Screen
 * App settings including detection mode selection and voice coach settings
 * 
 * Task 3.2.1: Add Mode Selection UI
 * Task 18.1: Add Voice Coach settings section
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { DetectionModeSettings } from '@/components/Settings/DetectionModeSettings';
import { CoachSettings } from '@/components/VoiceCoach/CoachSettings';
import { UnifiedPoseDetectionService } from '@/services/poseDetection';
import { DetectionMode } from '@/types/detection';
import { useVoiceCoachStore } from '@/store/voiceCoachStore';
import type { CoachSettingsValues } from '@/components/VoiceCoach/CoachSettings';

export default function SettingsScreen() {
  const [currentMode, setCurrentMode] = useState<DetectionMode>(DetectionMode.AUTO);
  const [supportsRealTime, setSupportsRealTime] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Voice coach store state and actions
  const voiceCoachState = useVoiceCoachStore();
  const {
    enabled,
    language,
    voiceId,
    realTimeCoachingEnabled,
    performanceReviewsEnabled,
    coachingFrequency,
    setEnabled,
    setLanguage,
    setVoiceId,
    setRealTimeCoachingEnabled,
    setPerformanceReviewsEnabled,
    setCoachingFrequency,
  } = voiceCoachState;

  // Initialize and load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const service = new UnifiedPoseDetectionService();
        await service.initialize();
        
        const mode = service.getCurrentMode();
        setCurrentMode(mode);
        
        const modeManager = service.getModeManager();
        const supports = modeManager.supportsRealTime();
        setSupportsRealTime(supports);
        
        console.log('Settings loaded:', { mode, supports });
      } catch (error) {
        console.error('Failed to load settings:', error);
        Alert.alert('Error', 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleModeChange = async (newMode: DetectionMode) => {
    try {
      const service = new UnifiedPoseDetectionService();
      await service.initialize();
      await service.setMode(newMode);
      setCurrentMode(newMode);
      
      Alert.alert(
        'Mode Changed',
        `Detection mode changed to ${newMode}. This will take effect in your next game.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to change mode:', error);
      Alert.alert('Error', 'Failed to change detection mode');
    }
  };

  /**
   * Handle voice coach settings changes
   * Updates the Zustand store which automatically persists to AsyncStorage
   * Requirements: 12.6
   */
  const handleVoiceCoachSettingsChange = (settings: Partial<CoachSettingsValues>) => {
    if (settings.enabled !== undefined) {
      setEnabled(settings.enabled);
    }
    if (settings.language !== undefined) {
      setLanguage(settings.language);
    }
    if (settings.voiceId !== undefined) {
      setVoiceId(settings.voiceId);
    }
    if (settings.realTimeCoachingEnabled !== undefined) {
      setRealTimeCoachingEnabled(settings.realTimeCoachingEnabled);
    }
    if (settings.performanceReviewsEnabled !== undefined) {
      setPerformanceReviewsEnabled(settings.performanceReviewsEnabled);
    }
    if (settings.coachingFrequency !== undefined) {
      setCoachingFrequency(settings.coachingFrequency);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white">Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="bg-gray-800 px-4 py-6 border-b border-gray-700">
        <Text className="text-3xl font-bold text-white">Settings</Text>
      </View>

      {/* Detection Mode Settings */}
      <DetectionModeSettings
        currentMode={currentMode}
        onModeChange={handleModeChange}
        supportsRealTime={supportsRealTime}
      />

      {/* Voice Coach Settings Section */}
      <View className="mt-4">
        <CoachSettings
          enabled={enabled}
          language={language}
          voiceId={voiceId}
          realTimeCoachingEnabled={realTimeCoachingEnabled}
          performanceReviewsEnabled={performanceReviewsEnabled}
          coachingFrequency={coachingFrequency}
          onSettingsChange={handleVoiceCoachSettingsChange}
        />
      </View>

      {/* Additional Settings Section */}
      <View className="p-4">
        <View className="bg-gray-800 p-4 rounded-lg">
          <Text className="text-white font-bold text-lg mb-2">About</Text>
          <Text className="text-gray-400 text-sm mb-2">
            Bacha Trainer v1.0.0
          </Text>
          <Text className="text-gray-400 text-sm">
            Powered by ExecuTorch for real-time pose detection
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
