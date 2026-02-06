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
      <div style={styles.topHighlight} />
      <header style={styles.header}>
        <div style={styles.logoStack}>
          <span style={styles.logoText}>New Gene</span>
          <span style={styles.logoCaption}>Personalised lab intelligence</span>
        </div>
        <div style={styles.headerRule} />
      </header>

      <main style={styles.main}>
        <div style={styles.copyBlock}>
          <div style={styles.kickerRow}>
            <span style={styles.kickerPill}>Precision nutrition</span>
            <Badge label="We protect your data" tone="success" />
          </div>
          <h1 style={styles.title}>
            Clarity for your <span style={styles.titleGradient}>health</span>.
          </h1>
          <p style={styles.subtitle}>
            Advanced AI trained on <strong>500,000+ peer-reviewed studies</strong> and clinical journals translates your biomarkers into trustworthy, actionable guidance.
          </p>
        </div>

        <div style={styles.metrics}>
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>24/7</span>
            <span style={styles.metricLabel}>Biomarker insights</span>
          </div>
          <div style={styles.metricDivider} />
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>3 min</span>
            <span style={styles.metricLabel}>Average setup</span>
          </div>
          <div style={styles.metricDivider} />
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>Private</span>
            <span style={styles.metricLabel}>Local-first data</span>
          </div>
        </div>

        <div style={styles.ctaShell}>
          <Button title="Get started" fullWidth onClick={() => navigate("/login")} />
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
      background: "radial-gradient(circle at top left, #FFF3E8 0%, #FFF9F4 40%, #FFFFFF 75%)",
      position: "relative" as const,
      padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`
    },
    gradientBlob: {
      position: "absolute" as const,
      width: 620,
      height: 620,
      borderRadius: "50%",
      top: "-10%",
      left: "-20%",
      background: "radial-gradient(circle, rgba(197,138,74,0.22) 0%, rgba(197,138,74,0) 70%)",
      zIndex: 0
    },
    glowRing: {
      position: "absolute" as const,
      width: 680,
      height: 680,
      borderRadius: "50%",
      bottom: "-30%",
      right: "-25%",
      background: "radial-gradient(circle, rgba(220,177,120,0.18) 0%, rgba(220,177,120,0) 75%)",
      zIndex: 0
    },
    topHighlight: {
      position: "absolute" as const,
      top: 0,
      width: "100%",
      height: 140,
      background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)",
      zIndex: 0
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing.lg,
      zIndex: 1,
      marginBottom: theme.spacing.xl,
      alignSelf: "center",
      width: contentWidth
    },
    headerRule: {
      flex: 1,
      height: 1,
      background: "linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 100%)",
      marginTop: 12
    },
    logoStack: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 2
    },
    logoText: {
      fontSize: 18,
      fontWeight: 700,
      color: theme.colors.text
    },
    logoCaption: {
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
      color: theme.colors.textSecondary
    },
    main: {
      width: contentWidth,
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.xl,
      textAlign: "left" as const,
      zIndex: 1
    },
    copyBlock: {
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.md,
      maxWidth: 460
    },
    kickerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: theme.spacing.sm,
      flexWrap: "wrap" as const
    },
    kickerPill: {
      padding: "6px 12px",
      borderRadius: 999,
      background: "rgba(197,138,74,0.14)",
      color: "#7B4E20",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const
    },
    title: {
      ...theme.typography.displayLg,
      margin: 0,
      color: theme.colors.text,
      lineHeight: "46px",
      letterSpacing: -0.8
    },
    titleGradient: {
      background: "linear-gradient(90deg, #C58A4A 0%, #F2B277 100%)",
      WebkitBackgroundClip: "text",
      color: "transparent"
    },
    subtitle: {
      fontSize: 17,
      color: theme.colors.textSecondary,
      margin: 0,
      lineHeight: "28px",
      maxWidth: 420
    },
    ctaShell: {
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.sm
    },
    metrics: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing.md,
      flexWrap: "wrap" as const,
      paddingTop: theme.spacing.sm,
      borderTop: "1px solid rgba(0,0,0,0.06)"
    },
    metricInline: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 4
    },
    metricDivider: {
      width: 1,
      height: 32,
      background: "rgba(0,0,0,0.08)"
    },
    metricValue: {
      fontSize: 16,
      fontWeight: 700,
      color: theme.colors.text
    },
    metricLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary
    }
  };
};

export default SplashScreen;
