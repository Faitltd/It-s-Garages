import { db } from '../config/database';

export interface ValidationGameSession {
  sessionId: string;
  userId: number;
  dataEntryId: number;
  address: string;
  imageUrl: string;
  correctAnswer: {
    garage_door_count: number;
    garage_door_width: number;
    garage_door_height: number;
    garage_door_type: string;
  };
  startTime: Date;
  timeLimit: number;
  questionsAnswered: number;
  totalScore: number;
  currentQuestionStartTime: Date;
}

export interface GameGuess {
  garage_door_count: number;
  garage_door_width: number;
  garage_door_height: number;
  garage_door_type: string;
  confidence: number;
  skipped?: boolean;
}

export interface ValidationResult {
  correct: boolean;
  accuracy: number;
  pointsEarned: number;
  correctAnswer: any;
  feedback: string;
  breakdown: {
    countAccuracy: number;
    sizeAccuracy: number;
    typeAccuracy: number;
    overallAccuracy: number;
  };
}

// In-memory storage for active sessions (use Redis in production)
const activeSessions = new Map<string, ValidationGameSession>();

/**
 * Start a new validation game session using confirmed data
 */
export const startValidationGame = async (userId: number): Promise<ValidationGameSession | null> => {
  try {
    // Get a random verified data entry
    const dataEntry = await getRandomVerifiedEntry();
    if (!dataEntry) {
      return null;
    }

    // Create session
    const sessionId = require('crypto').randomUUID();
    // Check if the stored Street View URL is valid, use fallback if not
    let imageUrl = dataEntry.street_view_url || '';

    // If the URL contains Google Street View API, test if it works
    if (imageUrl.includes('maps.googleapis.com/maps/api/streetview')) {
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
          // Use placeholder if Google API returns error
          imageUrl = 'https://via.placeholder.com/640x640/cccccc/666666?text=Street+View+Unavailable';
        }
      } catch (error) {
        // Use placeholder if fetch fails
        imageUrl = 'https://via.placeholder.com/640x640/cccccc/666666?text=Street+View+Unavailable';
      }
    }

    const session: ValidationGameSession = {
      sessionId,
      userId,
      dataEntryId: dataEntry.id,
      address: dataEntry.address,
      imageUrl,
      correctAnswer: {
        garage_door_count: dataEntry.garage_door_count,
        garage_door_width: dataEntry.garage_door_width,
        garage_door_height: dataEntry.garage_door_height,
        garage_door_type: dataEntry.garage_door_type
      },
      startTime: new Date(),
      timeLimit: 60, // 60 seconds
      questionsAnswered: 0,
      totalScore: 0,
      currentQuestionStartTime: new Date()
    };

    // Store session
    activeSessions.set(sessionId, session);

    return session;
  } catch (error) {
    console.error('Error starting validation game:', error);
    return null;
  }
};

/**
 * Submit a guess for validation
 */
export const submitValidationGuess = async (
  sessionId: string,
  guess: GameGuess,
  userId: number
): Promise<ValidationResult | null> => {
  try {
    const session = activeSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    // Handle skipped questions
    if (guess.skipped) {
      const result: ValidationResult = {
        correct: false,
        accuracy: 0,
        pointsEarned: 0,
        correctAnswer: session.correctAnswer,
        feedback: 'Question skipped. No points awarded, but no penalty either!',
        breakdown: {
          countAccuracy: 0,
          sizeAccuracy: 0,
          typeAccuracy: 0,
          overallAccuracy: 0
        }
      };

      // Save skipped result
      await saveValidationGameResult(session, guess, result);

      // Don't update user stats for skipped questions
      activeSessions.delete(sessionId);
      return result;
    }

    // Calculate accuracy for each component
    const countAccuracy = guess.garage_door_count === session.correctAnswer.garage_door_count ? 1.0 : 0.0;
    
    // Size accuracy - allow some tolerance
    const widthDiff = Math.abs(guess.garage_door_width - session.correctAnswer.garage_door_width);
    const heightDiff = Math.abs(guess.garage_door_height - session.correctAnswer.garage_door_height);
    const widthAccuracy = Math.max(0, 1 - (widthDiff / session.correctAnswer.garage_door_width));
    const heightAccuracy = Math.max(0, 1 - (heightDiff / session.correctAnswer.garage_door_height));
    const sizeAccuracy = (widthAccuracy + heightAccuracy) / 2;
    
    const typeAccuracy = guess.garage_door_type === session.correctAnswer.garage_door_type ? 1.0 : 0.0;

    // Overall accuracy (weighted)
    const overallAccuracy = (countAccuracy * 0.4 + sizeAccuracy * 0.4 + typeAccuracy * 0.2);
    
    // Calculate points based on accuracy and confidence
    const basePoints = Math.floor(overallAccuracy * 100);
    const confidenceBonus = Math.floor(basePoints * (guess.confidence / 100) * 0.2);
    const pointsEarned = basePoints + confidenceBonus;

    // Generate feedback
    let feedback = '';
    if (overallAccuracy >= 0.9) {
      feedback = 'Excellent! Your measurements are very accurate!';
    } else if (overallAccuracy >= 0.7) {
      feedback = 'Good job! You got most details right.';
    } else if (overallAccuracy >= 0.5) {
      feedback = 'Not bad, but there\'s room for improvement.';
    } else {
      feedback = 'Keep practicing! Try to look more carefully at the details.';
    }

    const result: ValidationResult = {
      correct: overallAccuracy >= 0.8,
      accuracy: overallAccuracy,
      pointsEarned,
      correctAnswer: session.correctAnswer,
      feedback,
      breakdown: {
        countAccuracy,
        sizeAccuracy,
        typeAccuracy,
        overallAccuracy
      }
    };

    // Save game result
    await saveValidationGameResult(session, guess, result);

    // Update user stats
    await updateUserValidationStats(userId, pointsEarned, overallAccuracy);

    // Update session for next question
    session.questionsAnswered++;
    session.totalScore += pointsEarned;

    // Keep session active for next question (don't delete)
    activeSessions.set(sessionId, session);

    return result;
  } catch (error) {
    console.error('Error submitting validation guess:', error);
    return null;
  }
};

