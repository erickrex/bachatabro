/**
 * Camera Component
 * Captures frames from the front camera for pose detection
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

interface CameraViewProps {
  onFrame?: (base64Image: string) => void;
  isRecording?: boolean;
  frameRate?: number; // frames per second
  mirror?: boolean;
}

export function CameraView({
  onFrame,
  isRecording = false,
  frameRate = 10,
  mirror = true,
}: CameraViewProps) {
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);

  // Request camera permissions on mount
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission]);

  // Capture a single frame
  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) return null;
    
    try {
      // expo-camera v17+ uses takePictureAsync on the ref
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });
      return photo?.base64 || null;
    } catch (error) {
      // If takePictureAsync fails, the camera might not support it
      // This can happen on some devices or in certain states
      console.warn('Frame capture not available:', error);
      return null;
    }
  }, []);

  // Frame capture interval
  useEffect(() => {
    if (!isRecording || !isReady || !onFrame) {
      return;
    }

    const intervalMs = 1000 / frameRate;
    let isCapturing = false;
    let frameCount = 0;

    const interval = setInterval(async () => {
      // Skip if already capturing to avoid queue buildup
      if (isCapturing) {
        return;
      }

      try {
        isCapturing = true;
        const base64 = await captureFrame();
        
        if (base64) {
          onFrame(base64);
          frameCount++;
        }
      } catch (error) {
        // Only log every 10th error to avoid spam
        if (frameCount % 10 === 0) {
          console.error('Frame capture error:', error);
        }
      } finally {
        isCapturing = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, isReady, onFrame, frameRate, captureFrame]);

  // Handle permission states
  if (permission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission denied</Text>
        <Text style={styles.subMessage}>
          Please enable camera access in your device settings to play Bachata Bro.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView
        ref={cameraRef}
        style={[styles.camera, mirror && styles.mirror]}
        facing="front"
        onCameraReady={() => setIsReady(true)}
        onMountError={(error) => {
          console.error('Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera');
        }}
      />
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.message}>Initializing camera...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  mirror: {
    transform: [{ scaleX: -1 }],
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  subMessage: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
});
