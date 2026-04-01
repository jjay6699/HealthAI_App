import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import AIChat from "../../components/AIChat";
import Dialog from "../../components/Dialog";
import { AppTheme, useTheme } from "../../theme";
import {
  analyzeBloodworkFile,
  analyzeBloodworkImages,
  analyzeBloodworkPdf,
  analyzeHealthDocumentBundle
} from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";
import { useI18n } from "../../i18n";

type IntegrationTab = "wearables" | "apps";

const UploadScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDeviceConnect, setShowDeviceConnect] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [activeIntegrationTab, setActiveIntegrationTab] = useState<IntegrationTab>("wearables");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [pastUploads, setPastUploads] = useState<Array<{ id: string; uploadedAt?: string; fileName?: string; concerns?: string[]; detailedInsights?: Array<{ category?: string }> }>>([]);
  const [showHealthConsentDialog, setShowHealthConsentDialog] = useState(false);
  const [pendingAnalyzeFiles, setPendingAnalyzeFiles] = useState<File[] | null>(null);
  const [healthConsentChecked, setHealthConsentChecked] = useState(false);
  const wearableIntegrations = [
    { id: "apple-watch", name: "Apple Watch", description: t("upload.modal.integration.appleWatch") },
    { id: "garmin-watch", name: "Garmin Watch", description: t("upload.modal.integration.garminWatch") },
    { id: "fitbit", name: "Fitbit", description: t("upload.modal.integration.fitbit") },
    { id: "galaxy-watch", name: "Samsung Galaxy Watch", description: t("upload.modal.integration.galaxyWatch") }
  ] as const;
  const fitnessApps = [
    { id: "apple-health", name: "Apple Health", description: t("upload.modal.integration.appleHealth") },
    { id: "google-fit", name: "Google Fit", description: t("upload.modal.integration.googleFit") },
    { id: "strava", name: "Strava", description: t("upload.modal.integration.strava") },
    { id: "myfitnesspal", name: "MyFitnessPal", description: t("upload.modal.integration.myfitnesspal") }
  ] as const;

  const localizedStepLabels = [
    t("upload.analyzing.step.reading"),
    t("upload.analyzing.step.extracting"),
    t("upload.analyzing.step.values"),
    t("upload.analyzing.step.recommending")
  ];

  const analysisSteps = [
    { icon: "📄", text: "Reading document", color: "#8B5CF6" },
    { icon: "🔍", text: "Extracting biomarkers", color: "#3B82F6" },
    { icon: "🧬", text: "Analyzing values", color: "#10B981" },
    { icon: "💊", text: "Recommending nutrition products", color: "#F59E0B" }
  ];

  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);

  React.useEffect(() => {
    const raw = persistentStorage.getItem(scopedKey("bloodworkHistory"));
    if (!raw) {
      setPastUploads([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setPastUploads(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPastUploads([]);
    }
  }, [user?.id]);

  const hasHealthDataConsent = () => {
    const consent = persistentStorage.getJSON<{
      healthDataProcessingAccepted?: boolean;
      termsPrivacyAccepted?: boolean;
      researchParticipation?: boolean;
      marketingCommunication?: boolean;
      policyVersion?: string;
      acceptedAt?: string;
    }>("userConsents", {});
    return consent.healthDataProcessingAccepted === true;
  };

  const persistHealthDataConsent = () => {
    const current = persistentStorage.getJSON<{
      healthDataProcessingAccepted?: boolean;
      termsPrivacyAccepted?: boolean;
      researchParticipation?: boolean;
      marketingCommunication?: boolean;
      policyVersion?: string;
      acceptedAt?: string;
    }>("userConsents", {});

    persistentStorage.setJSON("userConsents", {
      ...current,
      healthDataProcessingAccepted: true,
      policyVersion: "2026-03",
      acceptedAt: new Date().toISOString()
    });
  };

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

  const analyzeFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log("Analyzing files:", files.map((file) => file.name).join(", "));

      let analysis;
      const hasPdf = files.some((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
      const allImages = files.every((file) => (file.type || "").startsWith("image/"));

      if (files.length > 1 && allImages) {
        const images = await Promise.all(
          files.map(async (file) => ({
            base64: await fileToBase64(file),
            fileType: file.type || "image/jpeg"
          }))
        );
        const [result] = await Promise.all([
          analyzeBloodworkImages(images),
          new Promise(resolve => setTimeout(resolve, 6000))
        ]);
        analysis = result;
      } else if (files.length > 1) {
        const [result] = await Promise.all([
          analyzeHealthDocumentBundle(files),
          new Promise(resolve => setTimeout(resolve, 6000)) // Minimum 6 seconds for UX
        ]);
        analysis = result;
      } else if (hasPdf) {
        const file = files[0];
        const [result] = await Promise.all([
          analyzeBloodworkPdf(file),
          new Promise(resolve => setTimeout(resolve, 6000)) // Minimum 6 seconds for UX
        ]);
        analysis = result;
      } else {
        const file = files[0];
        const base64 = await fileToBase64(file);
        const [result] = await Promise.all([
          analyzeBloodworkFile(base64, file.type),
          new Promise(resolve => setTimeout(resolve, 6000)) // Minimum 6 seconds for UX
        ]);
        analysis = result;
      }

      // Save (locally + to Railway-backed SQLite when available)
      persistentStorage.setItem(scopedKey("bloodworkAnalysis"), JSON.stringify(analysis));
      const uploadedAt = new Date().toISOString();
      const fileName = files.map((file) => file.name).join(", ");
      const fileType =
        files.length > 1 && allImages
          ? "images"
          : files.length > 1
          ? "document-bundle"
          : hasPdf
          ? "application/pdf"
          : (files[0].type || "unknown");
      const fileSize = files.reduce((total, file) => total + file.size, 0);

      persistentStorage.setItem(
        scopedKey("bloodworkAnalysisMeta"),
        JSON.stringify({
          uploadedAt,
          fileName,
          fileType,
          fileSize
        })
      );

      const historyRaw = persistentStorage.getItem(scopedKey("bloodworkHistory"));
      let history: any[] = [];
      if (historyRaw) {
        try {
          history = JSON.parse(historyRaw);
        } catch {
          history = [];
        }
      }
      history.unshift({
        id: `${uploadedAt}:${fileName}:${fileSize}`,
        uploadedAt,
        fileName,
        fileType,
        fileSize,
        summary: analysis.summary,
        concerns: analysis.concerns || [],
        strengths: analysis.strengths || [],
        recommendations: analysis.recommendations || [],
        detailedInsights: analysis.detailedInsights || []
      });
      const nextHistory = history.slice(0, 20);
      persistentStorage.setItem(scopedKey("bloodworkHistory"), JSON.stringify(nextHistory));
      setPastUploads(nextHistory);

      // Navigate to insights
      navigate("/insights");
    } catch (err) {
      console.error("Error analyzing file:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze file. Please try again.");
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setQueuedFiles((current) => [...current, ...files]);
    setError(null);
    event.target.value = "";
  };

  const handleAnalyzeQueuedFiles = async () => {
    if (queuedFiles.length === 0 || isAnalyzing) return;
    if (!hasHealthDataConsent()) {
      setPendingAnalyzeFiles(queuedFiles);
      setHealthConsentChecked(false);
      setShowHealthConsentDialog(true);
      return;
    }
    await analyzeFiles(queuedFiles);
  };

  const handleConfirmHealthConsent = async () => {
    if (!healthConsentChecked) {
      setError(t("upload.consent.requiredError"));
      return;
    }

    persistHealthDataConsent();
    setShowHealthConsentDialog(false);
    setError(null);

    const filesToAnalyze = pendingAnalyzeFiles ?? queuedFiles;
    setPendingAnalyzeFiles(null);
    if (filesToAnalyze.length > 0) {
      await analyzeFiles(filesToAnalyze);
    }
  };

  const handleRemoveQueuedFile = (index: number) => {
    setQueuedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
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

  const toggleIntegration = (id: string) => {
    setConnectedIntegrations((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };



  // Show analyzing screen when processing
  if (isAnalyzing) {
    return (
      <div style={styles.analyzingContainer}>
        <div style={styles.analyzingContent}>
          <div style={styles.spinner}></div>
          <h2 style={styles.analyzingTitle}>{t("upload.analyzing.title")}</h2>
          <p style={styles.analyzingText}>
            {t("upload.analyzing.body")}
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
                    {localizedStepLabels[index] ?? step.text}
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
      <h1 style={styles.heading}>{t("upload.heading")}</h1>
      <p style={styles.subheading}>
        {t("upload.subheading")}
      </p>

      {error && (
        <Card style={{ ...styles.card, background: theme.colors.accentPeach, border: `1px solid ${theme.colors.error}` }}>
          <p style={{ color: theme.colors.error, margin: 0, fontSize: 14 }}>{error}</p>
        </Card>
      )}
      <Card style={styles.card}>
        <SectionHeader title={t("upload.howItWorks")} />
        <ol style={styles.timeline}>
          <li style={styles.timelineItem}>{t("upload.step1")}</li>
          <li style={styles.timelineItem}>{t("upload.step2")}</li>
          <li style={styles.timelineItem}>{t("upload.step3")}</li>
        </ol>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Photo tips for best accuracy" />
        <ul style={styles.captureTipsList}>
          <li style={styles.captureTipItem}>Place the report on a flat surface (no curves or folds).</li>
          <li style={styles.captureTipItem}>Use bright, even lighting and avoid glare.</li>
          <li style={styles.captureTipItem}>Fill the frame with the table; take close‑ups if needed.</li>
          <li style={styles.captureTipItem}>Hold the phone steady and keep the text in focus.</li>
        </ul>
        <p style={styles.captureTipNote}>Clear, flat, well‑lit photos reduce number reading errors.</p>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("upload.chooseSource")} />
        <button
          type="button"
          style={styles.optionButton}
          onClick={() => setShowAIChat(true)}
          disabled={isAnalyzing}
        >
          <span style={styles.optionTitle}>{t("upload.ai.title")}</span>
          <span style={styles.optionDescription}>{t("upload.ai.description")}</span>
        </button>
        <label style={styles.optionButton}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileUpload}
            style={{ display: "none" }}
            disabled={isAnalyzing}
          />
          <span style={styles.optionTitle}>{queuedFiles.length > 0 ? "Add more files" : t("upload.file.title")}</span>
          <span style={styles.optionDescription}>
            {queuedFiles.length > 0 ? "You can keep adding files in order before analyzing." : t("upload.file.description")}
          </span>
        </label>

        {queuedFiles.length > 0 && (
          <div style={styles.queueContainer}>
            <p style={styles.queueTitle}>Selected files ({queuedFiles.length})</p>
            <div style={styles.queueList}>
              {queuedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} style={styles.queueItem}>
                  <span style={styles.queueItemText}>{`${index + 1}. ${file.name}`}</span>
                  <button type="button" style={styles.queueRemoveButton} onClick={() => handleRemoveQueuedFile(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <Button
              title={`Analyze ${queuedFiles.length} file${queuedFiles.length > 1 ? "s" : ""}`}
              onClick={handleAnalyzeQueuedFiles}
              fullWidth
              disabled={isAnalyzing || queuedFiles.length === 0}
            />
          </div>
        )}

        <button
          type="button"
          style={{
            ...styles.optionButton,
            ...(showDeviceConnect ? styles.optionButtonActive : {})
          }}
          onClick={() => setShowDeviceConnect(true)}
        >
          <span style={styles.optionTitle}>{t("upload.watch.title")}</span>
          <span style={styles.optionDescription}>
            {t("upload.watch.description")}
          </span>
        </button>
      </Card>


      <Card style={styles.card}>
        <SectionHeader title={t("upload.pastUploads")} />
        {pastUploads.length > 0 ? (
          pastUploads.slice(0, 2).map((entry, index) => (
            <React.Fragment key={entry.id || `${entry.fileName || "upload"}-${index}`}>
              <div style={styles.pastRow}>
                <div>
                  <p style={styles.pastTitle}>
                    {entry.uploadedAt
                      ? `${new Date(entry.uploadedAt).toLocaleDateString()} - ${entry.fileName || "Bloodwork upload"}`
                      : entry.fileName || "Bloodwork upload"}
                  </p>
                  <span style={styles.pastMeta}>
                    {(entry.detailedInsights || []).length} markers • {(entry.concerns || []).length > 0 ? "Needs review" : "In range"}
                  </span>
                </div>
                <Link to="/history" style={styles.link}>
                  {t("upload.history.view")}
                </Link>
              </div>
              {index < Math.min(1, pastUploads.length - 1) ? <hr style={styles.divider} /> : null}
            </React.Fragment>
          ))
        ) : (
          <div style={styles.emptyState}>
            <h4 style={styles.emptyTitle}>{t("upload.emptyTitle")}</h4>
            <p style={styles.emptyCopy}>{t("upload.emptyBody")}</p>
          </div>
        )}
      </Card>

      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}
      {showHealthConsentDialog ? (
        <Dialog
          title={t("upload.consent.title")}
          description={t("upload.consent.description")}
          onClose={() => {
            setShowHealthConsentDialog(false);
            setPendingAnalyzeFiles(null);
            setHealthConsentChecked(false);
          }}
          onConfirm={handleConfirmHealthConsent}
          confirmLabel={t("upload.consent.confirm")}
          cancelLabel={t("upload.consent.cancel")}
        >
          <label style={styles.consentCheckboxRow}>
            <input
              type="checkbox"
              checked={healthConsentChecked}
              onChange={(event) => setHealthConsentChecked(event.target.checked)}
              style={styles.consentCheckbox}
            />
            <span style={styles.consentCheckboxLabel}>{t("upload.consent.checkbox")}</span>
          </label>
        </Dialog>
      ) : null}
      {showDeviceConnect ? (
        <Dialog
          title={t("upload.modal.title")}
          description={t("upload.modal.description")}
          onClose={() => {
            setShowDeviceConnect(false);
            setActiveIntegrationTab("wearables");
          }}
          cancelLabel={t("upload.modal.done")}
        >
          <div style={styles.integrationSection}>
            <div style={styles.integrationTabs}>
              <button
                type="button"
                style={{
                  ...styles.integrationTabButton,
                  ...(activeIntegrationTab === "wearables" ? styles.integrationTabButtonActive : {})
                }}
                onClick={() => setActiveIntegrationTab("wearables")}
              >
                {t("upload.modal.wearables")}
              </button>
              <button
                type="button"
                style={{
                  ...styles.integrationTabButton,
                  ...(activeIntegrationTab === "apps" ? styles.integrationTabButtonActive : {})
                }}
                onClick={() => setActiveIntegrationTab("apps")}
              >
                {t("upload.modal.fitnessApps")}
              </button>
            </div>

            {activeIntegrationTab === "wearables" ? (
              <div style={styles.integrationGroup}>
                <div>
                  <h3 style={styles.integrationTitle}>{t("upload.modal.wearablesTitle")}</h3>
                  <p style={styles.integrationIntro}>{t("upload.modal.wearablesIntro")}</p>
                </div>
                <div style={styles.integrationList}>
                  {wearableIntegrations.map((integration) => {
                    const isConnected = connectedIntegrations.includes(integration.id);
                    return (
                      <div key={integration.id} style={styles.integrationRow}>
                        <div style={styles.integrationCopy}>
                          <span style={styles.integrationName}>{integration.name}</span>
                          <span style={styles.integrationDescription}>{integration.description}</span>
                        </div>
                        <button
                          type="button"
                          style={{
                            ...styles.integrationButton,
                            ...(isConnected ? styles.integrationButtonConnected : {})
                          }}
                          onClick={() => toggleIntegration(integration.id)}
                        >
                          {isConnected ? t("upload.modal.connected") : t("upload.modal.connect")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={styles.integrationGroup}>
                <div>
                  <h3 style={styles.integrationTitle}>{t("upload.modal.appsTitle")}</h3>
                  <p style={styles.integrationIntro}>{t("upload.modal.appsIntro")}</p>
                </div>
                <div style={styles.integrationList}>
                  {fitnessApps.map((integration) => {
                    const isConnected = connectedIntegrations.includes(integration.id);
                    return (
                      <div key={integration.id} style={styles.integrationRow}>
                        <div style={styles.integrationCopy}>
                          <span style={styles.integrationName}>{integration.name}</span>
                          <span style={styles.integrationDescription}>{integration.description}</span>
                        </div>
                        <button
                          type="button"
                          style={{
                            ...styles.integrationButton,
                            ...(isConnected ? styles.integrationButtonConnected : {})
                          }}
                          onClick={() => toggleIntegration(integration.id)}
                        >
                          {isConnected ? t("upload.modal.connected") : t("upload.modal.connect")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      ) : null}
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
  optionButtonActive: {
    borderColor: theme.colors.primary,
    boxShadow: "0 10px 24px rgba(197,138,74,0.14)"
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
  integrationSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    maxHeight: "58vh",
    overflowY: "auto" as const,
    paddingRight: 4
  },
  integrationTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.sm
  },
  integrationTabButton: {
    borderRadius: theme.radii.pill,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: 700,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    cursor: "pointer"
  },
  integrationTabButtonActive: {
    borderColor: theme.colors.primary,
    background: `${theme.colors.primary}18`,
    color: theme.colors.primary
  },
  integrationGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    borderRadius: theme.radii.xl,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.divider}`,
    padding: theme.spacing.md
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0
  },
  integrationIntro: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: `${theme.spacing.xs}px 0 0`
  },
  integrationList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  integrationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    padding: `${theme.spacing.md}px`,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background
  },
  integrationCopy: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0
  },
  integrationName: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text
  },
  integrationDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: "18px"
  },
  integrationButton: {
    borderRadius: theme.radii.pill,
    border: `1px solid ${theme.colors.primary}`,
    background: theme.colors.surface,
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: 700,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    cursor: "pointer",
    whiteSpace: "nowrap" as const
  },
  integrationButtonConnected: {
    background: theme.colors.primary,
    color: theme.colors.background
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
  captureTipsList: {
    margin: 0,
    paddingInlineStart: theme.spacing.lg,
    display: "grid",
    gap: theme.spacing.xs
  },
  captureTipItem: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  captureTipNote: {
    margin: 0,
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  queueContainer: {
    display: "grid",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    width: "100%",
    maxWidth: "100%",
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    overflow: "hidden"
  },
  queueTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.text
  },
  queueList: {
    display: "grid",
    gap: theme.spacing.xs,
    minWidth: 0
  },
  queueItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minWidth: 0,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface
  },
  queueItemText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const
  },
  queueRemoveButton: {
    border: "none",
    background: "transparent",
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
    padding: 0
  },
  consentCheckboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    cursor: "pointer"
  },
  consentCheckbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `1px solid ${theme.colors.divider}`,
    flexShrink: 0
  },
  consentCheckboxLabel: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: "20px"
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
