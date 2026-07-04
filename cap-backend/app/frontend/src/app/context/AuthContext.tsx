// Authentication and user context

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, UserRole } from '../types/entities';
import { AuthAPI } from '../services/odata/authApi';
import { onAuthExpired, setODataAuthToken } from '../services/odata/core';
import { UsersAPI } from '../services/odata/usersApi';

interface AuthContextType {
  currentUser: User | null;
  login: (_email?: string, _password?: string) => Promise<void>;
  /** Local/dev-only credential login (mocked auth). No-op path on BTP/XSUAA. */
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  directLogin: (_role: UserRole) => void;
  isDirectLoginEnabled: boolean;
  /** True when running the Vite dev server (no XSUAA) → show demo login. */
  isDevLogin: boolean;
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
    // no-op: storage cleanup failure should not block session state
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

  // Local demo login (mocked auth). Authenticates against the backend's demo
  // accounts and stores the returned bearer token for subsequent OData calls.
  const loginWithCredentials = useCallback(async (email: string, password: string) => {
    setIsAuthLoading(true);
    try {
      const session = await AuthAPI.authenticate(email, password);
      setODataAuthToken(session.token);
      setCurrentUser(session.user.active ? session.user : null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setODataAuthToken(null);
    clearLegacyAuthStorage();
    // XSUAA (BTP) requires the App Router `/do/logout` endpoint to also drop the
    // IdP session. In local demo/dev (mocked auth) that endpoint does not exist,
    // so navigating there just reloads the SPA and strands the user. The bearer
    // token is already cleared above, so returning to /login is enough to land
    // on the demo role picker and switch profiles.
    if (import.meta.env.DEV) {
      window.location.assign('/login');
    } else {
      window.location.assign('/do/logout');
    }
  }, []);

  const directLogin = useCallback((_role: UserRole) => {
    throw new Error('Direct login is disabled in XSUAA mode');
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
      loginWithCredentials,
      logout,
      switchUser,
      isAuthenticated: Boolean(currentUser),
      isAuthLoading,
      directLogin,
      isDirectLoginEnabled: false,
      isDevLogin: Boolean(import.meta.env.DEV),
    }),
    [currentUser, directLogin, isAuthLoading, login, loginWithCredentials, logout, switchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
