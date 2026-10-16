import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'digital-gold-demo-session';
const DEMO_EMAIL = 'admin@digitalgold.demo';
const DEMO_PASSWORD = 'GoldAdmin123!';

function readSession() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'authenticated';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(readSession);

  function login(email, password) {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      return { success: false, message: 'Email or password is incorrect.' };
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, 'authenticated');
    } catch {
      return { success: false, message: 'Could not save the demo session in this browser.' };
    }
    setIsAuthenticated(true);
    return { success: true };
  }

  function logout() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory session is still cleared if browser storage is unavailable.
    }
    setIsAuthenticated(false);
  }

  const value = useMemo(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated],
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
