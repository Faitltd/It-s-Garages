import { db } from '../config/database';
import { hashPassword, comparePassword } from '../utils/auth';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  total_points: number;
  games_played: number;
  jobs_submitted: number;
  accuracy_rate: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  role: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  total_points: number;
  games_played: number;
  jobs_submitted: number;
  accuracy_rate: number;
  created_at: string;
  role: string;
}

/**
 * Create a new user
 */
export const createUser = async (userData: CreateUserData): Promise<UserProfile> => {
  return new Promise(async (resolve, reject) => {
    try {
      const hashedPassword = await hashPassword(userData.password);
      
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, 'user')
      `);
      
      stmt.run([userData.username, userData.email, hashedPassword], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: users.email')) {
            reject(new Error('Email already exists'));
          } else if (err.message.includes('UNIQUE constraint failed: users.username')) {
            reject(new Error('Username already exists'));
          } else {
            reject(err);
          }
          return;
        }
        
        // Get the created user
        getUserById(this.lastID)
          .then(user => resolve(user))
          .catch(err => reject(err));
      });
      
      stmt.finalize();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get user by email (for login)
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT * FROM users 
      WHERE email = ? AND is_active = 1
    `);
    
    stmt.get([email], (err, row: User) => {
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
 * Get user by ID
 */
export const getUserById = async (id: number): Promise<UserProfile> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT id, username, email, total_points, games_played, 
             jobs_submitted, accuracy_rate, created_at, role
      FROM users 
      WHERE id = ? AND is_active = 1
    `);
    
    stmt.get([id], (err, row: UserProfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        reject(new Error('User not found'));
        return;
      }
      resolve(row);
    });
    
    stmt.finalize();
  });
};

/**
 * Get user by username
 */
export const getUserByUsername = async (username: string): Promise<UserProfile | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT id, username, email, total_points, games_played, 
             jobs_submitted, accuracy_rate, created_at, role
      FROM users 
      WHERE username = ? AND is_active = 1
    `);
    
    stmt.get([username], (err, row: UserProfile) => {
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
 * Authenticate user (login)
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return null;
    }
    
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }
    
    // Return user profile without password hash
    const { password_hash, ...userProfile } = user;
    return userProfile as UserProfile;
  } catch (error) {
    throw error;
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (userId: number, currentPassword: string, newPassword: string): Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    try {
      // First verify current password
      const stmt = db.prepare('SELECT password_hash FROM users WHERE id = ?');
      stmt.get([userId], async (err, row: { password_hash: string }) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          reject(new Error('User not found'));
          return;
        }
        
        const isValidPassword = await comparePassword(currentPassword, row.password_hash);
        if (!isValidPassword) {
          reject(new Error('Current password is incorrect'));
          return;
        }
        
        // Hash new password and update
        const hashedNewPassword = await hashPassword(newPassword);
        const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        
        updateStmt.run([hashedNewPassword, userId], function(updateErr) {
          if (updateErr) {
            reject(updateErr);
            return;
          }
          resolve(true);
        });
        
        updateStmt.finalize();
      });
      
      stmt.finalize();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: number, updates: Partial<Pick<User, 'username' | 'email'>>): Promise<UserProfile> => {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    if (updates.username) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    
    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    
    if (fields.length === 0) {
      reject(new Error('No fields to update'));
      return;
    }
    
    values.push(userId);
    
    const stmt = db.prepare(`
      UPDATE users 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    stmt.run(values, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: users.email')) {
          reject(new Error('Email already exists'));
        } else if (err.message.includes('UNIQUE constraint failed: users.username')) {
          reject(new Error('Username already exists'));
        } else {
          reject(err);
        }
        return;
      }
      
      // Get updated user
      getUserById(userId)
        .then(user => resolve(user))
        .catch(err => reject(err));
    });
    
    stmt.finalize();
  });
};
