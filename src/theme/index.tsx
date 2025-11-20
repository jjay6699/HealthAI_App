import React, { ReactNode, createContext, useContext } from "react";
import { palette } from "./palette";
import { spacing } from "./spacing";
import { typography } from "./typography";

const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999
} as const;

const shadows = {
  card: "0 6px 16px rgba(15, 23, 42, 0.08)",
  soft: "0 2px 8px rgba(15, 23, 42, 0.05)"
} as const;

export const theme = {
  colors: palette,
  spacing,
  typography,
  radii,
  shadows
};

export type AppTheme = typeof theme;

const ThemeContext = createContext<AppTheme>(theme);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);