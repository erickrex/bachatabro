/**
 * Type definitions for pose detection modes and ExecuTorch integration
 */

export enum DetectionMode {
  AUTO = 'auto',
  REAL_TIME = 'real-time',
  PRE_COMPUTED = 'pre-computed',
}

export interface DeviceCapabilities {
  year: number;
  memoryGB: number;
  platform: 'ios' | 'android';
  modelName: string;
}

export interface PoseResult {
  keypoints: Array<{ x: number; y: number; confidence: number }>;
  inferenceTime: number;
  confidence: number;
}

export interface DetectionInput {
  type: 'camera' | 'precomputed';
  imageData?: string; // base64 for camera
  frameIndex?: number; // for precomputed
  songId?: string; // for precomputed
}

export interface PoseAngles {
  leftArm: number;
  rightArm: number;
  leftElbow: number;
  rightElbow: number;
  leftThigh: number;
  rightThigh: number;
  leftLeg: number;
  rightLeg: number;
  confidence?: number;
  source?: 'real-time' | 'pre-computed';
}

export interface PerformanceMetrics {
  averageFPS: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsageMB: number;
}
