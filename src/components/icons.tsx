import React from "react";
import { useTheme } from "../theme";

type IconProps = {
  active?: boolean;
};

const getColor = (active: boolean | undefined, primary: string, secondary: string) =>
  active ? primary : secondary;

export const HomeIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 10.5L12 4L19.5 10.5V19C19.5 19.8284 18.8284 20.5 18 20.5H6C5.17157 20.5 4.5 19.8284 4.5 19V10.5Z"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20.5V14.5C9.5 13.6716 10.1716 13 11 13H13C13.8284 13 14.5 13.6716 14.5 14.5V20.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const UploadIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4V16"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.5 7.5L12 4L15.5 7.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20H19"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const InsightsIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 15.5L9 11.5L12 14.5L18 8"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="15.5" r="1.8" fill={stroke} />
      <circle cx="9" cy="11.5" r="1.8" fill={stroke} />
      <circle cx="12" cy="14.5" r="1.8" fill={stroke} />
      <circle cx="18" cy="8" r="1.8" fill={stroke} />
    </svg>
  );
};

export const SupplementsIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="4.5"
        y="5"
        width="6.5"
        height="14"
        rx="3.25"
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path
        d="M15 5H18C19.6569 5 21 6.34315 21 8V16C21 17.6569 19.6569 19 18 19H15"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M4.5 12.5H11" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

export const HistoryIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 13L10 9L13 12L18 7"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 5V19" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 5V19" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

export const ProfileIcon: React.FC<IconProps> = ({ active }) => {
  const theme = useTheme();
  const stroke = getColor(active, theme.colors.primary, theme.colors.textSecondary);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3.5" stroke={stroke} strokeWidth="1.6" />
      <path
        d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};
