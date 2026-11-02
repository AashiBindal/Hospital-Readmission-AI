import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import DataUploadPage from './pages/DataUploadPage';
import RiskPredictionPage from './pages/RiskPredictionPage';
import FollowUpsPage from './pages/FollowUpsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';

function PublicRoute({ children }) {
  const { currentUser, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route
              path="data-upload"
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Doctor', 'Nurse']}>
                  <DataUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="risk-prediction"
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Doctor', 'Nurse']}>
                  <RiskPredictionPage />
                </ProtectedRoute>
              }
            />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route
              path="follow-ups"
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Doctor', 'Nurse']}>
                  <FollowUpsPage />
                </ProtectedRoute>
              }
            />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
