/**
 * TensorFlow.js Pose Detection Service
 * Drop-in replacement for ExecuTorchService using TensorFlow.js MoveNet
 * 
 * This provides REAL on-device AI inference on Arm devices
 * Uses WebGL/GPU acceleration when available
 */

import { PoseResult } from '@/types/detection';

// Lazy imports to avoid bundling issues
let tf: typeof import('@tensorflow/tfjs') | null = null;
let poseDetection: typeof import('@tensorflow-models/pose-detection') | null = null;

export class TFJSPoseService {
  private detector: any = null;
  private modelLoaded = false;
  private inferenceTimes: number[] = [];
  private readonly MAX_INFERENCE_TIMES = 100;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize TensorFlow.js and load MoveNet model
   */
  async initialize(_modelPath?: string): Promise<void> {
    // Prevent multiple initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('Initializing TensorFlow.js...');

      // Dynamic imports
      tf = await import('@tensorflow/tfjs');
      await import('@tensorflow/tfjs-react-native');
      poseDetection = await import('@tensorflow-models/pose-detection');

      // Initialize TF.js backend
      await tf.ready();
      console.log('TensorFlow.js ready, backend:', tf.getBackend());

      // Load MoveNet SinglePose Lightning (fastest)
      console.log('Loading MoveNet model...');
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        }
      );

      this.modelLoaded = true;
      console.log('TensorFlow.js pose detector ready!');

    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      this.modelLoaded = false;
      throw new Error(`TensorFlow.js initialization failed: ${error}`);
    }
  }

  /**
   * Detect pose from base64 image data
   */
  async detectPose(imageData: string): Promise<PoseResult> {
    if (!this.modelLoaded || !this.detector) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    const startTime = performance.now();

    try {
      // Convert base64 to image tensor
      const imageTensor = await this.base64ToTensor(imageData);
      
      if (!imageTensor) {
        throw new Error('Failed to convert image to tensor');
      }

      // Run inference
      const poses = await this.detector.estimatePoses(imageTensor);
      
      // Dispose tensor to free memory
      if (tf && imageTensor.dispose) {
        imageTensor.dispose();
      }

      const inferenceTime = performance.now() - startTime;

      // Track inference times
      this.inferenceTimes.push(inferenceTime);
      if (this.inferenceTimes.length > this.MAX_INFERENCE_TIMES) {
        this.inferenceTimes.shift();
      }

      // Parse results
      if (poses.length === 0) {
        return {
          keypoints: this.createEmptyKeypoints(),
          inferenceTime,
          confidence: 0,
        };
      }

      const pose = poses[0];
      const keypoints = this.parseKeypoints(pose.keypoints);
      const confidence = this.calculateConfidence(pose.keypoints);

      return {
        keypoints,
        inferenceTime,
        confidence,
      };

    } catch (error) {
      console.error('TensorFlow.js inference failed:', error);
      throw new Error(`Pose detection failed: ${error}`);
    }
  }

  /**
   * Convert base64 image to TensorFlow tensor
   */
  private async base64ToTensor(base64Data: string): Promise<any> {
    if (!tf) return null;

    try {
      // Remove data URL prefix if present
      const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      
      // Decode base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode image using tf.node or browser APIs
      // For React Native, we need to use a different approach
      const { decodeJpeg } = await import('@tensorflow/tfjs-react-native');
      const imageTensor = decodeJpeg(bytes);
      
      return imageTensor;

    } catch (error) {
      console.error('Failed to convert base64 to tensor:', error);
      return null;
    }
  }

  /**
   * Parse TensorFlow.js keypoints to our format
   */
  private parseKeypoints(tfKeypoints: any[]): Array<{ x: number; y: number; confidence: number }> {
    if (!tfKeypoints || tfKeypoints.length === 0) {
      return this.createEmptyKeypoints();
    }

    return tfKeypoints.map((kp: any) => ({
      x: kp.x || 0,
      y: kp.y || 0,
      confidence: kp.score || 0,
    }));
  }

  /**
   * Create empty keypoints array (17 COCO keypoints)
   */
  private createEmptyKeypoints(): Array<{ x: number; y: number; confidence: number }> {
    return Array(17).fill(null).map(() => ({
      x: 0,
      y: 0,
      confidence: 0,
    }));
  }

  /**
   * Calculate overall confidence from keypoints
   */
  private calculateConfidence(keypoints: any[]): number {
    if (!keypoints || keypoints.length === 0) {
      return 0;
    }

    const scores = keypoints.map((kp: any) => kp.score || 0);
    return scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  }

  /**
   * Get average FPS from recent inferences
   */
  getAverageFPS(): number {
    if (this.inferenceTimes.length === 0) {
      return 0;
    }

    const avgTime = this.inferenceTimes.reduce((a, b) => a + b, 0) / this.inferenceTimes.length;
    return 1000 / avgTime;
  }

  /**
   * Get average inference latency in milliseconds
   */
  getAverageLatency(): number {
    if (this.inferenceTimes.length === 0) {
      return 0;
    }

    return this.inferenceTimes.reduce((a, b) => a + b, 0) / this.inferenceTimes.length;
  }

  /**
   * Get latency percentiles
   */
  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    if (this.inferenceTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.inferenceTimes].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.inferenceTimes = [];
  }

  /**
   * Dispose of the detector
   */
  async dispose(): Promise<void> {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    this.modelLoaded = false;
  }
}
