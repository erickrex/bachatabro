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

export type AngleConfidenceMap = Partial<Record<keyof Angles, number>>;

const ZERO_VECTOR_THRESHOLD = 1e-9;

function getJointConfidence(points: Point[]): number {
  if (points.length === 0) {
    return 0;
  }

  return points.reduce((min, point) => {
    const confidence = point?.confidence ?? 0;
    return Math.min(min, confidence);
  }, Infinity);
}

/**
 * Calculate angle between three points
 * @param p1 First point
 * @param p2 Vertex point (angle is measured at this point)
 * @param p3 Third point
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle(p1: Point, p2: Point, p3: Point): number {
  // Calculate vectors from p2 to p1 and p2 to p3
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  
  // Avoid division by zero
  if (mag1 <= ZERO_VECTOR_THRESHOLD || mag2 <= ZERO_VECTOR_THRESHOLD) return 0;
  
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
export type AnglesWithConfidence = Angles & { angleConfidence: AngleConfidenceMap };

/**
 * Calculate all joint angles from keypoints plus per-joint confidence metadata.
 */
export function calculateAngles(keypoints: Record<string, Point>): AnglesWithConfidence {
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
  const angleConfidence: AngleConfidenceMap = {};

  const computeAngle = (joint: keyof Angles, p1Key: keyof typeof keypoints, p2Key: keyof typeof keypoints, p3Key: keyof typeof keypoints) => {
    const p1 = keypoints[p1Key];
    const p2 = keypoints[p2Key];
    const p3 = keypoints[p3Key];

    if (!p1 || !p2 || !p3) {
      angleConfidence[joint] = 0;
      return;
    }

    const confidence = getJointConfidence([p1, p2, p3]);
    angleConfidence[joint] = confidence;
    if (confidence === 0) {
      angles[joint] = 0;
      return;
    }

    angles[joint] = calculateAngle(p1, p2, p3);
  };

  // Left arm angle (shoulder-elbow-wrist)
  computeAngle('leftArm', 'leftShoulder', 'leftElbow', 'leftWrist');
  angleConfidence.leftElbow = angleConfidence.leftArm;
  angles.leftElbow = angles.leftArm;
  
  // Right arm angle (shoulder-elbow-wrist)
  computeAngle('rightArm', 'rightShoulder', 'rightElbow', 'rightWrist');
  angleConfidence.rightElbow = angleConfidence.rightArm;
  angles.rightElbow = angles.rightArm;
  
  // Left thigh angle (hip-knee-ankle)
  computeAngle('leftThigh', 'leftHip', 'leftKnee', 'leftAnkle');
  angleConfidence.leftLeg = angleConfidence.leftThigh;
  angles.leftLeg = angles.leftThigh;
  
  // Right thigh angle (hip-knee-ankle)
  computeAngle('rightThigh', 'rightHip', 'rightKnee', 'rightAnkle');
  angleConfidence.rightLeg = angleConfidence.rightThigh;
  angles.rightLeg = angles.rightThigh;
  
  return {
    ...angles,
    angleConfidence,
  };
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
