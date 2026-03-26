import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import StickyFooter from "../../components/StickyFooter";
import { SHOW_LANGUAGE_SWITCHER } from "../../config/features";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis, translateBloodworkAnalysis } from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";
import { Language, useI18n } from "../../i18n";

type AnalysisMeta = {
  uploadedAt?: string;
  fileName?: string;
  fileType?: string;
};

const HomeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const width = `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [displayAnalysis, setDisplayAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);

  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);

  useEffect(() => {
    const storedAnalysis = persistentStorage.getItem(scopedKey("bloodworkAnalysis"));
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error("Failed to parse bloodwork analysis:", error);
      }
    }

    const storedMeta = persistentStorage.getItem(scopedKey("bloodworkAnalysisMeta"));
    if (storedMeta) {
      try {
        setMeta(JSON.parse(storedMeta));
      } catch (error) {
        console.error("Failed to parse bloodwork metadata:", error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!analysis) {
      setDisplayAnalysis(null);
      return;
    }

    translateBloodworkAnalysis(analysis, language)
      .then((translated) => {
        if (!cancelled) setDisplayAnalysis(translated);
      })
      .catch(() => {
        if (!cancelled) setDisplayAnalysis(analysis);
      });

    return () => {
      cancelled = true;
    };
  }, [analysis, language]);

  const formatDate = (iso?: string) => {
    if (!iso) return t("home.hero.noUploads");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t("home.hero.noUploads");
    const locale = language === "zh" ? "zh-CN" : language === "bm" ? "ms-MY" : "en-US";
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const latestInsights = (displayAnalysis?.detailedInsights || [])
    .slice(0, 2)
    .map((insight, index) => ({
      id: `insight-${index}`,
      title: insight.findings,
      summary: insight.impact,
      domain: insight.category
    }));

  const concernCount = displayAnalysis?.concerns?.length || 0;
  const recommendationCount = displayAnalysis?.recommendations?.length || 0;
  const statusTone = concernCount > 0 ? "warning" : "success";
  const statusLabel = concernCount > 0 ? t("home.status.needsReview") : t("home.status.inRange");

  const languageOptions: { value: Language; label: string }[] = [
    { value: "en", label: t("common.language.en") },
    { value: "zh", label: t("common.language.zh") },
    { value: "bm", label: t("common.language.bm") }
  ];

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTopRow}>
          <div style={styles.heroPill}>
            {t("home.hero.lastUpload")} - {formatDate(meta?.uploadedAt)}
          </div>
          {SHOW_LANGUAGE_SWITCHER ? (
            <div style={styles.languageSwitcher} aria-label={t("home.switcher.label")}>
              {languageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  style={{
                    ...styles.languageButton,
                    ...(language === option.value ? styles.languageButtonActive : {})
                  }}
                  onClick={() => setLanguage(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <h1 style={styles.heroTitle}>{t("home.hero.title")}</h1>
        <p style={styles.heroCopy}>
          {t("home.hero.copy")}
        </p>
        <div style={styles.heroBadges}>
          <Badge label={t("home.hero.badge.analysis")} tone="info" />
          <Badge label={t("home.hero.badge.progress")} tone="success" />
        </div>
      </section>

      <SectionHeader
        title={t("home.insights.title")}
        rightSlot={<Link to="/insights" style={styles.link}>{t("home.insights.viewAll")}</Link>}
        style={styles.sectionHeader}
      />

      <div style={styles.insightList}>
        {latestInsights.length > 0 ? (
          latestInsights.map((insight) => (
            <Card key={insight.id} style={styles.insightCard}>
              <Badge label={insight.domain} tone="info" />
              <h3 style={styles.cardTitle}>{insight.title}</h3>
              <p style={styles.cardBody}>{insight.summary}</p>
              <Link to="/insights" style={styles.cardLink}>
                {t("home.insights.seeDetails")}
              </Link>
            </Card>
          ))
        ) : (
          <Card style={styles.insightCard}>
            <h3 style={styles.cardTitle}>{t("home.insights.emptyTitle")}</h3>
            <p style={styles.cardBody}>{t("home.insights.emptyBody")}</p>
            <Link to="/upload" style={styles.cardLink}>
              {t("home.insights.uploadNow")}
            </Link>
          </Card>
        )}
      </div>

      <Card style={styles.statusCard} shadow={false}>
        <div style={styles.statusHeader}>
          <div>
            <h3 style={styles.statusTitle}>{t("home.status.title")}</h3>
            <p style={styles.statusSub}>
              {meta?.uploadedAt
                ? t("home.status.basedOn", { date: formatDate(meta.uploadedAt) })
                : t("home.hero.noUploads")}
            </p>
          </div>
          <Badge label={statusLabel} tone={statusTone} />
        </div>
        <div style={styles.statusGrid}>
          <div>
            <span style={styles.statusLabel}>{t("home.status.concerns")}</span>
            <p style={styles.statusValue}>{concernCount}</p>
          </div>
          <div>
            <span style={styles.statusLabel}>{t("home.status.recommendations")}</span>
            <p style={styles.statusValue}>{recommendationCount}</p>
          </div>
        </div>
        {displayAnalysis?.summary && (
          <p style={styles.statusSummary}>{displayAnalysis.summary}</p>
        )}
      </Card>

      <StickyFooter width={width}>
        <Button title={t("home.footer.upload")} fullWidth onClick={() => navigate("/upload")} style={{ flex: 1 }} />
        <Button title={t("home.footer.viewHistory")} variant="secondary" onClick={() => navigate("/history")} style={{ minWidth: 140 }} />
      </StickyFooter>
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
  hero: {
    background: `linear-gradient(135deg, ${theme.colors.accentPeach} 0%, ${theme.colors.accentBlue} 100%)`,
    borderRadius: theme.radii.xl,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  heroTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    flexWrap: "wrap" as const
  },
  heroPill: {
    alignSelf: "flex-start" as const,
    borderRadius: theme.radii.pill,
    background: `${theme.colors.primary}22`,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 600,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`
  },
  languageSwitcher: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: theme.radii.pill,
    background: "rgba(255,255,255,0.72)",
    border: `1px solid ${theme.colors.divider}`
  },
  languageButton: {
    border: "none",
    background: "transparent",
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: 700,
    borderRadius: theme.radii.pill,
    padding: "6px 10px",
    cursor: "pointer"
  },
  languageButtonActive: {
    background: theme.colors.primary,
    color: theme.colors.background
  },
  heroTitle: {
    ...theme.typography.headingLg,
    margin: 0,
    color: theme.colors.text
  },
  heroCopy: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: "24px"
  },
  heroBadges: {
    display: "flex",
    gap: theme.spacing.sm,
    flexWrap: "wrap" as const
  },
  sectionHeader: {
    marginTop: theme.spacing.sm
  },
  link: {
    color: theme.colors.primary,
    fontWeight: 600
  },
  insightList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  insightCard: {
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px ${theme.spacing.md}px`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  cardTitle: {
    ...theme.typography.headingSm,
    margin: 0
  },
  cardBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0
  },
  cardLink: {
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14
  },
  statusCard: {
    marginTop: theme.spacing.sm,
    border: `1px solid ${theme.colors.divider}`
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0
  },
  statusSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: `${theme.spacing.xs}px 0 0`
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: theme.spacing.md
  },
  statusLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 700,
    margin: `${theme.spacing.xs}px 0 0`
  },
  statusSummary: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: "20px"
  }
});

export default HomeScreen;
