import React, { ReactNode } from "react";
import { BOTTOM_NAV_HEIGHT } from "./BottomNav";
import { useTheme } from "../theme";

type StickyFooterProps = {
  children: ReactNode;
  width?: string;
};

const StickyFooter: React.FC<StickyFooterProps> = ({ children, width }) => {
  const theme = useTheme();
  const computedWidth = width ?? `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;

  return (
    <div
      style={{
        position: "fixed" as const,
        left: "50%",
        bottom: BOTTOM_NAV_HEIGHT + theme.spacing.lg,
        transform: "translateX(-50%)",
        width: computedWidth,
        zIndex: 15
      }}
    >
      <div
        style={{
          display: "flex",
          gap: theme.spacing.md,
          alignItems: "center",
          background: theme.colors.background,
          borderRadius: theme.radii.xl,
          boxShadow: "0 12px 24px rgba(15,23,42,0.1)",
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default StickyFooter;
