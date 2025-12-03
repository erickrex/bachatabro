/**
 * Model Configuration Constants
 * 
 * Centralized configuration for the pose estimation model.
 * Updated for YOLOv8s-pose (December 2024).
 */

/**
 * Model input configuration
 */
export const MODEL_CONFIG = {
  /**
   * Model input size (width and height)
   * YOLOv8s-pose uses 256x256 input
   */
  INPUT_SIZE: 256,

  /**
   * Number of keypoints output by the model
   * COCO format: 17 keypoints
   */
  NUM_KEYPOINTS: 17,

  /**
   * Model file name in assets
   */
  MODEL_FILE: 'pose.pte',

  /**
   * Model version identifier
   */
  MODEL_VERSION: 'yolov8s-pose',

  /**
   * Model accuracy on COCO benchmark
   */
  MODEL_ACCURACY: '64.0 AP',

  /**
   * Minimum confidence threshold for keypoint detection
   */
  MIN_CONFIDENCE: 0.3,

  /**
   * Target inference latency in milliseconds
   */
  TARGET_LATENCY_MS: 100,

  /**
   * Target frames per second
   */
  TARGET_FPS: {
    MIN: 10,
    MAX: 30,
  },
} as const;

/**
 * COCO keypoint names in order
 */
export const KEYPOINT_NAMES = [
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
] as const;

/**
 * Keypoint connections for skeleton visualization
 */
export const SKELETON_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], // nose -> leftEye
  [0, 2], // nose -> rightEye
  [1, 3], // leftEye -> leftEar
  [2, 4], // rightEye -> rightEar

  // Arms
  [5, 7],  // leftShoulder -> leftElbow
  [7, 9],  // leftElbow -> leftWrist
  [6, 8],  // rightShoulder -> rightElbow
  [8, 10], // rightElbow -> rightWrist

  // Torso
  [5, 6],   // leftShoulder -> rightShoulder
  [5, 11],  // leftShoulder -> leftHip
  [6, 12],  // rightShoulder -> rightHip
  [11, 12], // leftHip -> rightHip

  // Legs
  [11, 13], // leftHip -> leftKnee
  [13, 15], // leftKnee -> leftAnkle
  [12, 14], // rightHip -> rightKnee
  [14, 16], // rightKnee -> rightAnkle
];

/**
 * Joint angle definitions
 * Each angle is defined by three keypoint indices: [point1, vertex, point2]
 */
export const ANGLE_DEFINITIONS = {
  leftArm: [5, 7, 9],     // leftShoulder -> leftElbow -> leftWrist
  rightArm: [6, 8, 10],   // rightShoulder -> rightElbow -> rightWrist
  leftElbow: [5, 7, 9],   // same as leftArm
  rightElbow: [6, 8, 10], // same as rightArm
  leftThigh: [11, 13, 15], // leftHip -> leftKnee -> leftAnkle
  rightThigh: [12, 14, 16], // rightHip -> rightKnee -> rightAnkle
  leftLeg: [11, 13, 15],   // same as leftThigh
  rightLeg: [12, 14, 16],  // same as rightThigh
} as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];
export type AngleName = keyof typeof ANGLE_DEFINITIONS;
