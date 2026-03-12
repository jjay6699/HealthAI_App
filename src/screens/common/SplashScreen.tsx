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
    <div style={styles.featureIconPlate}>
      <div style={styles.featureIconWrap} dangerouslySetInnerHTML={{ __html: icon }} />
    </div>
    <div style={styles.featureCopy}>
      <h2 style={styles.featureTitle}>{title}</h2>
      <p style={styles.featureDescription}>{description}</p>
    </div>
  </div>
);

const LockIcon = ({ styles }: { styles: ReturnType<typeof createStyles> }) => (
  <svg style={styles.lockIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.8 8.4V6.9C6.8 5.13 8.23 3.7 10 3.7C11.77 3.7 13.2 5.13 13.2 6.9V8.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <rect x="5.2" y="8.4" width="9.6" height="7.9" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
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
        <div style={styles.ctaShell}>
          <Button
            title="Start Biomarker Analysis"
            onClick={() => navigate("/login")}
            style={styles.ctaButton}
          />
          <p style={styles.trustLine}>
            <LockIcon styles={styles} />
            <span>Your data stays on your device.</span>
          </p>
        </div>
      </main>
    </div>
  );
};

const createStyles = (theme: AppTheme) => {
  const contentMaxWidth = 332;

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
      boxSizing: "border-box" as const,
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
      left: "50%",
      top: 84,
      width: 280,
      height: 190,
      transform: "translateX(-50%)",
      opacity: 0.04,
      backgroundImage:
        "radial-gradient(circle at 24% 28%, rgba(140,90,43,0.9) 0 1.5px, transparent 1.5px), radial-gradient(circle at 76% 22%, rgba(140,90,43,0.9) 0 1.5px, transparent 1.5px), radial-gradient(circle at 34% 78%, rgba(140,90,43,0.9) 0 1.5px, transparent 1.5px), linear-gradient(rgba(140,90,43,0.55), rgba(140,90,43,0.55)), linear-gradient(rgba(140,90,43,0.55), rgba(140,90,43,0.55)), linear-gradient(rgba(140,90,43,0.5), rgba(140,90,43,0.5))",
      backgroundSize: "100% 100%, 100% 100%, 100% 100%, 108px 1px, 1px 84px, 116px 1px",
      backgroundPosition: "0 0, 0 0, 0 0, 24% 28%, 24% 28%, 24% 52%",
      backgroundRepeat: "no-repeat",
      zIndex: 0
    },
    header: {
      height: 12,
      zIndex: 1
    },
    main: {
      width: "100%",
      maxWidth: contentMaxWidth,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      flex: 1,
      zIndex: 1,
      boxSizing: "border-box" as const
    },
    heroSection: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 16,
      textAlign: "center" as const,
      width: "100%",
      maxWidth: 320
    },
    title: {
      margin: 0,
      color: "#2B2B2B",
      fontSize: 35,
      fontWeight: 650,
      lineHeight: 1.08,
      letterSpacing: 0.2,
      textAlign: "center" as const,
      fontFamily: 'Georgia, "Times New Roman", serif',
      textWrap: "balance" as const
    },
    subtitle: {
      margin: 0,
      color: "rgba(43,43,43,0.82)",
      fontSize: 15,
      lineHeight: 1.45,
      width: "100%",
      maxWidth: "100%",
      textAlign: "center" as const
    },
    featuresSection: {
      width: "100%",
      display: "flex",
      flexDirection: "column" as const,
      gap: 16,
      marginTop: 0
    },
    featureCard: {
      width: "100%",
      boxSizing: "border-box" as const,
      display: "flex",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
      borderRadius: 20,
      background: "#F8F6F3",
      border: "1px solid rgba(255,255,255,0.58)",
      boxShadow: "0 8px 22px rgba(0,0,0,0.05)",
      backdropFilter: "blur(12px)"
    },
    featureIconPlate: {
      width: 48,
      height: 48,
      minWidth: 48,
      borderRadius: "50%",
      background: "#EFE7DD",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    featureIconWrap: {
      width: 40,
      height: 40,
      minWidth: 40,
      color: "#8C5A2B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    featureCopy: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6
    },
    featureTitle: {
      margin: 0,
      color: "#2B2B2B",
      fontSize: 15,
      fontWeight: 700,
      lineHeight: 1.25
    },
    featureDescription: {
      margin: 0,
      color: "rgba(43,43,43,0.74)",
      fontSize: 14,
      lineHeight: 1.45
    },
    ctaShell: {
      width: "100%",
      maxWidth: contentMaxWidth,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 12,
      marginTop: 44,
      zIndex: 1,
      boxSizing: "border-box" as const
    },
    ctaButton: {
      width: "100%",
      boxSizing: "border-box" as const,
      minWidth: 0,
      height: 58,
      borderRadius: 30,
      background: "#C38A4A",
      boxShadow: "0 12px 28px rgba(195,138,74,0.30)"
    },
    trustLine: {
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: 6,
      color: "rgba(43,43,43,0.62)",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: 0.1
    },
    lockIcon: {
      width: 14,
      height: 14,
      color: "rgba(43,43,43,0.56)"
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
