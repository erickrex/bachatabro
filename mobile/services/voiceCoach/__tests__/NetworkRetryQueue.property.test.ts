/**
 * Property-based tests for NetworkRetryQueue
 * Feature: elevenlabs-voice-coach
 * 
 * Property 19: Network Retry Queue
 * Validates: Requirements 13.4
 * 
 * For any voice request that fails due to network connectivity,
 * the request should be queued and automatically retried when connectivity is restored.
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { NetworkRetryQueue, RequestType, QueuedRequest } from '../NetworkRetryQueue';

describe('NetworkRetryQueue Property Tests', () => {
  // Increase timeout for property-based tests
  jest.setTimeout(30000);

  // Feature: elevenlabs-voice-coach, Property 19: Network Retry Queue
  describe('Property 19: Network Retry Queue', () => {
    /**
     * Validates: Requirements 13.4
     * 
     * For any voice request that fails due to network connectivity,
     * the request should be queued and automatically retried when connectivity is restored.
     */

    it('should queue requests when offline and not queue when online', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip', 'performance-review'),
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (requestType, payload) => {
            const queue = new NetworkRetryQueue();
            
            // When online, requests should not be queued
            queue.setNetworkStatus('online');
            const onlineResult = queue.enqueue(requestType, payload, async () => {});
            expect(onlineResult).toBeNull();
            expect(queue.getQueueLength()).toBe(0);
            
            // When offline, requests should be queued
            queue.setNetworkStatus('offline');
            const offlineResult = queue.enqueue(requestType, payload, async () => {});
            expect(offlineResult).not.toBeNull();
            expect(queue.getQueueLength()).toBe(1);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should process queued requests when coming back online', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip'),
              payload: fc.record({ data: fc.string({ minLength: 1, maxLength: 50 }) }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (requests) => {
            const queue = new NetworkRetryQueue({ retryDelayMs: 10 });
            const executedRequests: string[] = [];
            
            // Go offline and queue requests
            queue.setNetworkStatus('offline');
            
            requests.forEach((req, index) => {
              queue.enqueue(req.type, req.payload, async () => {
                executedRequests.push(`${req.type}-${index}`);
              });
            });
            
            expect(queue.getQueueLength()).toBe(requests.length);
            
            // Come back online - should trigger processing
            queue.setNetworkStatus('online');
            
            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // All requests should have been executed
            expect(executedRequests.length).toBe(requests.length);
            expect(queue.getQueueLength()).toBe(0);
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should retry failed requests up to maxRetries times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 10 }),
          async (maxRetries, failCount) => {
            const queue = new NetworkRetryQueue({ 
              maxRetries, 
              retryDelayMs: 5 
            });
            
            let attemptCount = 0;
            const shouldSucceed = failCount < maxRetries;
            
            queue.setNetworkStatus('offline');
            queue.enqueue('tts', { text: 'test' }, async () => {
              attemptCount++;
              if (attemptCount <= failCount) {
                throw new Error('Network error');
              }
            });
            
            queue.setNetworkStatus('online');
            await queue.processQueue();
            
            // Wait for retries
            await new Promise(resolve => setTimeout(resolve, maxRetries * 50));
            
            if (shouldSucceed) {
              // Request should have succeeded eventually
              expect(attemptCount).toBe(failCount + 1);
            } else {
              // Request should have been removed after max retries
              expect(attemptCount).toBe(maxRetries);
            }
            
            // Queue should be empty after processing
            expect(queue.getQueueLength()).toBe(0);
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should preserve request order in queue (FIFO)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip'),
              id: fc.string({ minLength: 1, maxLength: 10 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (requests) => {
            const queue = new NetworkRetryQueue({ retryDelayMs: 5 });
            const executionOrder: string[] = [];
            
            queue.setNetworkStatus('offline');
            
            // Queue requests with unique identifiers
            requests.forEach((req, index) => {
              const uniqueId = `${req.id}-${index}`;
              queue.enqueue(req.type, { id: uniqueId }, async () => {
                executionOrder.push(uniqueId);
              });
            });
            
            const expectedOrder = requests.map((req, index) => `${req.id}-${index}`);
            
            queue.setNetworkStatus('online');
            await queue.processQueue();
            
            // Wait for all to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Requests should be executed in FIFO order
            expect(executionOrder).toEqual(expectedOrder);
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should respect maxQueueSize limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 20 }),
          async (maxQueueSize, requestCount) => {
            const queue = new NetworkRetryQueue({ maxQueueSize });
            
            queue.setNetworkStatus('offline');
            
            for (let i = 0; i < requestCount; i++) {
              queue.enqueue('tts', { index: i }, async () => {});
            }
            
            // Queue size should never exceed maxQueueSize
            expect(queue.getQueueLength()).toBeLessThanOrEqual(maxQueueSize);
            
            // If we added more than max, oldest should be removed
            if (requestCount > maxQueueSize) {
              const queuedRequests = queue.getQueue();
              // The last maxQueueSize requests should be in the queue
              expect(queuedRequests.length).toBe(maxQueueSize);
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should fire onRequestQueued event for each queued request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip'),
            { minLength: 1, maxLength: 5 }
          ),
          async (requestTypes) => {
            const queue = new NetworkRetryQueue();
            const queuedEvents: QueuedRequest[] = [];
            
            queue.onRequestQueued = (request) => {
              queuedEvents.push(request);
            };
            
            queue.setNetworkStatus('offline');
            
            requestTypes.forEach((type, index) => {
              queue.enqueue(type, { index }, async () => {});
            });
            
            // Should have received an event for each queued request
            expect(queuedEvents.length).toBe(requestTypes.length);
            
            // Each event should have the correct type
            queuedEvents.forEach((event, index) => {
              expect(event.type).toBe(requestTypes[index]);
            });
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should fire onRequestRetried event with correct success status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (shouldSucceed) => {
            const queue = new NetworkRetryQueue({ maxRetries: 1, retryDelayMs: 5 });
            const retriedEvents: { request: QueuedRequest; success: boolean }[] = [];
            
            queue.onRequestRetried = (request, success) => {
              retriedEvents.push({ request, success });
            };
            
            queue.setNetworkStatus('offline');
            queue.enqueue('tts', { test: true }, async () => {
              if (!shouldSucceed) {
                throw new Error('Failed');
              }
            });
            
            queue.setNetworkStatus('online');
            await queue.processQueue();
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Should have received exactly one retry event
            expect(retriedEvents.length).toBe(1);
            expect(retriedEvents[0].success).toBe(shouldSucceed);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should allow removing specific requests from queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip'),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0 }),
          async (requestTypes, removeIndex) => {
            const queue = new NetworkRetryQueue();
            const requestIds: string[] = [];
            
            queue.setNetworkStatus('offline');
            
            requestTypes.forEach((type) => {
              const id = queue.enqueue(type, {}, async () => {});
              if (id) requestIds.push(id);
            });
            
            const initialLength = queue.getQueueLength();
            const indexToRemove = removeIndex % requestIds.length;
            const idToRemove = requestIds[indexToRemove];
            
            const removed = queue.remove(idToRemove);
            
            expect(removed).toBe(true);
            expect(queue.getQueueLength()).toBe(initialLength - 1);
            
            // The removed request should no longer be in the queue
            const remainingIds = queue.getQueue().map(r => r.id);
            expect(remainingIds).not.toContain(idToRemove);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should clear all requests when clear() is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom<RequestType>('tts', 'stt', 'coaching-tip'),
            { minLength: 1, maxLength: 10 }
          ),
          async (requestTypes) => {
            const queue = new NetworkRetryQueue();
            
            queue.setNetworkStatus('offline');
            
            requestTypes.forEach((type) => {
              queue.enqueue(type, {}, async () => {});
            });
            
            expect(queue.getQueueLength()).toBe(requestTypes.length);
            
            queue.clear();
            
            expect(queue.getQueueLength()).toBe(0);
            expect(queue.hasRequests()).toBe(false);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });
});
