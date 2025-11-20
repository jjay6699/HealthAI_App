import React, { ReactNode } from "react";
import { useTheme } from "../theme";

interface DialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: ReactNode;
}

const Dialog: React.FC<DialogProps> = ({
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  children
}) => {
  const theme = useTheme();

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        backgroundColor: "rgba(17, 24, 39, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: `min(420px, calc(100% - ${theme.spacing.xl * 2}px))`,
          background: theme.colors.background,
          borderRadius: 24,
          padding: `${theme.spacing.xl}px`,
          boxShadow: "0 32px 72px rgba(15,23,42,0.18)",
          display: "flex",
          flexDirection: "column" as const,
          gap: theme.spacing.lg
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 style={{ ...theme.typography.headingLg, margin: 0 }}>{title}</h2>
          {description ? <p style={{ fontSize: 15, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>{description}</p> : null}
        </div>
        <div>{children}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: onConfirm ? "repeat(2, minmax(0, 1fr))" : "1fr",
            gap: theme.spacing.md
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: theme.radii.lg,
              border: `1px solid ${theme.colors.divider}`,
              background: theme.colors.surface,
              color: theme.colors.text,
              padding: `${theme.spacing.lg}px`,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {cancelLabel}
          </button>
          {onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              style={{
                borderRadius: theme.radii.lg,
                border: "none",
                background: theme.colors.primary,
                color: theme.colors.background,
                padding: `${theme.spacing.lg}px`,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
