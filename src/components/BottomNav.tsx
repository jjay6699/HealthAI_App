import React from "react";
import { NavLink } from "react-router-dom";
import classNames from "classnames";
import { useTheme } from "../theme";
import { HomeIcon, UploadIcon, InsightsIcon, SupplementsIcon, HistoryIcon, ProfileIcon } from "./icons";
import { useI18n } from "../i18n";

export const BOTTOM_NAV_HEIGHT = 68;

type BottomNavProps = {
  width?: string;
};

const BottomNav: React.FC<BottomNavProps> = ({ width }) => {
  const theme = useTheme();
  const { t } = useI18n();
  const computedWidth = width ?? `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;
  const tabs = [
    { to: "/home", label: t("nav.home"), icon: HomeIcon },
    { to: "/upload", label: t("nav.upload"), icon: UploadIcon },
    { to: "/insights", label: t("nav.insights"), icon: InsightsIcon },
    { to: "/supplements", label: t("nav.nutrition"), icon: SupplementsIcon },
    { to: "/history", label: t("nav.history"), icon: HistoryIcon },
    { to: "/profile", label: t("nav.profile"), icon: ProfileIcon }
  ];

  return (
    <nav
      style={{
        position: "fixed" as const,
        left: "50%",
        bottom: theme.spacing.md,
        transform: "translateX(-50%)",
        width: computedWidth,
        height: BOTTOM_NAV_HEIGHT,
        background: theme.colors.background,
        borderRadius: 22,
        boxShadow: "0 12px 22px rgba(15,23,42,0.08)",
        display: "grid",
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        alignItems: "center",
        padding: `0 ${theme.spacing.lg}px`,
        zIndex: 20
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              classNames("bottom-nav-link", {
                active: isActive
              })
            }
            style={({ isActive }) => ({
              justifySelf: "center",
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderRadius: theme.radii.md,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              backgroundColor: isActive ? `${theme.colors.primary}18` : "transparent",
              transition: "background-color 0.2s ease"
            })}
          >
            {({ isActive }) => <Icon active={isActive} />}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;
