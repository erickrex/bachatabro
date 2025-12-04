/**
 * Score Calculation Service
 * Compares user poses with reference poses and calculates scores
 */

import { Angles } from '../utils/angleCalculator';

export interface FrameScore {
  score: number;
  matches: Record<string, boolean>;
  timestamp: number;
}

export interface ScoreBreakdown {
  leftElbow: number;
  rightElbow: number;
  leftThigh: number;
  rightThigh: number;
}

/**
 * Calculate score for a single frame
 * @param userAngles User's joint angles
 * @param referenceAngles Reference joint angles
 * @param threshold Maximum angle difference for a match (default 20 degrees)
 * @returns Frame score and match details
 */
export function calculateFrameScore(
  userAngles: Partial<Angles>,
  referenceAngles: Partial<Angles>,
  threshold: number = 20
): { score: number; matches: Record<string, boolean> } {
  const matches: Record<string, boolean> = {};
  let matchCount = 0;
  let totalJoints = 0;
  
  // Compare only unique joint angles (avoid duplicates like leftLeg=leftThigh)
  // Primary joints: arms (elbow angles) and legs (thigh angles)
  const joints: (keyof Angles)[] = [
    'leftElbow',
    'rightElbow',
    'leftThigh',
    'rightThigh',
  ];
  
  for (const joint of joints) {
    const userAngle = userAngles[joint];
    const refAngle = referenceAngles[joint];
    
    // Skip if either angle is missing
    if (userAngle === undefined || refAngle === undefined) {
      matches[joint] = false;
      continue;
    }
    
    // If reference angle is 0 (low confidence in pre-computed data),
    // give the user benefit of the doubt - count as match
    if (refAngle === 0) {
      matches[joint] = true;
      totalJoints++;
      matchCount++;
      continue;
    }
    
    // If user angle is 0 (low confidence detection), count as no match
    // but still include in total to avoid inflated scores
    if (userAngle === 0) {
      matches[joint] = false;
      totalJoints++;
      continue;
    }
    
    totalJoints++;
    
    // Calculate angle difference
    const diff = Math.abs(userAngle - refAngle);
    
    // Check if within threshold
    matches[joint] = diff <= threshold;
    if (matches[joint]) {
      matchCount++;
    }
  }
  
  // Calculate score as percentage
  // If no joints could be compared, return 0 instead of undefined behavior
  const score = totalJoints > 0 ? (matchCount / totalJoints) * 100 : 0;
  
  return { score, matches };
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
  frameScores: Array<{ matches: Record<string, boolean> }>
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    leftElbow: 0,
    rightElbow: 0,
    leftThigh: 0,
    rightThigh: 0,
  };
  
  if (frameScores.length === 0) return breakdown;
  
  const joints: (keyof ScoreBreakdown)[] = [
    'leftElbow',
    'rightElbow',
    'leftThigh',
    'rightThigh',
  ];
  
  // Count matches for each joint
  for (const joint of joints) {
    let matchCount = 0;
    
    for (const frame of frameScores) {
      if (frame.matches[joint]) {
        matchCount++;
      }
    }
    
    breakdown[joint] = (matchCount / frameScores.length) * 100;
  }
  
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
