import api from './api';
import type { LoginResponse, AuthUser } from '../types';

const TOKEN_KEY = 'token';

export const authService = {
  /**
   * Login with username and password.
   * Stores JWT token in localStorage on success.
   */
  async login(username: string, password: string): Promise<AuthUser> {
    const response = await api.post<LoginResponse>('/auth/login', { username, password });
    const { token } = response.data;
    localStorage.setItem(TOKEN_KEY, token);

    // Decode the JWT payload to get userId and role
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.userId, role: payload.role, isFirstLogin: payload.isFirstLogin };
  },

  /**
   * Logout the current user.
   * Calls backend to log the action, then clears local token.
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the API call fails, clear the token locally
    }
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Verify if the stored token is still valid.
   * Returns the user info if valid, null otherwise.
   */
  async verifyToken(): Promise<AuthUser | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await api.get<{ success: boolean; data: AuthUser }>('/auth/verify');
      return response.data.data;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  },

  async changePassword(newPassword: string): Promise<void> {
    await api.put('/auth/change-password', { newPassword });
  },

  /** Get the stored JWT token */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  /** Check if a token exists (does NOT verify validity) */
  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};
