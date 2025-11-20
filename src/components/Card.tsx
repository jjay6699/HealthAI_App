import React, { ReactNode, CSSProperties } from "react";
import classNames from "classnames";
import { useTheme } from "../theme";

type CardProps = {
  children: ReactNode;
  padding?: "md" | "lg" | "xl";
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
};

const Card: React.FC<CardProps> = ({ children, padding = "lg", shadow = false, className, style }) => {
  const theme = useTheme();
  const paddingValue = padding === "md" ? theme.spacing.lg : padding === "lg" ? theme.spacing.xl : theme.spacing.xxl;

  return (
    <div
      className={classNames("app-card", className)}
      style={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.radii.lg,
        padding: paddingValue,
        border: `1px solid ${theme.colors.background}`,
        boxShadow: shadow ? theme.shadows.card : "none",
        transition: "box-shadow 0.2s ease",
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default Card;