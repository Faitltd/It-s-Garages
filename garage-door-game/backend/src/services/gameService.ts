import { db } from '../config/database';
import { googleApiService } from './googleApiService';
import { getRandomCentennialAddress } from './centennialAddressService';

export interface GameSession {
  id: number;
  user_id: number;
  job_id: number;
  guess_door_count?: number;
  guess_door_width?: number;
  guess_door_height?: number;
  guess_garage_type?: string;
  is_correct: boolean;
  points_earned: number;
  time_taken?: number;
  created_at: string;
  completed_at?: string;
  difficulty: string;
  location_lat: number;
  location_lng: number;
  location_address?: string;
}

export interface GameGuess {
  garageCount: number;
  garageWidth?: number;
  garageHeight?: number;
  garageType?: string;
  confidence: number;
}

export interface ScoreResult {
  points: number;
  accuracy: number;
  feedback: string;
  correctAnswer: any;
  breakdown: {
    countAccuracy: number;
    sizeAccuracy?: number;
    typeAccuracy?: number;
    confidenceBonus: number;
    timeBonus: number;
  };
}

export interface GameQuestion {
  id: number;
  address: string;
  image_url: string;
  correct_answer: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points_value: number;
  created_at: string;
}

export interface QuestionGameSession {
  sessionId: string;
  userId: number;
  questionId: number;
  imageUrl: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  startTime: Date;
  pointsValue: number;
  address: string;
  options: string[];
}

/**
 * Create a new game session
 */
