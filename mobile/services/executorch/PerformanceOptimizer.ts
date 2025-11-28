/**
 * Performance Optimizer
 * 
 * Optimizes real-time pose detection performance through:
 * - Adaptive frame rate
 * - Memory management
 * - Tensor reuse
 * - Cache optimization
 */

export interface PerformanceConfig {
  targetFPS: number;
  minFPS: number;
  maxFPS: number;
  adaptiveFrameRate: boolean;
  memoryLimit: number; // MB
}

export interface PerformanceStats {
  currentFPS: number;
  averageLatency: number;
  memoryUsage: number;
  droppedFrames: number;
  totalFrames: number;
}

export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private frameTimestamps: number[] = [];
  private latencies: number[] = [];
  private droppedFrames = 0;
  private totalFrames = 0;
  private lastFrameTime = 0;
  private tensorCache: Map<string, any> = new Map();

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      targetFPS: 15,
      minFPS: 10,
      maxFPS: 30,
      adaptiveFrameRate: true,
      memoryLimit: 100,
      ...config,
    };
  }

  /**
   * Determine if current frame should be processed
   * based on adaptive frame rate logic
   */
  shouldProcessFrame(): boolean {
    const now = Date.now();

    // Always process first frame
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return true;
    }

    // Calculate time since last frame
    const timeSinceLastFrame = now - this.lastFrameTime;
    const minFrameInterval = 1000 / this.config.maxFPS;

    // Don't process if too soon
    if (timeSinceLastFrame < minFrameInterval) {
      this.droppedFrames++;
      return false;
    }

    // If not using adaptive frame rate, process every frame (within max FPS)
    if (!this.config.adaptiveFrameRate) {
      this.lastFrameTime = now;
      return true;
    }

    // Adaptive logic: adjust based on current performance
    const currentFPS = this.getCurrentFPS();

    if (currentFPS < this.config.minFPS) {
      // Performance is poor, skip more frames
      const skipProbability = 1 - (currentFPS / this.config.minFPS);
      if (Math.random() < skipProbability) {
        this.droppedFrames++;
        return false;
      }
    } else if (currentFPS > this.config.targetFPS) {
      // Performance is good, can process more frames
      this.lastFrameTime = now;
      return true;
    }

    // Default: process frame
    this.lastFrameTime = now;
    return true;
  }

  /**
   * Record frame processing time
   */
  recordFrameProcessed(latency: number): void {
    const now = Date.now();
    this.frameTimestamps.push(now);
    this.latencies.push(latency);
    this.totalFrames++;

    // Keep only last 30 frames for FPS calculation
    if (this.frameTimestamps.length > 30) {
      this.frameTimestamps.shift();
    }

    // Keep only last 100 latencies
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
  }

  /**
   * Get current FPS based on recent frames
   */
  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) {
      return 0;
    }

    const duration = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    const frameCount = this.frameTimestamps.length - 1;

    return (frameCount / duration) * 1000;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    if (this.latencies.length === 0) {
      return 0;
    }

    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    return {
      currentFPS: this.getCurrentFPS(),
      averageLatency: this.getAverageLatency(),
      memoryUsage: this.getMemoryUsage(),
      droppedFrames: this.droppedFrames,
      totalFrames: this.totalFrames,
    };
  }

  /**
   * Optimize memory by clearing caches
   */
  optimizeMemory(): void {
    // Clear tensor cache
    this.tensorCache.clear();

    // Trim history
    if (this.frameTimestamps.length > 30) {
      this.frameTimestamps = this.frameTimestamps.slice(-30);
    }

    if (this.latencies.length > 100) {
      this.latencies = this.latencies.slice(-100);
    }

    // Suggest garbage collection (if available)
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get cached tensor or create new one
   */
  getTensor(key: string, factory: () => any): any {
    if (this.tensorCache.has(key)) {
      return this.tensorCache.get(key);
    }

    const tensor = factory();
    this.tensorCache.set(key, tensor);

    // Limit cache size
    if (this.tensorCache.size > 10) {
      const firstKey = this.tensorCache.keys().next().value;
      this.tensorCache.delete(firstKey);
    }

    return tensor;
  }

  /**
   * Check if memory usage is within limits
   */
  isMemoryWithinLimits(): boolean {
    const usage = this.getMemoryUsage();
    return usage < this.config.memoryLimit;
  }

  /**
   * Get current memory usage (approximate)
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Adjust target FPS based on performance
   */
  adjustTargetFPS(newTarget: number): void {
    this.config.targetFPS = Math.max(
      this.config.minFPS,
      Math.min(this.config.maxFPS, newTarget)
    );
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.frameTimestamps = [];
    this.latencies = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
    this.lastFrameTime = 0;
    this.tensorCache.clear();
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    if (stats.currentFPS < this.config.minFPS) {
      recommendations.push('FPS below minimum - consider reducing resolution or switching to pre-computed mode');
    }

    if (stats.averageLatency > 100) {
      recommendations.push('High latency detected - optimize preprocessing or use hardware acceleration');
    }

    if (stats.memoryUsage > this.config.memoryLimit * 0.8) {
      recommendations.push('Memory usage high - clear caches or reduce batch size');
    }

    const dropRate = stats.droppedFrames / Math.max(stats.totalFrames, 1);
    if (dropRate > 0.3) {
      recommendations.push('High frame drop rate - reduce target FPS or optimize processing');
    }

    return recommendations;
  }
}
