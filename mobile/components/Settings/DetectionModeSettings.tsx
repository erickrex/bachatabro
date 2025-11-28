/**
 * Detection Mode Settings Component
 * Allows users to select detection mode
 * 
 * Task 3.2.1: Add Mode Selection UI
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { DetectionMode } from '@/types/detection';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DetectionModeSettingsProps {
  currentMode: DetectionMode;
  onModeChange: (mode: DetectionMode) => Promise<void>;
  supportsRealTime: boolean;
}

export function DetectionModeSettings({
  currentMode,
  onModeChange,
  supportsRealTime,
}: DetectionModeSettingsProps) {
  const [selectedMode, setSelectedMode] = useState<DetectionMode>(currentMode);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);

  const handleModeChange = async (newMode: DetectionMode) => {
    setIsChanging(true);
    try {
      await onModeChange(newMode);
      setSelectedMode(newMode);
    } catch (error) {
      console.error('Failed to change mode:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const modes = [
    {
      value: DetectionMode.AUTO,
      title: 'Auto (Recommended)',
      description: 'Automatically choose the best mode for your device',
      icon: '🤖',
    },
    {
      value: DetectionMode.REAL_TIME,
      title: 'Real-Time Detection',
      description: 'Live pose detection using your camera (requires modern device)',
      icon: '📹',
      disabled: !supportsRealTime,
    },
    {
      value: DetectionMode.PRE_COMPUTED,
      title: 'Pre-Computed (Smooth)',
      description: 'Use pre-processed pose data for smooth playback',
      icon: '📊',
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-4">
        <Text className="text-2xl font-bold text-white mb-2">Detection Mode</Text>
        <Text className="text-gray-400 mb-6">
          Choose how pose detection works during gameplay
        </Text>

        {modes.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            onPress={() => !mode.disabled && handleModeChange(mode.value)}
            disabled={isChanging || mode.disabled}
            className={`mb-4 p-4 rounded-lg border-2 ${
              selectedMode === mode.value
                ? 'bg-purple-600/20 border-purple-600'
                : mode.disabled
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-gray-800 border-gray-700'
            }`}
          >
            <View className="flex-row items-center mb-2">
              <Text className="text-3xl mr-3">{mode.icon}</Text>
              <View className="flex-1">
                <Text
                  className={`text-lg font-bold ${
                    mode.disabled ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  {mode.title}
                </Text>
                {selectedMode === mode.value && (
                  <Text className="text-purple-400 text-sm">✓ Active</Text>
                )}
              </View>
            </View>
            <Text
              className={`text-sm ${
                mode.disabled ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              {mode.description}
            </Text>
            {mode.disabled && (
              <Text className="text-red-400 text-sm mt-2">
                Not supported on this device
              </Text>
            )}
          </TouchableOpacity>
        ))}

        <View className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <Text className="text-blue-400 font-bold mb-2">ℹ️ About Detection Modes</Text>
          <Text className="text-gray-300 text-sm mb-2">
            <Text className="font-bold">Auto:</Text> Automatically selects the best mode based on
            your device capabilities.
          </Text>
          <Text className="text-gray-300 text-sm mb-2">
            <Text className="font-bold">Real-Time:</Text> Uses your camera to detect your pose in
            real-time. Requires a modern device (2020+).
          </Text>
          <Text className="text-gray-300 text-sm">
            <Text className="font-bold">Pre-Computed:</Text> Uses pre-processed pose data for
            smooth, consistent playback on all devices.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
