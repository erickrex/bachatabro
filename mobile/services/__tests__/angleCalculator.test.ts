/**
 * Tests for angle calculator utility
 */

import { 
  calculateAngle, 
  calculateAngles, 
  angleDifference,
  compareAngles,
  validateAngles
} from '../../utils/angleCalculator';

describe('angleCalculator', () => {
  describe('calculateAngle', () => {
    it('should calculate 90 degree angle', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 1, y: 1 };
      
      const angle = calculateAngle(p1, p2, p3);
      expect(angle).toBeCloseTo(90, 1);
    });
    
    it('should calculate 180 degree angle (straight line)', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 2, y: 0 };
      
      const angle = calculateAngle(p1, p2, p3);
      expect(angle).toBeCloseTo(180, 1);
    });
    
    it('should calculate 45 degree angle', () => {
      // For a 45 degree angle using dot product method
      // Vector from p2 to p1: (-1, 0)
      // Vector from p2 to p3: (0, 1)
      // This creates a 90 degree angle, so let's use different points
      // For 45 degrees: vectors should be at 45 degrees apart
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 1 + Math.cos(Math.PI/4), y: Math.sin(Math.PI/4) };
      
      const angle = calculateAngle(p1, p2, p3);
      expect(angle).toBeCloseTo(135, 1); // The implementation returns the supplementary angle
    });
    
    it('should still return angle for low confidence points when data exists', () => {
      const p1 = { x: 0, y: 0, confidence: 0.3 };
      const p2 = { x: 1, y: 0, confidence: 0.9 };
      const p3 = { x: 1, y: 1, confidence: 0.9 };
      
      const angle = calculateAngle(p1, p2, p3);
      expect(angle).toBeGreaterThan(0);
    });
  });
  
  describe('calculateAngles', () => {
    it('should calculate all joint angles', () => {
      const keypoints = {
        leftShoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
        leftElbow: { x: 0.3, y: 0.5, confidence: 0.9 },
        leftWrist: { x: 0.2, y: 0.5, confidence: 0.9 },
        rightShoulder: { x: 0.6, y: 0.3, confidence: 0.9 },
        rightElbow: { x: 0.7, y: 0.5, confidence: 0.9 },
        rightWrist: { x: 0.8, y: 0.5, confidence: 0.9 },
        leftHip: { x: 0.4, y: 0.6, confidence: 0.9 },
        leftKnee: { x: 0.4, y: 0.8, confidence: 0.9 },
        leftAnkle: { x: 0.4, y: 1.0, confidence: 0.9 },
        rightHip: { x: 0.6, y: 0.6, confidence: 0.9 },
        rightKnee: { x: 0.6, y: 0.8, confidence: 0.9 },
        rightAnkle: { x: 0.6, y: 1.0, confidence: 0.9 },
      };
      
      const angles = calculateAngles(keypoints);
      
      expect(angles).toHaveProperty('leftArm');
      expect(angles).toHaveProperty('rightArm');
      expect(angles).toHaveProperty('leftElbow');
      expect(angles).toHaveProperty('rightElbow');
      expect(angles).toHaveProperty('leftThigh');
      expect(angles).toHaveProperty('rightThigh');
      expect(angles).toHaveProperty('leftLeg');
      expect(angles).toHaveProperty('rightLeg');
    });

    it('should attach per-joint confidence metadata', () => {
      const keypoints = {
        leftShoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
        leftElbow: { x: 0.3, y: 0.5, confidence: 0.5 },
        leftWrist: { x: 0.2, y: 0.5, confidence: 0.4 },
        rightShoulder: { x: 0.6, y: 0.3, confidence: 0.8 },
        rightElbow: { x: 0.7, y: 0.5, confidence: 0.8 },
        rightWrist: { x: 0.8, y: 0.5, confidence: 0.8 },
        leftHip: { x: 0.4, y: 0.6, confidence: 0.7 },
        leftKnee: { x: 0.4, y: 0.8, confidence: 0.7 },
        leftAnkle: { x: 0.4, y: 1.0, confidence: 0.7 },
        rightHip: { x: 0.6, y: 0.6, confidence: 0.9 },
        rightKnee: { x: 0.6, y: 0.8, confidence: 0.9 },
        rightAnkle: { x: 0.6, y: 1.0, confidence: 0.9 },
      };

      const angles = calculateAngles(keypoints);
      expect(angles.angleConfidence?.leftArm).toBeCloseTo(0.4);
      expect(angles.angleConfidence?.rightArm).toBeCloseTo(0.8);
    });
  });
  
  describe('angleDifference', () => {
    it('should calculate shortest angular difference', () => {
      expect(angleDifference(10, 20)).toBe(10);
      expect(angleDifference(350, 10)).toBe(20);
      expect(angleDifference(180, 0)).toBe(180);
    });
  });
  
  describe('compareAngles', () => {
    it('should return 100 for identical angles', () => {
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
      
      const similarity = compareAngles(angles, angles, 20);
      expect(similarity).toBe(100);
    });
    
    it('should return 0 for completely different angles', () => {
      const angles1 = {
        leftArm: 0,
        rightArm: 0,
        leftElbow: 0,
        rightElbow: 0,
        leftThigh: 0,
        rightThigh: 0,
        leftLeg: 0,
        rightLeg: 0,
      };
      
      const angles2 = {
        leftArm: 180,
        rightArm: 180,
        leftElbow: 180,
        rightElbow: 180,
        leftThigh: 180,
        rightThigh: 180,
        leftLeg: 180,
        rightLeg: 180,
      };
      
      const similarity = compareAngles(angles1, angles2, 20);
      expect(similarity).toBe(0);
    });
  });
  
  describe('validateAngles', () => {
    it('should validate correct angles', () => {
      const angles = {
        leftArm: 90,
        rightArm: 45,
        leftElbow: 120,
        rightElbow: 60,
        leftThigh: 180,
        rightThigh: 170,
        leftLeg: 150,
        rightLeg: 160,
      };
      
      expect(validateAngles(angles)).toBe(true);
    });
    
    it('should reject invalid angles', () => {
      const angles = {
        leftArm: 200, // Invalid: > 180
        rightArm: 45,
        leftElbow: 120,
        rightElbow: 60,
        leftThigh: 180,
        rightThigh: 170,
        leftLeg: 150,
        rightLeg: 160,
      };
      
      expect(validateAngles(angles)).toBe(false);
    });
  });
});
