import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Modal from "../../components/Modal";
import ProgressBar from "../../components/ProgressBar";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";

const sections = [
  {
    title: "How have you been feeling?",
    description: "Past 30 days-rate or note what applies.",
    items: [
      "Fatigue levels (0-10)",
      "Brain fog or difficulty concentrating (0-10)",
      "Mood: low mood, anxiety, irritability (0-10 each)",
      "Headaches or migraines (days per week)",
      "Dizziness or lightheadedness (Y/N)",
      "Temperature sensitivity (Y/N)",
      "Hair, nails, or skin changes",
      "Digestive changes (frequency scale)",
      "Joint or muscle discomfort (0-10)",
      "Menstrual symptoms (if applicable)"
    ]
  },
  {
    title: "Your sleep",
    description: "Tell us about your typical week.",
    items: [
      "Average sleep duration (hours)",
      "Sleep quality (0-10)",
      "Sleep latency (>30 min? Y/N)",
      "Night awakenings (nights/week)",
      "Snoring or suspected apnea (Y/N)",
      "Chronotype (early/intermediate/late)"
    ]
  },
  {
    title: "Daily stress",
    description: "How does stress show up for you?",
    items: [
      "Perceived stress (0-10)",
      "Major stressors",
      "Relaxation practices (minutes per week)"
    ]
  },
  {
    title: "Eating patterns",
    description: "Share a snapshot of your nutrition.",
    items: [
      "Fruit and veg servings per day",
      "Protein per meal (rough grams)",
      "Omega-3 sources 2x per week (Y/N)",
      "Ultra-processed foods (frequency)",
      "Water intake (cups per day)",
      "Added sugar intake",
      "Fiber (g per day)"
    ]
  },
  {
    title: "Movement",
    description: "Capture your weekly activity mix.",
    items: [
      "Moderate cardio minutes",
      "Vigorous cardio minutes",
      "Strength training minutes",
      "Mobility or recovery minutes",
      "Step count (if known)",
      "Recent changes (increasing/stable/decreasing)"
    ]
  },
  {
    title: "Your environment",
    description: "Track context that influences recovery.",
    items: [
      "Sunlight exposure (minutes per day)",
      "Indoor time (hours per day)",
      "Smoking or vaping",
      "Shift work or frequent jet lag (Y/N)"
    ]
  },
  {
    title: "Safety checks",
    description: "We use this to keep supplement suggestions safe.",
    items: [
      "Known allergies (medications or supplements)",
      "Kidney or liver conditions",
      "Bleeding disorders or anticoagulants",
      "Pregnancy or trying to conceive"
    ]
  },
  {
    title: "Your goals",
    description: "Select priorities and what success looks like.",
    items: [
      "Top goals (select all that apply)",
      "Priority order",
      "Notes for your coach (optional)"
    ]
  }
];

const QuestionnaireScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        <span style={styles.progressLabel}>Section {sectionIndex + 1} of {sections.length}</span>
        <ProgressBar progress={progress} />
        <h1 style={styles.heading}>Lifestyle questionnaire</h1>
        <p style={styles.subheading}>Quick check-in so we can deliver precise, evidence-based guidance.</p>
      </header>

      <Card style={styles.card} shadow>
        <SectionHeader title={current.title} subtitle={current.description} />
        <div style={styles.fieldGrid}>
          {current.items.map((item) => (
            <label key={item} style={styles.field}>
              <span style={styles.label}>{item}</span>
              <input placeholder="Type response" style={styles.input} />
            </label>
          ))}
        </div>
      </Card>

      <footer style={styles.footer}>
        <Button title="Back" variant="secondary" disabled={sectionIndex === 0} onClick={handleBack} fullWidth />
        <Button
          title={sectionIndex === sections.length - 1 ? "Submit" : "Next"}
          onClick={handleNext}
          fullWidth
        />
      </footer>

      {showComplete ? (
        <Modal
          title="Thanks for registering!"
          description="We'll start analysing your information and keep your recommendations up to date."
          actionLabel="Go to home"
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
