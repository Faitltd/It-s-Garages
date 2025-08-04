import { db } from '../config/database';

export interface LeaderboardEntry {
  id: number;
  username: string;
  total_points: number;
  games_played: number;
  accuracy_rate: number;
  rank: number;
  questions_answered: number;
  question_accuracy: number;
  recent_activity?: string;
  achievements_count?: number;
}

export interface LeaderboardStats {
  totalPlayers: number;
  totalGames: number;
  totalQuestions: number;
  averageAccuracy: number;
}

/**
 * Get global leaderboard with pagination
 */
export const getGlobalLeaderboard = async (
  page: number = 1,
  limit: number = 10
): Promise<{ entries: LeaderboardEntry[]; stats: LeaderboardStats; pagination: any }> => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    // Get leaderboard entries
    const leaderboardQuery = `
      SELECT 
        u.id,
        u.username,
        u.total_points,
        u.games_played,
        u.accuracy_rate,
        RANK() OVER (ORDER BY u.total_points DESC) as rank,
        COUNT(qgr.id) as questions_answered,
        COALESCE(AVG(CASE WHEN qgr.is_correct THEN 1.0 ELSE 0.0 END), 0) as question_accuracy,
        MAX(qgr.created_at) as recent_activity,
        COUNT(DISTINCT ua.id) as achievements_count
      FROM users u
      LEFT JOIN question_game_results qgr ON u.id = qgr.user_id
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      WHERE u.total_points > 0
      GROUP BY u.id, u.username, u.total_points, u.games_played, u.accuracy_rate
      ORDER BY u.total_points DESC, u.games_played DESC
      LIMIT ? OFFSET ?
    `;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE total_points > 0
    `;

    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as totalPlayers,
        SUM(u.games_played) as totalGames,
        COUNT(qgr.id) as totalQuestions,
        AVG(u.accuracy_rate) as averageAccuracy
      FROM users u
      LEFT JOIN question_game_results qgr ON u.id = qgr.user_id
      WHERE u.total_points > 0
    `;

    // Execute all queries
    db.get(countQuery, (err, countRow: any) => {
      if (err) {
        reject(err);
        return;
      }

      const total = countRow.total;

      db.get(statsQuery, (err, statsRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        const stats: LeaderboardStats = {
          totalPlayers: statsRow.totalPlayers || 0,
          totalGames: statsRow.totalGames || 0,
          totalQuestions: statsRow.totalQuestions || 0,
          averageAccuracy: statsRow.averageAccuracy || 0
        };

        db.all(leaderboardQuery, [limit, offset], (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const entries: LeaderboardEntry[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            total_points: row.total_points,
            games_played: row.games_played,
            accuracy_rate: row.accuracy_rate,
            rank: row.rank,
            questions_answered: row.questions_answered,
            question_accuracy: row.question_accuracy,
            recent_activity: row.recent_activity,
            achievements_count: row.achievements_count
          }));

          resolve({
            entries,
            stats,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit)
            }
          });
        });
      });
    });
  });
};

/**
 * Get user's rank and position
 */
export const getUserRank = async (userId: number): Promise<{ rank: number; totalPlayers: number } | null> => {
  return new Promise((resolve, reject) => {
    const query = `
      WITH ranked_users AS (
        SELECT 
          id,
          total_points,
          RANK() OVER (ORDER BY total_points DESC) as rank
        FROM users
        WHERE total_points > 0
      )
      SELECT 
        ru.rank,
        (SELECT COUNT(*) FROM users WHERE total_points > 0) as totalPlayers
      FROM ranked_users ru
      WHERE ru.id = ?
    `;

    db.get(query, [userId], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        resolve(null);
        return;
      }

      resolve({
        rank: row.rank,
        totalPlayers: row.totalPlayers
      });
    });
  });
};

/**
 * Get top performers by category
 */
export const getTopPerformers = async (): Promise<{
  topPoints: LeaderboardEntry[];
  topAccuracy: LeaderboardEntry[];
  mostActive: LeaderboardEntry[];
}> => {
  return new Promise((resolve, reject) => {
    const topPointsQuery = `
      SELECT u.*, RANK() OVER (ORDER BY u.total_points DESC) as rank
      FROM users u
      WHERE u.total_points > 0
      ORDER BY u.total_points DESC
      LIMIT 5
    `;

    const topAccuracyQuery = `
      SELECT 
        u.*,
        COALESCE(AVG(CASE WHEN qgr.is_correct THEN 1.0 ELSE 0.0 END), 0) as question_accuracy,
        RANK() OVER (ORDER BY u.accuracy_rate DESC) as rank
      FROM users u
      LEFT JOIN question_game_results qgr ON u.id = qgr.user_id
      WHERE u.games_played >= 5
      GROUP BY u.id
      ORDER BY u.accuracy_rate DESC
      LIMIT 5
    `;

    const mostActiveQuery = `
      SELECT u.*, RANK() OVER (ORDER BY u.games_played DESC) as rank
      FROM users u
      WHERE u.games_played > 0
      ORDER BY u.games_played DESC
      LIMIT 5
    `;

    // Execute all queries in parallel
    let results: {
      topPoints: LeaderboardEntry[];
      topAccuracy: LeaderboardEntry[];
      mostActive: LeaderboardEntry[];
    } = { topPoints: [], topAccuracy: [], mostActive: [] };
    let completed = 0;

    const checkComplete = () => {
      completed++;
      if (completed === 3) {
        resolve(results);
      }
    };

    db.all(topPointsQuery, (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      results.topPoints = rows.map(row => ({
        ...row,
        questions_answered: 0,
        question_accuracy: 0
      }));
      checkComplete();
    });

    db.all(topAccuracyQuery, (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      results.topAccuracy = rows.map(row => ({
        ...row,
        questions_answered: 0,
        question_accuracy: row.question_accuracy || 0
      }));
      checkComplete();
    });

    db.all(mostActiveQuery, (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      results.mostActive = rows.map(row => ({
        ...row,
        questions_answered: 0,
        question_accuracy: 0
      }));
      checkComplete();
    });
  });
};

/**
 * Get recent activity feed
 */
export const getRecentActivity = async (limit: number = 10): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        'game_result' as activity_type,
        u.username,
        qgr.points_earned,
        qgr.is_correct,
        qgr.difficulty,
        qgr.created_at,
        gq.address
      FROM question_game_results qgr
      JOIN users u ON qgr.user_id = u.id
      JOIN game_questions gq ON qgr.question_id = gq.id
      
      UNION ALL
      
      SELECT 
        'achievement' as activity_type,
        u.username,
        ua.points_awarded as points_earned,
        1 as is_correct,
        ua.achievement_type as difficulty,
        ua.earned_at as created_at,
        ua.achievement_name as address
      FROM user_achievements ua
      JOIN users u ON ua.user_id = u.id
      
      ORDER BY created_at DESC
      LIMIT ?
    `;

    db.all(query, [limit], (err, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};
