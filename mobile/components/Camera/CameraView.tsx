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
  const [captureSupported, setCaptureSupported] = useState(true);

  // Request camera permissions on mount
  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
  }, [permission]);

  // Capture a single frame
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current || !captureSupported) return null;
    
    try {
      // Check if takePictureAsync exists on the ref
      if (typeof cameraRef.current.takePictureAsync !== 'function') {
        console.warn('takePictureAsync not available on camera ref');
        setCaptureSupported(false);
        return null;
      }
      
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });
      return photo?.base64 || null;
    } catch (error: any) {
      // If takePictureAsync fails, mark it as unsupported
      if (error?.message?.includes('undefined is not a function') ||
          error?.message?.includes('not a function')) {
        console.warn('Frame capture not supported on this device/build');
        setCaptureSupported(false);
      } else {
        console.warn('Frame capture error:', error?.message || error);
      }
      return null;
    }
  }, [captureSupported]);

  // Frame capture interval
  useEffect(() => {
    if (!isRecording || !isReady || !onFrame || !captureSupported) {
      return;
    }

    const intervalMs = 1000 / frameRate;
    let isCapturing = false;
    let errorCount = 0;

    const interval = setInterval(async () => {
      // Skip if already capturing to avoid queue buildup
      if (isCapturing) {
        return;
      }

      // Stop trying after too many errors
      if (errorCount > 5) {
        console.warn('Too many capture errors, disabling frame capture');
        setCaptureSupported(false);
        return;
      }

      try {
        isCapturing = true;
        const base64 = await captureFrame();
        
        if (base64) {
          onFrame(base64);
          errorCount = 0; // Reset error count on success
        }
      } catch (error) {
        errorCount++;
      } finally {
        isCapturing = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, isReady, onFrame, frameRate, captureFrame, captureSupported]);

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
