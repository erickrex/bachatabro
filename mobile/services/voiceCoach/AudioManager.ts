import { Audio } from 'expo-av';
import { BackgroundAudioProcessor, getBackgroundAudioProcessor } from './BackgroundAudioProcessor';

export type AudioPriority = 'low' | 'normal' | 'high';

export interface AudioClip {
  id: string;
  audio: string; // base64 encoded audio
  priority: AudioPriority;
  text: string; // for transcript display
}

export interface AudioManagerConfig {
  duckingVolume?: number; // Volume to reduce background music to (0-1)
  originalVolume?: number; // Original background music volume (0-1)
  useBackgroundProcessing?: boolean; // Enable background audio processing (Requirements 15.6)
}

export class AudioManager {
  private queue: AudioClip[] = [];
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentSound: Audio.Sound | null = null;
  private backgroundMusicSound: Audio.Sound | null = null;
  private originalMusicVolume: number = 1.0;
  private duckingVolume: number = 0.3;
  private useBackgroundProcessing: boolean = true;
  private backgroundProcessor: BackgroundAudioProcessor;
  
  // Event handlers
  public onPlaybackStart: ((clip: AudioClip) => void) | null = null;
  public onPlaybackEnd: ((clip: AudioClip) => void) | null = null;
  public onQueueChange: ((queue: AudioClip[]) => void) | null = null;

  constructor(config?: AudioManagerConfig) {
    if (config?.duckingVolume !== undefined) {
      this.duckingVolume = config.duckingVolume;
    }
    if (config?.originalVolume !== undefined) {
      this.originalMusicVolume = config.originalVolume;
    }
    if (config?.useBackgroundProcessing !== undefined) {
      this.useBackgroundProcessing = config.useBackgroundProcessing;
    }
    this.backgroundProcessor = getBackgroundAudioProcessor();
  }

  /**
   * Set the background music sound object for ducking
   */
  public setBackgroundMusic(sound: Audio.Sound | null): void {
    this.backgroundMusicSound = sound;
  }

  /**
   * Enqueue an audio clip for playback
   * High priority clips clear the queue of lower priority clips
   */
  public enqueue(clip: AudioClip, autoPlay: boolean = true): void {
    if (clip.priority === 'high') {
      // Clear all lower priority clips from queue
      this.queue = this.queue.filter(c => c.priority === 'high');
    }
    
    this.queue.push(clip);
    this.notifyQueueChange();
    
    // Start playing if not already playing (and autoPlay is enabled)
    if (autoPlay && !this.isPlaying) {
      this.play();
    }
  }

  /**
   * Clear all queued audio clips (does not stop currently playing audio)
   */
  public clearQueue(): void {
    this.queue = [];
    this.notifyQueueChange();
  }

  /**
   * Cancel currently playing audio and clear queue
   */
  public async cancelCurrent(): Promise<void> {
    if (this.currentSound) {
      await this.currentSound.stopAsync();
      await this.currentSound.unloadAsync();
      this.currentSound = null;
    }
    this.clearQueue();
    this.isPlaying = false;
    await this.restoreMusic();
  }

  /**
   * Start playing queued audio clips
   */
  public async play(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;

    while (this.queue.length > 0) {
      const clip = this.queue.shift()!;
      this.notifyQueueChange();

      // Skip playback if muted
      if (this.isMuted) {
        this.notifyPlaybackEnd(clip);
        continue;
      }

      try {
        // Duck background music before playing
        await this.duckMusic();

        // Notify playback start
        this.notifyPlaybackStart(clip);

        // Decode base64 audio and play
        await this.playClip(clip);

        // Notify playback end
        this.notifyPlaybackEnd(clip);

        // Restore background music after playing
        await this.restoreMusic();
      } catch (error) {
        console.error('[AudioManager] Error playing clip:', error);
        this.notifyPlaybackEnd(clip);
        await this.restoreMusic();
      }
    }

    this.isPlaying = false;
  }

  /**
   * Pause playback (not implemented - audio plays to completion)
   */
  public pause(): void {
    // Note: For simplicity, we don't support pausing mid-clip
    // Audio clips play to completion
    console.warn('[AudioManager] Pause not implemented - clips play to completion');
  }

  /**
   * Set muted state
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  /**
   * Get current muted state
   */
  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Get current queue length
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Peek at next clip in queue without removing it
   */
  public peekNext(): AudioClip | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Get current playing state
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Duck (reduce volume of) background music
   */
  private async duckMusic(): Promise<void> {
    if (!this.backgroundMusicSound) {
      return;
    }

    try {
      const status = await this.backgroundMusicSound.getStatusAsync();
      if (status.isLoaded && status.volume !== undefined) {
        this.originalMusicVolume = status.volume;
        await this.backgroundMusicSound.setVolumeAsync(this.duckingVolume);
      }
    } catch (error) {
      console.error('[AudioManager] Error ducking music:', error);
    }
  }

  /**
   * Restore background music to original volume
   */
  private async restoreMusic(): Promise<void> {
    if (!this.backgroundMusicSound) {
      return;
    }

    try {
      await this.backgroundMusicSound.setVolumeAsync(this.originalMusicVolume);
    } catch (error) {
      console.error('[AudioManager] Error restoring music:', error);
    }
  }

  /**
   * Play a single audio clip
   * Uses background processing to prepare audio without blocking UI (Requirements 15.6)
   */
  private async playClip(clip: AudioClip): Promise<void> {
    let audioUri: string;

    // Use background processing if enabled
    if (this.useBackgroundProcessing) {
      const prepared = await this.backgroundProcessor.prepareAudioForPlayback(
        clip.audio,
        { format: 'mp3', validate: true }
      );
      
      if (!prepared.isValid) {
        throw new Error('Invalid audio data');
      }
      
      audioUri = prepared.uri;
    } else {
      // Direct conversion without background processing
      audioUri = `data:audio/mp3;base64,${clip.audio}`;
    }

    // Create and play sound
    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: true }
    );

    this.currentSound = sound;

    // Wait for playback to complete
    return new Promise((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().then(() => {
            this.currentSound = null;
            resolve();
          }).catch(reject);
        } else if (!status.isLoaded && status.error) {
          reject(new Error(status.error));
        }
      });
    });
  }

  /**
   * Notify playback start event
   */
  private notifyPlaybackStart(clip: AudioClip): void {
    if (this.onPlaybackStart) {
      this.onPlaybackStart(clip);
    }
  }

  /**
   * Notify playback end event
   */
  private notifyPlaybackEnd(clip: AudioClip): void {
    if (this.onPlaybackEnd) {
      this.onPlaybackEnd(clip);
    }
  }

  /**
   * Notify queue change event
   */
  private notifyQueueChange(): void {
    if (this.onQueueChange) {
      this.onQueueChange([...this.queue]);
    }
  }

  /**
   * Enable or disable background audio processing
   */
  public setUseBackgroundProcessing(enabled: boolean): void {
    this.useBackgroundProcessing = enabled;
  }

  /**
   * Check if background processing is enabled
   */
  public isBackgroundProcessingEnabled(): boolean {
    return this.useBackgroundProcessing;
  }

  /**
   * Get the background processor instance
   */
  public getBackgroundProcessor(): BackgroundAudioProcessor {
    return this.backgroundProcessor;
  }
}
