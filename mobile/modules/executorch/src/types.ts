/**
 * ExecuTorch Native Module Types
 */

export interface Keypoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  confidence: number; // 0-1
}

export interface PoseResult {
  keypoints: Keypoint[];
  inferenceTime: number; // milliseconds
  timestamp: number;
}

export interface ImageData {
  width: number;
  height: number;
  data: string; // base64 encoded image or file URI
}

export interface PerformanceMetrics {
  averageFPS: number;
  averageLatency: number; // milliseconds
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalInferences: number;
}

export type HardwareDelegate = 'coreml' | 'xnnpack' | 'none';

export interface ExecuTorchModuleInterface {
  /**
   * Load ExecuTorch model from file path
   */
  loadModel(modelPath: string): Promise<void>;

  /**
   * Set hardware acceleration delegate
   */
  setDelegate(delegate: HardwareDelegate): Promise<void>;

  /**
   * Run pose detection inference
   */
  runInference(imageData: ImageData): Promise<PoseResult>;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Promise<PerformanceMetrics>;

  /**
   * Reset performance metrics
   */
  resetMetrics(): Promise<void>;

  /**
   * Check if model is loaded
   */
  isModelLoaded(): Promise<boolean>;

  /**
   * Unload model and free resources
   */
  unloadModel(): Promise<void>;
}

/**
 * Keypoint indices (COCO format)
 */
export enum KeypointIndex {
  NOSE = 0,
  LEFT_EYE = 1,
  RIGHT_EYE = 2,
  LEFT_EAR = 3,
  RIGHT_EAR = 4,
  LEFT_SHOULDER = 5,
  RIGHT_SHOULDER = 6,
  LEFT_ELBOW = 7,
  RIGHT_ELBOW = 8,
  LEFT_WRIST = 9,
  RIGHT_WRIST = 10,
  LEFT_HIP = 11,
  RIGHT_HIP = 12,
  LEFT_KNEE = 13,
  RIGHT_KNEE = 14,
  LEFT_ANKLE = 15,
  RIGHT_ANKLE = 16,
}

export const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;
