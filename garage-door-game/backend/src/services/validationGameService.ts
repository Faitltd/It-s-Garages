import { db } from '../config/database';
import { getRandomCentennialAddress, getRandomCentennialAddressExcluding, getCentennialAddressWithStreetView, markAddressAsNotVisible } from './centennialAddressService';

export interface ValidationGameSession {
  sessionId: string;
  userId: number;
  centennialAddressId: number;
  address: string;
  imageUrl: string;
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
  notVisible?: boolean;
}

export interface ValidationResult {
  submitted: boolean;
  pointsEarned: number;
  feedback: string;
  questionsAnswered: number;
  totalScore: number;
}

// In-memory storage for active sessions (use Redis in production)
const activeSessions = new Map<string, ValidationGameSession>();

/**
 * Start a new validation game session using confirmed data
 */
export const startValidationGame = async (userId: number): Promise<ValidationGameSession | null> => {
  try {
    // Get a random Centennial address with Street View
    const addressData = await getCentennialAddressWithStreetView();
    if (!addressData) {
      return null;
    }

    const { address, streetViewUrl } = addressData;

    // Create session
    const sessionId = require('crypto').randomUUID();

    // For addresses without known garage door data, we'll use default values
    // The user will provide the actual measurements
    const session: ValidationGameSession = {
      sessionId,
      userId,
      centennialAddressId: address.id,
      address: address.address,
      imageUrl: streetViewUrl,
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
        submitted: false,
        pointsEarned: 0,
        feedback: 'Question skipped. No points awarded.',
        questionsAnswered: session.questionsAnswered + 1,
        totalScore: session.totalScore
      };

      // Save skipped result
      await saveValidationGameResult(session, guess, result);

      // Update session for next question (don't delete session)
      session.questionsAnswered++;
      activeSessions.set(sessionId, session);

      return result;
    }

    // Handle "garage not visible" submissions
    if (guess.notVisible) {
      // Mark the address as not visible in the database
      await markAddressAsNotVisible(session.centennialAddressId);

      const result: ValidationResult = {
        submitted: false,
        pointsEarned: 0,
        feedback: 'Address marked as "garage not visible". This address will not appear in future games.',
        questionsAnswered: session.questionsAnswered + 1,
        totalScore: session.totalScore
      };

      // Save not visible result
      await saveValidationGameResult(session, guess, result);

      // Update session for next question (don't delete session)
      session.questionsAnswered++;
      activeSessions.set(sessionId, session);

      return result;
    }

    // This is data collection, not validation - award points for participation
    const pointsEarned = 10; // Fixed points for submitting data

    // Generate encouraging feedback
    const feedbackOptions: string[] = [
      'Thanks for your submission! Your data helps improve our system.',
      'Great job! Every measurement helps us learn.',
      'Excellent contribution! Your input is valuable.',
      'Well done! Thanks for helping us collect garage door data.',
      'Perfect! Your observations help train our AI.'
    ];
    const feedback: string = feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)] || 'Thanks for your contribution!';

    const result: ValidationResult = {
      submitted: true,
      pointsEarned,
      feedback,
      questionsAnswered: session.questionsAnswered + 1,
      totalScore: session.totalScore + pointsEarned
    };

    // Save game result
    try {
      await saveValidationGameResult(session, guess, result);
      console.log('✅ Validation game result saved successfully');
    } catch (error) {
      console.error('❌ Error saving validation game result:', error);
      throw error;
    }

    // Update user stats
    try {
      await updateUserValidationStats(userId, pointsEarned, 1.0); // Always count as "accurate" since it's data collection
      console.log('✅ User validation stats updated successfully');
    } catch (error) {
      console.error('❌ Error updating user validation stats:', error);
      // Don't throw here, as the main result was saved
    }

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

    // Get a new random Centennial address (different from current one)
    const addressData = await getCentennialAddressWithStreetView();
    if (!addressData) {
      // No more questions available, end the session
      activeSessions.delete(sessionId);
      return null;
    }

    const { address, streetViewUrl } = addressData;

    // Update session with new question
    session.centennialAddressId = address.id;
    session.address = address.address;
    session.imageUrl = streetViewUrl;
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
      session.centennialAddressId,
      session.sessionId,
      guess.garage_door_count || 0,
      guess.garage_door_width || 0,
      guess.garage_door_height || 0,
      guess.garage_door_type || 'unknown',
      guess.confidence || 0,
      1.0, // Always 1.0 accuracy for data collection
      result.pointsEarned,
      result.submitted ? 1 : 0, // 1 if submitted, 0 if skipped/not visible
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
    // First, get current stats - only use columns that definitely exist
    const getStatsStmt = db.prepare(`
      SELECT total_points, games_played
      FROM users WHERE id = ?
    `);

    getStatsStmt.get([userId], (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }

      const currentPoints = row?.total_points || 0;
      const currentGames = row?.games_played || 0;
      const newPoints = currentPoints + points;
      const newGames = currentGames + 1;

      // Update user stats - only update columns that definitely exist
      const updateStmt = db.prepare(`
        UPDATE users
        SET total_points = ?,
            games_played = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run([newPoints, newGames, userId], function(err) {
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
