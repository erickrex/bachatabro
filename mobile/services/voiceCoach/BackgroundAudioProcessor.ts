/**
 * Background Audio Processor Service
 *
 * Processes audio operations in the background to ensure UI remains responsive.
 * Uses React Native's InteractionManager and async patterns to defer heavy work.
 *
 * Requirements: 15.6
 */

import { InteractionManager } from 'react-native';

export interface AudioTask {
  id: string;
  type: 'decode' | 'encode' | 'process';
  data: string; // base64 audio data
  priority: 'low' | 'normal' | 'high';
  callback?: (result: AudioTaskResult) => void;
}

export interface AudioTaskResult {
  id: string;
  success: boolean;
  data?: string;
  error?: string;
  processingTimeMs: number;
}

export interface BackgroundAudioProcessorConfig {
  maxConcurrentTasks?: number;
  taskTimeoutMs?: number;
}

type TaskResolver = (result: AudioTaskResult) => void;

export class BackgroundAudioProcessor {
  private taskQueue: AudioTask[] = [];
  private activeTasks: Map<string, { task: AudioTask; startTime: number }> = new Map();
  private maxConcurrentTasks: number;
  private taskTimeoutMs: number;
  private isProcessing: boolean = false;
  private pendingResolvers: Map<string, TaskResolver> = new Map();

  constructor(config: BackgroundAudioProcessorConfig = {}) {
    this.maxConcurrentTasks = config.maxConcurrentTasks ?? 2;
    this.taskTimeoutMs = config.taskTimeoutMs ?? 10000; // 10 seconds default
  }

