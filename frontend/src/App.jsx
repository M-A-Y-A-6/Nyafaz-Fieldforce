import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DemoStoreProvider, useDemoStore } from './context/DemoStoreContext';
import AppShell from './components/AppShell';
import Login from './pages/Login';

// Manager Screens
import ManagerDashboard from './pages/manager/ManagerDashboard';
import SalesExecutives from './pages/manager/SalesExecutives';
import TaskAssignment from './pages/manager/TaskAssignment';
import SalonsReports from './pages/manager/SalonsReports';

// Executive Screens
import ExecutiveCalendar from './pages/executive/ExecutiveCalendar';
import DailyTasks from './pages/executive/DailyTasks';

// Protected layout wrapper
function ProtectedRoute({ allowedRole, children }) {
  const { currentUser } = useDemoStore();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  // Role mismatch redirect
  if (allowedRole && currentUser.role !== allowedRole) {
    return (
      <Navigate
        to={currentUser.role === 'manager' ? '/manager/dashboard' : '/executive/calendar'}
        replace
      />
    );
  }
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <DemoStoreProvider>
      <BrowserRouter>
        <Routes>
          {/* Public & Session Entry - Default page is always Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          
          {/* Sales Manager Routes */}
          <Route
            path="/manager"
            element={<Navigate to="/manager/dashboard" replace />}
          />
          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute allowedRole="manager">
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/executives"
            element={
              <ProtectedRoute allowedRole="manager">
                <SalesExecutives />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/assign"
            element={
              <ProtectedRoute allowedRole="manager">
                <TaskAssignment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/salons"
            element={
              <ProtectedRoute allowedRole="manager">
                <SalonsReports />
              </ProtectedRoute>
            }
          />

          {/* Sales Executive Routes */}
          <Route
            path="/executive"
            element={<Navigate to="/executive/calendar" replace />}
          />
          <Route
            path="/executive/calendar"
            element={
              <ProtectedRoute allowedRole="executive">
                <ExecutiveCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/executive/tasks"
            element={
              <ProtectedRoute allowedRole="executive">
                <DailyTasks />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </DemoStoreProvider>
  );
}
