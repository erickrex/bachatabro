/**
 * Database Service
 * Local SQLite database for storing scores and game data
 */

import * as SQLite from 'expo-sqlite';

export interface Score {
  id?: number;
  songId: string;
  score: number;
  playerName: string;
  playedAt: string;
}

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync('bachatrainer.db');
    
    // Create scores table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id TEXT NOT NULL,
        score REAL NOT NULL,
        player_name TEXT DEFAULT 'Player',
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_song_score 
      ON scores(song_id, score DESC);
      
      CREATE INDEX IF NOT EXISTS idx_played_at 
      ON scores(played_at DESC);
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Save a score to the database
 */
export async function saveScore(
  songId: string,
  score: number,
  playerName: string = 'Player'
): Promise<number> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.runAsync(
      'INSERT INTO scores (song_id, score, player_name) VALUES (?, ?, ?)',
      [songId, score, playerName]
    );
    
    console.log(`Score saved: ${score} for ${songId}`);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Failed to save score:', error);
    throw error;
  }
}

/**
 * Get leaderboard (top scores)
 */
export async function getLeaderboard(
  songId?: string,
  limit: number = 10
): Promise<Score[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    let query: string;
    let params: any[];
    
    if (songId) {
      query = `
        SELECT id, song_id as songId, score, player_name as playerName, 
               played_at as playedAt
        FROM scores 
        WHERE song_id = ? 
        ORDER BY score DESC, played_at DESC 
        LIMIT ?
      `;
      params = [songId, limit];
    } else {
      query = `
        SELECT id, song_id as songId, score, player_name as playerName, 
               played_at as playedAt
        FROM scores 
        ORDER BY score DESC, played_at DESC 
        LIMIT ?
      `;
      params = [limit];
    }
    
    const scores = await db.getAllAsync<Score>(query, params);
    return scores;
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    throw error;
  }
}

/**
 * Get all scores for a specific song
 */
export async function getScoresBySong(songId: string): Promise<Score[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const scores = await db.getAllAsync<Score>(
      `SELECT id, song_id as songId, score, player_name as playerName, 
              played_at as playedAt
       FROM scores 
       WHERE song_id = ? 
       ORDER BY played_at DESC`,
      [songId]
    );
    
    return scores;
  } catch (error) {
    console.error('Failed to get scores by song:', error);
    throw error;
  }
}

/**
 * Get user's best score for a song
 */
export async function getBestScore(
  songId: string,
  playerName: string = 'Player'
): Promise<Score | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const score = await db.getFirstAsync<Score>(
      `SELECT id, song_id as songId, score, player_name as playerName, 
              played_at as playedAt
       FROM scores 
       WHERE song_id = ? AND player_name = ? 
       ORDER BY score DESC 
       LIMIT 1`,
      [songId, playerName]
    );
    
    return score || null;
  } catch (error) {
    console.error('Failed to get best score:', error);
    throw error;
  }
}

/**
 * Get recent scores
 */
export async function getRecentScores(limit: number = 10): Promise<Score[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const scores = await db.getAllAsync<Score>(
      `SELECT id, song_id as songId, score, player_name as playerName, 
              played_at as playedAt
       FROM scores 
       ORDER BY played_at DESC 
       LIMIT ?`,
      [limit]
    );
    
    return scores;
  } catch (error) {
    console.error('Failed to get recent scores:', error);
    throw error;
  }
}

/**
 * Delete a score
 */
export async function deleteScore(id: number): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync('DELETE FROM scores WHERE id = ?', [id]);
    console.log(`Score ${id} deleted`);
  } catch (error) {
    console.error('Failed to delete score:', error);
    throw error;
  }
}

/**
 * Clear all scores (for testing)
 */
export async function clearAllScores(): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync('DELETE FROM scores');
    console.log('All scores cleared');
  } catch (error) {
    console.error('Failed to clear scores:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalScores: number;
  totalSongs: number;
  averageScore: number;
}> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getFirstAsync<{
      totalScores: number;
      totalSongs: number;
      averageScore: number;
    }>(`
      SELECT 
        COUNT(*) as totalScores,
        COUNT(DISTINCT song_id) as totalSongs,
        AVG(score) as averageScore
      FROM scores
    `);
    
    return result || { totalScores: 0, totalSongs: 0, averageScore: 0 };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    throw error;
  }
}

/**
 * Reset database (for testing only)
 * @internal
 */
export function __resetDatabase(): void {
  db = null;
}
