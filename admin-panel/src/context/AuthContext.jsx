import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/auth/session')
      .then((session) => {
        if (active) setUser(session.user ?? null);
      })
      .catch((error) => {
        if (active) setAuthError(error.message || 'Could not verify your session with the server.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    setAuthError('');
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (!result?.user) throw new Error('The server returned an invalid sign-in response.');
    setUser(result.user);
    setAuthError('');
  }

  async function logout() {
    setUser(null);
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setAuthError('');
    } catch (error) {
      setAuthError(`Could not complete sign out with the server: ${error.message}`);
    }
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      authError,
      user,
      login,
      logout,
    }),
    [user, isLoading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
