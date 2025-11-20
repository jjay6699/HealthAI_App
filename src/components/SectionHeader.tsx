import React, { CSSProperties } from "react";
import classNames from "classnames";
import { useTheme } from "../theme";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, rightSlot, className, style }) => {
  const theme = useTheme();

  return (
    <div
      className={classNames("section-header", className)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: theme.spacing.md,
        ...style
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            ...theme.typography.headingSm,
            color: theme.colors.text,
            marginBottom: theme.spacing.xs / 2
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 14, color: theme.colors.textSecondary }}>{subtitle}</div>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
};

export default SectionHeader;