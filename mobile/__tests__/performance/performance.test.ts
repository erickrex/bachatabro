/**
 * Performance Tests
 * 
 * Tests performance characteristics of critical functions
 * Validates NFR-001 to NFR-004
 */

import { calculateFrameScore, calculateFinalScore } from '../../services/scoreCalculator';
import { calculateAngles, calculateAngle } from '../../utils/angleCalculator';

describe('Performance Tests', () => {
  const mockAngles = {
    leftArm: 90,
    rightArm: 90,
    leftElbow: 120,
    rightElbow: 120,
    leftThigh: 170,
    rightThigh: 170,
    leftLeg: 160,
    rightLeg: 160,
  };

  const mockKeypoints = {
    leftShoulder: { x: 0.3, y: 0.4, confidence: 0.9 },
    leftElbow: { x: 0.25, y: 0.5, confidence: 0.9 },
    leftWrist: { x: 0.2, y: 0.6, confidence: 0.9 },
    rightShoulder: { x: 0.7, y: 0.4, confidence: 0.9 },
    rightElbow: { x: 0.75, y: 0.5, confidence: 0.9 },
    rightWrist: { x: 0.8, y: 0.6, confidence: 0.9 },
    leftHip: { x: 0.35, y: 0.7, confidence: 0.9 },
    leftKnee: { x: 0.35, y: 0.85, confidence: 0.9 },
    leftAnkle: { x: 0.35, y: 1.0, confidence: 0.9 },
    rightHip: { x: 0.65, y: 0.7, confidence: 0.9 },
    rightKnee: { x: 0.65, y: 0.85, confidence: 0.9 },
    rightAnkle: { x: 0.65, y: 1.0, confidence: 0.9 },
  };

  describe('Score Calculation Performance', () => {
    it('should calculate frame score in <1ms', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        calculateFrameScore(mockAngles, mockAngles);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Average frame score calculation time: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(1);
    });

    it('should calculate final score from 300 frames in <10ms', () => {
      const frameScores = Array(300).fill(85);
      
      const startTime = performance.now();
      const finalScore = calculateFinalScore(frameScores);
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`Final score calculation time: ${duration.toFixed(3)}ms`);
      
      expect(duration).toBeLessThan(10);
      expect(finalScore).toBe(85);
    });

    it('should handle 10fps scoring for 30 seconds (300 frames) in <300ms', () => {
      const startTime = performance.now();

      for (let i = 0; i < 300; i++) {
        calculateFrameScore(mockAngles, mockAngles);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`300 frame scores calculated in: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Angle Calculation Performance', () => {
    it('should calculate single angle in <0.1ms', () => {
      const p1 = { x: 0, y: 0, confidence: 0.9 };
      const p2 = { x: 1, y: 0, confidence: 0.9 };
      const p3 = { x: 1, y: 1, confidence: 0.9 };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        calculateAngle(p1, p2, p3);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Average single angle calculation time: ${avgTime.toFixed(4)}ms`);
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should calculate all 8 joint angles in <1ms', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        calculateAngles(mockKeypoints);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Average all angles calculation time: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive objects during scoring', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate 30 seconds of gameplay (300 frames)
      const frameScores: number[] = [];
      for (let i = 0; i < 300; i++) {
        const { score } = calculateFrameScore(mockAngles, mockAngles);
        frameScores.push(score);
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase for 300 frames: ${(memoryIncrease / 1024).toFixed(2)}KB`);
      
      // Should use less than 1MB for 300 frames
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process multiple frames efficiently', () => {
      const frameCounts = [10, 50, 100, 300];
      
      frameCounts.forEach(count => {
        const startTime = performance.now();
        
        for (let i = 0; i < count; i++) {
          calculateFrameScore(mockAngles, mockAngles);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const avgPerFrame = duration / count;

        console.log(`${count} frames: ${duration.toFixed(2)}ms total, ${avgPerFrame.toFixed(3)}ms per frame`);
        
        // Should maintain consistent per-frame performance
        expect(avgPerFrame).toBeLessThan(1);
      });
    });
  });

  describe('Real-time Performance Simulation', () => {
    it('should maintain 10fps processing rate', () => {
      const targetFps = 10;
      const targetFrameTime = 1000 / targetFps; // 100ms per frame
      const testDuration = 1000; // 1 second
      const expectedFrames = testDuration / targetFrameTime; // 10 frames

      let framesProcessed = 0;
      const startTime = performance.now();

      // Simulate real-time processing
      while (performance.now() - startTime < testDuration) {
        const frameStart = performance.now();
        
        // Process frame
        calculateFrameScore(mockAngles, mockAngles);
        
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        
        // Ensure we don't exceed frame budget
        expect(frameTime).toBeLessThan(targetFrameTime);
        
        framesProcessed++;
        
        // Simulate waiting for next frame
        const remainingTime = targetFrameTime - frameTime;
        if (remainingTime > 0) {
          // In real app, this would be handled by the camera frame rate
          const waitStart = performance.now();
          while (performance.now() - waitStart < remainingTime) {
            // Busy wait (in real app, this is idle time)
          }
        }
      }

      console.log(`Processed ${framesProcessed} frames in ${testDuration}ms`);
      expect(framesProcessed).toBeGreaterThanOrEqual(expectedFrames - 1);
    });
  });
});
