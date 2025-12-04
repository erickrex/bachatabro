/**
 * Angle Calculation Utilities
 * Calculate joint angles from pose keypoints
 */

export interface Point {
  x: number;
  y: number;
  confidence?: number;
}

export interface Angles {
  leftArm: number;
  rightArm: number;
  leftElbow: number;
  rightElbow: number;
  leftThigh: number;
  rightThigh: number;
  leftLeg: number;
  rightLeg: number;
}

// Minimum confidence threshold for keypoint detection
// Lowered from 0.5 to 0.3 to capture more poses, especially wrists
const MIN_CONFIDENCE = 0.3;

/**
 * Calculate angle between three points
 * @param p1 First point
 * @param p2 Vertex point (angle is measured at this point)
 * @param p3 Third point
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle(p1: Point, p2: Point, p3: Point): number {
  // Check confidence if available - use lower threshold for better coverage
  if (p1.confidence !== undefined && p1.confidence < MIN_CONFIDENCE) return 0;
  if (p2.confidence !== undefined && p2.confidence < MIN_CONFIDENCE) return 0;
  if (p3.confidence !== undefined && p3.confidence < MIN_CONFIDENCE) return 0;
  
  // Calculate vectors from p2 to p1 and p2 to p3
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  
  // Avoid division by zero
  if (mag1 === 0 || mag2 === 0) return 0;
  
  // Calculate dot product
  const dot = v1x * v2x + v1y * v2y;
  
  // Calculate angle in radians
  const cosAngle = dot / (mag1 * mag2);
  
  // Clamp to [-1, 1] to avoid NaN from acos
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  
  // Convert to degrees
  const angleRad = Math.acos(clampedCos);
  const angleDeg = (angleRad * 180) / Math.PI;
  
  return angleDeg;
}

/**
 * Calculate all joint angles from keypoints
 * @param keypoints Map of keypoint names to coordinates
 * @returns Object containing all joint angles
 */
export function calculateAngles(keypoints: Record<string, Point>): Angles {
  const angles: Angles = {
    leftArm: 0,
    rightArm: 0,
    leftElbow: 0,
    rightElbow: 0,
    leftThigh: 0,
    rightThigh: 0,
    leftLeg: 0,
    rightLeg: 0,
  };
  
  // Left arm angle (shoulder-elbow-wrist)
  if (keypoints.leftShoulder && keypoints.leftElbow && keypoints.leftWrist) {
    angles.leftArm = calculateAngle(
      keypoints.leftShoulder,
      keypoints.leftElbow,
      keypoints.leftWrist
    );
    angles.leftElbow = angles.leftArm; // Same angle
  }
  
  // Right arm angle (shoulder-elbow-wrist)
  if (keypoints.rightShoulder && keypoints.rightElbow && keypoints.rightWrist) {
    angles.rightArm = calculateAngle(
      keypoints.rightShoulder,
      keypoints.rightElbow,
      keypoints.rightWrist
    );
    angles.rightElbow = angles.rightArm; // Same angle
  }
  
  // Left thigh angle (hip-knee-ankle)
  if (keypoints.leftHip && keypoints.leftKnee && keypoints.leftAnkle) {
    angles.leftThigh = calculateAngle(
      keypoints.leftHip,
      keypoints.leftKnee,
      keypoints.leftAnkle
    );
    angles.leftLeg = angles.leftThigh; // Same angle
  }
  
  // Right thigh angle (hip-knee-ankle)
  if (keypoints.rightHip && keypoints.rightKnee && keypoints.rightAnkle) {
    angles.rightThigh = calculateAngle(
      keypoints.rightHip,
      keypoints.rightKnee,
      keypoints.rightAnkle
    );
    angles.rightLeg = angles.rightThigh; // Same angle
  }
  
  return angles;
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Calculate angular difference (shortest path)
 */
export function angleDifference(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2);
  return Math.min(diff, 360 - diff);
}


/**
 * Compare two angle sets and return similarity score
 * @param angles1 First set of angles
 * @param angles2 Second set of angles
 * @param threshold Maximum difference for a match
 * @returns Similarity score (0-100)
 */
export function compareAngles(
  angles1: Partial<Angles>,
  angles2: Partial<Angles>,
  threshold: number = 20
): number {
  let matches = 0;
  let total = 0;
  
  const joints: (keyof Angles)[] = [
    'leftArm',
    'rightArm',
    'leftElbow',
    'rightElbow',
    'leftThigh',
    'rightThigh',
    'leftLeg',
    'rightLeg',
  ];
  
  for (const joint of joints) {
    const angle1 = angles1[joint];
    const angle2 = angles2[joint];
    
    if (angle1 !== undefined && angle2 !== undefined && angle1 > 0 && angle2 > 0) {
      total++;
      const diff = Math.abs(angle1 - angle2);
      if (diff <= threshold) {
        matches++;
      }
    }
  }
  
  return total > 0 ? (matches / total) * 100 : 0;
}

/**
 * Validate angles are within reasonable ranges
 */
export function validateAngles(angles: Partial<Angles>): boolean {
  const joints = Object.values(angles);
  
  // Check all angles are between 0 and 180
  return joints.every((angle) => angle >= 0 && angle <= 180);
}

/**
 * Get angle description for debugging
 */
export function describeAngle(angle: number): string {
  if (angle < 30) return 'very acute';
  if (angle < 60) return 'acute';
  if (angle < 90) return 'moderate';
  if (angle < 120) return 'obtuse';
  if (angle < 150) return 'very obtuse';
  return 'nearly straight';
}
