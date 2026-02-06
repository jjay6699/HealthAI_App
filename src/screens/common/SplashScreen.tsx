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
      <header style={styles.header} />

      <main style={styles.main}>
        <div style={styles.copyBlock}>
          <div style={styles.kickerRow}>
            <span style={styles.kickerPill}>Precision nutrition</span>
            <Badge label="We protect your data" tone="success" />
          </div>
          <p style={styles.proofLine}>Advanced AI trained on 500,000+ peer-reviewed studies</p>
          <h1 style={styles.title}>
            Turn lab results into <span style={styles.titleGradient}>clear health guidance</span>.
          </h1>
          <p style={styles.subtitle}>
            Understand what your biomarkers mean, and get personalized actions you can take right away.
          </p>
          <p style={styles.trustLine}>Built with clinicians and nutrition scientists.</p>
        </div>

        <div style={styles.metrics}>
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>24/7 insights</span>
            <span style={styles.metricLabel}>Always-on biomarker analysis</span>
          </div>
          <div style={styles.metricDivider} />
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>3-minute setup</span>
            <span style={styles.metricLabel}>No onboarding friction</span>
          </div>
          <div style={styles.metricDivider} />
          <div style={styles.metricInline}>
            <span style={styles.metricValue}>Private by design</span>
            <span style={styles.metricLabel}>Your data stays on your device</span>
          </div>
        </div>

        <div style={styles.ctaShell}>
          <Button title="Analyze my biomarkers" onClick={() => navigate("/login")} style={styles.ctaButton} />
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
      height: "100vh",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at top left, #FFF3E8 0%, #FFF9F4 40%, #FFFFFF 75%)",
      position: "relative" as const,
      padding: `${theme.spacing.xl}px ${theme.spacing.xl}px`,
      overflow: "hidden"
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
      height: 24
    },
    main: {
      width: contentWidth,
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.lg,
      textAlign: "center" as const,
      zIndex: 1,
      alignItems: "center",
      flex: 1,
      justifyContent: "center"
    },
    copyBlock: {
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.md,
      maxWidth: 460,
      alignItems: "center"
    },
    proofLine: {
      fontSize: 13,
      fontWeight: 600,
      color: theme.colors.textSecondary,
      margin: 0
    },
    kickerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
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
    trustLine: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      margin: 0
    },
    ctaShell: {
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.sm,
      width: "100%",
      alignItems: "center"
    },
    ctaButton: {
      minWidth: 220,
      maxWidth: 320,
      width: "70%",
      borderRadius: 999,
      background: "#B6763B",
      boxShadow: "0 14px 24px rgba(182,118,59,0.28)"
    },
    metrics: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing.md,
      flexWrap: "wrap" as const,
      paddingTop: theme.spacing.sm,
      borderTop: "1px solid rgba(0,0,0,0.06)",
      justifyContent: "center"
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
    },
    footer: {
      display: "none"
    },
    footerInner: {
      display: "none"
    }
  };
};

export default SplashScreen;
