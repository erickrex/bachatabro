/**
 * Mode Indicator Component
 * Shows current detection mode during gameplay
 * 
 * Task 3.2.1: Add Mode Selection UI
 */

import React from 'react';
import { View, Text } from 'react-native';
import { DetectionMode } from '@/types/detection';

interface ModeIndicatorProps {
  mode: DetectionMode;
  fps?: number;
  latency?: number;
}

export function ModeIndicator({ mode, fps, latency }: ModeIndicatorProps) {
  const getModeInfo = () => {
    switch (mode) {
      case DetectionMode.REAL_TIME:
        return {
          label: 'LIVE',
          color: 'bg-green-600',
          icon: '📹',
        };
      case DetectionMode.PRE_COMPUTED:
        return {
          label: 'SMOOTH',
          color: 'bg-blue-600',
          icon: '📊',
        };
      case DetectionMode.AUTO:
        return {
          label: 'AUTO',
          color: 'bg-purple-600',
          icon: '🤖',
        };
      default:
        return {
          label: 'UNKNOWN',
          color: 'bg-gray-600',
          icon: '❓',
        };
    }
  };

  const { label, color, icon } = getModeInfo();

  return (
    <View className="absolute top-4 right-4 z-10">
      <View className={`${color} px-3 py-2 rounded-lg flex-row items-center`}>
        <Text className="text-white text-xs mr-1">{icon}</Text>
        <Text className="text-white text-xs font-bold">{label}</Text>
      </View>
      
      {mode === DetectionMode.REAL_TIME && (fps !== undefined || latency !== undefined) && (
        <View className="bg-black/70 px-2 py-1 rounded mt-1">
          {fps !== undefined && (
            <Text className="text-white text-xs">
              {fps.toFixed(1)} FPS
            </Text>
          )}
          {latency !== undefined && (
            <Text className="text-white text-xs">
              {latency.toFixed(0)}ms
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
