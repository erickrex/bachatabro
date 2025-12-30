/**
 * Score Calculation Service
 * Compares user poses with reference poses and calculates scores
 */

import { Angles } from '../utils/angleCalculator';

export interface FrameScore {
  score: number;
  matches: Partial<Record<keyof Angles, boolean>>;
  timestamp: number;
  attemptedJoints?: number;
  skippedJoints?: number;
  skippedJointsList?: (keyof Angles)[];
}

export type ScoreBreakdown = Record<keyof Angles, number>;
type AngleSample = Partial<Angles> & {
  angleConfidence?: Partial<Record<keyof Angles, number>>;
};

export const TRACKED_JOINTS: (keyof Angles)[] = [
  'leftArm',
  'rightArm',
  'leftElbow',
  'rightElbow',
  'leftThigh',
  'rightThigh',
  'leftLeg',
  'rightLeg',
];

// Compile-time check: ensure TRACKED_JOINTS includes all Angles keys
type _AssertAllJointsTracked = typeof TRACKED_JOINTS extends ReadonlyArray<keyof Angles>
  ? keyof Angles extends typeof TRACKED_JOINTS[number]
    ? true
    : never
  : never;
const _assertAllJointsTracked: _AssertAllJointsTracked = true;

const JOINT_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Calculate score for a single frame
 * @param userAngles User's joint angles
 * @param referenceAngles Reference joint angles
 * @param threshold Maximum angle difference for a match (default 20 degrees)
 * @returns Frame score and match details
 */
export function calculateFrameScore(
  userAngles: AngleSample,
  referenceAngles: AngleSample,
  threshold: number = 20
): {
  score: number;
  matches: Partial<Record<keyof Angles, boolean>>;
  attemptedJoints: number;
  skippedJoints: number;
  skippedJointsList: (keyof Angles)[];
} {
  const matches: Partial<Record<keyof Angles, boolean>> = {};
  let matchCount = 0;
  let totalJoints = 0;
  let skippedJoints = 0;
  const skippedJointNames: (keyof Angles)[] = [];
  
  for (const joint of TRACKED_JOINTS) {
    const userAngle = userAngles[joint];
    const refAngle = referenceAngles[joint];
    
    // Skip if either angle is missing
    if (
      userAngle === undefined ||
      refAngle === undefined ||
      !Number.isFinite(userAngle) ||
      !Number.isFinite(refAngle)
    ) {
      skippedJoints++;
      skippedJointNames.push(joint);
      continue;
    }

    const userJointConfidence = userAngles.angleConfidence?.[joint];
    if (
      userJointConfidence !== undefined &&
      userJointConfidence < JOINT_CONFIDENCE_THRESHOLD
    ) {
      skippedJoints++;
      skippedJointNames.push(joint);
      continue;
    }

    const refJointConfidence = referenceAngles.angleConfidence?.[joint];
    if (
      refJointConfidence !== undefined &&
      refJointConfidence < JOINT_CONFIDENCE_THRESHOLD
    ) {
      skippedJoints++;
      skippedJointNames.push(joint);
      continue;
    }
    
    // Angles of 0 indicate low-confidence detections in our pipeline.
    // Skip them entirely so missing joints do not force 0% or 100% scores.
    if (userAngle === 0 || refAngle === 0) {
      skippedJoints++;
      skippedJointNames.push(joint);
      continue;
    }
    
    totalJoints++;
    
    // Calculate angle difference
    const diff = Math.abs(userAngle - refAngle);
    
    // Check if within threshold
    const isMatch = diff <= threshold;
    matches[joint] = isMatch;
    if (isMatch) {
      matchCount++;
    }
  }
  
  // Calculate score as percentage
  // If no joints could be compared, return 0 instead of undefined behavior
  const score = totalJoints > 0 ? (matchCount / totalJoints) * 100 : 0;
  
  return { score, matches, attemptedJoints: totalJoints, skippedJoints, skippedJointsList: skippedJointNames };
}

/**
 * Calculate final score from all frame scores
 * @param frameScores Array of frame scores
 * @returns Average score
 */
export function calculateFinalScore(frameScores: number[]): number {
  if (frameScores.length === 0) return 0;
  
  const sum = frameScores.reduce((acc, score) => acc + score, 0);
  return sum / frameScores.length;
}

/**
 * Calculate score breakdown by joint
 * @param frameScores Array of frame score objects with match details
 * @returns Percentage match for each joint
 */
export function calculateScoreBreakdown(
  frameScores: Array<{ matches: Partial<Record<keyof Angles, boolean>> }>
): ScoreBreakdown {
  const breakdown = {
    leftArm: 0,
    rightArm: 0,
    leftElbow: 0,
    rightElbow: 0,
    leftThigh: 0,
    rightThigh: 0,
    leftLeg: 0,
    rightLeg: 0,
  } as ScoreBreakdown;
  
  if (frameScores.length === 0) {
    return breakdown;
  }
  
  const jointStats = TRACKED_JOINTS.reduce((acc, joint) => {
    acc[joint] = { attempts: 0, matches: 0 };
    return acc;
  }, {} as Record<keyof Angles, { attempts: number; matches: number }>);

  frameScores.forEach((frame) => {
    TRACKED_JOINTS.forEach((joint) => {
      const match = frame.matches?.[joint];
      if (match === undefined) {
        return;
      }
      jointStats[joint].attempts += 1;
      if (match) {
        jointStats[joint].matches += 1;
      }
    });
  });

  TRACKED_JOINTS.forEach((joint) => {
    const { attempts, matches } = jointStats[joint];
    breakdown[joint] = attempts > 0 ? (matches / attempts) * 100 : 0;
  });
  
  return breakdown;
}

/**
 * Get performance rating based on score
 */
export function getPerformanceRating(score: number): string {
  if (score >= 90) return 'Perfect!';
  if (score >= 80) return 'Excellent!';
  if (score >= 70) return 'Great!';
  if (score >= 60) return 'Good!';
  if (score >= 50) return 'Nice Try!';
  return 'Keep Practicing!';
}

/**
 * Calculate weighted score (give more weight to recent frames)
 */
export function calculateWeightedScore(frameScores: number[]): number {
  if (frameScores.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  frameScores.forEach((score, index) => {
    // Linear weight: later frames have more weight
    const weight = index + 1;
    weightedSum += score * weight;
    weightSum += weight;
  });
  
  return weightedSum / weightSum;
}
