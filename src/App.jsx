// src/App.jsx
import "./App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/AuthContext";
import { BusinessProfileProvider } from "./business/BusinessProfileProvider";
import { useBusinessProfile } from "./business/BusinessProfileContext";
import { ThemeProvider } from "./theme/ThemeProvider";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";

function RouteError({ message }) {
  return (
    <div className="app route-error-screen">
      <div className="route-error-card">
        <h1>Something went wrong</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function ProfileReadyRoute({ children }) {
  const { loadingProfile, profileError } = useBusinessProfile();
  if (loadingProfile) return null;
  if (profileError) return <RouteError message={profileError} />;
  return children;
}

function CompleteProfileRoute({ children }) {
  const { hasProfile } = useBusinessProfile();
  if (!hasProfile) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <ProfileReadyRoute>
              <OnboardingPage />
            </ProfileReadyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProfileReadyRoute>
              <CompleteProfileRoute>
                <DashboardPage />
              </CompleteProfileRoute>
            </ProfileReadyRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BusinessProfileProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </BusinessProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
