import React, { useMemo } from 'react';
import { AppTheme, useTheme } from '../theme';

const DesktopPrompt = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <span style={styles.icon}>📱</span>
        <h1 style={styles.title}>Mobile Experience Recommended</h1>
        <p style={styles.text}>
          This application is designed for mobile devices. For the best experience, please open it on your phone.
        </p>
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(243, 244, 246, 0.95)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: theme.spacing.xl,
  },
  content: {
    textAlign: 'center' as const,
    maxWidth: 400,
  },
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.md,
  },
  text: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: '24px',
  },
});

export default DesktopPrompt;

