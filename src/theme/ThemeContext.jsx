/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

const ThemeContext = createContext(null);

export { ThemeContext };

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
