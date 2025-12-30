/**
 * Tests for score calculator service
 */

import {
  calculateFrameScore,
  calculateFinalScore,
  calculateScoreBreakdown,
  getPerformanceRating,
  calculateWeightedScore,
  TRACKED_JOINTS,
} from '../scoreCalculator';

describe('scoreCalculator', () => {
  describe('calculateFrameScore', () => {
    it('should return 100% for identical angles', () => {
      const angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 90,
        rightElbow: 90,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const result = calculateFrameScore(angles, angles, 20);
      expect(result.score).toBe(100);
      expect(result.matches.leftArm).toBe(true);
      expect(result.matches.rightArm).toBe(true);
      expect(result.attemptedJoints).toBeGreaterThan(0);
      expect(result.skippedJoints).toBe(0);
    });

    it('should return 0% for completely different angles', () => {
      const userAngles = {
        leftArm: 0,
        rightArm: 0,
        leftElbow: 0,
        rightElbow: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftLeg: 0,
        rightLeg: 0,
      };

      const refAngles = {
        leftArm: 180,
        rightArm: 180,
        leftElbow: 180,
        rightElbow: 180,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const result = calculateFrameScore(userAngles, refAngles, 20);
      expect(result.score).toBe(0);
      expect(result.attemptedJoints).toBe(0);
      expect(result.skippedJoints).toBeGreaterThan(0);
    });

    it('should handle partial matches', () => {
      const userAngles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 90,
        rightElbow: 90,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const refAngles = {
        leftArm: 95, // Within threshold
        rightArm: 85, // Within threshold
        leftElbow: 120, // Outside threshold
        rightElbow: 60, // Outside threshold
        leftThigh: 175, // Within threshold
        rightThigh: 185, // Within threshold (wraps)
        leftLeg: 150, // Outside threshold
        rightLeg: 150, // Outside threshold
      };

      const result = calculateFrameScore(userAngles, refAngles, 20);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('should skip zero angles', () => {
      const userAngles = {
        leftArm: 0, // Should be skipped
        rightArm: 90,
        leftElbow: 0,
        rightElbow: 90,
        leftThigh: 0,
        rightThigh: 180,
        leftLeg: 0,
        rightLeg: 180,
      };

      const refAngles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 90,
        rightElbow: 90,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const result = calculateFrameScore(userAngles, refAngles, 20);
      // Should only compare non-zero angles
      expect(result.score).toBeGreaterThan(0);
      expect(result.matches.leftArm).toBeUndefined();
      expect(result.matches.rightArm).toBe(true);
      expect(result.matches.rightElbow).toBe(true);
      expect(result.attemptedJoints).toBeGreaterThan(0);
      expect(result.skippedJoints).toBeGreaterThan(0);
      expect(result.skippedJointsList).toContain('leftArm');
    });

    it('should skip joints with low confidence metadata', () => {
      const userAngles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 90,
        rightElbow: 90,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
        angleConfidence: {
          leftArm: 0.9,
          rightArm: 0.9,
        },
      };

      const refAngles = {
        ...userAngles,
        angleConfidence: {
          leftArm: 0.1,
          rightArm: 0.9,
        },
      };

      const result = calculateFrameScore(userAngles, refAngles, 20);
      expect(result.matches.leftArm).toBeUndefined();
      expect(result.attemptedJoints).toBeLessThan(TRACKED_JOINTS.length);
      expect(result.skippedJointsList).toContain('leftArm');
    });
  });

  describe('calculateFinalScore', () => {
    it('should calculate average of frame scores', () => {
      const frameScores = [80, 90, 70, 100];
      const finalScore = calculateFinalScore(frameScores);
      expect(finalScore).toBe(85);
    });

    it('should return 0 for empty array', () => {
      const finalScore = calculateFinalScore([]);
      expect(finalScore).toBe(0);
    });

    it('should handle single frame', () => {
      const finalScore = calculateFinalScore([75]);
      expect(finalScore).toBe(75);
    });
  });

  describe('calculateScoreBreakdown', () => {
    it('should calculate percentage for each joint', () => {
      const frameScores = [
        {
          matches: {
            leftArm: true,
            rightArm: true,
            leftElbow: false,
            rightElbow: false,
            leftThigh: true,
            rightThigh: true,
            leftLeg: true,
            rightLeg: true,
          },
        },
        {
          matches: {
            leftArm: true,
            rightArm: false,
            leftElbow: true,
            rightElbow: false,
            leftThigh: true,
            rightThigh: true,
            leftLeg: false,
            rightLeg: true,
          },
        },
      ];

      const breakdown = calculateScoreBreakdown(frameScores);
      expect(breakdown.leftArm).toBe(100); // 2/2
      expect(breakdown.rightArm).toBe(50); // 1/2
      expect(breakdown.leftElbow).toBe(50); // 1/2
      expect(breakdown.rightElbow).toBe(0); // 0/2
    });

    it('should ignore joints without attempts when calculating percentages', () => {
      const frameScores = [
        {
          matches: {
            leftArm: true,
          },
        },
        {
          matches: {
            rightArm: false,
          },
        },
      ];

      const breakdown = calculateScoreBreakdown(frameScores);
      expect(breakdown.leftArm).toBe(100); // 1/1
      expect(breakdown.rightArm).toBe(0); // 0/1
      expect(breakdown.leftLeg).toBe(0); // no attempts, stays 0
    });

    it('should return zeros for empty array', () => {
      const breakdown = calculateScoreBreakdown([]);
      expect(breakdown.leftArm).toBe(0);
      expect(breakdown.rightArm).toBe(0);
    });
  });

  describe('getPerformanceRating', () => {
    it('should return correct ratings', () => {
      expect(getPerformanceRating(95)).toBe('Perfect!');
      expect(getPerformanceRating(85)).toBe('Excellent!');
      expect(getPerformanceRating(75)).toBe('Great!');
      expect(getPerformanceRating(65)).toBe('Good!');
      expect(getPerformanceRating(55)).toBe('Nice Try!');
      expect(getPerformanceRating(45)).toBe('Keep Practicing!');
    });
  });

  describe('calculateWeightedScore', () => {
    it('should give more weight to later frames', () => {
      const frameScores = [50, 100]; // Later frame is perfect
      const weightedScore = calculateWeightedScore(frameScores);
      
      // Weighted: (50*1 + 100*2) / (1+2) = 250/3 = 83.33
      expect(weightedScore).toBeCloseTo(83.33, 1);
    });

    it('should return 0 for empty array', () => {
      const weightedScore = calculateWeightedScore([]);
      expect(weightedScore).toBe(0);
    });
  });
});
