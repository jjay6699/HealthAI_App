import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { persistentStorage } from "./persistentStorage";

type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  pictureUrl?: string | null;
  provider: string;
  createdAt: number;
  lastLoginAt: number;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refreshAuth: () => Promise<AuthUser | null>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const syncUserProfileFromAuth = (user: AuthUser | null) => {
  if (!user) return;

  try {
    const raw = persistentStorage.getItem("userProfile");
    const existing = raw ? JSON.parse(raw) : {};
    const existingName = typeof existing?.name === "string" ? existing.name.trim() : "";
    const shouldUpdateName =
      !existingName || existingName === "JJAY TECH";

    persistentStorage.setItem(
      "userProfile",
      JSON.stringify({
        ...existing,
        ...(user.email ? { email: user.email } : {}),
        ...(shouldUpdateName && user.name ? { name: user.name } : {})
      })
    );
  } catch {
    // Ignore bootstrap sync errors.
  }
};

const fetchAuthMe = async (): Promise<AuthUser | null> => {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  return payload?.user ?? null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const nextUser = await fetchAuthMe();
      setUser(nextUser);
      return nextUser;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuth();
  }, []);

  useEffect(() => {
    syncUserProfileFromAuth(user);
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      refreshAuth,
      setUser
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
};
