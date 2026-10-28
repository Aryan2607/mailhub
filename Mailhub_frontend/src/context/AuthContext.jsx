import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getSavedUser, clearTokens, getAccessToken } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getSavedUser());
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await authApi.getMe();
      setUser(data);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener('mailhub_auth_expired', handleExpired);
    return () => window.removeEventListener('mailhub_auth_expired', handleExpired);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
    return res;
  };

  const register = async (userData) => {
    const res = await authApi.register(userData);
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const isAdmin = Boolean(
    user && (user.role === 'ADMIN' || user.is_admin || user.is_staff)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
