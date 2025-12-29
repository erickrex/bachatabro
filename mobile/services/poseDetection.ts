/**
 * Unified Pose Detection Service
 * Supports both real-time ExecuTorch detection and pre-computed pose data
 * 
 * Updated for YOLOv8s-pose model (64.0 AP on COCO)
 * Task 3.1.3: Update Unified Pose Detection Service
 */

import { calculateAngles } from '../utils/angleCalculator';
import { ExecuTorchService } from './executorch/ExecuTorchService';
import { DetectionModeManager } from './executorch/DetectionModeManager';
import { loadPoseData } from './assetLoader';
import { DetectionMode, DetectionInput, PoseAngles } from '@/types/detection';
import { PoseData } from '@/types/game';
import { MODEL_CONFIG } from '@/constants/ModelConfig';

// Use ExecuTorch 1.0 for Arm-optimized on-device inference
// XNNPACK backend provides Arm NEON acceleration
type PoseService = ExecuTorchService;

export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

export interface KeypointMap {
  nose: Keypoint;
  leftEye: Keypoint;
  rightEye: Keypoint;
  leftEar: Keypoint;
  rightEar: Keypoint;
  leftShoulder: Keypoint;
  rightShoulder: Keypoint;
  leftElbow: Keypoint;
  rightElbow: Keypoint;
  leftWrist: Keypoint;
  rightWrist: Keypoint;
  leftHip: Keypoint;
  rightHip: Keypoint;
  leftKnee: Keypoint;
  rightKnee: Keypoint;
  leftAnkle: Keypoint;
  rightAnkle: Keypoint;
}

export interface PoseDetectionResult {
  keypoints: Partial<KeypointMap>;
  angles: Record<string, number>;
}

/**
 * Unified Pose Detection Service Class
 * Manages both real-time and pre-computed detection modes
 */
export class UnifiedPoseDetectionService {
  private poseService?: PoseService;
  private modeManager: DetectionModeManager;
  private precomputedCache: Map<string, PoseData> = new Map();
  private initialized = false;

  constructor() {
    this.modeManager = new DetectionModeManager();
  }

  /**
   * Initialize the pose detection service
   */
  async initialize(mode?: DetectionMode): Promise<void> {
    // Initialize mode manager
    await this.modeManager.initialize();

    // Set mode if provided
    if (mode) {
      await this.modeManager.setMode(mode);
    }

    const currentMode = this.modeManager.getCurrentMode();

    // Initialize ExecuTorch for real-time mode
    // Uses XNNPACK backend for Arm NEON acceleration
    if (currentMode === DetectionMode.REAL_TIME || currentMode === DetectionMode.AUTO) {
      try {
        this.poseService = new ExecuTorchService();
        await this.poseService.initialize(MODEL_CONFIG.MODEL_FILE);
        console.log(`ExecuTorch 1.0 initialized with ${MODEL_CONFIG.MODEL_VERSION} for real-time detection`);
      } catch (error) {
        console.warn('Failed to initialize ExecuTorch, falling back to pre-computed:', error);
        this.modeManager.triggerFallback('ExecuTorch initialization failed');
      }
    }

    this.initialized = true;
    console.log('Unified pose detection service initialized');
  }

