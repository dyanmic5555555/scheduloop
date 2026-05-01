// src/auth/AuthContext.jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

const AuthContext = createContext(null);

export { AuthContext };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
