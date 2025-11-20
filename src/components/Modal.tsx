import React from "react";
import { useTheme } from "../theme";

type ModalProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

const Modal: React.FC<ModalProps> = ({ title, description, actionLabel = "Close", onAction }) => {
  const theme = useTheme();

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        background: "rgba(17, 24, 39, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
      }}
    >
      <div
        style={{
          width: `min(420px, calc(100% - ${theme.spacing.xl * 2}px))`,
          background: theme.colors.background,
          borderRadius: 24,
          padding: `${theme.spacing.xl}px ${theme.spacing.xl}px ${theme.spacing.xl}px`,
          boxShadow: "0 32px 72px rgba(15,23,42,0.2)",
          display: "flex",
          flexDirection: "column" as const,
          gap: theme.spacing.lg,
          textAlign: "center" as const
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto",
            borderRadius: 32,
            background: "linear-gradient(135deg, #FF385C 0%, #FF8A5C 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.colors.background,
            fontWeight: 700,
            fontSize: 22
          }}
        >
          ?
        </div>
        <h2 style={{ ...theme.typography.headingLg, margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 15, color: theme.colors.textSecondary, margin: 0 }}>{description}</p>
        <button
          onClick={onAction}
          style={{
            borderRadius: theme.radii.lg,
            border: "none",
            background: theme.colors.primary,
            color: theme.colors.background,
            fontSize: 16,
            fontWeight: 700,
            padding: `${theme.spacing.lg}px`,
            cursor: "pointer"
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default Modal;
