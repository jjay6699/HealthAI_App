import React, { useMemo } from 'react';
import { AppTheme, useTheme } from '../theme';
import Button from './Button';

interface PaywallModalProps {
  onClose: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ onClose }) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <span style={styles.icon}>✨</span>
        <h2 style={styles.title}>Unlock Your Full Potential</h2>
        <p style={styles.text}>
          You've reached the free limit for our advanced features. Subscribe to get unlimited analyses and personalized insights.
        </p>
        <div style={styles.buttonContainer}>
          <Button title="Subscribe Now" onClick={() => alert('Redirect to subscription page!')} fullWidth />
          <Button title="Maybe Later" onClick={onClose} variant="secondary" fullWidth />
        </div>
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
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: theme.colors.background,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    margin: theme.spacing.lg,
    maxWidth: 400,
    width: '100%',
    textAlign: 'center' as const,
    animation: 'scaleIn 0.3s ease-out',
  },
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.md,
  },
  text: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.xl,
    lineHeight: '22px',
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.spacing.md,
  },
});

export default PaywallModal;

