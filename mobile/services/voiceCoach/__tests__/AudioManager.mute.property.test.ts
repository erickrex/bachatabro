/**
 * Property-based tests for AudioManager mute behavior
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { AudioManager, AudioClip } from '../AudioManager';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            setOnPlaybackStatusUpdate: jest.fn((callback) => {
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

// Get reference to the mocked function after mocking
const { Audio } = require('expo-av');
const mockCreateAsync = Audio.Sound.createAsync as jest.Mock;

describe('AudioManager Mute Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  // Feature: elevenlabs-voice-coach, Property 17: Mute State Behavior
  describe('Property 17: Mute State Behavior', () => {
    /**
     * Validates: Requirements 10.5
     * 
     * For any audio playback request while the Voice Coach is muted,
     * no audio should be played through the speakers.
     */

    it('should not create audio when muted for any clip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
            priority: fc.constantFrom('low', 'normal', 'high'),
          }),
          async (clipData) => {
            const manager = new AudioManager();
            
            // Set muted state
            manager.setMuted(true);
            expect(manager.getMuted()).toBe(true);

            const clip: AudioClip = {
              ...clipData,
              audio: 'dGVzdA==', // base64 "test"
            };

            // Track playback events
            let playbackStarted = false;
            let playbackEnded = false;

            manager.onPlaybackStart = () => {
              playbackStarted = true;
            };

            manager.onPlaybackEnd = () => {
              playbackEnded = true;
            };

            // Clear mock call count
            mockCreateAsync.mockClear();

            // Enqueue and play
            manager.enqueue(clip, false);
            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Audio.Sound.createAsync should NOT be called when muted
            expect(mockCreateAsync).not.toHaveBeenCalled();

            // Playback end event should still fire (for cleanup)
            expect(playbackEnded).toBe(true);
          }
        ),
        propertyConfig({ numRuns: 100, timeout: 10000 })
      );
    });

    it('should play audio when unmuted for any clip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
            priority: fc.constantFrom('low', 'normal', 'high'),
          }),
          async (clipData) => {
            const manager = new AudioManager();
            
            // Ensure not muted
            manager.setMuted(false);
            expect(manager.getMuted()).toBe(false);

            const clip: AudioClip = {
              ...clipData,
              audio: 'dGVzdA==',
            };

            // Clear mock call count
            mockCreateAsync.mockClear();

            // Enqueue and play
            manager.enqueue(clip, false);
            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Audio.Sound.createAsync SHOULD be called when not muted
            expect(mockCreateAsync).toHaveBeenCalled();
          }
        ),
        propertyConfig({ numRuns: 100, timeout: 10000 })
      );
    });

    it('should handle mute state changes during queue processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.constantFrom('low', 'normal', 'high'),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.boolean(), // Initial mute state
          async (clipsData, initialMuteState) => {
            const manager = new AudioManager();
            manager.setMuted(initialMuteState);

            const clips: AudioClip[] = clipsData.map((data, index) => ({
              ...data,
              id: `${data.id}-${index}`,
              audio: 'dGVzdA==',
            }));

            // Track which clips triggered playback end
            const endedClips: string[] = [];
            manager.onPlaybackEnd = (clip) => {
              endedClips.push(clip.id);
            };

            mockCreateAsync.mockClear();

            // Enqueue all clips WITHOUT auto-play
            // Track expected queue size after all enqueues (accounting for high-priority clearing)
            let expectedClipsToPlay = 0;
            clips.forEach((clip) => {
              manager.enqueue(clip, false);
              // After each enqueue, check the queue length
              expectedClipsToPlay = manager.getQueueLength();
            });

            // Play
            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // All clips that were in the final queue should have ended (even if muted)
            expect(endedClips.length).toBe(expectedClipsToPlay);

            // If muted, no audio should have been created
            if (initialMuteState) {
              expect(mockCreateAsync).not.toHaveBeenCalled();
            } else {
              expect(mockCreateAsync).toHaveBeenCalled();
            }
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });

    it('should respect mute state for any number of clips', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.boolean(),
          async (numClips, isMuted) => {
            const manager = new AudioManager();
            manager.setMuted(isMuted);

            const clips: AudioClip[] = Array.from({ length: numClips }, (_, i) => ({
              id: `clip-${i}`,
              text: `Test ${i}`,
              audio: 'dGVzdA==',
              priority: 'normal',
            }));

            mockCreateAsync.mockClear();

            // Enqueue all clips WITHOUT auto-play
            clips.forEach((clip) => manager.enqueue(clip, false));

            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 5));

            // Verify mute behavior
            if (isMuted) {
              expect(mockCreateAsync).not.toHaveBeenCalled();
            } else {
              expect(mockCreateAsync).toHaveBeenCalledTimes(numClips);
            }
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });

    it('should allow toggling mute state at any time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
          async (muteStates) => {
            const manager = new AudioManager();

            // Toggle through all mute states
            for (const muteState of muteStates) {
              manager.setMuted(muteState);
              expect(manager.getMuted()).toBe(muteState);
            }

            // Final state should match last value
            const finalState = muteStates[muteStates.length - 1];
            expect(manager.getMuted()).toBe(finalState);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });
});