export const createGameSession = async (
  userId: number, 
  location: { lat: number; lng: number; address?: string }, 
  difficulty: string = 'medium'
): Promise<number> => {
  return new Promise((resolve, reject) => {
    // For now, create a simple game session without a specific job
    // In the future, this will be linked to actual garage door data
    const stmt = db.prepare(`
      INSERT INTO game_sessions (
        user_id, job_id, difficulty, location_lat, location_lng, location_address, 
        is_correct, points_earned, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
    `);
    
    stmt.run([userId, 1, difficulty, location.lat, location.lng, location.address || null], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
    
    stmt.finalize();
  });
};

/**
 * Get game session by ID and user ID
 */
export const getGameSession = async (sessionId: number, userId: number): Promise<GameSession | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT gs.*, 
             CASE WHEN gs.guess_door_count IS NOT NULL THEN 1 ELSE 0 END as completed
      FROM game_sessions gs 
      WHERE gs.id = ? AND gs.user_id = ?
    `);
    
    stmt.get([sessionId, userId], (err, row: any) => {
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
 * Update game session with guess and score
 */
export const updateGameSession = async (
  sessionId: number, 
  updates: {
    garageCount: number;
    garageWidth?: number;
    garageHeight?: number;
    garageType?: string;
    confidence: number;
    score: number;
    accuracy: number;
    completed: boolean;
    completedAt: Date;
  }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE game_sessions 
      SET guess_door_count = ?, 
          guess_door_width = ?, 
          guess_door_height = ?, 
          guess_garage_type = ?,
          points_earned = ?,
          is_correct = ?,
          time_taken = ?
      WHERE id = ?
    `);
    
    // Calculate time taken (simplified for now)
    const timeTaken = Math.floor(Math.random() * 30) + 10; // 10-40 seconds
    
    stmt.run([
      updates.garageCount,
      updates.garageWidth || null,
      updates.garageHeight || null,
      updates.garageType || null,
      updates.score,
      updates.accuracy > 0.7 ? 1 : 0, // Consider correct if accuracy > 70%
      timeTaken,
      sessionId
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
 * Calculate score based on guess accuracy
 */
export const calculateScore = async (session: GameSession, guess: GameGuess): Promise<ScoreResult> => {
  // For now, use mock data for scoring
  // In the future, this will compare against actual garage door data
  const mockCorrectAnswer = {
    garageCount: Math.floor(Math.random() * 3) + 1, // 1-3 garages
    garageWidth: 8 + Math.random() * 8, // 8-16 feet
    garageHeight: 7 + Math.random() * 2, // 7-9 feet
    garageType: ['single', 'double', 'triple'][Math.floor(Math.random() * 3)]
  };

  // Calculate accuracy for each component
  const countAccuracy = guess.garageCount === mockCorrectAnswer.garageCount ? 1.0 : 
                       Math.abs(guess.garageCount - mockCorrectAnswer.garageCount) <= 1 ? 0.5 : 0.0;

  let sizeAccuracy = 0.0;
  if (guess.garageWidth && guess.garageHeight) {
    const widthDiff = Math.abs(guess.garageWidth - mockCorrectAnswer.garageWidth) / mockCorrectAnswer.garageWidth;
    const heightDiff = Math.abs(guess.garageHeight - mockCorrectAnswer.garageHeight) / mockCorrectAnswer.garageHeight;
    sizeAccuracy = Math.max(0, 1 - (widthDiff + heightDiff) / 2);
  }

  const typeAccuracy = guess.garageType === mockCorrectAnswer.garageType ? 1.0 : 0.0;

  // Calculate bonuses
  const confidenceBonus = guess.confidence / 100 * 0.2; // Up to 20% bonus
  const timeBonus = 0.1; // Simplified time bonus

  // Calculate overall accuracy and points
  const overallAccuracy = (countAccuracy * 0.5 + sizeAccuracy * 0.3 + typeAccuracy * 0.2);
  const basePoints = Math.floor(overallAccuracy * 100);
  const bonusPoints = Math.floor(basePoints * (confidenceBonus + timeBonus));
  const totalPoints = basePoints + bonusPoints;

  // Generate feedback
  let feedback = '';
  if (overallAccuracy >= 0.8) {
    feedback = 'Excellent! You have a great eye for garage doors!';
  } else if (overallAccuracy >= 0.6) {
    feedback = 'Good job! You got most of the details right.';
  } else if (overallAccuracy >= 0.4) {
    feedback = 'Not bad, but there\'s room for improvement.';
  } else {
    feedback = 'Keep practicing! Garage door identification takes time to master.';
  }

  return {
    points: totalPoints,
    accuracy: overallAccuracy,
    feedback,
    correctAnswer: mockCorrectAnswer,
    breakdown: {
      countAccuracy,
      sizeAccuracy,
      typeAccuracy,
      confidenceBonus,
      timeBonus
    }
  };
};

/**
 * Get user's game history
 */
export const getUserGameHistory = async (
  userId: number, 
  page: number = 1, 
  limit: number = 10
): Promise<{ games: GameSession[]; total: number }> => {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM game_sessions WHERE user_id = ?');
    countStmt.get([userId], (err, countRow: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      const total = countRow.total;
      
      // Get games
      const gamesStmt = db.prepare(`
        SELECT * FROM game_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      
      gamesStmt.all([userId, limit, offset], (err, rows: GameSession[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({ games: rows, total });
      });
      
      gamesStmt.finalize();
    });
    
    countStmt.finalize();
  });
};

/**
 * Update user statistics after a game
 */
export const updateUserStats = async (userId: number, points: number, accuracy: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE users 
      SET total_points = total_points + ?,
          games_played = games_played + 1,
          accuracy_rate = (accuracy_rate * (games_played - 1) + ?) / games_played
      WHERE id = ?
    `);
    
    stmt.run([points, accuracy, userId], function(err) {
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
 * Generate random residential location for game - ONLY HOME ADDRESSES
 * All locations are verified residential addresses with houses that have garage doors
 */
export const generateRandomLocation = async (difficulty: string): Promise<{ lat: number; lng: number; address: string } | null> => {
  try {
    const centennialAddress = await getRandomCentennialAddress();
    if (!centennialAddress) {
      return null;
    }

    return {
      lat: centennialAddress.latitude,
      lng: centennialAddress.longitude,
      address: centennialAddress.address
    };
  } catch (error) {
    console.error('Error getting random Centennial address for game:', error);
    return null;
  }
};

/**
 * Get time limit based on difficulty
 */
export const getTimeLimitForDifficulty = (difficulty: string): number => {
  const timeLimits = {
    easy: 60,    // 60 seconds
    medium: 45,  // 45 seconds
    hard: 30     // 30 seconds
  };

  return timeLimits[difficulty as keyof typeof timeLimits] || 45;
};

/**
 * Get a random game question based on difficulty
 */
export const getRandomQuestion = async (difficulty: string = 'medium'): Promise<GameQuestion | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT * FROM game_questions
      WHERE difficulty = ?
      ORDER BY RANDOM()
      LIMIT 1
    `);

    stmt.get([difficulty], (err, row: any) => {
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
 * Create a question-based game session
 */
export const createQuestionGameSession = async (
  userId: number,
  difficulty: string = 'medium'
): Promise<QuestionGameSession | null> => {
  try {
    // Get a random question
    const question = await getRandomQuestion(difficulty);
    if (!question) {
      return null;
    }

    // Create session ID
    const sessionId = require('crypto').randomUUID();

    // Get time limit
    const timeLimit = getTimeLimitForDifficulty(difficulty);

    // Create session object
    const session: QuestionGameSession = {
      sessionId,
      userId,
      questionId: question.id,
      imageUrl: question.image_url,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      timeLimit,
      startTime: new Date(),
      pointsValue: question.points_value,
      address: question.address,
      options: [question.option_a, question.option_b, question.option_c, question.option_d]
    };

    // Store session in memory (in production, use Redis or database)
    activeQuestionSessions.set(sessionId, session);

    return session;
  } catch (error) {
    console.error('Error creating question game session:', error);
    return null;
  }
};

/**
 * Submit answer for question-based game
 */
export const submitQuestionAnswer = async (
  sessionId: string,
  selectedAnswer: string,
  userId: number
): Promise<{ correct: boolean; correctAnswer: string; pointsEarned: number; accuracy: number } | null> => {
  try {
    // Get session
    const session = activeQuestionSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    // Get the question to check correct answer
    const question = await getQuestionById(session.questionId);
    if (!question) {
      return null;
    }

    // Calculate time taken
    const timeTaken = (new Date().getTime() - session.startTime.getTime()) / 1000;
    const isCorrect = selectedAnswer === question.correct_answer;

    // Calculate points
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = question.points_value;

      // Time bonus (up to 50% extra points for quick answers)
      const timeBonus = Math.max(0, (session.timeLimit - timeTaken) / session.timeLimit * 0.5);
      pointsEarned = Math.floor(pointsEarned * (1 + timeBonus));
    }

    // Update user stats
    await updateUserStats(userId, pointsEarned, isCorrect ? 1.0 : 0.0);

    // Save game result to database
    await saveQuestionGameResult(session, selectedAnswer, isCorrect, pointsEarned, timeTaken);

    // Clean up session
    activeQuestionSessions.delete(sessionId);

    return {
      correct: isCorrect,
      correctAnswer: question.correct_answer,
      pointsEarned,
      accuracy: isCorrect ? 1.0 : 0.0
    };
  } catch (error) {
    console.error('Error submitting question answer:', error);
    return null;
  }
};

// In-memory storage for active question sessions (use Redis in production)
const activeQuestionSessions = new Map<string, QuestionGameSession>();

/**
 * Get question by ID
 */
const getQuestionById = async (questionId: number): Promise<GameQuestion | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('SELECT * FROM game_questions WHERE id = ?');

    stmt.get([questionId], (err, row: any) => {
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
 * Save question game result to database
 */
const saveQuestionGameResult = async (
  session: QuestionGameSession,
  selectedAnswer: string,
  isCorrect: boolean,
  pointsEarned: number,
  timeTaken: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO question_game_results (
        user_id, question_id, selected_answer, correct_answer, is_correct,
        points_earned, time_taken, difficulty, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run([
      session.userId,
      session.questionId,
      selectedAnswer,
      isCorrect,
      pointsEarned,
      timeTaken,
      session.difficulty
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
