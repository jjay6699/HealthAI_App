import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ProgressBar from "../../components/ProgressBar";
import { AppTheme, useTheme } from "../../theme";

const steps = [
  {
    key: "basics",
    title: "Basics",
    description: "Tell us about you to personalise ranges.",
    fields: [
      { label: "First name", placeholder: "e.g., Maya" },
      { label: "Sex at birth", placeholder: "Female / Male" },
      { label: "Gender identity", placeholder: "Optional" },
      { label: "Date of birth", placeholder: "YYYY-MM-DD" },
      { label: "Height", placeholder: "cm or ft+in" },
      { label: "Weight", placeholder: "kg or lb" }
    ]
  },
  {
    key: "vitals",
    title: "Vitals",
    description: "Optional vitals add context to your trends.",
    fields: [
      { label: "Resting heart rate", placeholder: "bpm" },
      { label: "Blood pressure", placeholder: "120/80" },
      { label: "Waist circumference", placeholder: "cm" },
      { label: "Body fat %", placeholder: "Optional" }
    ]
  },
  {
    key: "activity",
    title: "Activity",
    description: "How you move informs goal setting.",
    fields: [
      { label: "Activity level", placeholder: "Sedentary / Light / Moderate / Very active" },
      { label: "Exercise days per week", placeholder: "e.g., 3" },
      { label: "Minutes per session", placeholder: "e.g., 45" }
    ]
  },
  {
    key: "diet",
    title: "Diet",
    description: "Your eating pattern guides recommendations.",
    fields: [
      { label: "Primary pattern", placeholder: "e.g., Mediterranean" },
      { label: "Meals per day", placeholder: "e.g., 3" },
      { label: "Allergies", placeholder: "List" }
    ]
  },
  {
    key: "medical",
    title: "Medical context",
    description: "Anything we should account for?",
    fields: [
      { label: "Conditions", placeholder: "Type to add" },
      { label: "Surgeries or hospitalisations", placeholder: "Optional" },
      { label: "Current medications", placeholder: "List" }
    ]
  },
  {
    key: "goals",
    title: "Goals",
    description: "Choose what matters most right now.",
    fields: [{ label: "Top priorities", placeholder: "Drag to rank" }]
  },
  {
    key: "consent",
    title: "Consents",
    description: "We take privacy seriously.",
    fields: [{ label: "Data processing consent", placeholder: "Required" }]
  }
] as const;

const ProfileIntakeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = steps[stepIndex];
  const progress = (stepIndex + 1) / steps.length;

  const handleNext = () => {
    if (stepIndex === steps.length - 1) {
      navigate("/questionnaire");
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigate(-1);
      return;
    }
    setStepIndex((prev) => prev - 1);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.progressLabel}>Step {stepIndex + 1} of {steps.length}</span>
        <ProgressBar progress={progress} />
        <h2 style={styles.heading}>Let's tailor your insights</h2>
      </header>

      <Card>
        <h3 style={styles.stepTitle}>{currentStep.title}</h3>
        <p style={styles.stepDescription}>{currentStep.description}</p>
        <div style={styles.fieldGrid}>
          {currentStep.fields.map((field) => (
            <label key={field.label} style={styles.field}>
              <span style={styles.label}>{field.label}</span>
              <input placeholder={field.placeholder} style={styles.input} />
            </label>
          ))}
        </div>
      </Card>

      <footer style={styles.footer}>
        <Button
          title="Back"
          variant="secondary"
          onClick={handleBack}
          disabled={stepIndex === 0}
          fullWidth
        />
        <Button
          title={stepIndex === steps.length - 1 ? "Finish" : "Next"}
          onClick={handleNext}
          fullWidth
        />
      </footer>
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
    ...theme.typography.headingLg,
    margin: 0,
    color: theme.colors.text
  },
  stepTitle: {
    ...theme.typography.headingMd,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text
  },
  stepDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg
  },
  fieldGrid: {
    display: "grid",
    gap: theme.spacing.lg
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
    padding: `${theme.spacing.lg}px`,
    background: theme.colors.surface,
    fontSize: 16,
    color: theme.colors.text
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.md
  }
});

export default ProfileIntakeScreen;