  /**
   * Schedule an audio task for background processing
   * Returns a promise that resolves when the task completes
   */
  public async scheduleTask(task: AudioTask): Promise<AudioTaskResult> {
    return new Promise((resolve) => {
      // Store the resolver for this task
      this.pendingResolvers.set(task.id, resolve);

      // Add task to queue based on priority
      if (task.priority === 'high') {
        // High priority tasks go to the front
        this.taskQueue.unshift(task);
      } else {
        this.taskQueue.push(task);
      }

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Process audio data in the background
   * Defers execution to after interactions complete
   */
  public async processInBackground<T>(
    operation: () => Promise<T>,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<T> {
    // For high priority, execute immediately
    if (priority === 'high') {
      return operation();
    }

    // For normal/low priority, defer to after interactions
    return new Promise((resolve, reject) => {
      const handle = InteractionManager.runAfterInteractions(() => {
        operation().then(resolve).catch(reject);
      });

      // Set timeout for low priority tasks
      if (priority === 'low') {
        setTimeout(() => {
          handle.cancel();
          reject(new Error('Task timeout'));
        }, this.taskTimeoutMs);
      }
    });
  }

  /**
   * Decode base64 audio data in the background
   * Returns the decoded data URI
   */
  public async decodeAudioInBackground(
    base64Audio: string,
    format: string = 'mp3'
  ): Promise<string> {
    return this.processInBackground(async () => {
      // Create data URI from base64
      const dataUri = `data:audio/${format};base64,${base64Audio}`;
      return dataUri;
    }, 'normal');
  }

  /**
   * Prepare audio for playback in the background
   * This includes validation and format conversion if needed
   */
  public async prepareAudioForPlayback(
    base64Audio: string,
    options: { format?: string; validate?: boolean } = {}
  ): Promise<{ uri: string; isValid: boolean; sizeBytes: number }> {
    const format = options.format ?? 'mp3';
    const validate = options.validate ?? true;

    return this.processInBackground(async () => {
      const uri = `data:audio/${format};base64,${base64Audio}`;
      
      // Calculate approximate size
      const sizeBytes = Math.ceil((base64Audio.length * 3) / 4);

      // Basic validation
      let isValid = true;
      if (validate) {
        isValid = base64Audio.length > 0 && this.isValidBase64(base64Audio);
      }

      return { uri, isValid, sizeBytes };
    }, 'normal');
  }

  /**
   * Batch process multiple audio clips in the background
   */
  public async batchPrepareAudio(
    clips: Array<{ id: string; audio: string; format?: string }>
  ): Promise<Map<string, { uri: string; isValid: boolean }>> {
    const results = new Map<string, { uri: string; isValid: boolean }>();

    // Process in chunks to avoid blocking
    const chunkSize = 3;
    for (let i = 0; i < clips.length; i += chunkSize) {
      const chunk = clips.slice(i, i + chunkSize);
      
      // Process chunk in background
      await this.processInBackground(async () => {
        for (const clip of chunk) {
          const format = clip.format ?? 'mp3';
          const uri = `data:audio/${format};base64,${clip.audio}`;
          const isValid = clip.audio.length > 0 && this.isValidBase64(clip.audio);
          results.set(clip.id, { uri, isValid });
        }
      }, 'low');
    }

    return results;
  }

  /**
   * Cancel a pending task
   */
  public cancelTask(taskId: string): boolean {
    // Remove from queue if not yet started
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      
      // Resolve with cancelled result
      const resolver = this.pendingResolvers.get(taskId);
      if (resolver) {
        resolver({
          id: taskId,
          success: false,
          error: 'Task cancelled',
          processingTimeMs: 0,
        });
        this.pendingResolvers.delete(taskId);
      }
      
      return true;
    }

    return false;
  }

  /**
   * Cancel all pending tasks
   */
  public cancelAllTasks(): void {
    // Cancel all queued tasks
    for (const task of this.taskQueue) {
      const resolver = this.pendingResolvers.get(task.id);
      if (resolver) {
        resolver({
          id: task.id,
          success: false,
          error: 'Task cancelled',
          processingTimeMs: 0,
        });
        this.pendingResolvers.delete(task.id);
      }
    }
    this.taskQueue = [];
  }

  /**
   * Get the number of pending tasks
   */
  public getPendingTaskCount(): number {
    return this.taskQueue.length;
  }

  /**
   * Get the number of active tasks
   */
  public getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Check if the processor is currently processing tasks
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      if (!task) continue;

      // Track active task
      this.activeTasks.set(task.id, { task, startTime: Date.now() });

      // Process task in background
      this.processTask(task).finally(() => {
        this.activeTasks.delete(task.id);
      });
    }

    this.isProcessing = false;
  }

  /**
   * Process a single task
   */
  private async processTask(task: AudioTask): Promise<void> {
    const startTime = Date.now();
    let result: AudioTaskResult;

    try {
      // Defer to after interactions for non-high priority
      if (task.priority !== 'high') {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
      }

      // Process based on task type
      let processedData: string | undefined;
      
      switch (task.type) {
        case 'decode':
          processedData = `data:audio/mp3;base64,${task.data}`;
          break;
        case 'encode':
          // Encoding would convert raw audio to base64
          processedData = task.data; // Placeholder
          break;
        case 'process':
          // Generic processing
          processedData = task.data;
          break;
      }

      result = {
        id: task.id,
        success: true,
        data: processedData,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      result = {
        id: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Call task callback if provided
    if (task.callback) {
      task.callback(result);
    }

    // Resolve the promise
    const resolver = this.pendingResolvers.get(task.id);
    if (resolver) {
      resolver(result);
      this.pendingResolvers.delete(task.id);
    }

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Validate base64 string
   */
  private isValidBase64(str: string): boolean {
    if (!str || str.length === 0) {
      return false;
    }
    
    // Check for valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str);
  }
}

// Singleton instance
let backgroundAudioProcessorInstance: BackgroundAudioProcessor | null = null;

/**
 * Get the singleton BackgroundAudioProcessor instance
 */
export function getBackgroundAudioProcessor(
  config?: BackgroundAudioProcessorConfig
): BackgroundAudioProcessor {
  if (!backgroundAudioProcessorInstance) {
    backgroundAudioProcessorInstance = new BackgroundAudioProcessor(config);
  }
  return backgroundAudioProcessorInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetBackgroundAudioProcessor(): void {
  backgroundAudioProcessorInstance = null;
}
