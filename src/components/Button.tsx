import React from "react";
import classNames from "classnames";
import { useTheme } from "../theme";

export type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  title: string;
  loading?: boolean;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style">;

const Button: React.FC<ButtonProps> = ({
  title,
  loading,
  variant = "primary",
  fullWidth,
  className,
  disabled,
  style,
  ...props
}) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background =
    variant === "primary"
      ? theme.colors.primary
      : variant === "secondary"
      ? theme.colors.surface
      : "transparent";
  const border = variant === "secondary" ? `1px solid ${theme.colors.divider}` : "none";
  const color = variant === "primary" ? theme.colors.background : theme.colors.text;

  const spinnerBorder = variant === "primary" ? "rgba(255,255,255,0.4)" : `${theme.colors.text}33`;
  const spinnerTop = variant === "primary" ? theme.colors.background : theme.colors.primary;

  return (
    <button
      className={classNames("app-button", className)}
      style={{
        width: fullWidth ? "100%" : "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: theme.radii.lg,
        padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
        background,
        border,
        color,
        fontSize: 16,
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.7 : 1,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: variant === "primary" ? theme.shadows.soft : "none",
        ...style
      }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span
          className="button-spinner"
          style={{ borderColor: spinnerBorder, borderTopColor: spinnerTop }}
        />
      ) : null}
      <span style={{ opacity: loading ? 0.6 : 1 }}>{title}</span>
    </button>
  );
};

export default Button;