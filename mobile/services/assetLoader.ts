/**
 * Asset Loader Service
 * Loads videos, audio, and pre-computed pose data
 */

import { Asset } from 'expo-asset';

export interface PoseFrame {
  frameNumber: number;
  timestamp: number;
  keypoints: Record<string, { x: number; y: number; confidence: number }>;
  angles: {
    leftArm: number;
    rightArm: number;
    leftElbow: number;
    rightElbow: number;
    leftThigh: number;
    rightThigh: number;
    leftLeg: number;
    rightLeg: number;
  };
}

export interface PoseData {
  songId: string;
  fps: number;
  totalFrames: number;
  frames: PoseFrame[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Available songs
export const SONGS: Song[] = [
  { id: 'howdeepisyourlove', title: 'How Deep Is Your Love', artist: 'Prince Royce', difficulty: 'medium' },
  { id: '30minutos', title: '30 Minutos', artist: 'Prince Royce', difficulty: 'medium' }
];

// Cache for loaded assets
const poseDataCache: Map<string, PoseData> = new Map();
const videoCache: Map<string, string> = new Map();
const audioCache: Map<string, string> = new Map();

/**
 * Load pose data for a song
 */
export async function loadPoseData(songId: string): Promise<PoseData> {
  // Check cache first
  if (poseDataCache.has(songId)) {
    return poseDataCache.get(songId)!;
  }

  try {
    // Load JSON file from assets
    // Note: The require path needs to be static for Metro bundler
    let poseData: PoseData;

    switch (songId) {
      case 'howdeepisyourlove':
        poseData = require('../assets/poses/howdeepisyourlove.json');
        break;
      case '30minutos':
        poseData = require('../assets/poses/30minutos.json');
        break;
      default:
        throw new Error(`Unknown song: ${songId}`);
    }

    // Cache the data
    poseDataCache.set(songId, poseData);

    console.log(`Loaded pose data for ${songId}: ${poseData.totalFrames} frames`);
    return poseData;
  } catch (error) {
    console.error(`Failed to load pose data for ${songId}:`, error);
    throw new Error(`Pose data not found for song: ${songId}`);
  }
}

/**
 * Load video asset for a song
 */
export async function loadVideo(songId: string): Promise<string> {
  // Check cache first
  if (videoCache.has(songId)) {
    return videoCache.get(songId)!;
  }

  try {
    let videoModule: number;

    switch (songId) {
      case 'howdeepisyourlove':
        videoModule = require('../assets/videos/howdeepisyourlove.mp4');
        break;
      case '30minutos':
        videoModule = require('../assets/videos/30minutos.mp4');
        break;
      default:
        throw new Error(`Unknown song: ${songId}`);
    }

    const asset = Asset.fromModule(videoModule);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load video asset');
    }

    // Cache the URI
    videoCache.set(songId, asset.localUri);

    console.log(`Loaded video for ${songId}`);
    return asset.localUri;
  } catch (error) {
    console.error(`Failed to load video for ${songId}:`, error);
    throw new Error(`Video not found for song: ${songId}`);
  }
}

/**
 * Load audio asset for a song
 */
export async function loadAudio(songId: string): Promise<string> {
  // Check cache first
  if (audioCache.has(songId)) {
    return audioCache.get(songId)!;
  }

  try {
    let audioModule: number;

    switch (songId) {
      case 'howdeepisyourlove':
        audioModule = require('../assets/audio/howdeepisyourlove.mp3');
        break;
      case '30minutos':
        audioModule = require('../assets/audio/30minutos.mp3');
        break;
      default:
        throw new Error(`Unknown song: ${songId}`);
    }

    const asset = Asset.fromModule(audioModule);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load audio asset');
    }

    // Cache the URI
    audioCache.set(songId, asset.localUri);

    console.log(`Loaded audio for ${songId}`);
    return asset.localUri;
  } catch (error) {
    console.error(`Failed to load audio for ${songId}:`, error);
    throw new Error(`Audio not found for song: ${songId}`);
  }
}

/**
 * Preload all assets for a song
 */
export async function preloadSongAssets(songId: string): Promise<void> {
  console.log(`Preloading assets for ${songId}...`);

  try {
    await Promise.all([
      loadPoseData(songId),
      loadVideo(songId),
      loadAudio(songId),
    ]);

    console.log(`All assets loaded for ${songId}`);
  } catch (error) {
    console.error(`Failed to preload assets for ${songId}:`, error);
    throw error;
  }
}

/**
 * Get song by ID
 */
export function getSongById(songId: string): Song | undefined {
  return SONGS.find((song) => song.id === songId);
}

/**
 * Get all available songs
 */
export function getAllSongs(): Song[] {
  return SONGS;
}

/**
 * Clear asset cache
 */
export function clearAssetCache(): void {
  poseDataCache.clear();
  videoCache.clear();
  audioCache.clear();
  console.log('Asset cache cleared');
}

/**
 * Get frame data for a specific timestamp
 */
export function getFrameAtTimestamp(
  poseData: PoseData,
  timestamp: number
): PoseFrame | null {
  // Find the closest frame to the timestamp
  const frameIndex = Math.round(timestamp * poseData.fps);

  if (frameIndex < 0 || frameIndex >= poseData.frames.length) {
    return null;
  }

  return poseData.frames[frameIndex];
}

/**
 * Get frame data by frame number
 */
export function getFrameByNumber(
  poseData: PoseData,
  frameNumber: number
): PoseFrame | null {
  if (frameNumber < 0 || frameNumber >= poseData.frames.length) {
    return null;
  }

  return poseData.frames[frameNumber];
}
