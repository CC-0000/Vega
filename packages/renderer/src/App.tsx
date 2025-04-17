// src/renderer/App.tsx
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import React from "react";
import "./App.css";

// Import components
import Login from "./components/Login";
import HomePage from "./components/HomePage";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext.defs";

// Protected route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  return isAuthenticated ? children : <Navigate to="/" />;
}

// Public route that redirects to home if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  return isAuthenticated ? <Navigate to="/home" /> : children;
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Login route */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Protected home route */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Redirect any unknown routes to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
