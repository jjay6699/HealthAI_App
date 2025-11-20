import React from "react";
import { Outlet } from "react-router-dom";
import { useTheme } from "../theme";

const AuthLayout = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        background: theme.colors.surfaceMuted
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          minHeight: "100vh",
          background: theme.colors.background,
          boxShadow: theme.shadows.card
        }}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;