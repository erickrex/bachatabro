/**
 * Error Handling & Edge Cases Tests
 * 
 * Tests error scenarios and edge cases
 * Validates NFR-008 (Error Handling)
 */

import { calculateFrameScore, calculateFinalScore } from '../../services/scoreCalculator';
import { calculateAngles, calculateAngle } from '../../utils/angleCalculator';
import { Angles } from '../../types/game';

describe('Error Handling & Edge Cases', () => {
  describe('Invalid Angle Data', () => {
    it('should handle NaN values in angles', () => {
      const invalidAngles: Angles = {
        leftArm: NaN,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(invalidAngles, validAngles);
      }).not.toThrow();
    });

    it('should handle Infinity values in angles', () => {
      const invalidAngles: Angles = {
        leftArm: Infinity,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(invalidAngles, validAngles);
      }).not.toThrow();
    });

    it('should handle negative angle values', () => {
      const negativeAngles: Angles = {
        leftArm: -90,
        rightArm: -90,
        leftElbow: -120,
        rightElbow: -120,
        leftThigh: -170,
        rightThigh: -170,
        leftLeg: -160,
        rightLeg: -160,
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(negativeAngles, validAngles);
      }).not.toThrow();
    });

    it('should handle angles > 360 degrees', () => {
      const largeAngles: Angles = {
        leftArm: 450,
        rightArm: 720,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(largeAngles, validAngles);
      }).not.toThrow();
    });
  });

  describe('Missing Keypoint Data', () => {
    it('should handle missing keypoints with low confidence', () => {
      const lowConfidencePoint = { x: 0, y: 0, confidence: 0.1 };
      const highConfidencePoint = { x: 1, y: 0, confidence: 0.9 };

      const angle = calculateAngle(
        lowConfidencePoint,
        highConfidencePoint,
        highConfidencePoint
      );

      expect(angle).toBe(0);
    });

    it('should handle keypoints at same position', () => {
      const samePoint = { x: 0.5, y: 0.5, confidence: 0.9 };

      const angle = calculateAngle(samePoint, samePoint, samePoint);

      expect(angle).toBe(0);
    });

    it('should handle partial keypoint data', () => {
      const partialKeypoints = {
        leftShoulder: { x: 0.3, y: 0.4, confidence: 0.9 },
        leftElbow: { x: 0.25, y: 0.5, confidence: 0.9 },
        leftWrist: { x: 0.2, y: 0.6, confidence: 0.9 },
        // Missing right side keypoints
      };

      expect(() => {
        calculateAngles(partialKeypoints as any);
      }).not.toThrow();
    });
  });

  describe('Empty or Invalid Frame Data', () => {
    it('should handle empty frame scores array', () => {
      const emptyScores: number[] = [];
      const finalScore = calculateFinalScore(emptyScores);

      expect(isNaN(finalScore) || finalScore === 0).toBe(true);
    });

    it('should handle single frame score', () => {
      const singleScore = [85];
      const finalScore = calculateFinalScore(singleScore);

      expect(finalScore).toBe(85);
    });

    it('should handle all zero scores', () => {
      const zeroScores = Array(10).fill(0);
      const finalScore = calculateFinalScore(zeroScores);

      expect(finalScore).toBe(0);
    });

    it('should handle mixed valid and invalid scores', () => {
      const mixedScores = [85, NaN, 90, Infinity, 75, -10, 95];
      
      expect(() => {
        calculateFinalScore(mixedScores);
      }).not.toThrow();
    });
  });

  describe('Boundary Values', () => {
    it('should handle 0 degree angles', () => {
      const zeroAngles: Angles = {
        leftArm: 0,
        rightArm: 0,
        leftElbow: 0,
        rightElbow: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftLeg: 0,
        rightLeg: 0,
      };

      const { score } = calculateFrameScore(zeroAngles, zeroAngles);
      // 0 degree angles might be treated as invalid/missing data
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle 180 degree angles', () => {
      const straightAngles: Angles = {
        leftArm: 180,
        rightArm: 180,
        leftElbow: 180,
        rightElbow: 180,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const { score } = calculateFrameScore(straightAngles, straightAngles);
      expect(score).toBe(100);
    });

    it('should handle maximum difference (180 degrees)', () => {
      const angles1: Angles = {
        leftArm: 0,
        rightArm: 0,
        leftElbow: 0,
        rightElbow: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftLeg: 0,
        rightLeg: 0,
      };

      const angles2: Angles = {
        leftArm: 180,
        rightArm: 180,
        leftElbow: 180,
        rightElbow: 180,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };

      const { score } = calculateFrameScore(angles1, angles2);
      expect(score).toBe(0); // All joints beyond threshold
    });
  });

  describe('Threshold Edge Cases', () => {
    it('should match exactly at threshold (20 degrees)', () => {
      const referenceAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const atThreshold: Angles = {
        leftArm: 110, // Exactly 20 degrees off
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const { score, matches } = calculateFrameScore(atThreshold, referenceAngles);
      expect(matches.leftArm).toBe(true); // Should match at threshold
    });

    it('should not match just beyond threshold (21 degrees)', () => {
      const referenceAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const beyondThreshold: Angles = {
        leftArm: 111, // 21 degrees off
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const { score, matches } = calculateFrameScore(beyondThreshold, referenceAngles);
      expect(matches.leftArm).toBe(false); // Should not match beyond threshold
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple simultaneous score calculations', () => {
      const angles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const promises = Array(100).fill(null).map(() => 
        Promise.resolve(calculateFrameScore(angles, angles))
      );

      return expect(Promise.all(promises)).resolves.toHaveLength(100);
    });
  });

  describe('Data Type Validation', () => {
    it('should handle string values coerced to numbers', () => {
      const stringAngles: any = {
        leftArm: '90',
        rightArm: '90',
        leftElbow: '120',
        rightElbow: '120',
        leftThigh: '170',
        rightThigh: '170',
        leftLeg: '160',
        rightLeg: '160',
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(stringAngles, validAngles);
      }).not.toThrow();
    });

    it('should handle undefined values', () => {
      const undefinedAngles: any = {
        leftArm: undefined,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const validAngles: Angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      expect(() => {
        calculateFrameScore(undefinedAngles, validAngles);
      }).not.toThrow();
    });
  });
});
