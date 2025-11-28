/**
 * Property-Based Tests: Angle Consistency
 * 
 * Uses property-based testing to verify correctness properties
 * across a wide range of inputs.
 */

import fc from 'fast-check';
import { calculateAngles } from '@/utils/angleCalculator';
import type { Keypoint } from '@/types/pose';

describe('Property-Based Tests: Angle Consistency', () => {
  describe('P-003: Angle Calculation Consistency', () => {
    it('should produce same angles for same keypoints (deterministic)', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          (keypoints) => {
            const angles1 = calculateAngles(keypoints);
            const angles2 = calculateAngles(keypoints);

            // Should be exactly equal (deterministic function)
            expect(angles1.leftElbow).toBe(angles2.leftElbow);
            expect(angles1.rightElbow).toBe(angles2.rightElbow);
            expect(angles1.leftKnee).toBe(angles2.leftKnee);
            expect(angles1.rightKnee).toBe(angles2.rightKnee);
            expect(angles1.leftShoulder).toBe(angles2.leftShoulder);
            expect(angles1.rightShoulder).toBe(angles2.rightShoulder);
            expect(angles1.leftHip).toBe(angles2.leftHip);
            expect(angles1.rightHip).toBe(angles2.rightHip);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce angles in valid range [0, 180]', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          (keypoints) => {
            const angles = calculateAngles(keypoints);

            // All angles should be in valid range
            Object.values(angles).forEach((angle) => {
              if (typeof angle === 'number' && !isNaN(angle)) {
                expect(angle).toBeGreaterThanOrEqual(0);
                expect(angle).toBeLessThanOrEqual(180);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle low confidence keypoints gracefully', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary({ minConfidence: 0, maxConfidence: 0.3 }),
          (keypoints) => {
            // Should not throw
            const angles = calculateAngles(keypoints);
            expect(angles).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should be invariant to coordinate scaling', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          fc.double({ min: 0.5, max: 2.0 }),
          (keypoints, scale) => {
            const angles1 = calculateAngles(keypoints);

            // Scale all coordinates
            const scaledKeypoints = keypoints.map((kp) => ({
              ...kp,
              x: kp.x * scale,
              y: kp.y * scale,
            }));

            const angles2 = calculateAngles(scaledKeypoints);

            // Angles should be approximately the same (within floating point error)
            expect(Math.abs(angles1.leftElbow - angles2.leftElbow)).toBeLessThan(0.1);
            expect(Math.abs(angles1.rightElbow - angles2.rightElbow)).toBeLessThan(0.1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('P-006: Quantization Accuracy', () => {
    it('should maintain angle accuracy after simulated quantization', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          (keypoints) => {
            const originalAngles = calculateAngles(keypoints);

            // Simulate quantization by rounding coordinates
            const quantizedKeypoints = keypoints.map((kp) => ({
              ...kp,
              x: Math.round(kp.x * 100) / 100, // 2 decimal places
              y: Math.round(kp.y * 100) / 100,
            }));

            const quantizedAngles = calculateAngles(quantizedKeypoints);

            // Angles should be within 5% (AC-008 requirement)
            Object.keys(originalAngles).forEach((key) => {
              const original = originalAngles[key as keyof typeof originalAngles];
              const quantized = quantizedAngles[key as keyof typeof quantizedAngles];

              if (typeof original === 'number' && typeof quantized === 'number' && !isNaN(original) && !isNaN(quantized)) {
                const percentDiff = Math.abs(original - quantized) / Math.max(original, 1);
                expect(percentDiff).toBeLessThan(0.05);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('P-008: JSON Format Compatibility', () => {
    it('should handle keypoints from JSON serialization/deserialization', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          (keypoints) => {
            const angles1 = calculateAngles(keypoints);

            // Simulate JSON round-trip
            const json = JSON.stringify(keypoints);
            const parsed = JSON.parse(json);

            const angles2 = calculateAngles(parsed);

            // Should be identical after JSON round-trip
            expect(angles1).toEqual(angles2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('P-013: Score Equivalence', () => {
    it('should produce equivalent scores for same angles regardless of source', () => {
      fc.assert(
        fc.property(
          generateKeypointsArbitrary(),
          generateKeypointsArbitrary(),
          (userKeypoints, referenceKeypoints) => {
            const userAngles = calculateAngles(userKeypoints);
            const refAngles = calculateAngles(referenceKeypoints);

            // Calculate score (simplified version)
            const score1 = calculateSimpleScore(userAngles, refAngles);

            // Mark as different sources
            const userAnglesRT = { ...userAngles, source: 'real-time' };
            const userAnglesPC = { ...userAngles, source: 'pre-computed' };

            const score2 = calculateSimpleScore(userAnglesRT, refAngles);
            const score3 = calculateSimpleScore(userAnglesPC, refAngles);

            // Scores should be identical regardless of source
            expect(score2).toBe(score1);
            expect(score3).toBe(score1);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle keypoints at image boundaries', () => {
      const boundaryKeypoints = [
        { x: 0, y: 0, confidence: 0.9 },
        { x: 1, y: 1, confidence: 0.9 },
        { x: 0, y: 1, confidence: 0.9 },
        { x: 1, y: 0, confidence: 0.9 },
        ...Array(13).fill({ x: 0.5, y: 0.5, confidence: 0.9 }),
      ];

      const angles = calculateAngles(boundaryKeypoints);
      expect(angles).toBeDefined();
    });

    it('should handle all keypoints at same position', () => {
      const samePositionKeypoints = Array(17).fill({
        x: 0.5,
        y: 0.5,
        confidence: 0.9,
      });

      const angles = calculateAngles(samePositionKeypoints);
      expect(angles).toBeDefined();
    });

    it('should handle zero confidence keypoints', () => {
      const zeroConfidenceKeypoints = Array(17).fill({
        x: 0.5,
        y: 0.5,
        confidence: 0,
      });

      const angles = calculateAngles(zeroConfidenceKeypoints);
      expect(angles).toBeDefined();
    });
  });
});

// Arbitraries for property-based testing
function generateKeypointsArbitrary(options?: {
  minConfidence?: number;
  maxConfidence?: number;
}): fc.Arbitrary<Keypoint[]> {
  const minConf = options?.minConfidence ?? 0.5;
  const maxConf = options?.maxConfidence ?? 1.0;

  return fc.array(
    fc.record({
      x: fc.double({ min: 0, max: 1 }),
      y: fc.double({ min: 0, max: 1 }),
      confidence: fc.double({ min: minConf, max: maxConf }),
    }),
    { minLength: 17, maxLength: 17 }
  );
}

// Simplified score calculation for testing
function calculateSimpleScore(userAngles: any, refAngles: any): number {
  const joints = ['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'];
  let totalDiff = 0;
  let count = 0;

  joints.forEach((joint) => {
    const userAngle = userAngles[joint];
    const refAngle = refAngles[joint];

    if (typeof userAngle === 'number' && typeof refAngle === 'number' && !isNaN(userAngle) && !isNaN(refAngle)) {
      totalDiff += Math.abs(userAngle - refAngle);
      count++;
    }
  });

  if (count === 0) return 0;

  const avgDiff = totalDiff / count;
  return Math.max(0, 100 - avgDiff);
}
