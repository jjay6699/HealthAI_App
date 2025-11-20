import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav, { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { useTheme } from "../theme";

const AppLayout = () => {
  const theme = useTheme();
  const contentWidth = `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.colors.surfaceMuted,
        paddingTop: theme.spacing.lg,
        paddingBottom: BOTTOM_NAV_HEIGHT * 2
      }}
    >
      <main
        style={{
          width: contentWidth,
          margin: "0 auto",
          paddingBottom: theme.spacing.xl
        }}
      >
        <Outlet />
      </main>
      <BottomNav width={contentWidth} />
    </div>
  );
};

export default AppLayout;
