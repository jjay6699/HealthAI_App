import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ProgressBar from "../../components/ProgressBar";
import { AppTheme, useTheme } from "../../theme";

type FieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  format?: "date";
  options?: string[];
  kind?: "text" | "select" | "multiselect" | "checkbox";
  maxSelected?: number;
  helper?: string;
  checkboxLabel?: string;
};

type IntakeProfile = {
  name: string;
  gender: string;
  dob: string;
  height: number;
  weight: number;
  bloodPressure: string;
  fastingGlucose: number;
  hba1c: number;
  restingHeartRate: number;
  waistCircumference: number;
  bodyFat: number;
  activityLevel: string;
  exerciseDays: number;
  minutesPerSession: number;
  sleepDuration: string;
  stressLevel: string;
  dietPattern: string;
  mealsPerDay: number;
  allergies: string;
  caffeineIntake: string;
  waterIntake: number;
  conditions: string;
  surgeries: string;
  medications: string;
  supplements: string;
  topPriorities: string;
  dataProcessingConsent: string;
};

type FieldValue = string | string[];
type RequiredRule = {
  key: string;
  label: string;
  validate: (value: FieldValue | undefined) => boolean;
};

const steps: {
  key: string;
  title: string;
  description: string;
  fields: FieldSpec[];
}[] = [
  {
    key: "basics",
    title: "Basics",
    description: "Tell us about you to personalise ranges.",
    fields: [
      { key: "firstName", label: "First name", placeholder: "e.g., Maya" },
      { key: "gender", label: "Gender", placeholder: "Select", options: ["Female", "Male"] },
      { key: "dob", label: "Date of birth", placeholder: "YYYY-MM-DD", inputMode: "numeric", format: "date" },
      { key: "heightCm", label: "Height", placeholder: "cm", type: "number", inputMode: "numeric" },
      { key: "weightKg", label: "Weight", placeholder: "kg", type: "number", inputMode: "numeric" }
    ]
  },
  {
    key: "vitals",
    title: "Vitals",
    description: "Optional vitals add context to your trends.",
    fields: [
      { key: "bloodPressure", label: "Blood pressure", placeholder: "120/80" },
      { key: "fastingGlucose", label: "Fasting glucose", placeholder: "mg/dL", type: "number", inputMode: "numeric" },
      { key: "hba1c", label: "HbA1c", placeholder: "%", type: "number", inputMode: "decimal" },
      { key: "restingHeartRate", label: "Resting heart rate", placeholder: "bpm", type: "number", inputMode: "numeric" },
      { key: "waistCircumference", label: "Waist circumference", placeholder: "cm", type: "number", inputMode: "numeric" },
      { key: "bodyFat", label: "Body fat %", placeholder: "%", type: "number", inputMode: "decimal" }
    ]
  },
  {
    key: "activity",
    title: "Activity",
    description: "How you move informs goal setting.",
    fields: [
      {
        key: "activityLevel",
        label: "Activity level",
        placeholder: "Select",
        options: ["Sedentary", "Lightly active", "Moderately active", "Very active"]
      },
      { key: "exerciseDays", label: "Exercise days per week", placeholder: "e.g., 3", type: "number", inputMode: "numeric" },
      { key: "minutesPerSession", label: "Minutes per session", placeholder: "e.g., 45", type: "number", inputMode: "numeric" },
      {
        key: "sleepDuration",
        label: "Sleep duration",
        placeholder: "Select",
        options: ["Under 5 hrs", "5-6 hrs", "6-7 hrs", "7-8 hrs", "8+ hrs"]
      },
      {
        key: "stressLevel",
        label: "Stress level",
        placeholder: "Select",
        options: ["Low", "Moderate", "High"]
      }
    ]
  },
  {
    key: "diet",
    title: "Diet",
    description: "Your eating pattern guides recommendations.",
    fields: [
      {
        key: "dietPattern",
        label: "Primary pattern",
        placeholder: "Select",
        options: ["Balanced", "Mediterranean", "Plant-based", "Vegetarian", "Vegan", "Low-carb", "Keto", "Paleo"]
      },
      { key: "mealsPerDay", label: "Meals per day", placeholder: "e.g., 3", type: "number", inputMode: "numeric" },
      { key: "allergies", label: "Allergies", placeholder: "List" },
      {
        key: "caffeineIntake",
        label: "Caffeine intake",
        placeholder: "Select",
        options: ["None", "Low (1 cup)", "Moderate (2-3 cups)", "High (4+ cups)"]
      },
      { key: "waterIntake", label: "Water intake", placeholder: "cups per day", type: "number", inputMode: "numeric" }
    ]
  },
  {
    key: "medical",
    title: "Medical context",
    description: "Anything we should account for?",
    fields: [
      { key: "conditions", label: "Conditions", placeholder: "Type to add" },
      { key: "surgeries", label: "Surgeries or hospitalisations", placeholder: "Optional" },
      { key: "medications", label: "Current medications", placeholder: "List" },
      { key: "supplements", label: "Current nutrition", placeholder: "List" }
    ]
  },
  {
    key: "goals",
    title: "Goals",
    description: "Choose what matters most right now.",
    fields: [
      {
        key: "topPriorities",
        label: "Top priorities (select up to 3)",
        kind: "multiselect",
        maxSelected: 3,
        options: [
          "More energy",
          "Metabolic health",
          "Weight management",
          "Gut health",
          "Better sleep",
          "Stress support",
          "Muscle & performance",
          "Longevity"
        ]
      }
    ]
  },
  {
    key: "consent",
    title: "Consents",
    description: "We take privacy seriously.",
    fields: [
      {
        key: "dataProcessingConsent",
        label: "Data processing consent",
        kind: "checkbox",
        checkboxLabel: "I agree to data processing for personalized recommendations.",
        helper: "Required to provide tailored nutrition guidance."
      }
    ]
  }
];

const ProfileIntakeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [attemptedNext, setAttemptedNext] = useState(false);

  const currentStep = steps[stepIndex];
  const progress = (stepIndex + 1) / steps.length;

  const requiredRules: RequiredRule[] = [
    { key: "firstName", label: "First name", validate: (value) => Boolean(String(value || "").trim()) },
    { key: "gender", label: "Gender", validate: (value) => Boolean(String(value || "").trim()) },
    { key: "dob", label: "Date of birth", validate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) },
    { key: "heightCm", label: "Height", validate: (value) => Number(value) > 0 },
    { key: "weightKg", label: "Weight", validate: (value) => Number(value) > 0 },
    {
      key: "activityLevel",
      label: "Activity level",
      validate: (value) => Boolean(String(value || "").trim())
    },
    {
      key: "dataProcessingConsent",
      label: "Data processing consent",
      validate: (value) => Boolean(String(value || "").trim())
    }
  ];

  const requiredMap = new Map(requiredRules.map((rule) => [rule.key, rule]));

  const isFieldRequired = (fieldKey: string) => requiredMap.has(fieldKey);
  const isFieldValid = (fieldKey: string) => {
    const rule = requiredMap.get(fieldKey);
    if (!rule) return true;
    return rule.validate(fieldValues[fieldKey]);
  };

  const isStepValid = () => currentStep.fields.every((field) => isFieldValid(field.key));

  const handleNext = () => {
    if (!isStepValid()) {
      setAttemptedNext(true);
      return;
    }
    if (stepIndex === steps.length - 1) {
      persistProfile(fieldValues);
      navigate("/questionnaire");
      return;
    }
    setStepIndex((prev) => prev + 1);
    setAttemptedNext(false);
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigate("/register");
      return;
    }
    setStepIndex((prev) => prev - 1);
    setAttemptedNext(false);
  };

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const fieldToProfileKey: Record<string, keyof IntakeProfile> = {
    firstName: "name",
    gender: "gender",
    dob: "dob",
    heightCm: "height",
    weightKg: "weight",
    bloodPressure: "bloodPressure",
    fastingGlucose: "fastingGlucose",
    hba1c: "hba1c",
    restingHeartRate: "restingHeartRate",
    waistCircumference: "waistCircumference",
    bodyFat: "bodyFat",
    activityLevel: "activityLevel",
    exerciseDays: "exerciseDays",
    minutesPerSession: "minutesPerSession",
    sleepDuration: "sleepDuration",
    stressLevel: "stressLevel",
    dietPattern: "dietPattern",
    mealsPerDay: "mealsPerDay",
    allergies: "allergies",
    caffeineIntake: "caffeineIntake",
    waterIntake: "waterIntake",
    conditions: "conditions",
    surgeries: "surgeries",
    medications: "medications",
    supplements: "supplements",
    topPriorities: "topPriorities",
    dataProcessingConsent: "dataProcessingConsent"
  };

  const numericProfileKeys = new Set<keyof IntakeProfile>([
    "height",
    "weight",
    "fastingGlucose",
    "hba1c",
    "restingHeartRate",
    "waistCircumference",
    "bodyFat",
    "exerciseDays",
    "minutesPerSession",
    "mealsPerDay",
    "waterIntake"
  ]);

  const persistProfile = (values: Record<string, FieldValue>) => {
    const saved = localStorage.getItem("userProfile");
    let existing: Partial<IntakeProfile> = {};
    if (saved) {
      try {
        existing = JSON.parse(saved);
      } catch {
        existing = {};
      }
    }

    const updates: Partial<IntakeProfile> = {};
    Object.entries(values).forEach(([key, value]) => {
      const profileKey = fieldToProfileKey[key];
      if (!profileKey) return;
      if (value === "" || (Array.isArray(value) && value.length === 0)) return;
      const normalized = Array.isArray(value) ? value.join(", ") : value;
      if (numericProfileKeys.has(profileKey)) {
        const parsed = Number(normalized);
        if (!Number.isNaN(parsed)) {
          updates[profileKey] = parsed as never;
        }
        return;
      }
      updates[profileKey] = normalized as never;
    });

    localStorage.setItem("userProfile", JSON.stringify({ ...existing, ...updates }));
  };

  React.useEffect(() => {
    const saved = localStorage.getItem("userProfile");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<IntakeProfile>;
      const seeded: Record<string, FieldValue> = {};
      const multiselectKeys = new Set(
        steps.flatMap((step) => step.fields.filter((field) => field.kind === "multiselect").map((field) => field.key))
      );
      Object.entries(fieldToProfileKey).forEach(([fieldKey, profileKey]) => {
        const value = parsed[profileKey];
        if (value === undefined || value === null) return;
        if (multiselectKeys.has(fieldKey) && typeof value === "string") {
          seeded[fieldKey] = value.split(",").map((entry) => entry.trim()).filter(Boolean);
          return;
        }
        seeded[fieldKey] = String(value);
      });
      setFieldValues(seeded);
    } catch {
      // Ignore malformed saved profile
    }
  }, []);

  const handleFieldChange = (field: FieldSpec, value: string) => {
    const nextValue = field.format === "date" ? formatDateInput(value) : value;
    setFieldValues((prev) => {
      const updated = { ...prev, [field.key]: nextValue };
      persistProfile({ [field.key]: nextValue });
      return updated;
    });
  };

  const toggleMultiSelect = (field: FieldSpec, option: string) => {
    setFieldValues((prev) => {
      const current = prev[field.key];
      const selected = Array.isArray(current) ? current : [];
      const exists = selected.includes(option);
      let next = exists ? selected.filter((value) => value !== option) : [...selected, option];
      if (!exists && field.maxSelected && next.length > field.maxSelected) {
        next = next.slice(0, field.maxSelected);
      }
      const updated = { ...prev, [field.key]: next };
      persistProfile({ [field.key]: next });
      return updated;
    });
  };

  const toggleCheckbox = (field: FieldSpec, checked: boolean) => {
    const value = checked ? "Granted" : "";
    setFieldValues((prev) => {
      const updated = { ...prev, [field.key]: value };
      persistProfile({ [field.key]: value });
      return updated;
    });
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.progressLabel}>Step {stepIndex + 1} of {steps.length}</span>
        <ProgressBar progress={progress} />
        <h2 style={styles.heading}>Let's tailor your insights</h2>
      </header>

      <Card style={styles.card} shadow>
        <h3 style={styles.stepTitle}>{currentStep.title}</h3>
        <p style={styles.stepDescription}>{currentStep.description}</p>
        <div style={styles.fieldGrid}>
          {currentStep.fields.map((field) => {
            const showError = attemptedNext && !isFieldValid(field.key) && isFieldRequired(field.key);
            return (
            <label key={field.key} style={styles.field}>
              <span style={styles.label}>{field.label}</span>
              {field.kind === "checkbox" ? (
                <div style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(fieldValues[field.key])}
                    onChange={(event) => toggleCheckbox(field, event.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.checkboxText}>{field.checkboxLabel || field.label}</span>
                </div>
              ) : field.kind === "multiselect" && field.options ? (
                <div style={styles.optionGrid}>
                  {field.options.map((option) => {
                    const selected = Array.isArray(fieldValues[field.key])
                      ? fieldValues[field.key].includes(option)
                      : false;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleMultiSelect(field, option)}
                        style={{
                          ...styles.optionChip,
                          ...(selected ? styles.optionChipActive : {})
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : field.options ? (
                <select
                  style={{ ...styles.select, ...(showError ? styles.inputError : {}) }}
                  value={typeof fieldValues[field.key] === "string" ? fieldValues[field.key] : ""}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                >
                  <option value="" disabled>
                    {field.placeholder || "Select"}
                  </option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder={field.placeholder}
                  style={{ ...styles.input, ...(showError ? styles.inputError : {}) }}
                  type={field.type || "text"}
                  inputMode={field.inputMode}
                  value={typeof fieldValues[field.key] === "string" ? fieldValues[field.key] : ""}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                />
              )}
              {field.helper ? <span style={styles.helperText}>{field.helper}</span> : null}
              {showError ? <span style={styles.errorText}>Required.</span> : null}
            </label>
          );})}
        </div>
      </Card>

      <footer style={styles.footer}>
        <Button
          title="Back"
          variant="secondary"
          onClick={handleBack}
          fullWidth
        />
        <Button
          title={stepIndex === steps.length - 1 ? "Finish" : "Next"}
          onClick={handleNext}
          disabled={!isStepValid()}
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
  card: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.divider}`,
    boxShadow: theme.shadows.soft
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
  helperText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error
  },
  input: {
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.background,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: "inherit",
    outline: "none"
  },
  inputError: {
    border: `1px solid ${theme.colors.error}`
  },
  select: {
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.background,
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: "inherit",
    appearance: "none" as const,
    outline: "none"
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: `1px solid ${theme.colors.divider}`
  },
  checkboxText: {
    fontSize: 14,
    color: theme.colors.text
  },
  optionGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: theme.spacing.sm
  },
  optionChip: {
    borderRadius: 999,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.text,
    cursor: "pointer"
  },
  optionChipActive: {
    background: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}`,
    color: theme.colors.background
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.md
  }
});

export default ProfileIntakeScreen;

