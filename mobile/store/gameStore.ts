/**
 * Game State Management with Zustand
 * 
 * Properties validated:
 * - P-018: Maintain game state across components
 * - P-019: Persist state to local storage
 * - P-020: Handle state updates atomically
 * - P-021: Provide type-safe state access
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, FrameScore, PoseData } from '@/types/game';
import { TRACKED_JOINTS } from '@/services/scoreCalculator';

interface GameState {
  // State
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'finished';
  currentSong: Song | null;
  currentFrame: number;
  frameScores: FrameScore[];
  finalScore: number | null;
  poseData: PoseData | null;
  error: string | null;
  
  // Actions
  startGame: (song: Song) => void;
  setLoading: () => void;
  setReady: (poseData: PoseData) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  addFrameScore: (frameScore: FrameScore) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const JOINTS_PER_FRAME = TRACKED_JOINTS.length;

const initialState = {
  status: 'idle' as const,
  currentSong: null,
  currentFrame: 0,
  frameScores: [],
  finalScore: null,
  poseData: null,
  error: null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      startGame: (song: Song) => set({ 
        status: 'loading',
        currentSong: song,
        frameScores: [],
        currentFrame: 0,
        finalScore: null,
        error: null,
      }),
      
      setLoading: () => set({ status: 'loading' }),
      
      setReady: (poseData: PoseData) => set({ 
        status: 'ready',
        poseData,
      }),
      
      pauseGame: () => {
        const { status } = get();
        if (status === 'playing') {
          set({ status: 'paused' });
        }
      },
      
      resumeGame: () => {
        const { status } = get();
        if (status === 'paused') {
          set({ status: 'playing' });
        }
      },
      
      endGame: () => set((state) => {
        const scores = state.frameScores.map(fs => fs.score);
        const finalScore = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

        const coverage = state.frameScores.reduce(
          (acc, frame) => {
            const attempted =
              frame.attemptedJoints ??
              Object.keys(frame.matches || {}).length;
            const skipped =
              frame.skippedJoints ??
              Math.max(JOINTS_PER_FRAME - attempted, 0);

            acc.attempted += attempted;
            acc.skipped += skipped;
            return acc;
          },
          { attempted: 0, skipped: 0 }
        );

        const totalComparisons = coverage.attempted + coverage.skipped;
        if (totalComparisons > 0) {
          const skippedFraction = coverage.skipped / totalComparisons;
          console.info('[PoseScore] Session joint coverage', {
            frames: state.frameScores.length,
            attemptedJoints: coverage.attempted,
            skippedJoints: coverage.skipped,
            skipFraction: Number(skippedFraction.toFixed(3)),
          });
        }
        
        return {
          status: 'finished',
          finalScore,
        };
      }),
      
      addFrameScore: (frameScore: FrameScore) => set((state) => ({
        frameScores: [...state.frameScores, frameScore],
        currentFrame: state.currentFrame + 1,
      })),
      
      setError: (error: string) => set({ 
        status: 'idle',
        error,
      }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'game-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        finalScore: state.finalScore,
        currentSong: state.currentSong,
      }),
    }
  )
);

// Selectors for optimized re-renders
export const useGameStatus = () => useGameStore((state) => state.status);
export const useCurrentSong = () => useGameStore((state) => state.currentSong);
export const useCurrentScore = () => useGameStore((state) => {
  const scores = state.frameScores.map(fs => fs.score);
  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
});
export const useFinalScore = () => useGameStore((state) => state.finalScore);
