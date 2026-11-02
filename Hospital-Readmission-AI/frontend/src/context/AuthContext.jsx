import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../api/authService';
import notificationService from '../api/notificationService';

const AuthContext = createContext(null);

const STORAGE_TOKEN_KEY = 'medisight_token';
const STORAGE_USER_KEY = 'medisight_active_session_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_TOKEN_KEY) || null;
    } catch (e) {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      localStorage.removeItem(STORAGE_USER_KEY); // Clean up legacy local storage
      const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifications, setNotifications] = useState([]);

  // Fetch real notifications from Spring Boot API
  const fetchNotifications = useCallback(async () => {
    if (!token && !sessionStorage.getItem(STORAGE_TOKEN_KEY)) {
      setNotifications([]);
      return false;
    }
    try {
      const data = await notificationService.getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
      return true;
    } catch (err) {
      console.warn('Failed to load notifications from API:', err);
      return false;
    }
  }, [token]);

  // Mark single notification as read via API
  const markNotificationRead = async (id) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read via API
  const markAllNotificationsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  };

  // Toggle read / unread status (persisted via PATCH /notifications/{id}/read|unread)
  const toggleNotificationRead = async (id) => {
    const item = notifications.find((n) => n.id === id);
    if (!item) return;
    const nextUnread = !item.unread;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: nextUnread } : n))
    );
    try {
      if (nextUnread) {
        await notificationService.markAsUnread(id);
      } else {
        await notificationService.markAsRead(id);
      }
    } catch (err) {
      console.warn('Failed to update notification read status:', err);
      // Roll back the optimistic change so the UI matches the server
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, unread: item.unread } : n))
      );
    }
  };

  // Delete a notification (DELETE /notifications/{id})
  const deleteNotification = async (id) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      console.warn('Failed to delete notification:', err);
      setNotifications(previous);
      throw err;
    }
  };

  // On App Mount: Validate stored token via GET /auth/me
  useEffect(() => {
    async function restoreSession() {
      const savedToken = sessionStorage.getItem(STORAGE_TOKEN_KEY);
      if (!savedToken) {
        setCurrentUser(null);
        setIsInitializing(false);
        return;
      }

      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        }
      } catch (err) {
        console.warn('Stored token is invalid or expired:', err);
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
        setCurrentUser(null);
        setToken(null);
      } finally {
        setIsInitializing(false);
      }
    }

    restoreSession();
  }, []);

  // Sync notifications when user session becomes active
  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [currentUser, fetchNotifications]);

  // Real API Login: POST /auth/login
  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);
      // Response: { token, tokenType, expiresAt, user: { id, name, email, role, department, avatarInitials, lastLogin } }
      const authToken = data.token;
      const authUser = data.user || data;

      if (authToken) {
        sessionStorage.setItem(STORAGE_TOKEN_KEY, authToken);
        setToken(authToken);
      }
      if (authUser) {
        sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser));
        setCurrentUser(authUser);
      }

      return authUser;
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        (err.response?.status === 401
          ? 'Invalid email address or password. Please verify your credentials.'
          : err.message || 'Login failed. Please check your credentials.');
      throw new Error(errorMsg);
    }
  };

  // Real API Register: POST /auth/register
  const register = async (registrationData) => {
    try {
      const res = await authService.register(registrationData);
      // Response: { message, user }
      return res.user;
    } catch (err) {
      if (err.response?.status === 409 || err.message?.includes('409')) {
        throw new Error('Email already registered');
      }
      const errorMsg =
        err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      throw new Error(errorMsg);
    }
  };

  // Logout: clear session and state
  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setNotifications([]);
    try {
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isInitializing,
        login,
        register,
        logout,
        globalSearch,
        setGlobalSearch,
        notifications,
        setNotifications,
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        toggleNotificationRead,
        deleteNotification
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
