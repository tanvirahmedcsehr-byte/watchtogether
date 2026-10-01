import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AdminUser {
  uid: string;
  username: string;
  role: 'admin';
  displayName: string;
  email?: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  authReady: boolean;
  loginWithCredentials: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  authReady: false,
  loginWithCredentials: async () => false,
  logout: () => {},
});

const ADMIN_STORAGE_KEY = 'cinelive_admin_auth_session';
export const ADMIN_AUTH_KEY = 'cinelive_admin_verified_tanvir_2026';

export function isApplicationAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    return Boolean(session && session.isAdmin === true);
  } catch {
    return false;
  }
}

export function checkAdminAuth(): { authenticated: boolean; error?: string } {
  if (!isApplicationAdminLoggedIn()) {
    return {
      authenticated: false,
      error: 'You must be logged in as an administrator (Username: Tanvir, Password: Movie).',
    };
  }
  return { authenticated: true };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.isAdmin) {
          setUser({
            uid: parsed.uid || 'admin-tanvir',
            username: parsed.username || 'Tanvir',
            role: 'admin',
            displayName: parsed.displayName || 'Tanvir (Admin)',
            email: parsed.email || 'storagedrive2solutionexplorer@gmail.com',
          });
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error('Failed to restore admin session:', err);
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }, []);

  const handleLogin = async (usernameInput: string, passwordInput: string): Promise<boolean> => {
    const userClean = usernameInput.trim().toLowerCase();
    const passClean = passwordInput.trim();

    // Valid usernames: 'tanvir', 'admin', or 'storagedrive2solutionexplorer@gmail.com'
    const isUserValid =
      userClean === 'tanvir' ||
      userClean === 'admin' ||
      userClean === 'storagedrive2solutionexplorer@gmail.com';

    // Valid password: 'Movie' (case-insensitive check for convenience)
    const isPassValid = passClean.toLowerCase() === 'movie';

    if (!isUserValid || !isPassValid) {
      throw new Error('ভুল ইউজারনেম বা পাসওয়ার্ড। ইউজারনেম: Tanvir এবং পাসওয়ার্ড: Movie লিখুন।');
    }

    const adminUser: AdminUser = {
      uid: 'admin-tanvir',
      username: 'Tanvir',
      role: 'admin',
      displayName: 'Tanvir (Admin)',
      email: 'storagedrive2solutionexplorer@gmail.com',
    };

    const sessionPayload = {
      isAdmin: true,
      uid: adminUser.uid,
      username: adminUser.username,
      displayName: adminUser.displayName,
      email: adminUser.email,
      timestamp: Date.now(),
    };

    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessionPayload));
    setUser(adminUser);
    setIsAdmin(true);
    return true;
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        authReady,
        loginWithCredentials: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
