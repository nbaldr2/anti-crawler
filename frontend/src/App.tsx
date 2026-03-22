import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Overview } from '@/components/Overview';
import { TrafficDrillDown } from '@/components/TrafficDrillDown';
import { RulesManagement } from '@/components/RulesManagement';
import { AllowDenyLists } from '@/components/AllowDenyLists';
import { Settings } from '@/components/Settings';
import { Login } from '@/pages/Login';
import { authService } from '@/services/auth';
import { useEffect } from 'react';
import { wsService } from '@/services/websocket';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = React.useState(() => authService.isAuthenticated());

  useEffect(() => {
    // Listen for storage changes (in case token is set in another tab)
    const handleStorage = () => setAuthenticated(authService.isAuthenticated());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
};

// App component that initializes WebSocket connection on authenticated routes
const AppContent: React.FC = () => {
  // Initialize WebSocket when app loads (if authenticated)
  useEffect(() => {
    if (authService.isAuthenticated()) {
      wsService.connect();
    }
    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/overview"
        element={
          <ProtectedRoute>
            <Overview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/traffic"
        element={
          <ProtectedRoute>
            <TrafficDrillDown />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rules"
        element={
          <ProtectedRoute>
            <RulesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lists"
        element={
          <ProtectedRoute>
            <AllowDenyLists />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;