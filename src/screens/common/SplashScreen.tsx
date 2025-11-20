import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";

const SplashScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.gradientBlob} />
      <div style={styles.glowRing} />
      <header style={styles.header}>
        <span style={styles.logoDot} />
        <span style={styles.logoText}>New Gene</span>
      </header>

      <main style={styles.main}>
        <p style={styles.kicker}>Personalised lab intelligence</p>
        <h1 style={styles.title}>
          Clarity for your <span style={styles.titleGradient}>health</span>.
        </h1>
        <p style={styles.subtitle}>
          Advanced AI trained on <strong>500,000+ peer-reviewed studies</strong> and clinical journals translates your biomarkers into trustworthy, actionable guidance.
        </p>

        <div style={styles.ctaShell}>
          <Button title="Get started" fullWidth onClick={() => navigate("/login")} />
        </div>

        <div style={styles.footerBadge}>
          <Badge label="We protect your data" tone="success" />
        </div>
      </main>
    </div>
  );
};

const createStyles = (theme: AppTheme) => {
  const contentWidth = `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;

  return {
    page: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(180deg, #FFF5F8 0%, #F6F7FF 40%, #FFFFFF 100%)",
      position: "relative" as const,
      padding: `${theme.spacing.xl}px`
    },
    gradientBlob: {
      position: "absolute" as const,
      width: 460,
      height: 460,
      borderRadius: "50%",
      top: "12%",
      background: "radial-gradient(circle, rgba(255,56,92,0.18) 0%, rgba(255,56,92,0) 70%)",
      zIndex: 0
    },
    glowRing: {
      position: "absolute" as const,
      width: 540,
      height: 540,
      borderRadius: "50%",
      bottom: "-20%",
      background: "radial-gradient(circle, rgba(232,74,95,0.12) 0%, rgba(232,74,95,0) 75%)",
      zIndex: 0
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing.sm,
      zIndex: 1,
      marginBottom: theme.spacing.xxl
    },
    logoDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      background: theme.colors.primary,
      boxShadow: "0 8px 18px rgba(255,56,92,0.35)"
    },
    logoText: {
      fontSize: 18,
      fontWeight: 700,
      color: theme.colors.text
    },
    main: {
      width: contentWidth,
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.xl,
      textAlign: "center" as const,
      zIndex: 1
    },
    kicker: {
      letterSpacing: 3,
      textTransform: "uppercase" as const,
      fontSize: 12,
      fontWeight: 700,
      color: theme.colors.info,
      margin: 0
    },
    title: {
      ...theme.typography.displayLg,
      margin: 0,
      color: theme.colors.text,
      lineHeight: "40px"
    },
    titleGradient: {
      background: "linear-gradient(90deg, #FF385C 0%, #FF8A5C 100%)",
      WebkitBackgroundClip: "text",
      color: "transparent"
    },
    subtitle: {
      fontSize: 17,
      color: theme.colors.textSecondary,
      margin: 0,
      lineHeight: "28px"
    },
    ctaShell: {
      position: "relative" as const
    },
    footerBadge: {
      display: "flex",
      justifyContent: "center"
    }
  };
};

export default SplashScreen;
