import React from "react";
import { NavLink } from "react-router-dom";
import classNames from "classnames";
import { useTheme } from "../theme";
import { HomeIcon, UploadIcon, InsightsIcon, SupplementsIcon, HistoryIcon, ProfileIcon } from "./icons";

export const BOTTOM_NAV_HEIGHT = 68;

type BottomNavProps = {
  width?: string;
};

const tabs = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/upload", label: "Upload", icon: UploadIcon },
  { to: "/insights", label: "Insights", icon: InsightsIcon },
  { to: "/supplements", label: "Nutrition", icon: SupplementsIcon },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/profile", label: "Profile", icon: ProfileIcon }
];

const BottomNav: React.FC<BottomNavProps> = ({ width }) => {
  const theme = useTheme();
  const computedWidth = width ?? `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;

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
