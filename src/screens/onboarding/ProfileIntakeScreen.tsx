import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ProgressBar from "../../components/ProgressBar";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";
import { fetchUserProfile, saveUserProfile } from "../../services/profileApi";

type FieldSpec = {
  key: string;
  label: string;
  labelKey?: TranslationKey;
  placeholder?: string;
  placeholderKey?: TranslationKey;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  step?: number | "any";
  format?: "date";
  options?: string[];
  kind?: "text" | "select" | "multiselect" | "checkbox";
  maxSelected?: number;
  helper?: string;
  helperKey?: TranslationKey;
  checkboxLabel?: string;
  checkboxLabelKey?: TranslationKey;
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
  titleKey: TranslationKey;
  description: string;
  descriptionKey: TranslationKey;
  fields: FieldSpec[];
}[] = [
  {
    key: "basics",
    title: "Basics",
    titleKey: "intake.basics.title",
    description: "Tell us about you to personalise ranges.",
    descriptionKey: "intake.basics.description",
    fields: [
      { key: "firstName", label: "First name", labelKey: "intake.firstName", placeholder: "e.g., Maya", placeholderKey: "intake.firstName.placeholder" },
      { key: "gender", label: "Gender", labelKey: "intake.gender", placeholder: "Select", options: ["Female", "Male"] },
      { key: "dob", label: "Date of birth", labelKey: "intake.dob", placeholder: "YYYY-MM-DD", inputMode: "numeric", format: "date" },
      { key: "heightCm", label: "Height", labelKey: "intake.height", placeholder: "cm", type: "number", inputMode: "numeric" },
      { key: "weightKg", label: "Weight", labelKey: "intake.weight", placeholder: "kg", type: "number", inputMode: "numeric" }
    ]
  },
  {
    key: "vitals",
    title: "Vitals",
    titleKey: "intake.vitals.title",
    description: "Optional vitals add context to your trends.",
    descriptionKey: "intake.vitals.description",
    fields: [
      { key: "bloodPressure", label: "Blood pressure", labelKey: "intake.bloodPressure", placeholder: "120/80" },
      { key: "fastingGlucose", label: "Fasting glucose", labelKey: "intake.fastingGlucose", placeholder: "mmol/L", type: "number", inputMode: "decimal", step: 0.1 },
      { key: "hba1c", label: "HbA1c", placeholder: "%", type: "number", inputMode: "decimal" },
      { key: "restingHeartRate", label: "Resting heart rate", labelKey: "intake.restingHeartRate", placeholder: "bpm", type: "number", inputMode: "numeric" },
      { key: "waistCircumference", label: "Waist circumference", labelKey: "intake.waistCircumference", placeholder: "cm", type: "number", inputMode: "numeric" },
      { key: "bodyFat", label: "Body fat %", labelKey: "intake.bodyFat", placeholder: "%", type: "number", inputMode: "decimal" }
    ]
  },
  {
    key: "activity",
    title: "Activity",
    titleKey: "intake.activity.title",
    description: "How you move informs goal setting.",
    descriptionKey: "intake.activity.description",
    fields: [
      {
        key: "activityLevel",
        label: "Activity level",
        labelKey: "intake.activityLevel",
        placeholder: "Select",
        options: ["Sedentary", "Lightly active", "Moderately active", "Very active"]
      },
      { key: "exerciseDays", label: "Exercise days per week", labelKey: "intake.exerciseDays", placeholder: "e.g., 3", type: "number", inputMode: "numeric" },
      { key: "minutesPerSession", label: "Minutes per session", labelKey: "intake.minutesPerSession", placeholder: "e.g., 45", type: "number", inputMode: "numeric" },
      {
        key: "sleepDuration",
        label: "Sleep duration",
        labelKey: "intake.sleepDuration",
        placeholder: "Select",
        options: ["Under 5 hrs", "5-6 hrs", "6-7 hrs", "7-8 hrs", "8+ hrs"]
      },
      {
        key: "stressLevel",
        label: "Stress level",
        labelKey: "intake.stressLevel",
        placeholder: "Select",
        options: ["Low", "Moderate", "High"]
      }
    ]
  },
  {
    key: "diet",
    title: "Diet",
    titleKey: "intake.diet.title",
    description: "Your eating pattern guides recommendations.",
    descriptionKey: "intake.diet.description",
    fields: [
      {
        key: "dietPattern",
        label: "Primary pattern",
        labelKey: "intake.primaryPattern",
        placeholder: "Select",
        options: [
          "Balanced",
          "Mediterranean",
          "Plant-based",
          "Vegetarian",
          "Vegan",
          "Low-carb",
          "Keto",
          "Paleo",
          "Standard American Diet (SAD)",
          "Fast Food Heavy",
          "High-Junk / Junk Food",
          "No Specific Pattern"
        ]
      },
      { key: "mealsPerDay", label: "Meals per day", labelKey: "intake.mealsPerDay", placeholder: "e.g., 3", type: "number", inputMode: "numeric" },
      { key: "allergies", label: "Allergies", labelKey: "intake.allergies", placeholder: "List", placeholderKey: "intake.placeholder.list" },
      {
        key: "caffeineIntake",
        label: "Caffeine intake",
        labelKey: "intake.caffeineIntake",
        placeholder: "Select",
        options: ["None", "Low (1 cup)", "Moderate (2-3 cups)", "High (4+ cups)"]
      },
      { key: "waterIntake", label: "Water intake", labelKey: "intake.waterIntake", placeholder: "cups per day", placeholderKey: "intake.placeholder.cupsPerDay", type: "number", inputMode: "numeric" }
    ]
  },
  {
    key: "medical",
    title: "Medical context",
    titleKey: "intake.medical.title",
    description: "Anything we should account for?",
    descriptionKey: "intake.medical.description",
    fields: [
      { key: "conditions", label: "Conditions", labelKey: "intake.conditions", placeholder: "Type to add", placeholderKey: "intake.placeholder.typeToAdd" },
      { key: "surgeries", label: "Surgeries or hospitalisations", labelKey: "intake.surgeries", placeholder: "Optional", placeholderKey: "intake.placeholder.optional" },
      { key: "medications", label: "Current medications", labelKey: "intake.medications", placeholder: "List", placeholderKey: "intake.placeholder.list" },
      { key: "supplements", label: "Current nutrition", labelKey: "intake.currentNutrition", placeholder: "List", placeholderKey: "intake.placeholder.list" }
    ]
  },
  {
    key: "goals",
    title: "Goals",
    titleKey: "intake.goals.title",
    description: "Choose what matters most right now.",
    descriptionKey: "intake.goals.description",
    fields: [
      {
        key: "topPriorities",
        label: "Top priorities (select up to 3)",
        labelKey: "intake.topPriorities",
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
    titleKey: "intake.consent.title",
    description: "We take privacy seriously.",
    descriptionKey: "intake.consent.description",
    fields: [
      {
        key: "dataProcessingConsent",
        label: "Data processing consent",
        labelKey: "intake.dataProcessingConsent",
        kind: "checkbox",
        checkboxLabel: "I agree to data processing for personalized recommendations.",
        checkboxLabelKey: "intake.dataProcessingConsent.checkbox",
        helper: "Required to provide tailored nutrition guidance.",
        helperKey: "intake.dataProcessingConsent.helper"
      }
    ]
  }
];

const ProfileIntakeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [attemptedNext, setAttemptedNext] = useState(false);

  const currentStep = steps[stepIndex];
  const progress = (stepIndex + 1) / steps.length;

  const optionLabelByValue: Record<string, TranslationKey> = {
    Female: "profile.gender.female",
    Male: "profile.gender.male",
    Sedentary: "profile.activity.sedentary",
    "Lightly active": "profile.activity.light",
    "Moderately active": "profile.activity.moderate",
    "Very active": "profile.activity.very",
    "Under 5 hrs": "profile.sleep.under5",
    "5-6 hrs": "profile.sleep.5to6",
    "6-7 hrs": "profile.sleep.6to7",
    "7-8 hrs": "profile.sleep.7to8",
    "8+ hrs": "profile.sleep.8plus",
    Low: "profile.stress.low",
    Moderate: "profile.stress.moderate",
    High: "profile.stress.high",
    Balanced: "profile.diet.balanced",
    Mediterranean: "profile.diet.mediterranean",
    "Plant-based": "profile.diet.plant",
    Vegetarian: "profile.diet.vegetarian",
    Vegan: "profile.diet.vegan",
    "Low-carb": "profile.diet.lowcarb",
    Keto: "profile.diet.keto",
    Paleo: "profile.diet.paleo",
    "Standard American Diet (SAD)": "profile.diet.sad",
    "Fast Food Heavy": "profile.diet.fastfood",
    "High-Junk / Junk Food": "profile.diet.junk",
    "No Specific Pattern": "profile.diet.nopattern",
    None: "profile.caffeine.none",
    "Low (1 cup)": "profile.caffeine.low",
    "Moderate (2-3 cups)": "profile.caffeine.moderate",
    "High (4+ cups)": "profile.caffeine.high",
    "More energy": "intake.option.moreEnergy",
    "Metabolic health": "intake.option.metabolicHealth",
    "Weight management": "intake.option.weightManagement",
    "Gut health": "intake.option.gutHealth",
    "Better sleep": "intake.option.betterSleep",
    "Stress support": "intake.option.stressSupport",
    "Muscle & performance": "intake.option.musclePerformance",
    Longevity: "intake.option.longevity"
  };

  const getOptionLabel = (option: string) => {
    const key = optionLabelByValue[option];
    return key ? t(key) : option;
  };

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
    const saved = persistentStorage.getItem("userProfile");
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

    const nextProfile = { ...existing, ...updates };
    persistentStorage.setItem("userProfile", JSON.stringify(nextProfile));
    void saveUserProfile<IntakeProfile>(nextProfile).catch((error) => {
      console.error("Failed to save intake profile:", error);
    });
  };

  React.useEffect(() => {
    let cancelled = false;

    const seedFieldValues = (parsed: Partial<IntakeProfile>) => {
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
    };

    const loadProfile = async () => {
      const localSaved = persistentStorage.getItem("userProfile");
      let localProfile: Partial<IntakeProfile> = {};

      if (localSaved) {
        try {
          localProfile = JSON.parse(localSaved) as Partial<IntakeProfile>;
        } catch {
          localProfile = {};
        }
      }

      try {
        const { profile: remoteProfile } = await fetchUserProfile<IntakeProfile>();
        if (cancelled) return;

        const hasRemoteProfile = Object.keys(remoteProfile).length > 0;
        const chosenProfile = hasRemoteProfile ? remoteProfile : localProfile;
        seedFieldValues(chosenProfile);

        if (!hasRemoteProfile && Object.keys(localProfile).length > 0) {
          await saveUserProfile<IntakeProfile>(localProfile);
        }
      } catch {
        if (cancelled) return;
        seedFieldValues(localProfile);
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
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
        <span style={styles.progressLabel}>{t("intake.stepLabel", { current: stepIndex + 1, total: steps.length })}</span>
        <ProgressBar progress={progress} />
        <h2 style={styles.heading}>{t("intake.heading")}</h2>
      </header>

      <Card style={styles.card} shadow>
        <h3 style={styles.stepTitle}>{t(currentStep.titleKey)}</h3>
        <p style={styles.stepDescription}>{t(currentStep.descriptionKey)}</p>
        <div style={styles.fieldGrid}>
          {currentStep.fields.map((field) => {
            const showError = attemptedNext && !isFieldValid(field.key) && isFieldRequired(field.key);
            return (
            <label key={field.key} style={styles.field}>
              <span style={styles.label}>{field.labelKey ? t(field.labelKey) : field.label}</span>
              {field.kind === "checkbox" ? (
                <div style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(fieldValues[field.key])}
                    onChange={(event) => toggleCheckbox(field, event.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.checkboxText}>{field.checkboxLabelKey ? t(field.checkboxLabelKey) : field.checkboxLabel || field.label}</span>
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
                        {getOptionLabel(option)}
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
                    {field.placeholderKey ? t(field.placeholderKey) : field.placeholder || t("intake.select")}
                  </option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {getOptionLabel(option)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
                  style={{ ...styles.input, ...(showError ? styles.inputError : {}) }}
                  type={field.type || "text"}
                  inputMode={field.inputMode}
                  step={field.step}
                  value={typeof fieldValues[field.key] === "string" ? fieldValues[field.key] : ""}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                />
              )}
              {field.helper || field.helperKey ? <span style={styles.helperText}>{field.helperKey ? t(field.helperKey) : field.helper}</span> : null}
              {showError ? <span style={styles.errorText}>{t("intake.required")}</span> : null}
            </label>
          );})}
        </div>
      </Card>

      <footer style={styles.footer}>
        <Button
          title={t("intake.back")}
          variant="secondary"
          onClick={handleBack}
          fullWidth
        />
        <Button
          title={stepIndex === steps.length - 1 ? t("intake.finish") : t("intake.next")}
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
