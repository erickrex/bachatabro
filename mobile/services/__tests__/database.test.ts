/**
 * Tests for Database Service
 * Acceptance Criteria: AC-048 to AC-050
 */

import * as SQLite from 'expo-sqlite';
import {
  initDatabase,
  saveScore,
  getLeaderboard,
  getScoresBySong,
  getBestScore,
  getRecentScores,
  deleteScore,
  clearAllScores,
  getDatabaseStats,
} from '../database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('Database Service', () => {
  let mockDb: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    };

    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Initialization (AC-048)', () => {
    it('should initialize database successfully', async () => {
      await initDatabase();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('bachatrainer.db');
      expect(mockDb.execAsync).toHaveBeenCalled();
    });

    it('should create scores table', async () => {
      await initDatabase();

      const execCall = mockDb.execAsync.mock.calls[0][0];
      expect(execCall).toContain('CREATE TABLE IF NOT EXISTS scores');
      expect(execCall).toContain('song_id TEXT NOT NULL');
      expect(execCall).toContain('score REAL NOT NULL');
    });

    it('should create indexes', async () => {
      await initDatabase();

      const execCall = mockDb.execAsync.mock.calls[0][0];
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_song_score');
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_played_at');
    });

    it('should handle initialization errors', async () => {
      mockDb.execAsync.mockRejectedValue(new Error('Init failed'));

      await expect(initDatabase()).rejects.toThrow('Init failed');
    });
  });

  describe('Save Score (AC-049)', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should save score successfully', async () => {
      const songId = 'test-song';
      const score = 85;
      const playerName = 'TestPlayer';

      const id = await saveScore(songId, score, playerName);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO scores (song_id, score, player_name) VALUES (?, ?, ?)',
        [songId, score, playerName]
      );
      expect(id).toBe(1);
    });

    it('should use default player name', async () => {
      await saveScore('test-song', 85);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        ['test-song', 85, 'Player']
      );
    });

    it('should handle save errors', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Save failed'));

      await expect(saveScore('test-song', 85)).rejects.toThrow('Save failed');
    });

    it('should throw if database not initialized', async () => {
      // Reset database to uninitialized state
      const { __resetDatabase } = require('../database');
      __resetDatabase();

      await expect(saveScore('test-song', 85)).rejects.toThrow(
        'Database not initialized'
      );
      
      // Re-initialize for subsequent tests
      await initDatabase();
    });
  });

  describe('Get Leaderboard (AC-050)', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should get global leaderboard', async () => {
      const mockScores = [
        { id: 1, songId: 'song1', score: 95, playerName: 'Player1', playedAt: '2024-01-01' },
        { id: 2, songId: 'song2', score: 90, playerName: 'Player2', playedAt: '2024-01-02' },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockScores);

      const scores = await getLeaderboard();

      expect(mockDb.getAllAsync).toHaveBeenCalled();
      expect(scores).toEqual(mockScores);
    });

    it('should get leaderboard for specific song', async () => {
      const mockScores = [
        { id: 1, songId: 'test-song', score: 95, playerName: 'Player1', playedAt: '2024-01-01' },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockScores);

      const scores = await getLeaderboard('test-song');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE song_id = ?'),
        ['test-song', 10]
      );
      expect(scores).toEqual(mockScores);
    });

    it('should respect limit parameter', async () => {
      await getLeaderboard(undefined, 5);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [5]
      );
    });

    it('should handle empty leaderboard', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const scores = await getLeaderboard();

      expect(scores).toEqual([]);
    });
  });

  describe('Get Scores By Song', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should get all scores for a song', async () => {
      const mockScores = [
        { id: 1, songId: 'test-song', score: 95, playerName: 'Player1', playedAt: '2024-01-01' },
        { id: 2, songId: 'test-song', score: 85, playerName: 'Player1', playedAt: '2024-01-02' },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockScores);

      const scores = await getScoresBySong('test-song');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE song_id = ?'),
        ['test-song']
      );
      expect(scores).toEqual(mockScores);
    });
  });

  describe('Get Best Score', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should get best score for player', async () => {
      const mockScore = {
        id: 1,
        songId: 'test-song',
        score: 95,
        playerName: 'TestPlayer',
        playedAt: '2024-01-01',
      };

      mockDb.getFirstAsync.mockResolvedValue(mockScore);

      const score = await getBestScore('test-song', 'TestPlayer');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY score DESC'),
        ['test-song', 'TestPlayer']
      );
      expect(score).toEqual(mockScore);
    });

    it('should return null if no score found', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const score = await getBestScore('test-song', 'TestPlayer');

      expect(score).toBeNull();
    });
  });

  describe('Get Recent Scores', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should get recent scores', async () => {
      const mockScores = [
        { id: 2, songId: 'song2', score: 90, playerName: 'Player2', playedAt: '2024-01-02' },
        { id: 1, songId: 'song1', score: 95, playerName: 'Player1', playedAt: '2024-01-01' },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockScores);

      const scores = await getRecentScores(10);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY played_at DESC'),
        [10]
      );
      expect(scores).toEqual(mockScores);
    });
  });

  describe('Delete Score', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should delete score by id', async () => {
      await deleteScore(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM scores WHERE id = ?',
        [1]
      );
    });
  });

  describe('Clear All Scores', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should clear all scores', async () => {
      await clearAllScores();

      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM scores');
    });
  });

  describe('Get Database Stats', () => {
    beforeEach(async () => {
      await initDatabase();
    });

    it('should get database statistics', async () => {
      const mockStats = {
        totalScores: 10,
        totalSongs: 5,
        averageScore: 85.5,
      };

      mockDb.getFirstAsync.mockResolvedValue(mockStats);

      const stats = await getDatabaseStats();

      expect(mockDb.getFirstAsync).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    it('should handle empty database', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const stats = await getDatabaseStats();

      expect(stats).toEqual({
        totalScores: 0,
        totalSongs: 0,
        averageScore: 0,
      });
    });
  });
});
