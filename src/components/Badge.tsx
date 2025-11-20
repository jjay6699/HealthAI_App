import React, { CSSProperties } from "react";
import classNames from "classnames";
import { useTheme } from "../theme";

type BadgeTone = "default" | "info" | "success" | "warning" | "danger";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  className?: string;
  style?: CSSProperties;
};

const Badge: React.FC<BadgeProps> = ({ label, tone = "default", className, style }) => {
  const theme = useTheme();

  const palette = {
    default: { background: theme.colors.surfaceMuted, text: theme.colors.text },
    info: { background: theme.colors.accentBlue, text: theme.colors.info },
    success: { background: theme.colors.accentMint, text: theme.colors.success },
    warning: { background: theme.colors.accentPeach, text: theme.colors.warning },
    danger: { background: "#FEE2E2", text: theme.colors.error }
  } as const;

  const toneColors = palette[tone];

  return (
    <span
      className={classNames("app-badge", className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radii.pill,
        padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
        backgroundColor: toneColors.background,
        color: toneColors.text,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        ...style
      }}
    >
      {label}
    </span>
  );
};

export default Badge;