  /**
   * Detect pose from input (camera or pre-computed)
   */
  async detectPose(input: DetectionInput): Promise<PoseAngles> {
    if (!this.initialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const currentMode = this.modeManager.getCurrentMode();

    // Real-time detection from camera
    if (input.type === 'camera' && input.imageData && 
        (currentMode === DetectionMode.REAL_TIME || currentMode === DetectionMode.AUTO)) {
      try {
        return await this.detectRealTime(input.imageData);
      } catch (error) {
        console.error('Real-time detection failed:', error);
        this.modeManager.recordFailure();
        
        // Fallback to pre-computed if available
        if (input.frameIndex !== undefined && input.songId) {
          return await this.detectPrecomputed(input.frameIndex, input.songId);
        }
        
        throw error;
      }
    }

    // Pre-computed detection
    if (input.type === 'precomputed' && input.frameIndex !== undefined && input.songId) {
      return await this.detectPrecomputed(input.frameIndex, input.songId);
    }

    throw new Error('Invalid detection input');
  }

  /**
   * Real-time pose detection using TensorFlow.js
   */
  private async detectRealTime(imageData: string): Promise<PoseAngles> {
    if (!this.poseService || !this.poseService.isReady()) {
      throw new Error('Pose service not ready');
    }

    const poseResult = await this.poseService.detectPose(imageData);
    
    // Convert keypoints to KeypointMap format
    const keypointMap = this.convertToKeypointMap(poseResult.keypoints);
    
    // Calculate angles using the same algorithm as pre-computed
    const angles = calculateAngles(keypointMap);

    return {
      ...angles,
      confidence: poseResult.confidence,
      source: 'real-time',
    };
  }

  /**
   * Pre-computed pose detection from JSON data
   */
  private async detectPrecomputed(frameIndex: number, songId: string): Promise<PoseAngles> {
    // Load pose data from cache or file
    let poseData = this.precomputedCache.get(songId);
    
    if (!poseData) {
      poseData = await loadPoseData(songId);
      this.precomputedCache.set(songId, poseData);
    }

    // Get frame data
    const frame = poseData.frames[frameIndex];
    
    if (!frame) {
      throw new Error(`Frame ${frameIndex} not found for song ${songId}`);
    }

    return {
      ...frame.angles,
      angleConfidence: frame.angleConfidence,
      confidence: 1.0, // Pre-computed data is always confident
      source: 'pre-computed',
    };
  }

  /**
   * Convert ExecuTorch keypoints to KeypointMap format
   */
  private convertToKeypointMap(
    keypoints: Array<{ x: number; y: number; confidence: number }>
  ): Partial<KeypointMap> {
    // COCO keypoint order (17 keypoints)
    const keypointNames: (keyof KeypointMap)[] = [
      'nose',
      'leftEye',
      'rightEye',
      'leftEar',
      'rightEar',
      'leftShoulder',
      'rightShoulder',
      'leftElbow',
      'rightElbow',
      'leftWrist',
      'rightWrist',
      'leftHip',
      'rightHip',
      'leftKnee',
      'rightKnee',
      'leftAnkle',
      'rightAnkle',
    ];

    const keypointMap: Partial<KeypointMap> = {};

    keypoints.forEach((kp, index) => {
      if (index < keypointNames.length && kp.confidence > 0.3) {
        keypointMap[keypointNames[index]] = kp;
      }
    });

    return keypointMap;
  }

  /**
   * Get current detection mode
   */
  getCurrentMode(): DetectionMode {
    return this.modeManager.getCurrentMode();
  }

  /**
   * Set detection mode
   */
  async setMode(mode: DetectionMode): Promise<void> {
    await this.modeManager.setMode(mode);
    
    // Re-initialize if switching to real-time mode
    if (mode === DetectionMode.REAL_TIME && !this.poseService) {
      await this.initialize(mode);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    if (!this.poseService) {
      return null;
    }

    return {
      averageFPS: this.poseService.getAverageFPS(),
      averageLatency: this.poseService.getAverageLatency(),
      ...this.poseService.getLatencyPercentiles(),
    };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get mode manager for advanced control
   */
  getModeManager(): DetectionModeManager {
    return this.modeManager;
  }
}

// Legacy compatibility functions
let mlKitAvailable = false;

/**
 * Initialize pose detection (legacy)
 * @deprecated Use UnifiedPoseDetectionService instead
 */
export async function initPoseDetection(): Promise<boolean> {
  console.warn('initPoseDetection is deprecated. Use UnifiedPoseDetectionService instead.');
  return mlKitAvailable;
}

/**
 * Detect pose from a base64 image
 * @param base64Image Base64 encoded image string
 * @returns Pose detection result with keypoints and angles
 */
export async function detectPoseFromFrame(
  base64Image: string
): Promise<PoseDetectionResult | null> {
  if (!mlKitAvailable) {
    // ML Kit not available - return null
    // In production, this should be installed
    return null;
  }

  try {
    // TODO: Uncomment when ML Kit is installed
    /*
    const result = await Pose.detectFromImage(`data:image/jpeg;base64,${base64Image}`);
    
    if (!result || !result.keypoints) {
      return null;
    }
    
    // Convert ML Kit keypoints to our format
    const keypoints = convertMLKitKeypoints(result.keypoints);
    
    // Filter low-confidence keypoints
    const filteredKeypoints = filterLowConfidenceKeypoints(keypoints);
    
    // Calculate angles
    const angles = calculateAngles(filteredKeypoints);
    
    return { keypoints: filteredKeypoints, angles };
    */
    
    console.warn('Pose detection not yet implemented - ML Kit integration pending');
    return null;
  } catch (error) {
    console.error('Pose detection failed:', error);
    return null;
  }
}

/**
 * Convert ML Kit keypoints to our format
 * ML Kit returns keypoints in a different structure
 */
function convertMLKitKeypoints(mlKitKeypoints: any): Partial<KeypointMap> {
  // TODO: Implement conversion based on actual ML Kit output format
  // This is a placeholder that assumes ML Kit returns an array of keypoints
  const keypoints: Partial<KeypointMap> = {};
  
  // ML Kit keypoint indices (example - adjust based on actual ML Kit format)
  const keypointNames: (keyof KeypointMap)[] = [
    'nose',
    'leftEye',
    'rightEye',
    'leftEar',
    'rightEar',
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ];
  
  if (Array.isArray(mlKitKeypoints)) {
    mlKitKeypoints.forEach((kp, index) => {
      if (index < keypointNames.length) {
        keypoints[keypointNames[index]] = {
          x: kp.x,
          y: kp.y,
          confidence: kp.confidence || 0,
        };
      }
    });
  }
  
  return keypoints;
}

/**
 * Filter out keypoints with low confidence
 */
function filterLowConfidenceKeypoints(
  keypoints: Partial<KeypointMap>,
  threshold: number = 0.5
): Partial<KeypointMap> {
  const filtered: Partial<KeypointMap> = {};
  
  for (const [key, value] of Object.entries(keypoints)) {
    if (value && value.confidence >= threshold) {
      filtered[key as keyof KeypointMap] = value;
    }
  }
  
  return filtered;
}

/**
 * Get pose detection statistics
 */
export function getPoseStats(result: PoseDetectionResult | null): {
  keypointsDetected: number;
  averageConfidence: number;
  anglesCalculated: number;
} {
  if (!result) {
    return { keypointsDetected: 0, averageConfidence: 0, anglesCalculated: 0 };
  }
  
  const keypoints = Object.values(result.keypoints);
  const keypointsDetected = keypoints.length;
  const averageConfidence =
    keypoints.reduce((sum, kp) => sum + kp.confidence, 0) / keypointsDetected || 0;
  const anglesCalculated = Object.keys(result.angles).filter(
    (key) => result.angles[key] > 0
  ).length;
  
  return { keypointsDetected, averageConfidence, anglesCalculated };
}

/**
 * Check if pose detection is ready
 */
export function isPoseDetectionReady(): boolean {
  return mlKitAvailable;
}
