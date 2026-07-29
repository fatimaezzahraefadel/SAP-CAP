// Authentication and user context

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types/entities';
import { AuthAPI } from '../services/odata/authApi';
import { onAuthExpired, setODataAuthToken, setTestUser, getTestUser, TestUser } from '../services/odata/core';
import { UsersAPI } from '../services/odata/usersApi';

interface AuthContextType {
  currentUser: User | null;
  login: () => Promise<void>;
  loginAsTestUser: (testUser: TestUser) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isDirectLoginEnabled: boolean;
}

// Persist context reference across Vite HMR reloads so the Provider and
// lazy-loaded consumers always share the same React context object.
const AuthContext: React.Context<AuthContextType | undefined> =
  import.meta.hot?.data?.authContext ??
  createContext<AuthContextType | undefined>(undefined);
if (import.meta.hot) {
  import.meta.hot.data.authContext = AuthContext;
}

const clearLegacyAuthStorage = (): void => {
  try {
    localStorage.removeItem('auth.session.v1');
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('odata.auth.token');
  } catch {
    // Storage cleanup failure should not block session state.
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    setIsAuthLoading(true);
    setODataAuthToken(null);

    try {
      const user = await AuthAPI.currentUser();
      setCurrentUser(user.active ? user : null);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const loginAsTestUser = useCallback(async (user: TestUser) => {
    console.log('[AuthContext] loginAsTestUser called with:', user);
    setIsAuthLoading(true);
    setTestUser(user);
    try {
      console.log('[AuthContext] Calling AuthAPI.currentUser()');
      const userData = await AuthAPI.currentUser();
      console.log('[AuthContext] Got user data:', userData);
      setCurrentUser(userData.active ? userData : null);
    } catch (error) {
      console.error('[AuthContext] Error in loginAsTestUser:', error);
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const existingTestUser = getTestUser();
    if (existingTestUser) {
      void loginAsTestUser(existingTestUser);
    } else {
      void loadCurrentUser();
    }
  }, [loadCurrentUser, loginAsTestUser]);

  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      setCurrentUser(null);
      setODataAuthToken(null);
      setTestUser(null);
      clearLegacyAuthStorage();
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setODataAuthToken(null);
    setTestUser(null);
    clearLegacyAuthStorage();
    window.location.assign('/do/logout');
  }, []);

  const switchUser = useCallback(async (userId: string) => {
    const user = await UsersAPI.getById(userId);
    if (user?.active && user.id === currentUser?.id) {
      setCurrentUser(user);
    }
  }, [currentUser?.id]);

  const value = useMemo<AuthContextType>(
    () => ({
      currentUser,
      login,
      loginAsTestUser,
      logout,
      switchUser,
      isAuthenticated: Boolean(currentUser),
      isAuthLoading,
      isDirectLoginEnabled: false,
    }),
    [currentUser, isAuthLoading, login, loginAsTestUser, logout, switchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
