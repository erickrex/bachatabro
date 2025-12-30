/**
 * Type definitions for the Bachata Bro game
 */

export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

export interface KeypointMap {
  nose?: Keypoint;
  leftEye?: Keypoint;
  rightEye?: Keypoint;
  leftEar?: Keypoint;
  rightEar?: Keypoint;
  leftShoulder?: Keypoint;
  rightShoulder?: Keypoint;
  leftElbow?: Keypoint;
  rightElbow?: Keypoint;
  leftWrist?: Keypoint;
  rightWrist?: Keypoint;
  leftHip?: Keypoint;
  rightHip?: Keypoint;
  leftKnee?: Keypoint;
  rightKnee?: Keypoint;
  leftAnkle?: Keypoint;
  rightAnkle?: Keypoint;
}

export interface Angles {
  leftArm: number;
  rightArm: number;
  leftElbow: number;
  rightElbow: number;
  leftThigh: number;
  rightThigh: number;
  leftLeg: number;
  rightLeg: number;
}

export interface PoseFrame {
  frameNumber: number;
  timestamp: number;
  keypoints: Record<string, Keypoint>;
  angles: Angles;
  angleConfidence?: Partial<Record<keyof Angles, number>>;
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

export interface Score {
  id?: number;
  songId: string;
  score: number;
  playerName: string;
  playedAt: string;
}

export interface FrameScore {
  score: number;
  matches: Partial<Record<keyof Angles, boolean>>;
  timestamp: number;
  attemptedJoints?: number;
  skippedJoints?: number;
  skippedJointsList?: (keyof Angles)[];
}

export interface SessionCoverage {
  attemptedJoints: number;
  skippedJoints: number;
  skipFraction: number;
  topSkippedJoints: (keyof Angles)[];
}

export interface GameState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'finished';
  currentSong: Song | null;
  currentFrame: number;
  frameScores: FrameScore[];
  finalScore: number | null;
  poseData: PoseData | null;
  sessionCoverage: SessionCoverage | null;
}

export type GameStatus = GameState['status'];
