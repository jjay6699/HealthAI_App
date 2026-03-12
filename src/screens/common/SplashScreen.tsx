import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";
import checkBadgeIcon from "../../assets/icons/check-badge.svg?raw";
import shieldCheckIcon from "../../assets/icons/shield-check.svg?raw";

type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  styles: ReturnType<typeof createStyles>;
};

const FeatureCard = ({ icon, title, description, styles }: FeatureCardProps) => (
  <div style={styles.featureCard}>
    <div style={styles.featureIconWrap} dangerouslySetInnerHTML={{ __html: icon }} />
    <div style={styles.featureCopy}>
      <h2 style={styles.featureTitle}>{title}</h2>
      <p style={styles.featureDescription}>{description}</p>
    </div>
  </div>
);

const SplashScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />
      <div style={styles.patternLayer} />

      <header style={styles.header} />

      <main style={styles.main}>
        <section style={styles.heroSection}>
          <h1 style={styles.title}>
            Turn Lab Results
            <br />
            Into Clarity
          </h1>
          <p style={styles.subtitle}>
            Understand your biomarkers with clinician-grade insights while keeping your data completely private.
          </p>
        </section>

        <section style={styles.featuresSection}>
          <FeatureCard
            icon={checkBadgeIcon}
            title="Clinician Reviewed"
            description="Your biomarkers are interpreted using clinical reference ranges."
            styles={styles}
          />
          <FeatureCard
            icon={shieldCheckIcon}
            title="Device Private"
            description="Your health data stays on your device and is never uploaded."
            styles={styles}
          />
        </section>
      </main>

      <div style={styles.ctaShell}>
        <Button
          title="Start Biomarker Analysis"
          onClick={() => navigate("/login")}
          style={styles.ctaButton}
        />
        <p style={styles.trustLine}>Your data stays on your device.</p>
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => {
  const contentWidth = `min(100%, 332px)`;

  return {
    page: {
      minHeight: "100vh",
      height: "100vh",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      background:
        "linear-gradient(180deg, #F6F1EA 0%, #EFE6DB 52%, #E9DED0 100%)",
      position: "relative" as const,
      padding: `${theme.spacing.xl}px ${theme.spacing.xl}px ${theme.spacing.xl * 1.25}px`,
      overflow: "hidden"
    },
    backgroundGlowTop: {
      position: "absolute" as const,
      top: -140,
      left: "50%",
      transform: "translateX(-50%)",
      width: 520,
      height: 520,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 70%)",
      filter: "blur(16px)",
      zIndex: 0
    },
    backgroundGlowBottom: {
      position: "absolute" as const,
      bottom: -180,
      right: -120,
      width: 360,
      height: 360,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(140,90,43,0.10) 0%, rgba(140,90,43,0) 72%)",
      filter: "blur(18px)",
      zIndex: 0
    },
    patternLayer: {
      position: "absolute" as const,
      inset: 0,
      opacity: 0.05,
      backgroundImage:
        "radial-gradient(circle at 24% 18%, rgba(140,90,43,0.9) 0 1.5px, transparent 1.5px), radial-gradient(circle at 76% 26%, rgba(140,90,43,0.85) 0 1.5px, transparent 1.5px), radial-gradient(circle at 34% 76%, rgba(140,90,43,0.85) 0 1.5px, transparent 1.5px), linear-gradient(rgba(140,90,43,0.6), rgba(140,90,43,0.6)), linear-gradient(rgba(140,90,43,0.6), rgba(140,90,43,0.6)), linear-gradient(rgba(140,90,43,0.55), rgba(140,90,43,0.55))",
      backgroundSize: "100% 100%, 100% 100%, 100% 100%, 120px 1px, 1px 96px, 132px 1px",
      backgroundPosition: "0 0, 0 0, 0 0, 24% 18%, 24% 18%, 24% 42%",
      backgroundRepeat: "no-repeat",
      zIndex: 0
    },
    header: {
      height: 12,
      zIndex: 1
    },
    main: {
      width: contentWidth,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xl,
      flex: 1,
      zIndex: 1,
      transform: "translateY(-30px)"
    },
    heroSection: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: theme.spacing.lg,
      textAlign: "center" as const
    },
    title: {
      margin: 0,
      color: "#2B2B2B",
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 0.98,
      letterSpacing: -1.4,
      textAlign: "center" as const,
      fontFamily: 'Georgia, "Times New Roman", serif',
      textWrap: "balance" as const
    },
    subtitle: {
      margin: 0,
      color: "rgba(43,43,43,0.82)",
      fontSize: 17,
      lineHeight: 1.5,
      maxWidth: 330,
      textAlign: "center" as const
    },
    featuresSection: {
      width: "100%",
      display: "flex",
      flexDirection: "column" as const,
      gap: theme.spacing.md
    },
    featureCard: {
      width: "100%",
      boxSizing: "border-box" as const,
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
      borderRadius: 20,
      background: "rgba(255,255,255,0.54)",
      border: "1px solid rgba(255,255,255,0.48)",
      boxShadow: "0 14px 32px rgba(92, 70, 45, 0.08)",
      backdropFilter: "blur(12px)"
    },
    featureIconWrap: {
      width: 44,
      height: 44,
      minWidth: 44,
      color: "#8C5A2B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    featureCopy: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
      paddingTop: 2
    },
    featureTitle: {
      margin: 0,
      color: "#2B2B2B",
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 1.2
    },
    featureDescription: {
      margin: 0,
      color: "rgba(43,43,43,0.74)",
      fontSize: 14,
      lineHeight: 1.45
    },
    ctaShell: {
      position: "absolute" as const,
      left: "50%",
      bottom: theme.spacing.xl * 1.4,
      transform: "translateX(-50%)",
      width: "min(100%, 332px)",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: theme.spacing.sm,
      zIndex: 1
    },
    ctaButton: {
      width: "100%",
      boxSizing: "border-box" as const,
      minWidth: 0,
      borderRadius: 18,
      background: "#C38A4A",
      boxShadow: "0 14px 28px rgba(195,138,74,0.24)"
    },
    trustLine: {
      margin: 0,
      color: "rgba(43,43,43,0.62)",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: 0.1
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
