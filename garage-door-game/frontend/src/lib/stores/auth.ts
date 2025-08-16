import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
  id: number;
  username: string;
  email: string;
  total_points: number;
  games_played: number;
  accuracy_rate: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    // Initialize auth state from localStorage
    init: () => {
      if (browser) {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData);
            set({
              isAuthenticated: true,
              user,
              token
            });
          } catch (error) {
            console.error('Error parsing stored user data:', error);
            // Clear invalid data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
    },

    // Login
    login: (user: User, token: string) => {
      if (browser) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      set({
        isAuthenticated: true,
        user,
        token
      });
    },

    // Logout
    logout: () => {
      if (browser) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      
      set(initialState);
    },

    // Update user data
    updateUser: (userData: Partial<User>) => {
      update(state => {
        if (state.user) {
          const updatedUser = { ...state.user, ...userData };
          
          if (browser) {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
          
          return {
            ...state,
            user: updatedUser
          };
        }
        return state;
      });
    }
  };
}

export const authStore = createAuthStore();
