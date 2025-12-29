/**
 * Type definitions for pose detection modes and ExecuTorch integration
 */
import type { Angles } from './game';

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

export interface PoseAngles extends Angles {
  confidence?: number;
  source?: 'real-time' | 'pre-computed';
  angleConfidence?: Partial<Record<keyof Angles, number>>;
}

export interface PerformanceMetrics {
  averageFPS: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsageMB: number;
}
