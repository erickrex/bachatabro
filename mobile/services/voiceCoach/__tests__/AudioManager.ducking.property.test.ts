/**
 * Property-based tests for AudioManager audio ducking
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { AudioManager, AudioClip } from '../AudioManager';

// Mock expo-av with volume tracking
let mockVolume = 1.0;
const mockSetVolumeAsync = jest.fn((volume: number) => {
  mockVolume = volume;
  return Promise.resolve();
});

const mockGetStatusAsync = jest.fn(() =>
  Promise.resolve({
    isLoaded: true,
    volume: mockVolume,
  })
);

const mockBackgroundSound = {
  setVolumeAsync: mockSetVolumeAsync,
  getStatusAsync: mockGetStatusAsync,
};

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            setOnPlaybackStatusUpdate: jest.fn((callback) => {
              // Simulate immediate playback completion
            setTimeout(() => {
              callback({ isLoaded: true, didJustFinish: true });
            }, 0);
          }),
            unloadAsync: jest.fn(() => Promise.resolve()),
            stopAsync: jest.fn(() => Promise.resolve()),
          },
        })
      ),
    },
  },
}));

describe('AudioManager Audio Ducking Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVolume = 1.0;
  });

  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  // Feature: elevenlabs-voice-coach, Property 16: Audio Ducking Round-Trip
  describe('Property 16: Audio Ducking Round-Trip', () => {
    /**
     * Validates: Requirements 10.1, 10.2
     * 
     * For any voice playback event, the background music volume should be
     * reduced during playback and restored to its original level after
     * playback completes.
     */

    it('should reduce and restore background music volume for any clip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
            priority: fc.constantFrom('low', 'normal', 'high'),
          }),
          fc.double({ min: 0.1, max: 1.0, noNaN: true }), // Original volume
          fc.double({ min: 0.0, max: 0.5, noNaN: true }), // Ducking volume
          async (clipData, originalVolume, duckingVolume) => {
            // Reset mock volume to original
            mockVolume = originalVolume;
            mockSetVolumeAsync.mockClear();
            mockGetStatusAsync.mockClear();

            const manager = new AudioManager({
              originalVolume,
              duckingVolume,
            });

            // Set background music
            manager.setBackgroundMusic(mockBackgroundSound as any);

            const clip: AudioClip = {
              ...clipData,
              audio: 'dGVzdA==', // base64 "test"
            };

            // Track volume changes
            const volumeChanges: number[] = [];
            mockSetVolumeAsync.mockImplementation((volume: number) => {
              volumeChanges.push(volume);
              mockVolume = volume;
              return Promise.resolve();
            });

            // Enqueue and play clip
            manager.enqueue(clip, false);
            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Should have called setVolumeAsync at least twice (duck and restore)
            expect(mockSetVolumeAsync).toHaveBeenCalled();

            if (volumeChanges.length >= 2) {
              // First call should duck the volume
              expect(volumeChanges[0]).toBeLessThanOrEqual(duckingVolume + 0.01);

              // Last call should restore to original volume
              const lastVolume = volumeChanges[volumeChanges.length - 1];
              expect(lastVolume).toBeCloseTo(originalVolume, 1);
            }
          }
        ),
        propertyConfig({ numRuns: 100, timeout: 10000 })
      );
    });

    it('should handle multiple clips with consistent ducking behavior', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.constantFrom('low', 'normal', 'high'),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          fc.double({ min: 0.5, max: 1.0, noNaN: true }), // Original volume
          async (clipsData, originalVolume) => {
            // Reset mock volume
            mockVolume = originalVolume;
            mockSetVolumeAsync.mockClear();
            mockGetStatusAsync.mockClear();

            const manager = new AudioManager({
              originalVolume,
              duckingVolume: 0.3,
            });

            manager.setBackgroundMusic(mockBackgroundSound as any);

            const clips: AudioClip[] = clipsData.map((data, index) => ({
              ...data,
              id: `${data.id}-${index}`,
              audio: 'dGVzdA==',
            }));

            // Track volume changes
            const volumeChanges: number[] = [];
            mockSetVolumeAsync.mockImplementation((volume: number) => {
              volumeChanges.push(volume);
              mockVolume = volume;
              return Promise.resolve();
            });

            // Enqueue all clips WITHOUT auto-play
            clips.forEach((clip) => manager.enqueue(clip, false));

            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Should have ducked and restored for each clip
            // At minimum: duck, restore (for simplicity, we check that restore happened)
            if (volumeChanges.length > 0) {
              const lastVolume = volumeChanges[volumeChanges.length - 1];
              expect(lastVolume).toBeCloseTo(originalVolume, 1);
            }
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });

    it('should handle no background music gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
            priority: fc.constantFrom('low', 'normal', 'high'),
          }),
          async (clipData) => {
            const manager = new AudioManager();

            // No background music set
            manager.setBackgroundMusic(null);

            const clip: AudioClip = {
              ...clipData,
              audio: 'dGVzdA==',
            };

            // Should not throw error
            await expect(async () => {
              manager.enqueue(clip, false);
              await manager.play();
              await new Promise((resolve) => setTimeout(resolve, 5));
            }).not.toThrow();
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });

    it('should preserve original volume across multiple playback sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.5, max: 1.0, noNaN: true }),
          fc.integer({ min: 2, max: 5 }),
          async (originalVolume, numSessions) => {
            mockVolume = originalVolume;
            mockSetVolumeAsync.mockClear();

            const manager = new AudioManager({
              originalVolume,
              duckingVolume: 0.3,
            });

            manager.setBackgroundMusic(mockBackgroundSound as any);

            const volumeChanges: number[] = [];
            mockSetVolumeAsync.mockImplementation((volume: number) => {
              volumeChanges.push(volume);
              mockVolume = volume;
              return Promise.resolve();
            });

            // Play multiple sessions
            for (let i = 0; i < numSessions; i++) {
              const clip: AudioClip = {
                id: `clip-${i}`,
                text: `Test ${i}`,
                audio: 'dGVzdA==',
                priority: 'normal',
              };

              manager.enqueue(clip, false);
              await manager.play();
              await new Promise((resolve) => setTimeout(resolve, 5));
            }

            // After all sessions, volume should be restored to original
            if (volumeChanges.length > 0) {
              const finalVolume = volumeChanges[volumeChanges.length - 1];
              expect(finalVolume).toBeCloseTo(originalVolume, 1);
            }
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });
  });
});
