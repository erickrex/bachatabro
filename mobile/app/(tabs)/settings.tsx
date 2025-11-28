/**
 * Settings Screen
 * App settings including detection mode selection
 * 
 * Task 3.2.1: Add Mode Selection UI
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { DetectionModeSettings } from '@/components/Settings/DetectionModeSettings';
import { UnifiedPoseDetectionService } from '@/services/poseDetection';
import { DetectionMode } from '@/types/detection';

export default function SettingsScreen() {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<DetectionMode>(DetectionMode.AUTO);
  const [supportsRealTime, setSupportsRealTime] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white">Loading settings...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="bg-gray-800 px-4 py-6 border-b border-gray-700">
        <Text className="text-3xl font-bold text-white">Settings</Text>
      </View>

      {/* Settings Content */}
      <DetectionModeSettings
        currentMode={currentMode}
        onModeChange={handleModeChange}
        supportsRealTime={supportsRealTime}
      />

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
    </View>
  );
}
