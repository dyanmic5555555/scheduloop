import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  canRequestPasswordReset,
  getFriendlyAuthErrorMessage,
} from "../utils/authErrors";

function LoginPage() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(
        getFriendlyAuthErrorMessage(
          err,
          "Login failed. Check your email and password."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setResetMessage("");

    if (!canRequestPasswordReset(email)) {
      setError("Enter your email address first, then we can send a reset link.");
      return;
    }

    setIsResetting(true);

    try {
      await resetPassword(email.trim());
      setResetMessage(
        "If an account exists for that email, a password reset link has been sent."
      );
    } catch (err) {
      console.error(err);
      if (err?.code === "auth/user-not-found") {
        setResetMessage(
          "If an account exists for that email, a password reset link has been sent."
        );
      } else {
        setError(
          getFriendlyAuthErrorMessage(
            err,
            "We could not send a reset link. Please try again."
          )
        );
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="app auth-screen">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to see your Shape of the Day.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {resetMessage && <p className="auth-success">{resetMessage}</p>}

          <button type="submit" className="auth-button" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>

          <button
            type="button"
            className="auth-link-button"
            onClick={handlePasswordReset}
            disabled={isResetting || isSubmitting}
          >
            {isResetting ? "Sending reset link..." : "Forgot password?"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
