// Authentication and user context

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types/entities';
import { AuthAPI } from '../services/odata/authApi';
import { onAuthExpired, setODataAuthToken } from '../services/odata/core';
import { UsersAPI } from '../services/odata/usersApi';

interface AuthContextType {
  currentUser: User | null;
  login: () => Promise<void>;
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
    clearLegacyAuthStorage();

    try {
      const user = await AuthAPI.currentUser();
      setCurrentUser(user.active ? user : null);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      setCurrentUser(null);
      setODataAuthToken(null);
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
      logout,
      switchUser,
      isAuthenticated: Boolean(currentUser),
      isAuthLoading,
      isDirectLoginEnabled: false,
    }),
    [currentUser, isAuthLoading, login, logout, switchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
