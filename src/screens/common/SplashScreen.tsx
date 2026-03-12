import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";
import checkBadgeIcon from "../../assets/icons/check-badge.svg?raw";
import shieldCheckIcon from "../../assets/icons/shield-check.svg?raw";

const SplashScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.atmosphere} />
      <div style={styles.atmosphereSoft} />
      <div style={styles.atmosphereEdge} />
      <header style={styles.header} />

      <main style={styles.main}>
        <div style={styles.copyBlock}>
          <h1 style={styles.title}>
            Turn Lab
            <br />
            Results Into
            <br />
            Clarity.
          </h1>
          <p style={styles.subtitle}>Clinician-grade insights. Device private.</p>
        </div>

        <div style={styles.trustGrid}>
          <div style={styles.trustCard}>
            <div style={styles.iconWrap} dangerouslySetInnerHTML={{ __html: checkBadgeIcon }} />
            <span style={styles.trustCardLabel}>Clinician-vetted</span>
          </div>
          <div style={styles.trustCard}>
            <div style={styles.iconWrap} dangerouslySetInnerHTML={{ __html: shieldCheckIcon }} />
            <span style={styles.trustCardLabel}>Device private</span>
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
      background:
        "radial-gradient(circle at 50% 12%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.18) 28%, rgba(255,255,255,0) 48%), radial-gradient(circle at 14% 24%, rgba(197,138,74,0.12) 0%, rgba(197,138,74,0) 34%), radial-gradient(circle at 86% 72%, rgba(160,126,84,0.14) 0%, rgba(160,126,84,0) 30%), linear-gradient(180deg, #FAF6EF 0%, #F2EADF 52%, #E8DECF 100%)",
      position: "relative" as const,
      padding: `${theme.spacing.xl}px ${theme.spacing.xl}px`,
      overflow: "hidden"
    },
    atmosphere: {
      position: "absolute" as const,
      width: 720,
      height: 720,
      borderRadius: "50%",
      top: -260,
      left: -220,
      background: "radial-gradient(circle, rgba(197,138,74,0.16) 0%, rgba(197,138,74,0) 68%)",
      filter: "blur(30px)",
      zIndex: 0
    },
    atmosphereSoft: {
      position: "absolute" as const,
      width: 680,
      height: 680,
      borderRadius: "50%",
      right: -240,
      top: 80,
      background: "radial-gradient(circle, rgba(163,132,92,0.12) 0%, rgba(163,132,92,0) 72%)",
      filter: "blur(34px)",
      zIndex: 0
    },
    atmosphereEdge: {
      position: "absolute" as const,
      inset: 0,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.05) 18%, rgba(98,73,47,0.05) 100%)",
      zIndex: 0
    },
    header: {
      height: 24
    },
    main: {
      width: contentWidth,
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.xl,
      zIndex: 1,
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingTop: theme.spacing.xxl * 1.2,
      paddingBottom: theme.spacing.xxl * 1.6
    },
    copyBlock: {
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.lg,
      maxWidth: 340,
      alignItems: "center"
    },
    title: {
      margin: 0,
      color: "#6A3412",
      fontSize: 44,
      fontWeight: 700,
      lineHeight: "0.94",
      letterSpacing: -1.8,
      textAlign: "center" as const,
      fontFamily: 'Georgia, "Times New Roman", serif'
    },
    subtitle: {
      fontSize: 18,
      color: "#4B4038",
      margin: 0,
      lineHeight: "1.35",
      maxWidth: 320,
      textAlign: "center" as const
    },
    trustGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: theme.spacing.xl,
      width: "100%",
      maxWidth: 332
    },
    trustCard: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: theme.spacing.sm
    },
    iconWrap: {
      width: 56,
      height: 56,
      color: "#5F3820",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.96
    },
    trustCardLabel: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase" as const,
      color: "#3A2D24",
      textAlign: "center" as const
    },
    ctaShell: {
      position: "absolute" as const,
      left: "50%",
      bottom: theme.spacing.xxl * 1.4,
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.md,
      width: "min(100%, 320px)",
      alignItems: "center",
      zIndex: 1
    },
    ctaButton: {
      minWidth: 240,
      width: "100%",
      borderRadius: 999,
      background: theme.colors.primary,
      boxShadow: "0 14px 28px rgba(197,138,74,0.24)"
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
