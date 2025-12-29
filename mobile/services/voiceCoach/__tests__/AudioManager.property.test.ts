/**
 * Property-based tests for AudioManager
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { AudioManager, AudioClip, AudioPriority } from '../AudioManager';

// Mock expo-av
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

describe('AudioManager Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function waitForPlaybackCompletion(
    results: string[],
    expectedCount: number,
    timeoutMs: number = 200
  ) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (results.length === expectedCount) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  // Feature: elevenlabs-voice-coach, Property 8: Audio Queue Management
  describe('Property 8: Audio Queue Management', () => {
    /**
     * Validates: Requirements 5.4, 10.3, 10.4
     * 
     * For any sequence of audio clips submitted to the AudioManager:
     * (a) clips should be played in order of arrival within the same priority level
     * (b) high-priority clips should clear the queue of lower-priority clips
     * (c) new clips should not interrupt currently playing audio unless high-priority
     */

    it('should play clips in FIFO order within same priority level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.constantFrom<AudioPriority>('low', 'normal'),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (clipData) => {
            const manager = new AudioManager();
            const playedClips: string[] = [];

            manager.onPlaybackEnd = (clip) => {
              playedClips.push(clip.id);
            };

            // Enqueue all clips WITHOUT auto-play
            const clips: AudioClip[] = clipData.map((data, index) => ({
              ...data,
              id: `${data.id}-${index}`, // Ensure unique IDs
              audio: 'dGVzdA==', // base64 "test"
            }));

            clips.forEach((clip) => manager.enqueue(clip, false));

            // Verify all clips are in queue
            expect(manager.getQueueLength()).toBe(clips.length);

            // Now play all clips
            await manager.play();
            await new Promise((resolve) => setTimeout(resolve, 25));

            // Verify clips were played in FIFO order
            const expectedOrder = clips.map((c) => c.id);
            expect(playedClips).toEqual(expectedOrder);
          }
        ),
        propertyConfig({ numRuns: 100, timeout: 10000 })
      );
    });

    it('should clear lower-priority clips when high-priority clip arrives', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.constantFrom<AudioPriority>('low', 'normal'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (lowPriorityData, highPriorityData) => {
            const manager = new AudioManager();

            // Enqueue low/normal priority clips WITHOUT auto-play
            const lowPriorityClips: AudioClip[] = lowPriorityData.map((data, index) => ({
              ...data,
              id: `low-${data.id}-${index}`,
              audio: 'dGVzdA==',
            }));

            lowPriorityClips.forEach((clip) => manager.enqueue(clip, false));

            const initialQueueLength = manager.getQueueLength();
            expect(initialQueueLength).toBe(lowPriorityClips.length);

            // Enqueue high-priority clip WITHOUT auto-play
            const highPriorityClip: AudioClip = {
              ...highPriorityData,
              id: `high-${highPriorityData.id}`,
              audio: 'dGVzdA==',
              priority: 'high',
            };

            manager.enqueue(highPriorityClip, false);

            // Queue should only contain high-priority clips
            const queueLength = manager.getQueueLength();
            expect(queueLength).toBe(1);
            expect(manager.peekNext()?.id).toBe(highPriorityClip.id);
            expect(manager.peekNext()?.priority).toBe('high');
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should not interrupt currently playing audio with normal priority clips', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            text: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (firstClipData, additionalClipsData) => {
            const manager = new AudioManager();
            const playbackStarted: string[] = [];
            const playbackEnded: string[] = [];

            manager.onPlaybackStart = (clip) => {
              playbackStarted.push(clip.id);
            };

            manager.onPlaybackEnd = (clip) => {
              playbackEnded.push(clip.id);
            };

            // Enqueue first clip and start playing
            const firstClip: AudioClip = {
              ...firstClipData,
              id: `first-${firstClipData.id}`,
              audio: 'dGVzdA==',
              priority: 'normal',
            };

            manager.enqueue(firstClip, true);

            // Wait a bit for playback to start
            await new Promise((resolve) => setTimeout(resolve, 2));

            // Enqueue additional clips while first is playing (without auto-play)
            const additionalClips: AudioClip[] = additionalClipsData.map((data, index) => ({
              ...data,
              id: `additional-${data.id}-${index}`,
              audio: 'dGVzdA==',
              priority: 'normal',
            }));

            additionalClips.forEach((clip) => manager.enqueue(clip, false));
            await manager.play();

            // Wait for all playback to complete
            await new Promise((resolve) => setTimeout(resolve, 5));

            // First clip should have started and completed
            expect(playbackStarted[0]).toBe(firstClip.id);
            expect(playbackEnded[0]).toBe(firstClip.id);

            // All clips should eventually play in order
            const allClips = [firstClip, ...additionalClips];
            await waitForPlaybackCompletion(playbackEnded, allClips.length);
            expect(playbackEnded).toEqual(allClips.map((c) => c.id));
          }
        ),
        propertyConfig({ numRuns: 50, timeout: 10000 })
      );
    });

    it('should handle empty queue gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const manager = new AudioManager();

          // Try to play with empty queue
          await manager.play();

          expect(manager.getQueueLength()).toBe(0);
          expect(manager.getIsPlaying()).toBe(false);
        }),
        propertyConfig({ numRuns: 10 })
      );
    });

    it('should clear queue correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              text: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.constantFrom<AudioPriority>('low', 'normal'), // Only low/normal to avoid high clearing queue
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (clipData) => {
            const manager = new AudioManager();

            // Enqueue clips WITHOUT auto-play
            const clips: AudioClip[] = clipData.map((data, index) => ({
              ...data,
              id: `${data.id}-${index}`,
              audio: 'dGVzdA==',
            }));

            clips.forEach((clip) => manager.enqueue(clip, false));

            const queueLengthBefore = manager.getQueueLength();
            expect(queueLengthBefore).toBe(clips.length);

            // Clear queue
            manager.clearQueue();

            expect(manager.getQueueLength()).toBe(0);
            expect(manager.peekNext()).toBeNull();
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });
});