/**
 * Get a random verified data entry for the game
 */
const getRandomVerifiedEntry = async (excludeId?: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    const whereClause = excludeId
      ? `WHERE is_verified = 1 AND street_view_url IS NOT NULL AND street_view_url != '' AND id != ?`
      : `WHERE is_verified = 1 AND street_view_url IS NOT NULL AND street_view_url != ''`;

    const stmt = db.prepare(`
      SELECT * FROM garage_door_data_entries
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT 1
    `);

    const params = excludeId ? [excludeId] : [];
    stmt.get(params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });

    stmt.finalize();
  });
};

/**
 * Get next question for an existing session
 */
export const getNextValidationQuestion = async (sessionId: string, userId: number): Promise<ValidationGameSession | null> => {
  try {
    const session = activeSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    // Get a new random verified data entry (different from current one)
    const dataEntry = await getRandomVerifiedEntry(session.dataEntryId);
    if (!dataEntry) {
      // No more questions available, end the session
      activeSessions.delete(sessionId);
      return null;
    }

    // Check if the stored Street View URL is valid, use fallback if not
    let imageUrl = dataEntry.street_view_url || '';

    if (imageUrl.includes('maps.googleapis.com/maps/api/streetview')) {
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
          imageUrl = 'https://via.placeholder.com/640x640/cccccc/666666?text=Street+View+Unavailable';
        }
      } catch (error) {
        imageUrl = 'https://via.placeholder.com/640x640/cccccc/666666?text=Street+View+Unavailable';
      }
    }

    // Update session with new question
    session.dataEntryId = dataEntry.id;
    session.address = dataEntry.address;
    session.imageUrl = imageUrl;
    session.correctAnswer = {
      garage_door_count: dataEntry.garage_door_count,
      garage_door_width: dataEntry.garage_door_width,
      garage_door_height: dataEntry.garage_door_height,
      garage_door_type: dataEntry.garage_door_type
    };
    session.currentQuestionStartTime = new Date();

    activeSessions.set(sessionId, session);
    return session;
  } catch (error) {
    console.error('Error getting next validation question:', error);
    return null;
  }
};

/**
 * End a validation game session
 */
export const endValidationGameSession = (sessionId: string, userId: number): boolean => {
  const session = activeSessions.get(sessionId);
  if (session && session.userId === userId) {
    activeSessions.delete(sessionId);
    return true;
  }
  return false;
};

/**
 * Save validation game result
 */
const saveValidationGameResult = async (
  session: ValidationGameSession,
  guess: GameGuess,
  result: ValidationResult
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO validation_game_results (
        user_id, data_entry_id, session_id,
        guess_door_count, guess_door_width, guess_door_height, guess_door_type,
        confidence_level, accuracy_score, points_earned, is_correct,
        time_taken, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const timeTaken = (new Date().getTime() - session.startTime.getTime()) / 1000;

    stmt.run([
      session.userId,
      session.dataEntryId,
      session.sessionId,
      guess.garage_door_count || 0,
      guess.garage_door_width || 0,
      guess.garage_door_height || 0,
      guess.garage_door_type || 'unknown',
      guess.confidence || 0,
      result.accuracy,
      result.pointsEarned,
      result.correct ? 1 : 0,
      timeTaken
    ], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });

    stmt.finalize();
  });
};

/**
 * Update user validation statistics
 */
const updateUserValidationStats = async (userId: number, points: number, accuracy: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    // First, get current stats
    const getStatsStmt = db.prepare(`
      SELECT validation_games_played, validation_accuracy_rate, total_points 
      FROM users WHERE id = ?
    `);

    getStatsStmt.get([userId], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }

      const currentGames = row?.validation_games_played || 0;
      const currentAccuracy = row?.validation_accuracy_rate || 0;
      const currentPoints = row?.total_points || 0;

      // Calculate new averages
      const newGames = currentGames + 1;
      const newAccuracy = ((currentAccuracy * currentGames) + accuracy) / newGames;
      const newPoints = currentPoints + points;

      // Update user stats
      const updateStmt = db.prepare(`
        UPDATE users 
        SET validation_games_played = ?, 
            validation_accuracy_rate = ?, 
            total_points = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run([newGames, newAccuracy, newPoints, userId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });

      updateStmt.finalize();
    });

    getStatsStmt.finalize();
  });
};

/**
 * Get validation game statistics
 */
export const getValidationStats = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        COUNT(*) as total_games,
        AVG(accuracy_score) as avg_accuracy,
        COUNT(DISTINCT user_id) as unique_players,
        COUNT(CASE WHEN is_correct = 1 THEN 1 END) as correct_guesses,
        AVG(time_taken) as avg_time_taken
      FROM validation_game_results
    `;

    db.get(query, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Get user's validation game history
 */
export const getUserValidationHistory = async (userId: number, limit: number = 10): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT 
        vgr.*,
        gde.address,
        gde.door_size as correct_door_size
      FROM validation_game_results vgr
      JOIN garage_door_data_entries gde ON vgr.data_entry_id = gde.id
      WHERE vgr.user_id = ?
      ORDER BY vgr.created_at DESC
      LIMIT ?
    `);

    stmt.all([userId, limit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });

    stmt.finalize();
  });
};
