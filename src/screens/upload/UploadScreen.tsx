import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import AIChat from "../../components/AIChat";
import { AppTheme, useTheme } from "../../theme";
import { analyzeBloodworkFile, analyzeBloodworkPdf } from "../../services/openai";
import { shouldShowPaywall, incrementAnalysesRun } from "../../services/usageTracker";
import PaywallModal from "../../components/PaywallModal";

const UploadScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  const analysisSteps = [
    { icon: "📄", text: "Reading document", color: "#8B5CF6" },
    { icon: "🔍", text: "Extracting biomarkers", color: "#3B82F6" },
    { icon: "🧬", text: "Analyzing values", color: "#10B981" },
    { icon: "💊", text: "Recommending supplements", color: "#F59E0B" }
  ];

  // Animate through steps
  React.useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStep(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < analysisSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500); // Change step every 1.5 seconds

    return () => clearInterval(interval);
  }, [isAnalyzing, analysisSteps.length]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (shouldShowPaywall()) {
      setShowPaywall(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log("Analyzing file:", file.name);

      incrementAnalysesRun();

      let analysis;

      // Check if it's a PDF or image
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Handle PDF files
        const [result] = await Promise.all([
          analyzeBloodworkPdf(file),
          new Promise(resolve => setTimeout(resolve, 6000)) // Minimum 6 seconds for UX
        ]);
        analysis = result;
      } else {
        // Handle image files
        const base64 = await fileToBase64(file);
        const [result] = await Promise.all([
          analyzeBloodworkFile(base64, file.type),
          new Promise(resolve => setTimeout(resolve, 6000)) // Minimum 6 seconds for UX
        ]);
        analysis = result;
      }

      // Save to localStorage
      localStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));

      // Navigate to insights
      navigate("/insights");
    } catch (err) {
      console.error("Error analyzing file:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze file. Please try again.");
      setIsAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };



  // Show analyzing screen when processing
  if (isAnalyzing) {
    return (
      <div style={styles.analyzingContainer}>
        <div style={styles.analyzingContent}>
          <div style={styles.spinner}></div>
          <h2 style={styles.analyzingTitle}>Analyzing Your Bloodwork</h2>
          <p style={styles.analyzingText}>
            Our AI is reading your bloodwork report and generating personalized supplement recommendations...
          </p>
          <div style={styles.progressSteps}>
            {analysisSteps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isPending = index > currentStep;

              return (
                <div
                  key={index}
                  style={{
                    ...styles.step,
                    ...(isActive ? styles.stepActive : {}),
                    ...(isPending ? styles.stepPending : {}),
                    background: isCompleted ? "#F0FDF4" : isActive ? "#FEFEFE" : styles.step.background,
                    borderColor: isCompleted ? "#10B981" : isActive ? step.color : theme.colors.divider,
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    ...styles.stepIconContainer,
                    background: isActive ? step.color : isCompleted ? '#10B981' : '#F3F4F6'
                  }}>
                    <span style={styles.stepIcon}>
                      {isCompleted ? '✓' : step.icon}
                    </span>
                  </div>
                  <span style={{
                    ...styles.stepText,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? theme.colors.text : isPending ? theme.colors.textSecondary : theme.colors.text
                  }}>
                    {step.text}
                  </span>
                  {isActive && (
                    <div style={styles.activeIndicator}>
                      <div style={styles.pulse}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      <h1 style={styles.heading}>Upload your labs</h1>
      <p style={styles.subheading}>Choose a file or snap a photo. We parse, normalise, and confirm with you.</p>

      {error && (
        <Card style={{ ...styles.card, background: theme.colors.accentPeach, border: `1px solid ${theme.colors.error}` }}>
          <p style={{ color: theme.colors.error, margin: 0, fontSize: 14 }}>{error}</p>
        </Card>
      )}

      <Card style={styles.card}>
        <SectionHeader title="Choose source" />
        <button
          type="button"
          style={styles.optionButton}
          onClick={() => setShowAIChat(true)}
          disabled={isAnalyzing}
        >
          <span style={styles.optionTitle}>Ask our AI Health Advisor</span>
          <span style={styles.optionDescription}>Our AI Health Advisor is trained with hundreds of thousands medical journals.</span>
        </button>
        <label style={styles.optionButton}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileUpload}
            style={{ display: "none" }}
            disabled={isAnalyzing}
          />
          <span style={styles.optionTitle}>Upload PDF or image</span>
          <span style={styles.optionDescription}>Supports PDF, JPG, PNG, WEBP. Upload your bloodwork report or take a clear photo.</span>
        </label>
        <button type="button" style={{ ...styles.optionButton, ...styles.disabled }} disabled>
          <span style={{ ...styles.optionTitle, ...styles.disabledText }}>Upload CSV (coming soon)</span>
          <span style={{ ...styles.optionDescription, ...styles.disabledText }}>
            Perfect for wearable exports or provider spreadsheets.
          </span>
        </button>
        <button type="button" style={{ ...styles.optionButton, ...styles.disabled }} disabled>
          <span style={{ ...styles.optionTitle, ...styles.disabledText }}>Connect provider (coming soon)</span>
          <span style={{ ...styles.optionDescription, ...styles.disabledText }}>
            Quest, Labcorp, and more integrations on the roadmap.
          </span>
        </button>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="How it works" />
        <ol style={styles.timeline}>
          <li style={styles.timelineItem}>Parse your document and map biomarkers to standard codes.</li>
          <li style={styles.timelineItem}>Normalise units and compare against evidence-informed ranges.</li>
          <li style={styles.timelineItem}>Review detected markers, tweak anything, and confirm upload.</li>
        </ol>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Past uploads" />
        <div style={styles.pastRow}>
          <div>
            <p style={styles.pastTitle}>July 2025 - Complete blood count</p>
            <span style={styles.pastMeta}>18 markers - 95% parser confidence</span>
          </div>
          <Link to="/history" style={styles.link}>
            View
          </Link>
        </div>
        <hr style={styles.divider} />
        <div style={styles.pastRow}>
          <div>
            <p style={styles.pastTitle}>April 2025 - Metabolic panel</p>
            <span style={styles.pastMeta}>12 markers - Manual review</span>
          </div>
          <Link to="/history" style={styles.link}>
            View
          </Link>
        </div>
        <div style={styles.emptyState}>
          <h4 style={styles.emptyTitle}>No labs yet?</h4>
          <p style={styles.emptyCopy}>Upload your first lab report to unlock personalised trends.</p>
        </div>
      </Card>

      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl
  },
  heading: {
    ...theme.typography.displayMd,
    margin: 0
  },
  subheading: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    margin: 0
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  demoDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.lg
  },
  advisorDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.md
  },
  optionButton: {
    textAlign: "left" as const,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface,
    padding: `${theme.spacing.lg}px`,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs,
    fontFamily: "inherit"
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.colors.text
  },
  optionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  disabled: {
    background: theme.colors.background,
    cursor: "not-allowed"
  },
  disabledText: {
    color: theme.colors.textSecondary
  },
  timeline: {
    margin: 0,
    paddingInlineStart: theme.spacing.lg,
    display: "grid",
    gap: theme.spacing.sm
  },
  timelineItem: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  pastRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pastTitle: {
    fontSize: 15,
    fontWeight: 600,
    margin: 0
  },
  pastMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  divider: {
    border: "none",
    borderTop: `1px solid ${theme.colors.divider}`,
    margin: `${theme.spacing.md}px 0`
  },
  emptyState: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  emptyCopy: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  link: {
    color: theme.colors.primary,
    fontWeight: 600
  },
  analyzingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "70vh",
    padding: theme.spacing.xl
  },
  analyzingContent: {
    textAlign: "center" as const,
    maxWidth: 400
  },
  spinner: {
    width: 60,
    height: 60,
    border: `4px solid ${theme.colors.divider}`,
    borderTop: `4px solid ${theme.colors.primary}`,
    borderRadius: "50%",
    margin: "0 auto",
    marginBottom: theme.spacing.xl,
    animation: "spin 1s linear infinite"
  },
  analyzingTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.md
  },
  analyzingText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.xl,
    lineHeight: "22px"
  },
  progressSteps: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: theme.colors.divider,
    position: "relative" as const
  },
  stepActive: {
    background: "#FEFEFE",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)"
  },
  stepPending: {
    opacity: 0.5
  },
  stepIconContainer: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.3s ease"
  },
  stepIcon: {
    fontSize: 20
  },
  stepText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: 500,
    flex: 1
  },
  activeIndicator: {
    position: "absolute" as const,
    right: theme.spacing.md,
    top: "50%",
    transform: "translateY(-50%)"
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: theme.colors.primary,
    animation: "pulse 1.5s ease-in-out infinite"
  }
});

export default UploadScreen;
