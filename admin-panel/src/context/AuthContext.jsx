import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);
export const STORAGE_KEY = 'digital-gold-demo-session';

export const DEMO_ACCOUNTS = Object.freeze([
  {
    accountId: 'demo-super-admin',
    email: 'superadmin@digitalgold.demo',
    password: 'SuperAdmin123!',
    name: 'Shop Owner',
    roleId: 'SUPER_ADMIN',
  },
  {
    accountId: 'demo-admin',
    email: 'admin@digitalgold.demo',
    password: 'Admin123!',
    name: 'Admin',
    roleId: 'ADMIN',
  },
]);

function publicAccount(account) {
  if (!account) return null;
  const { password: _password, ...user } = account;
  return user;
}

function accountForSession(rawSession) {
  if (!rawSession) return null;
  try {
    const session = JSON.parse(rawSession);
    if (session.version !== 1 || typeof session.accountId !== 'string') return null;
    return publicAccount(DEMO_ACCOUNTS.find((account) => account.accountId === session.accountId));
  } catch {
    return null;
  }
}

function readSession() {
  try {
    return accountForSession(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  function login(email, password) {
    const account = DEMO_ACCOUNTS.find((candidate) => (
      candidate.email === email.trim().toLowerCase() && candidate.password === password
    ));
    if (!account) return { success: false, message: 'Email or password is incorrect.' };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, accountId: account.accountId }));
    } catch {
      return { success: false, message: 'Could not save the demo session in this browser.' };
    }
    const authenticatedUser = publicAccount(account);
    setUser(authenticatedUser);
    return { success: true, user: authenticatedUser };
  }

  function logout() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory demo session is still cleared if browser storage is unavailable.
    }
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), login, logout }),
    [user],
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
