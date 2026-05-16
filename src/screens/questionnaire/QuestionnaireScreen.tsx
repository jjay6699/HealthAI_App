import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Modal from "../../components/Modal";
import ProgressBar from "../../components/ProgressBar";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";

const sections = [
  {
    title: "How have you been feeling?",
    titleKey: "questionnaire.section.feeling.title",
    description: "Past 30 days-rate or note what applies.",
    descriptionKey: "questionnaire.section.feeling.description",
    items: [
      "questionnaire.item.fatigue",
      "questionnaire.item.brainFog",
      "questionnaire.item.mood",
      "questionnaire.item.headaches",
      "questionnaire.item.dizziness",
      "questionnaire.item.temperature",
      "questionnaire.item.hairSkin",
      "questionnaire.item.digestive",
      "questionnaire.item.jointMuscle",
      "questionnaire.item.menstrual"
    ]
  },
  {
    title: "Your sleep",
    titleKey: "questionnaire.section.sleep.title",
    description: "Tell us about your typical week.",
    descriptionKey: "questionnaire.section.sleep.description",
    items: [
      "questionnaire.item.sleepDuration",
      "questionnaire.item.sleepQuality",
      "questionnaire.item.sleepLatency",
      "questionnaire.item.nightAwakenings",
      "questionnaire.item.snoring",
      "questionnaire.item.chronotype"
    ]
  },
  {
    title: "Daily stress",
    titleKey: "questionnaire.section.stress.title",
    description: "How does stress show up for you?",
    descriptionKey: "questionnaire.section.stress.description",
    items: [
      "questionnaire.item.perceivedStress",
      "questionnaire.item.majorStressors",
      "questionnaire.item.relaxation"
    ]
  },
  {
    title: "Eating patterns",
    titleKey: "questionnaire.section.eating.title",
    description: "Share a snapshot of your nutrition.",
    descriptionKey: "questionnaire.section.eating.description",
    items: [
      "questionnaire.item.fruitVeg",
      "questionnaire.item.protein",
      "questionnaire.item.omega3",
      "questionnaire.item.ultraProcessed",
      "questionnaire.item.water",
      "questionnaire.item.addedSugar",
      "questionnaire.item.fiber"
    ]
  },
  {
    title: "Movement",
    titleKey: "questionnaire.section.movement.title",
    description: "Capture your weekly activity mix.",
    descriptionKey: "questionnaire.section.movement.description",
    items: [
      "questionnaire.item.moderateCardio",
      "questionnaire.item.vigorousCardio",
      "questionnaire.item.strengthTraining",
      "questionnaire.item.mobility",
      "questionnaire.item.steps",
      "questionnaire.item.recentChanges"
    ]
  },
  {
    title: "Your environment",
    titleKey: "questionnaire.section.environment.title",
    description: "Track context that influences recovery.",
    descriptionKey: "questionnaire.section.environment.description",
    items: [
      "questionnaire.item.sunlight",
      "questionnaire.item.indoorTime",
      "questionnaire.item.smoking",
      "questionnaire.item.shiftWork"
    ]
  },
  {
    title: "Safety checks",
    titleKey: "questionnaire.section.safety.title",
    description: "We use this to keep nutrition suggestions safe.",
    descriptionKey: "questionnaire.section.safety.description",
    items: [
      "questionnaire.item.knownAllergies",
      "questionnaire.item.kidneyLiver",
      "questionnaire.item.bleeding",
      "questionnaire.item.pregnancy"
    ]
  },
  {
    title: "Your goals",
    titleKey: "questionnaire.section.goals.title",
    description: "Select priorities and what success looks like.",
    descriptionKey: "questionnaire.section.goals.description",
    items: [
      "questionnaire.item.topGoals",
      "questionnaire.item.priorityOrder",
      "questionnaire.item.coachNotes"
    ]
  }
] satisfies Array<{
  title: string;
  titleKey: TranslationKey;
  description: string;
  descriptionKey: TranslationKey;
  items: TranslationKey[];
}>;

const QuestionnaireScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [showComplete, setShowComplete] = useState(false);

  const current = sections[sectionIndex];
  const progress = (sectionIndex + 1) / sections.length;

  const handleNext = () => {
    if (sectionIndex === sections.length - 1) {
      setShowComplete(true);
      return;
    }
    setSectionIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (sectionIndex === 0) {
      return;
    }
    setSectionIndex((prev) => prev - 1);
  };

  const handleComplete = () => {
    setShowComplete(false);
    navigate("/home");
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.progressLabel}>{t("questionnaire.sectionLabel", { current: sectionIndex + 1, total: sections.length })}</span>
        <ProgressBar progress={progress} />
        <h1 style={styles.heading}>{t("questionnaire.heading")}</h1>
        <p style={styles.subheading}>{t("questionnaire.subheading")}</p>
      </header>

      <Card style={styles.card} shadow>
        <SectionHeader title={t(current.titleKey)} subtitle={t(current.descriptionKey)} />
        <div style={styles.fieldGrid}>
          {current.items.map((item) => (
            <label key={item} style={styles.field}>
              <span style={styles.label}>{t(item)}</span>
              <input placeholder={t("questionnaire.typeResponse")} style={styles.input} />
            </label>
          ))}
        </div>
      </Card>

      <footer style={styles.footer}>
        <Button title={t("questionnaire.back")} variant="secondary" disabled={sectionIndex === 0} onClick={handleBack} fullWidth />
        <Button
          title={sectionIndex === sections.length - 1 ? t("questionnaire.submit") : t("questionnaire.next")}
          onClick={handleNext}
          fullWidth
        />
      </footer>

      {showComplete ? (
        <Modal
          title={t("questionnaire.completeTitle")}
          description={t("questionnaire.completeBody")}
          actionLabel={t("questionnaire.goHome")}
          onAction={handleComplete}
        />
      ) : null}
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    padding: `${theme.spacing.xl}px ${theme.spacing.xl}px ${theme.spacing.xxl}px`
  },
  header: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  progressLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: 600
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
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.divider}`,
    boxShadow: theme.shadows.soft
  },
  fieldGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text
  },
  input: {
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.background,
    fontSize: 15,
    color: theme.colors.text,
    fontFamily: "inherit",
    outline: "none"
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.md
  }
});

export default QuestionnaireScreen;

