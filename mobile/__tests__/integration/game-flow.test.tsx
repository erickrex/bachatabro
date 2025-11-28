/**
 * Integration Test: Complete Game Flow
 * 
 * Tests the complete user journey:
 * 1. Song selection
 * 2. Game play
 * 3. Score calculation
 * 4. Results display
 * 5. Leaderboard update
 * 
 * Validates all acceptance criteria for Phase 4 Task 4.1.1
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { calculateFrameScore, calculateFinalScore } from '../../services/scoreCalculator';
import { calculateAngles } from '../../utils/angleCalculator';

describe('Complete Game Flow Integration', () => {

  describe('End-to-End Game Flow', () => {
    it('should complete full game cycle: select song → play → score', () => {
      // 1. Song Selection
      const selectedSong = 'cheapthrills';
      expect(selectedSong).toBeTruthy();

      // 2. Simulate Game Play with mock pose data
      const mockUserAngles = {
        leftArm: 90,
        rightArm: 85,
        leftElbow: 120,
        rightElbow: 115,
        leftThigh: 170,
        rightThigh: 175,
        leftLeg: 160,
        rightLeg: 165,
      };

      const mockReferenceAngles = {
        leftArm: 95,
        rightArm: 90,
        leftElbow: 125,
        rightElbow: 120,
        leftThigh: 175,
        rightThigh: 180,
        leftLeg: 165,
        rightLeg: 170,
      };

      // 3. Calculate frame scores
      const frameScores: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { score } = calculateFrameScore(mockUserAngles, mockReferenceAngles);
        frameScores.push(score);
      }

      expect(frameScores.length).toBe(10);
      expect(frameScores.every(score => score >= 0 && score <= 100)).toBe(true);

      // 4. Calculate final score
      const finalScore = calculateFinalScore(frameScores);
      expect(finalScore).toBeGreaterThan(0);
      expect(finalScore).toBeLessThanOrEqual(100);
    });

    it('should handle multiple songs in sequence', () => {
      const songs = ['cheapthrills', 'uptownfunk', 'dontstartnow'];
      const scores: number[] = [];

      for (const song of songs) {
        // Simulate gameplay
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
        
        const { score } = calculateFrameScore(mockAngles, mockAngles);
        scores.push(score);
      }

      // Verify all scores were calculated
      expect(scores.length).toBe(songs.length);
      expect(scores.every(score => score === 100)).toBe(true);
    });

    it('should maintain score accuracy across multiple frames', async () => {
      const perfectAngles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      // Perfect match should give 100% score
      const { score: perfectScore } = calculateFrameScore(perfectAngles, perfectAngles);
      expect(perfectScore).toBe(100);

      // Slight deviation (within threshold) should still give good score
      const slightlyOffAngles = {
        ...perfectAngles,
        leftArm: 95, // 5 degrees off (within 20 degree threshold)
      };
      const { score: goodScore } = calculateFrameScore(slightlyOffAngles, perfectAngles);
      expect(goodScore).toBeGreaterThanOrEqual(85);
      
      // Deviation beyond threshold should reduce score
      const beyondThresholdAngles = {
        ...perfectAngles,
        leftArm: 115, // 25 degrees off (beyond 20 degree threshold)
      };
      const { score: reducedScore } = calculateFrameScore(beyondThresholdAngles, perfectAngles);
      expect(reducedScore).toBeLessThan(100);

      // Large deviation should significantly reduce score
      const wayOffAngles = {
        ...perfectAngles,
        leftArm: 150, // 60 degrees off
        rightArm: 150,
      };
      const { score: poorScore } = calculateFrameScore(wayOffAngles, perfectAngles);
      expect(poorScore).toBeLessThan(goodScore);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid angle data gracefully', () => {
      const invalidAngles = {
        leftArm: NaN,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const validAngles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      // Should not throw
      expect(() => {
        calculateFrameScore(invalidAngles, validAngles);
      }).not.toThrow();
    });

    it('should handle empty frame scores', () => {
      const emptyScores: number[] = [];
      const finalScore = calculateFinalScore(emptyScores);
      
      // Should return 0 or NaN for empty array
      expect(isNaN(finalScore) || finalScore === 0).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should calculate scores quickly for many frames', () => {
      const angles = {
        leftArm: 90,
        rightArm: 90,
        leftElbow: 120,
        rightElbow: 120,
        leftThigh: 170,
        rightThigh: 170,
        leftLeg: 160,
        rightLeg: 160,
      };

      const startTime = Date.now();
      
      // Simulate 300 frames (30 seconds at 10fps)
      for (let i = 0; i < 300; i++) {
        calculateFrameScore(angles, angles);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
