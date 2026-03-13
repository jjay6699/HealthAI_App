import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../services/auth";

const FullPageMessage: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      textAlign: "center",
      color: "#6B7280",
      fontSize: 15
    }}
  >
    {message}
  </div>
);

export const RequireAuth = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageMessage message="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export const RedirectIfAuthed = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageMessage message="Checking your session..." />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};
