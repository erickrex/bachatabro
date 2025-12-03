/**
 * TensorFlow.js Pose Detection Service
 * Uses MoveNet for real-time on-device pose detection
 * 
 * This runs actual AI inference on the device (Arm-optimized via WebGL/GPU)
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as poseDetection from '@tensorflow-models/pose-detection';

// COCO keypoint names (17 keypoints) - matches our JSON format
const KEYPOINT_NAMES = [
  'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
  'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
  'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
];

interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

interface PoseResult {
  keypoints: Record<string, Keypoint>;
  angles: Record<string, number>;
  inferenceTime: number;
}

class TFPoseDetector {
  private detector: poseDetection.PoseDetector | null = null;
  private isReady = false;
  private isInitializing = false;

  /**
   * Initialize TensorFlow.js and load the pose detection model
   */
  async initialize(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;

    try {
      console.log('Initializing TensorFlow.js...');
      
      // Initialize TF.js with React Native backend
      await tf.ready();
      console.log('TensorFlow.js ready, backend:', tf.getBackend());

      // Load MoveNet model (SinglePose Lightning for speed)
      console.log('Loading MoveNet model...');
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        }
      );

      this.isReady = true;
      this.isInitializing = false;
      console.log('Pose detector ready!');
      return true;

    } catch (error) {
      console.error('Failed to initialize pose detector:', error);
      this.isInitializing = false;
      return false;
    }
  }

  /**
   * Detect pose from camera frame
   */
  async detectPose(
    imageData: ImageData | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<PoseResult | null> {
    if (!this.isReady || !this.detector) {
      console.warn('Pose detector not ready');
      return null;
    }

    const startTime = performance.now();

    try {
      // Run inference
      const poses = await this.detector.estimatePoses(imageData);

      const inferenceTime = performance.now() - startTime;

      if (poses.length === 0) {
        return {
          keypoints: this.createEmptyKeypoints(),
          angles: this.createEmptyAngles(),
          inferenceTime,
        };
      }

      // Get the first (best) pose
      const pose = poses[0];

      // Convert to our format
      const keypoints = this.convertKeypoints(pose.keypoints, width, height);
      const angles = this.calculateAngles(keypoints);

      return {
        keypoints,
        angles,
        inferenceTime,
      };

    } catch (error) {
      console.error('Pose detection failed:', error);
      return null;
    }
  }

  /**
   * Convert TF.js keypoints to our format (normalized 0-1)
   */
  private convertKeypoints(
    tfKeypoints: poseDetection.Keypoint[],
    width: number,
    height: number
  ): Record<string, Keypoint> {
    const keypoints: Record<string, Keypoint> = {};

    for (let i = 0; i < KEYPOINT_NAMES.length; i++) {
      const name = KEYPOINT_NAMES[i];
      const tfKp = tfKeypoints[i];

      if (tfKp) {
        keypoints[name] = {
          x: tfKp.x / width,  // Normalize to 0-1
          y: tfKp.y / height,
          confidence: tfKp.score || 0,
        };
      } else {
        keypoints[name] = { x: 0, y: 0, confidence: 0 };
      }
    }

    return keypoints;
  }

  /**
   * Calculate joint angles from keypoints
   */
  private calculateAngles(keypoints: Record<string, Keypoint>): Record<string, number> {
    const angles: Record<string, number> = {
      leftArm: 0,
      rightArm: 0,
      leftElbow: 0,
      rightElbow: 0,
      leftThigh: 0,
      rightThigh: 0,
      leftLeg: 0,
      rightLeg: 0,
    };

    // Left arm (shoulder-elbow-wrist)
    angles.leftArm = this.calculateAngle(
      keypoints.leftShoulder,
      keypoints.leftElbow,
      keypoints.leftWrist
    );
    angles.leftElbow = angles.leftArm;

    // Right arm
    angles.rightArm = this.calculateAngle(
      keypoints.rightShoulder,
      keypoints.rightElbow,
      keypoints.rightWrist
    );
    angles.rightElbow = angles.rightArm;

    // Left leg (hip-knee-ankle)
    angles.leftThigh = this.calculateAngle(
      keypoints.leftHip,
      keypoints.leftKnee,
      keypoints.leftAnkle
    );
    angles.leftLeg = angles.leftThigh;

    // Right leg
    angles.rightThigh = this.calculateAngle(
      keypoints.rightHip,
      keypoints.rightKnee,
      keypoints.rightAnkle
    );
    angles.rightLeg = angles.rightThigh;

    return angles;
  }

  /**
   * Calculate angle between three points
   */
  private calculateAngle(p1: Keypoint, p2: Keypoint, p3: Keypoint): number {
    if (p1.confidence < 0.5 || p2.confidence < 0.5 || p3.confidence < 0.5) {
      return 0;
    }

    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angle = Math.acos(cosAngle) * (180 / Math.PI);

    return angle;
  }

  private createEmptyKeypoints(): Record<string, Keypoint> {
    const keypoints: Record<string, Keypoint> = {};
    for (const name of KEYPOINT_NAMES) {
      keypoints[name] = { x: 0, y: 0, confidence: 0 };
    }
    return keypoints;
  }

  private createEmptyAngles(): Record<string, number> {
    return {
      leftArm: 0, rightArm: 0,
      leftElbow: 0, rightElbow: 0,
      leftThigh: 0, rightThigh: 0,
      leftLeg: 0, rightLeg: 0,
    };
  }

  /**
   * Check if detector is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Dispose of the detector
   */
  async dispose(): Promise<void> {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    this.isReady = false;
  }
}

// Singleton instance
export const tfPoseDetector = new TFPoseDetector();

// Export for direct use
export { TFPoseDetector, KEYPOINT_NAMES };
export type { PoseResult, Keypoint };
