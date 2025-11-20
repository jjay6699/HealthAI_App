import React, { CSSProperties } from "react";
import { useTheme } from "../theme";

type ProgressBarProps = {
  progress: number; // 0-1
  style?: CSSProperties;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, style }) => {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div
      style={{
        height: 8,
        width: "100%",
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radii.md,
        overflow: "hidden",
        ...style
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped * 100}%`,
          backgroundColor: theme.colors.primary,
          transition: "width 0.3s ease"
        }}
      />
    </div>
  );
};

export default ProgressBar;