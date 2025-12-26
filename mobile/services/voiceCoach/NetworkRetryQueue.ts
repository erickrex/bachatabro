/**
 * Network Retry Queue for Voice Coach
 * 
 * Queues failed requests when offline and retries them when connectivity is restored.
 * 
 * Requirements: 13.4
 */

export type RequestType = 'tts' | 'stt' | 'coaching-tip' | 'performance-review' | 'conversation';

export interface QueuedRequest<T = unknown> {
  id: string;
  type: RequestType;
  payload: T;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  execute: () => Promise<unknown>;
}

export interface NetworkRetryQueueConfig {
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxAgeMs?: number;
}

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export class NetworkRetryQueue {
  private queue: QueuedRequest[] = [];
  private maxQueueSize: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private maxAgeMs: number;
  private networkStatus: NetworkStatus = 'online';
  private isProcessing: boolean = false;
  private idCounter: number = 0;

  // Event handlers
  public onRequestQueued: ((request: QueuedRequest) => void) | null = null;
  public onRequestRetried: ((request: QueuedRequest, success: boolean) => void) | null = null;
  public onNetworkStatusChange: ((status: NetworkStatus) => void) | null = null;

  constructor(config?: NetworkRetryQueueConfig) {
    this.maxQueueSize = config?.maxQueueSize ?? 50;
    this.maxRetries = config?.maxRetries ?? 3;
    this.retryDelayMs = config?.retryDelayMs ?? 1000;
    this.maxAgeMs = config?.maxAgeMs ?? 300000; // 5 minutes
  }

  /**
   * Queue a failed request for retry
   * Returns the queued request ID or null if queue is full
   */
  enqueue<T>(
    type: RequestType,
    payload: T,
    execute: () => Promise<unknown>
  ): string | null {
    // Don't queue if we're online - the request should be retried immediately
    if (this.networkStatus === 'online') {
      return null;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest request to make room
      this.queue.shift();
    }

    const request: QueuedRequest<T> = {
      id: this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      execute,
    };

    this.queue.push(request);
    this.onRequestQueued?.(request);

    return request.id;
  }

  /**
   * Set network status and trigger retry if coming back online
   */
  setNetworkStatus(status: NetworkStatus): void {
    const wasOffline = this.networkStatus === 'offline';
    this.networkStatus = status;
    this.onNetworkStatusChange?.(status);

    // If we just came back online, process the queue
    if (wasOffline && status === 'online') {
      this.processQueue();
    }
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.networkStatus !== 'online') {
      return;
    }

    this.isProcessing = true;

    try {
      // Remove expired requests first
      this.removeExpiredRequests();

      // Process each request
      while (this.queue.length > 0 && this.networkStatus === 'online') {
        const request = this.queue[0];
        
        try {
          await request.execute();
          // Success - remove from queue
          this.queue.shift();
          this.onRequestRetried?.(request, true);
        } catch (error) {
          request.retryCount++;
          
          if (request.retryCount >= request.maxRetries) {
            // Max retries exceeded - remove from queue
            this.queue.shift();
            this.onRequestRetried?.(request, false);
          } else {
            // Move to end of queue for later retry
            this.queue.shift();
            this.queue.push(request);
            
            // Wait before next retry
            await this.delay(this.retryDelayMs * request.retryCount);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get number of queued requests
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get all queued requests (for debugging/testing)
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Get queued requests by type
   */
  getQueuedByType(type: RequestType): QueuedRequest[] {
    return this.queue.filter(r => r.type === type);
  }

  /**
   * Remove a specific request from the queue
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex(r => r.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Check if queue has requests
   */
  hasRequests(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  private generateId(): string {
    return `req-${Date.now()}-${++this.idCounter}`;
  }

  private removeExpiredRequests(): void {
    const now = Date.now();
    this.queue = this.queue.filter(r => now - r.timestamp < this.maxAgeMs);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let defaultRetryQueue: NetworkRetryQueue | null = null;

export function getNetworkRetryQueue(): NetworkRetryQueue {
  if (!defaultRetryQueue) {
    defaultRetryQueue = new NetworkRetryQueue();
  }
  return defaultRetryQueue;
}
