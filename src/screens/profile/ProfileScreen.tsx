import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import Dialog from "../../components/Dialog";
import { SHOW_LANGUAGE_SWITCHER } from "../../config/features";
import { AppTheme, useTheme } from "../../theme";
import { generateProfileSummary, translateDailyProfileSummary } from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";
import { Language, useI18n } from "../../i18n";

type ProfileState = {
  avatarImage: string | null;
  name: string;
  email: string;
  dob: string;
  gender: string;
  height: number;
  weight: number;
  activityLevel: string;
  exerciseDays: number;
  minutesPerSession: number;
  sleepDuration: string;
  stressLevel: string;
  bloodPressure: string;
  fastingGlucose: number;
  hba1c: number;
  restingHeartRate: number;
  waistCircumference: number;
  bodyFat: number;
  dietPattern: string;
  mealsPerDay: number;
  caffeineIntake: string;
  waterIntake: number;
  allergies: string;
  conditions: string;
  surgeries: string;
  medications: string;
  supplements: string;
  topPriorities: string;
  dataProcessingConsent: string;
  dataProcessing: string;
  dataStorage: string;
  research: string;
  appleHealth: string;
  googleFit: string;
};

type PaymentMethod = {
  id: string;
  type: "card" | "fpx" | "ewallet";
  last4?: string;
  brand?: string;
  isDefault: boolean;
};

type ShippingAddress = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postcode: string;
  isDefault: boolean;
};

type Order = {
  orderNumber: string;
  date: string;
  plan: string;
  price: number;
  status: "processing" | "shipped" | "delivered" | "cancelled";
};

type BloodPressureEntry = {
  date: string;
  systolic: number;
  diastolic: number;
};

type FastingGlucoseEntry = {
  date: string;
  value: number;
};

type WeightEntry = {
  date: string;
  value: number;
};

type EditKey = keyof ProfileState;
type EditConfig = {
  label: string;
  helper?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  step?: number | "any";
  options?: string[];
};

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.map(w => w[0]).join("").substring(0, 2).toUpperCase();
};

const formatGlucoseValue = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value);

const ProfileScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const defaultProfile: ProfileState = {
    avatarImage: null,
    name: "",
    email: "",
    dob: "",
    gender: "",
    height: 175, // Default height in cm
    weight: 70, // Default weight in kg
    activityLevel: "Moderate",
    exerciseDays: 0,
    minutesPerSession: 0,
    sleepDuration: "",
    stressLevel: "",
    bloodPressure: "",
    fastingGlucose: 0,
    hba1c: 0,
    restingHeartRate: 0,
    waistCircumference: 0,
    bodyFat: 0,
    dietPattern: "",
    mealsPerDay: 0,
    caffeineIntake: "",
    waterIntake: 0,
    allergies: "",
    conditions: "",
    surgeries: "",
    medications: "",
    supplements: "",
    topPriorities: "",
    dataProcessingConsent: "",
    dataProcessing: "Allowed",
    dataStorage: "Opted in",
    research: "Opted out",
    appleHealth: "Not connected",
    googleFit: "Not connected"
  };
  const [profile, setProfile] = useState<ProfileState>(() => {
    const saved = persistentStorage.getItem("userProfile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration for old `measurements` string
        if (typeof parsed.measurements === 'string') {
          const [heightStr, weightStr] = parsed.measurements.split('•').map((s: string) => s.trim());
          parsed.height = parseInt(heightStr, 10) || 175;
          parsed.weight = parseInt(weightStr, 10) || 70;
          delete parsed.measurements; // Remove old key
        }
        return { ...defaultProfile, ...parsed };
      } catch {
        // Fall through to default
      }
    }
    return defaultProfile;
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    const saved = persistentStorage.getItem("paymentMethods");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(() => {
    const saved = persistentStorage.getItem("shippingAddresses");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = persistentStorage.getItem("orderHistory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [editState, setEditState] = useState<null | {
    key: EditKey;
    label: string;
    helper?: string;
    value: string;
    type?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    step?: number | "any";
    options?: string[];
  }>(null);
  const [editValue, setEditValue] = useState("");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isEditingMeasurements, setIsEditingMeasurements] = useState(false);
  const [activeTracker, setActiveTracker] = useState<"bloodPressure" | "fastingGlucose" | "weight" | null>(null);
  const [bpDate, setBpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [bpMonthFilter, setBpMonthFilter] = useState("all");
  const [glucoseDate, setGlucoseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [glucoseValue, setGlucoseValue] = useState("");
  const [glucoseMonthFilter, setGlucoseMonthFilter] = useState("all");
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weightValue, setWeightValue] = useState("");
  const [weightMonthFilter, setWeightMonthFilter] = useState("all");
  const [bpHistory, setBpHistory] = useState<BloodPressureEntry[]>(() => {
    const saved = persistentStorage.getItem("bloodPressureHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [glucoseHistory, setGlucoseHistory] = useState<FastingGlucoseEntry[]>(() => {
    const saved = persistentStorage.getItem("fastingGlucoseHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(() => {
    const saved = persistentStorage.getItem("weightHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [aiSummary, setAiSummary] = useState("");
  const [aiMotivation, setAiMotivation] = useState("");
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [consentRefreshTick, setConsentRefreshTick] = useState(0);
  const languageOptions: { value: Language; label: string }[] = [
    { value: "en", label: t("common.language.en") },
    { value: "zh", label: t("common.language.zh") },
    { value: "bm", label: t("common.language.bm") }
  ];

  const consentState = useMemo(
    () =>
      persistentStorage.getJSON<{
        termsPrivacyAccepted?: boolean;
        healthDataProcessingAccepted?: boolean;
        researchParticipation?: boolean;
        marketingCommunication?: boolean;
        policyVersion?: string;
        acceptedAt?: string;
      }>("userConsents", {}),
    [consentRefreshTick]
  );

  const updateConsent = (
    key:
      | "termsPrivacyAccepted"
      | "healthDataProcessingAccepted"
      | "researchParticipation"
      | "marketingCommunication",
    granted: boolean
  ) => {
    const current = persistentStorage.getJSON<{
      termsPrivacyAccepted?: boolean;
      healthDataProcessingAccepted?: boolean;
      researchParticipation?: boolean;
      marketingCommunication?: boolean;
      policyVersion?: string;
      acceptedAt?: string;
    }>("userConsents", {});

    const nextAcceptedAt = granted
      ? new Date().toISOString()
      : current.acceptedAt || new Date().toISOString();

    persistentStorage.setJSON("userConsents", {
      ...current,
      [key]: granted,
      policyVersion: current.policyVersion || "2026-03",
      acceptedAt: nextAcceptedAt
    });
    setConsentRefreshTick((prev) => prev + 1);
  };

  // Temporary state for measurement editor
  const [tempHeight, setTempHeight] = useState(profile.height);
  const [tempWeight, setTempWeight] = useState(profile.weight);

  // Auto-generate initials from name
  const avatarInitials = useMemo(() => getInitials(profile.name), [profile.name]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    persistentStorage.setItem("userProfile", JSON.stringify(profile));
  }, [profile]);

  // Save payment methods to localStorage
  useEffect(() => {
    persistentStorage.setItem("paymentMethods", JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  // Save shipping addresses to localStorage
  useEffect(() => {
    persistentStorage.setItem("shippingAddresses", JSON.stringify(shippingAddresses));
  }, [shippingAddresses]);

  // Save order history to localStorage
  useEffect(() => {
    persistentStorage.setItem("orderHistory", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    persistentStorage.setItem("bloodPressureHistory", JSON.stringify(bpHistory));
  }, [bpHistory]);

  useEffect(() => {
    persistentStorage.setItem("fastingGlucoseHistory", JSON.stringify(glucoseHistory));
  }, [glucoseHistory]);

  useEffect(() => {
    persistentStorage.setItem("weightHistory", JSON.stringify(weightHistory));
  }, [weightHistory]);

  const editConfig: Record<EditKey, EditConfig> = {
    avatarImage: { label: t("profile.profilePhoto") },
    name: { label: t("profile.fullName") },
    email: { label: t("profile.emailAddress"), type: "email" },
    dob: { label: t("profile.dateOfBirth"), type: "date" },
    gender: { label: t("profile.gender"), options: ["Female", "Male"] },
    height: { label: t("profile.heightCm"), type: "number", inputMode: "numeric" },
    weight: { label: t("profile.weightKg"), type: "number", inputMode: "numeric" },
    activityLevel: { label: t("profile.activityLevel"), options: ["Sedentary", "Lightly active", "Moderately active", "Very active"] },
    exerciseDays: { label: t("profile.exerciseDaysPerWeek"), type: "number", inputMode: "numeric" },
    minutesPerSession: { label: t("profile.minutesPerSession"), type: "number", inputMode: "numeric" },
    sleepDuration: { label: t("profile.sleepDuration"), options: ["Under 5 hrs", "5-6 hrs", "6-7 hrs", "7-8 hrs", "8+ hrs"] },
    stressLevel: { label: t("profile.stressLevel"), options: ["Low", "Moderate", "High"] },
    bloodPressure: { label: t("profile.bloodPressure"), helper: t("profile.bpFormatHelper") },
    fastingGlucose: { label: `${t("profile.fastingGlucose")} (mmol/L)`, type: "number", inputMode: "decimal", step: 0.1 },
    hba1c: { label: `${t("profile.hba1c")} (%)`, type: "number", inputMode: "decimal" },
    restingHeartRate: { label: t("profile.restingHrBpm"), type: "number", inputMode: "numeric" },
    waistCircumference: { label: `${t("profile.waistCircumference")} (cm)`, type: "number", inputMode: "numeric" },
    bodyFat: { label: `${t("profile.bodyFat")} (%)`, type: "number", inputMode: "decimal" },
    dietPattern: {
      label: t("profile.dietPattern"),
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
    mealsPerDay: { label: t("profile.mealsPerDay"), type: "number", inputMode: "numeric" },
    caffeineIntake: { label: t("profile.caffeineIntake"), options: ["None", "Low (1 cup)", "Moderate (2-3 cups)", "High (4+ cups)"] },
    waterIntake: { label: `${t("profile.waterIntake")} (cups/day)`, type: "number", inputMode: "numeric" },
    allergies: { label: t("profile.allergies") },
    conditions: { label: t("profile.conditions") },
    surgeries: { label: t("profile.surgeries") },
    medications: { label: t("profile.medications") },
    supplements: { label: t("profile.currentNutrition") },
    topPriorities: { label: t("profile.topPriorities") },
    dataProcessingConsent: { label: t("profile.dataConsent") },
    dataProcessing: {
      label: t("profile.dataProcessing"),
      options: ["Allowed", "Limited", "Not allowed"]
    },
    dataStorage: {
      label: t("profile.healthDataStorage"),
      options: ["Opted in", "Limited retention", "Opted out"]
    },
    research: {
      label: t("profile.researchParticipationStatus"),
      options: ["Opted in", "Opted out"]
    },
    appleHealth: { label: t("profile.appleHealthStatus") },
    googleFit: { label: t("profile.googleFitStatus") }
  };

  const numericKeys = new Set<EditKey>([
    "height",
    "weight",
    "exerciseDays",
    "minutesPerSession",
    "fastingGlucose",
    "hba1c",
    "restingHeartRate",
    "waistCircumference",
    "bodyFat",
    "mealsPerDay",
    "waterIntake"
  ]);

  const openEdit = (key: EditKey, labelOverride?: string) => {
    const config = editConfig[key] ?? { label: key };
    const rawValue = profile[key];
    const value =
      typeof rawValue === "number" ? (rawValue === 0 ? "" : String(rawValue)) : (rawValue as string) || "";
    setEditState({
      key,
      label: labelOverride ?? config.label,
      helper: config.helper,
      value,
      type: config.type,
      inputMode: config.inputMode,
      step: config.step,
      options: config.options
    });
    setEditValue(value);
  };

  const handleConfirm = () => {
    if (!editState) return;
    let value = editValue.trim();
    if (!value) {
      setEditState(null);
      return;
    }
    if (numericKeys.has(editState.key)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        setProfile((prev) => ({ ...prev, [editState.key]: parsed }));
      }
    } else {
      setProfile((prev) => ({ ...prev, [editState.key]: value }));
    }
    setEditState(null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, avatarImage: reader.result as string }));
        setShowImageUpload(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfile(prev => ({ ...prev, avatarImage: null }));
    setShowImageUpload(false);
  };

  // When measurement editor opens, sync temp state
  useEffect(() => {
    if (isEditingMeasurements) {
      setTempHeight(profile.height);
      setTempWeight(profile.weight);
    }
  }, [isEditingMeasurements, profile.height, profile.weight]);

  const handleConfirmMeasurements = () => {
    setProfile((prev) => ({ ...prev, height: tempHeight, weight: tempWeight }));
    setIsEditingMeasurements(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" }
      });
    } catch {
      // Clear local state even if the network request fails.
    } finally {
      persistentStorage.removeItem("userProfile");
      persistentStorage.removeItem("paymentMethods");
      persistentStorage.removeItem("shippingAddresses");
      persistentStorage.removeItem("orderHistory");
      persistentStorage.removeItem("bloodworkAnalysis");
      persistentStorage.removeItem("bloodworkAnalysisMeta");
      persistentStorage.removeItem("bloodworkHistory");
      persistentStorage.removeItem("bloodPressureHistory");
      persistentStorage.removeItem("fastingGlucoseHistory");
      persistentStorage.removeItem("weightHistory");
      persistentStorage.removeItem("orderDetails");
      persistentStorage.removeItem("deliveryAddress");
      persistentStorage.removeItem("lastOrder");
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  const localizeProfileValue = (value: string) => {
    const trimmed = value.trim();
    switch (trimmed) {
      case "Female": return t("profile.gender.female");
      case "Male": return t("profile.gender.male");
      case "Sedentary": return t("profile.activity.sedentary");
      case "Lightly active": return t("profile.activity.light");
      case "Moderately active": return t("profile.activity.moderate");
      case "Very active": return t("profile.activity.very");
      case "Under 5 hrs": return t("profile.sleep.under5");
      case "5-6 hrs": return t("profile.sleep.5to6");
      case "6-7 hrs": return t("profile.sleep.6to7");
      case "7-8 hrs": return t("profile.sleep.7to8");
      case "8+ hrs": return t("profile.sleep.8plus");
      case "Low": return t("profile.stress.low");
      case "Moderate": return t("profile.stress.moderate");
      case "High": return t("profile.stress.high");
      case "Balanced": return t("profile.diet.balanced");
      case "Mediterranean": return t("profile.diet.mediterranean");
      case "Plant-based": return t("profile.diet.plant");
      case "Vegetarian": return t("profile.diet.vegetarian");
      case "Vegan": return t("profile.diet.vegan");
      case "Low-carb": return t("profile.diet.lowcarb");
      case "Keto": return t("profile.diet.keto");
      case "Paleo": return t("profile.diet.paleo");
      case "Standard American Diet (SAD)": return t("profile.diet.sad");
      case "Fast Food Heavy": return t("profile.diet.fastfood");
      case "High-Junk / Junk Food": return t("profile.diet.junk");
      case "No Specific Pattern": return t("profile.diet.nopattern");
      case "None": return t("profile.caffeine.none");
      case "Low (1 cup)": return t("profile.caffeine.low");
      case "Moderate (2-3 cups)": return t("profile.caffeine.moderate");
      case "High (4+ cups)": return t("profile.caffeine.high");
      case "Allowed": return t("profile.data.allowed");
      case "Opted in": return t("profile.data.optedIn");
      case "Opted out": return t("profile.data.optedOut");
      case "Not connected": return t("profile.data.notConnected");
      default: return trimmed;
    }
  };

  const formatValue = (value: string) => (value && value.trim() ? localizeProfileValue(value) : t("profile.notSet"));
  const formatNumber = (value: number, unit?: string) =>
    value && value > 0 ? `${value}${unit ? ` ${unit}` : ""}` : t("profile.notSet");

  const localizeOrderStatus = (status: Order["status"]) => {
    switch (status) {
      case "processing": return t("profile.orderStatus.processing");
      case "shipped": return t("profile.orderStatus.shipped");
      case "delivered": return t("profile.orderStatus.delivered");
      case "cancelled": return t("profile.orderStatus.cancelled");
      default: return status;
    }
  };

  const getLatestBp = () => {
    if (bpHistory.length === 0) return formatValue(profile.bloodPressure);
    const sorted = [...bpHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${sorted[0].systolic}/${sorted[0].diastolic}`;
  };

  const getLatestGlucose = () => {
    if (glucoseHistory.length === 0) return formatNumber(profile.fastingGlucose, "mmol/L");
    const sorted = [...glucoseHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${formatGlucoseValue(sorted[0].value)} mmol/L`;
  };

  const getLatestWeight = () => {
    if (weightHistory.length === 0) return formatNumber(profile.weight, "kg");
    const sorted = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${sorted[0].value} kg`;
  };

  const addBloodPressureEntry = () => {
    const systolic = Number(bpSystolic);
    const diastolic = Number(bpDiastolic);
    if (!bpDate || Number.isNaN(systolic) || Number.isNaN(diastolic) || systolic <= 0 || diastolic <= 0) {
      return;
    }

    setBpHistory((prev) => {
      const withoutDate = prev.filter((entry) => entry.date !== bpDate);
      return [...withoutDate, { date: bpDate, systolic, diastolic }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setProfile((prev) => ({ ...prev, bloodPressure: `${systolic}/${diastolic}` }));
    setBpSystolic("");
    setBpDiastolic("");
  };

  const addGlucoseEntry = () => {
    const value = Number(glucoseValue);
    if (!glucoseDate || Number.isNaN(value) || value <= 0) {
      return;
    }

    setGlucoseHistory((prev) => {
      const withoutDate = prev.filter((entry) => entry.date !== glucoseDate);
      return [...withoutDate, { date: glucoseDate, value }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setProfile((prev) => ({ ...prev, fastingGlucose: value }));
    setGlucoseValue("");
  };

  const addWeightEntry = () => {
    const value = Number(weightValue);
    if (!weightDate || Number.isNaN(value) || value <= 0) {
      return;
    }

    setWeightHistory((prev) => {
      const withoutDate = prev.filter((entry) => entry.date !== weightDate);
      return [...withoutDate, { date: weightDate, value }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setProfile((prev) => ({ ...prev, weight: value }));
    setWeightValue("");
  };

  const buildLinePath = (values: number[], width: number, height: number) => {
    if (values.length === 0) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    return values
      .map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  const buildMonthTicks = (dates: string[], width: number) => {
    if (dates.length === 0) return [] as { x: number; label: string; anchor: "start" | "middle" | "end" }[];
    const hasMultipleYears = new Set(dates.map((date) => date.slice(0, 4))).size > 1;
    const seen = new Set<string>();
    const ticks: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [];

    dates.forEach((date, index) => {
      const monthKey = date.slice(0, 7);
      if (seen.has(monthKey)) return;
      seen.add(monthKey);

      const rawX = dates.length === 1 ? width / 2 : (index / (dates.length - 1)) * width;
      const x = Math.max(8, Math.min(width - 8, rawX));
      const parsed = new Date(`${date}T00:00:00`);
      const label = Number.isNaN(parsed.getTime())
        ? monthKey
        : parsed.toLocaleDateString(undefined, hasMultipleYears ? { month: "short", year: "2-digit" } : { month: "short" });
      const anchor: "start" | "middle" | "end" = x <= 16 ? "start" : x >= width - 16 ? "end" : "middle";
      ticks.push({ x, label, anchor });
    });

    return ticks;
  };

  const chartWidth = 300;
  const chartPlotHeight = 96;

  const toMonthLabel = (monthKey: string) => {
    const parsed = new Date(`${monthKey}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return monthKey;
    return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const bpSortedEntries = [...bpHistory].sort((a, b) => a.date.localeCompare(b.date));
  const glucoseSortedEntries = [...glucoseHistory].sort((a, b) => a.date.localeCompare(b.date));
  const weightSortedEntries = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const bpMonthOptions = Array.from(new Set(bpSortedEntries.map((entry) => entry.date.slice(0, 7))))
    .sort((a, b) => b.localeCompare(a));
  const glucoseMonthOptions = Array.from(new Set(glucoseSortedEntries.map((entry) => entry.date.slice(0, 7))))
    .sort((a, b) => b.localeCompare(a));
  const weightMonthOptions = Array.from(new Set(weightSortedEntries.map((entry) => entry.date.slice(0, 7))))
    .sort((a, b) => b.localeCompare(a));

  const bpFilteredEntries =
    bpMonthFilter === "all"
      ? bpSortedEntries
      : bpSortedEntries.filter((entry) => entry.date.startsWith(bpMonthFilter));
  const glucoseFilteredEntries =
    glucoseMonthFilter === "all"
      ? glucoseSortedEntries
      : glucoseSortedEntries.filter((entry) => entry.date.startsWith(glucoseMonthFilter));
  const weightFilteredEntries =
    weightMonthFilter === "all"
      ? weightSortedEntries
      : weightSortedEntries.filter((entry) => entry.date.startsWith(weightMonthFilter));

  const bpChartEntries = bpFilteredEntries.slice(-31);
  const glucoseChartEntries = glucoseFilteredEntries.slice(-31);
  const weightChartEntries = weightFilteredEntries.slice(-31);

  const bpSystolicPath = buildLinePath(bpChartEntries.map((entry) => entry.systolic), chartWidth, chartPlotHeight);
  const bpDiastolicPath = buildLinePath(bpChartEntries.map((entry) => entry.diastolic), chartWidth, chartPlotHeight);
  const glucosePath = buildLinePath(glucoseChartEntries.map((entry) => entry.value), chartWidth, chartPlotHeight);
  const weightPath = buildLinePath(weightChartEntries.map((entry) => entry.value), chartWidth, chartPlotHeight);
  const bpMonthTicks = buildMonthTicks(bpChartEntries.map((entry) => entry.date), chartWidth);
  const glucoseMonthTicks = buildMonthTicks(glucoseChartEntries.map((entry) => entry.date), chartWidth);
  const weightMonthTicks = buildMonthTicks(weightChartEntries.map((entry) => entry.date), chartWidth);

  const bpInsight = (() => {
    if (bpFilteredEntries.length < 2) return t("profile.tracker.insight.bp.empty");
    const avgSystolic =
      bpFilteredEntries.reduce((sum, entry) => sum + entry.systolic, 0) / bpFilteredEntries.length;
    const avgDiastolic =
      bpFilteredEntries.reduce((sum, entry) => sum + entry.diastolic, 0) / bpFilteredEntries.length;
    const trend = bpFilteredEntries[bpFilteredEntries.length - 1].systolic - bpFilteredEntries[0].systolic;
    const trendText = trend > 0 ? t("profile.trend.rising") : trend < 0 ? t("profile.trend.improving") : t("profile.trend.stable");
    if (avgSystolic >= 130 || avgDiastolic >= 80) {
      return t("profile.tracker.insight.bp.high", { systolic: Math.round(avgSystolic), diastolic: Math.round(avgDiastolic), trend: trendText });
    }
    return t("profile.tracker.insight.bp.normal", { systolic: Math.round(avgSystolic), diastolic: Math.round(avgDiastolic), trend: trendText });
  })();

  const glucoseInsight = (() => {
    if (glucoseFilteredEntries.length < 2) return t("profile.tracker.insight.glucose.empty");
    const avg = glucoseFilteredEntries.reduce((sum, entry) => sum + entry.value, 0) / glucoseFilteredEntries.length;
    const trend = glucoseFilteredEntries[glucoseFilteredEntries.length - 1].value - glucoseFilteredEntries[0].value;
    const trendText = trend > 0 ? t("profile.trend.rising") : trend < 0 ? t("profile.trend.improving") : t("profile.trend.stable");
    if (avg >= 5.6) {
      return t("profile.tracker.insight.glucose.high", { value: formatGlucoseValue(avg), trend: trendText });
    }
    return t("profile.tracker.insight.glucose.normal", { value: formatGlucoseValue(avg), trend: trendText });
  })();

  const weightInsight = (() => {
    if (weightFilteredEntries.length < 2) return t("profile.tracker.insight.weight.empty");
    const avg = weightFilteredEntries.reduce((sum, entry) => sum + entry.value, 0) / weightFilteredEntries.length;
    const delta = weightFilteredEntries[weightFilteredEntries.length - 1].value - weightFilteredEntries[0].value;
    const trendText = delta > 0 ? t("profile.trend.upward") : delta < 0 ? t("profile.trend.downward") : t("profile.trend.stable");
    const changeText = `${Math.abs(delta).toFixed(1)} kg`;
    return t("profile.tracker.insight.weight.summary", { value: avg.toFixed(1), trend: trendText, change: changeText });
  })();

  const latestBpValue = useMemo(() => {
    if (bpHistory.length === 0) return profile.bloodPressure;
    const sorted = [...bpHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${sorted[0].systolic}/${sorted[0].diastolic}`;
  }, [bpHistory, profile.bloodPressure]);

  const latestGlucoseValue = useMemo(() => {
    if (glucoseHistory.length === 0) return profile.fastingGlucose;
    const sorted = [...glucoseHistory].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0].value;
  }, [glucoseHistory, profile.fastingGlucose]);

  const profileSummaryInput = useMemo(
    () => ({
      name: profile.name,
      dob: profile.dob || undefined,
      gender: profile.gender || undefined,
      heightCm: profile.height > 0 ? profile.height : undefined,
      weightKg: profile.weight > 0 ? profile.weight : undefined,
      activityLevel: profile.activityLevel || undefined,
      exerciseDays: profile.exerciseDays > 0 ? profile.exerciseDays : undefined,
      minutesPerSession: profile.minutesPerSession > 0 ? profile.minutesPerSession : undefined,
      sleepDuration: profile.sleepDuration || undefined,
      stressLevel: profile.stressLevel || undefined,
      bloodPressure: latestBpValue || undefined,
      fastingGlucoseMmolL: latestGlucoseValue > 0 ? latestGlucoseValue : undefined,
      hba1c: profile.hba1c > 0 ? profile.hba1c : undefined,
      restingHeartRate: profile.restingHeartRate > 0 ? profile.restingHeartRate : undefined,
      waistCircumferenceCm: profile.waistCircumference > 0 ? profile.waistCircumference : undefined,
      bodyFatPercent: profile.bodyFat > 0 ? profile.bodyFat : undefined,
      dietPattern: profile.dietPattern || undefined,
      mealsPerDay: profile.mealsPerDay > 0 ? profile.mealsPerDay : undefined,
      caffeineIntake: profile.caffeineIntake || undefined,
      waterIntakeCups: profile.waterIntake > 0 ? profile.waterIntake : undefined,
      allergies: profile.allergies || undefined,
      conditions: profile.conditions || undefined,
      medications: profile.medications || undefined,
      supplements: profile.supplements || undefined,
      topPriorities: profile.topPriorities || undefined
    }),
    [latestBpValue, latestGlucoseValue, profile]
  );

  const fetchProfileSummary = async () => {
    setIsAiSummaryLoading(true);
    setAiSummaryError("");
    try {
      const result = await generateProfileSummary(profileSummaryInput);
      setAiSummary(result.summary);
      setAiMotivation(result.motivation);
    } catch {
      setAiSummary("");
      setAiMotivation("");
      setAiSummaryError("Unable to load AI profile insight right now. Please try again.");
    } finally {
      setIsAiSummaryLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if ((!aiSummary && !aiMotivation) || language === "en") {
      return;
    }

    translateDailyProfileSummary(
      {
        summary: aiSummary,
        motivation: aiMotivation
      },
      language
    )
      .then((translated) => {
        if (cancelled) return;
        setAiSummary(translated.summary);
        setAiMotivation(translated.motivation);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    const hasData = Object.values(profileSummaryInput).some((value) => {
      if (typeof value === "number") return value > 0;
      return Boolean(value);
    });
    if (!hasData) return;
    fetchProfileSummary();
  }, [profileSummaryInput, language]);

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div className="profile-avatar-container" style={styles.avatarContainer}>
          <div className="profile-avatar-shell" style={styles.avatarShell} onClick={() => setShowImageUpload(true)}>
            {profile.avatarImage ? (
              <>
                <img src={profile.avatarImage} alt="Profile" style={styles.avatarImage} />
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>{t("profile.edit")}</span>
                </div>
              </>
            ) : (
              <>
                <span style={styles.avatarInitials}>{avatarInitials}</span>
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>{t("profile.uploadAvatar")}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={styles.heroInfo}>
          <h1 style={styles.name}>{profile.name}</h1>
          <p style={styles.email}>{profile.email}</p>
          <button type="button" style={styles.editProfileButton} onClick={() => openEdit("name", t("profile.fullName"))}>
            {t("profile.editProfile")}
          </button>
        </div>
      </header>
      <Card style={styles.card}>
        <div style={styles.aiSummaryHeader}>
          <SectionHeader title={t("profile.dailyInsight")} />
          <button
            type="button"
            style={styles.aiRefreshButton}
            onClick={fetchProfileSummary}
            disabled={isAiSummaryLoading}
          >
            {isAiSummaryLoading ? t("profile.analyzing") : t("profile.refresh")}
          </button>
        </div>
        {aiSummaryError ? <p style={styles.aiSummaryError}>{aiSummaryError}</p> : null}
        {!aiSummaryError ? (
          <p style={styles.aiSummaryText}>
            {isAiSummaryLoading && !aiSummary
              ? t("profile.analyzingBody")
              : aiSummary || t("profile.emptyAiSummary")}
          </p>
        ) : null}
        {!aiSummaryError && aiMotivation ? <p style={styles.aiMotivationText}>{aiMotivation}</p> : null}
      </Card>
      {SHOW_LANGUAGE_SWITCHER ? (
        <Card style={styles.card}>
          <SectionHeader title={t("profile.languageTitle")} />
          <p style={styles.languageIntro}>{t("profile.languageIntro")}</p>
          <div style={styles.languageSwitcher}>
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
        </Card>
      ) : null}
      <Card style={styles.card}>
        <SectionHeader title={t("profile.personalInfo")} />
        <ProfileRow label={t("profile.fullName")} value={profile.name} action={t("profile.edit")} onEdit={() => openEdit("name")} />
        <ProfileRow label={t("profile.email")} value={profile.email} action={t("profile.edit")} onEdit={() => openEdit("email")} />
        <ProfileRow label={t("profile.dateOfBirth")} value={profile.dob} action={t("profile.edit")} onEdit={() => openEdit("dob")} />
        <ProfileRow label={t("profile.gender")} value={formatValue(profile.gender)} action={t("profile.edit")} onEdit={() => openEdit("gender")} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.healthData")} />
        <ProfileRow label={t("profile.measurements")} value={t("profile.measurementsValue", { height: profile.height, weight: profile.weight })} action={t("profile.action.update")} onEdit={() => setIsEditingMeasurements(true)} />
        <ProfileRow label={t("profile.dailyWeight")} value={getLatestWeight()} action={t("profile.action.track")} onEdit={() => setActiveTracker("weight")} />
        <ProfileRow label={t("profile.activityLevel")} value={formatValue(profile.activityLevel)} action={t("profile.action.update")} onEdit={() => openEdit("activityLevel")} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.vitals")} />
        <div style={styles.infoGrid}>
          <InfoItem label={t("profile.bloodPressure")} value={getLatestBp()} action={t("profile.action.track")} onEdit={() => setActiveTracker("bloodPressure")} />
          <InfoItem label={t("profile.fastingGlucose")} value={getLatestGlucose()} action={t("profile.action.track")} onEdit={() => setActiveTracker("fastingGlucose")} />
          <InfoItem label={t("profile.hba1c")} value={formatNumber(profile.hba1c, "%")} action={t("profile.action.set")} onEdit={() => openEdit("hba1c")} />
          <InfoItem label={t("profile.restingHr")} value={formatNumber(profile.restingHeartRate, "bpm")} action={t("profile.action.set")} onEdit={() => openEdit("restingHeartRate")} />
          <InfoItem label={t("profile.waistCircumference")} value={formatNumber(profile.waistCircumference, "cm")} action={t("profile.action.set")} onEdit={() => openEdit("waistCircumference")} />
          <InfoItem label={t("profile.bodyFat")} value={formatNumber(profile.bodyFat, "%")} action={t("profile.action.set")} onEdit={() => openEdit("bodyFat")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.lifestyle")} />
        <div style={styles.infoGrid}>
          <InfoItem label={t("profile.exerciseDays")} value={formatNumber(profile.exerciseDays, "days/week")} action={t("profile.action.set")} onEdit={() => openEdit("exerciseDays")} />
          <InfoItem label={t("profile.minutesPerSession")} value={formatNumber(profile.minutesPerSession, "min")} action={t("profile.action.set")} onEdit={() => openEdit("minutesPerSession")} />
          <InfoItem label={t("profile.sleepDuration")} value={formatValue(profile.sleepDuration)} action={t("profile.action.set")} onEdit={() => openEdit("sleepDuration")} />
          <InfoItem label={t("profile.stressLevel")} value={formatValue(profile.stressLevel)} action={t("profile.action.set")} onEdit={() => openEdit("stressLevel")} />
          <InfoItem label={t("profile.dietPattern")} value={formatValue(profile.dietPattern)} action={t("profile.action.set")} onEdit={() => openEdit("dietPattern")} />
          <InfoItem label={t("profile.mealsPerDay")} value={formatNumber(profile.mealsPerDay)} action={t("profile.action.set")} onEdit={() => openEdit("mealsPerDay")} />
          <InfoItem label={t("profile.caffeineIntake")} value={formatValue(profile.caffeineIntake)} action={t("profile.action.set")} onEdit={() => openEdit("caffeineIntake")} />
          <InfoItem label={t("profile.waterIntake")} value={formatNumber(profile.waterIntake, "cups/day")} action={t("profile.action.set")} onEdit={() => openEdit("waterIntake")} />
          <InfoItem label={t("profile.allergies")} value={formatValue(profile.allergies)} action={t("profile.action.set")} onEdit={() => openEdit("allergies")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.medicalHistory")} />
        <div style={styles.infoGrid}>
          <InfoItem label={t("profile.conditions")} value={formatValue(profile.conditions)} action={t("profile.action.set")} onEdit={() => openEdit("conditions")} />
          <InfoItem label={t("profile.surgeries")} value={formatValue(profile.surgeries)} action={t("profile.action.set")} onEdit={() => openEdit("surgeries")} />
          <InfoItem label={t("profile.medications")} value={formatValue(profile.medications)} action={t("profile.action.set")} onEdit={() => openEdit("medications")} />
          <InfoItem label={t("profile.currentNutrition")} value={formatValue(profile.supplements)} action={t("profile.action.set")} onEdit={() => openEdit("supplements")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.goalsConsent")} />
        <div style={styles.infoGrid}>
          <InfoItem label={t("profile.topPriorities")} value={formatValue(profile.topPriorities)} action={t("profile.action.set")} onEdit={() => openEdit("topPriorities")} />
          <InfoItem label={t("profile.dataConsent")} value={formatValue(profile.dataProcessingConsent)} action={t("profile.action.set")} onEdit={() => openEdit("dataProcessingConsent")} />
        </div>
      </Card>

      {/* Order History */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title={t("profile.orderHistory")} />
          {orders.length > 0 && (
            <button style={styles.viewAllButton} onClick={() => navigate("/orders")}>
              {t("home.insights.viewAll")}
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{t("profile.noOrders")}</p>
            <Button title={t("profile.startShopping")} onClick={() => navigate("/upload")} variant="secondary" />
          </div>
        ) : (
          orders.slice(0, 3).map((order) => (
            <div key={order.orderNumber} style={styles.orderItem}>
              <div>
                <p style={styles.orderNumber}>#{order.orderNumber}</p>
                <p style={styles.orderDate}>{new Date(order.date).toLocaleDateString(language === "zh" ? "zh-CN" : language === "bm" ? "ms-MY" : "en-MY", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div style={styles.orderRight}>
                <p style={styles.orderPrice}>RM{order.price}</p>
                <span style={{...styles.orderStatus, ...getStatusStyle(order.status, theme)}}>{localizeOrderStatus(order.status)}</span>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Payment Methods */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title={t("profile.paymentMethods")} />
          <button style={styles.addButton} onClick={() => navigate("/add-payment")}>
            + {t("upload.modal.connect")}
          </button>
        </div>
        {paymentMethods.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{t("profile.noPaymentMethods")}</p>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div key={method.id} style={styles.paymentItem}>
              <div style={styles.paymentLeft}>
                <span style={styles.paymentIcon}>{method.type === "card" ? "💳" : method.type === "fpx" ? "🏦" : "📱"}</span>
                <div>
                  <p style={styles.paymentBrand}>{method.brand || method.type.toUpperCase()}</p>
                  {method.last4 && <p style={styles.paymentLast4}>•••• {method.last4}</p>}
                </div>
              </div>
              {method.isDefault && <span style={styles.defaultBadge}>{t("profile.default")}</span>}
            </div>
          ))
        )}
      </Card>

      {/* Shipping Addresses */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title={t("profile.shippingAddresses")} />
          <button style={styles.addButton} onClick={() => navigate("/add-address")}>
            + {t("upload.modal.connect")}
          </button>
        </div>
        {shippingAddresses.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{t("profile.noShippingAddresses")}</p>
          </div>
        ) : (
          shippingAddresses.map((address) => (
            <div key={address.id} style={styles.addressItem}>
              <div>
                <p style={styles.addressName}>{address.fullName}</p>
                <p style={styles.addressText}>
                  {address.addressLine1}
                  {address.addressLine2 && `, ${address.addressLine2}`}
                </p>
                <p style={styles.addressText}>
                  {address.city}, {address.state} {address.postcode}
                </p>
                <p style={styles.addressPhone}>{address.phone}</p>
              </div>
              {address.isDefault && <span style={styles.defaultBadge}>{t("profile.default")}</span>}
            </div>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.privacyConnections")} />
        <ProfileRow label={t("profile.dataProcessing")} value={formatValue(profile.dataProcessing)} action={t("profile.action.manage")} onEdit={() => openEdit("dataProcessing") } />
        <ProfileRow label={t("profile.healthDataStorage")} value={formatValue(profile.dataStorage)} action={t("profile.action.manage")} onEdit={() => openEdit("dataStorage") } />
        <ProfileRow label={t("profile.researchParticipation")} value={formatValue(profile.research)} action={t("profile.action.manage")} onEdit={() => openEdit("research") } />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.consent.title")} />
        <div style={styles.consentGrid}>
          <div style={styles.consentItem}>
            <span style={styles.consentLabel}>{t("profile.consent.termsPrivacy")}</span>
            <div style={styles.consentInlineActionRow}>
              <span style={styles.consentValue}>
                {consentState.termsPrivacyAccepted ? t("profile.consent.granted") : t("profile.consent.notGranted")}
              </span>
              <button
                type="button"
                style={styles.consentActionButton}
                onClick={() => updateConsent("termsPrivacyAccepted", !consentState.termsPrivacyAccepted)}
              >
                {consentState.termsPrivacyAccepted ? t("profile.consent.disable") : t("profile.consent.enable")}
              </button>
            </div>
          </div>
          <div style={styles.consentItem}>
            <span style={styles.consentLabel}>{t("profile.consent.healthDataProcessing")}</span>
            <div style={styles.consentInlineActionRow}>
              <span style={styles.consentValue}>
                {consentState.healthDataProcessingAccepted ? t("profile.consent.granted") : t("profile.consent.notGranted")}
              </span>
              <button
                type="button"
                style={styles.consentActionButton}
                onClick={() => updateConsent("healthDataProcessingAccepted", !consentState.healthDataProcessingAccepted)}
              >
                {consentState.healthDataProcessingAccepted ? t("profile.consent.disable") : t("profile.consent.enable")}
              </button>
            </div>
          </div>
          <div style={styles.consentItem}>
            <span style={styles.consentLabel}>{t("profile.consent.researchOptional")}</span>
            <div style={styles.consentInlineActionRow}>
              <span style={styles.consentValue}>
                {consentState.researchParticipation ? t("profile.consent.granted") : t("profile.consent.notGranted")}
              </span>
              <button
                type="button"
                style={styles.consentActionButton}
                onClick={() => updateConsent("researchParticipation", !consentState.researchParticipation)}
              >
                {consentState.researchParticipation ? t("profile.consent.disable") : t("profile.consent.enable")}
              </button>
            </div>
          </div>
          <div style={styles.consentItem}>
            <span style={styles.consentLabel}>{t("profile.consent.marketingOptional")}</span>
            <div style={styles.consentInlineActionRow}>
              <span style={styles.consentValue}>
                {consentState.marketingCommunication ? t("profile.consent.granted") : t("profile.consent.notGranted")}
              </span>
              <button
                type="button"
                style={styles.consentActionButton}
                onClick={() => updateConsent("marketingCommunication", !consentState.marketingCommunication)}
              >
                {consentState.marketingCommunication ? t("profile.consent.disable") : t("profile.consent.enable")}
              </button>
            </div>
          </div>
          <div style={styles.consentMetaRow}>
            <span style={styles.consentMetaText}>
              {t("profile.consent.version")}: {consentState.policyVersion || "2026-03"}
            </span>
            <span style={styles.consentMetaText}>
              {t("profile.consent.acceptedAt")}: {consentState.acceptedAt ? new Date(consentState.acceptedAt).toLocaleString() : t("profile.notSet")}
            </span>
          </div>
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("profile.linkedServices")} />
        <ProfileRow label={t("profile.appleHealthStatus")} value={formatValue(profile.appleHealth)} action={t("profile.action.connect")} onEdit={() => openEdit("appleHealth") } />
        <ProfileRow label={t("profile.googleFitStatus")} value={formatValue(profile.googleFit)} action={t("profile.action.connect")} onEdit={() => openEdit("googleFit") } />
      </Card>

      <div style={styles.logoutStack}>
        <Button
          title={t("profile.logOut")}
          variant="secondary"
          fullWidth
          onClick={handleLogout}
          loading={isLoggingOut}
        />
        <button type="button" style={styles.dangerButton}>{t("profile.deleteAccount")}</button>
      </div>

      {editState ? (
        <Dialog
          title={t("profile.editTitle", { label: editState.label.toLowerCase() })}
          description={editState.helper}
          onClose={() => setEditState(null)}
          onConfirm={handleConfirm}
        >
          {editState.options ? (
            <select
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              autoFocus
              style={{
                width: "100%",
                borderRadius: theme.radii.lg,
                border: `1px solid ${theme.colors.divider}`,
                padding: `${theme.spacing.lg}px`,
                fontSize: 16,
                marginTop: theme.spacing.sm,
                fontFamily: "inherit"
              }}
            >
              <option value="" disabled>
                {t("profile.select")}
              </option>
              {editState.options.map((option) => (
                <option key={option} value={option}>
                  {localizeProfileValue(option)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={editState.type || "text"}
              inputMode={editState.inputMode}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              autoFocus
              style={{
                width: "100%",
                borderRadius: theme.radii.lg,
                border: `1px solid ${theme.colors.divider}`,
                padding: `${theme.spacing.lg}px`,
                fontSize: 16,
                marginTop: theme.spacing.sm
              }}
            />
          )}
        </Dialog>
      ) : null}

      {activeTracker === "bloodPressure" ? (
        <Dialog
          title={t("profile.tracker.bpTitle")}
          description={t("profile.tracker.bpDescription")}
          onClose={() => setActiveTracker(null)}
          cancelLabel={t("profile.tracker.close")}
        >
          <div style={styles.trackerContent}>
            <div style={styles.trackerFormRowOne}>
              <input
                type="date"
                value={bpDate}
                onChange={(event) => setBpDate(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <div style={styles.trackerFormRowTwo}>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("profile.tracker.systolic")}
                value={bpSystolic}
                onChange={(event) => setBpSystolic(event.target.value)}
                style={styles.trackerInput}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("profile.tracker.diastolic")}
                value={bpDiastolic}
                onChange={(event) => setBpDiastolic(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <button type="button" style={styles.trackerAddButton} onClick={addBloodPressureEntry}>
              {t("profile.tracker.addReading")}
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>{t("profile.tracker.month")}</span>
              <select
                value={bpMonthFilter}
                onChange={(event) => setBpMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">{t("profile.tracker.allMonths")}</option>
                {bpMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {toMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>

            <svg viewBox="0 0 300 120" style={styles.trackerChart}>
              <rect x="0" y="0" width="300" height="120" fill={theme.colors.surface} rx="8" />
              {[60, 120, 180, 240].map((x) => (
                <line key={`bp-v-${x}`} x1={x} y1="0" x2={x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.25" />
              ))}
              {[0, 24, 48, 72, 96].map((y) => (
                <line key={`bp-h-${y}`} x1="0" y1={y} x2="300" y2={y} stroke={theme.colors.divider} strokeWidth="1" opacity="0.35" />
              ))}
              {bpMonthTicks.map((tick) => (
                <g key={`bp-m-${tick.label}-${tick.x}`}>
                  <line x1={tick.x} y1="0" x2={tick.x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.55" />
                  <text x={tick.x} y="114" textAnchor={tick.anchor} fontSize="9" fill={theme.colors.textSecondary}>
                    {tick.label}
                  </text>
                </g>
              ))}
              {bpSystolicPath ? <path d={bpSystolicPath} stroke="#DC2626" strokeWidth="2" fill="none" /> : null}
              {bpDiastolicPath ? <path d={bpDiastolicPath} stroke="#D97706" strokeWidth="2" fill="none" /> : null}
            </svg>
            <p style={styles.trackerLegend}>{t("profile.tracker.legend.bp")}</p>
            <p style={styles.trackerInsight}>{bpInsight}</p>
            <div style={styles.trackerHistory}>
              {bpFilteredEntries
                .slice(-7)
                .reverse()
                .map((entry) => (
                  <div key={`bp-${entry.date}`} style={styles.trackerHistoryRow}>
                    <span>{entry.date}</span>
                    <span>{entry.systolic}/{entry.diastolic}</span>
                  </div>
                ))}
            </div>
          </div>
        </Dialog>
      ) : null}

      {activeTracker === "fastingGlucose" ? (
        <Dialog
          title={t("profile.tracker.glucoseTitle")}
          description={t("profile.tracker.glucoseDescription")}
          onClose={() => setActiveTracker(null)}
          cancelLabel={t("profile.tracker.close")}
        >
          <div style={styles.trackerContent}>
            <div style={styles.trackerFormRowTwo}>
              <input
                type="date"
                value={glucoseDate}
                onChange={(event) => setGlucoseDate(event.target.value)}
                style={styles.trackerInput}
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="mmol/L"
                value={glucoseValue}
                onChange={(event) => setGlucoseValue(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <button type="button" style={styles.trackerAddButton} onClick={addGlucoseEntry}>
              {t("profile.tracker.addReading")}
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>{t("profile.tracker.month")}</span>
              <select
                value={glucoseMonthFilter}
                onChange={(event) => setGlucoseMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">{t("profile.tracker.allMonths")}</option>
                {glucoseMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {toMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>

            <svg viewBox="0 0 300 120" style={styles.trackerChart}>
              <rect x="0" y="0" width="300" height="120" fill={theme.colors.surface} rx="8" />
              {[60, 120, 180, 240].map((x) => (
                <line key={`gl-v-${x}`} x1={x} y1="0" x2={x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.25" />
              ))}
              {[0, 24, 48, 72, 96].map((y) => (
                <line key={`gl-h-${y}`} x1="0" y1={y} x2="300" y2={y} stroke={theme.colors.divider} strokeWidth="1" opacity="0.35" />
              ))}
              {glucoseMonthTicks.map((tick) => (
                <g key={`gl-m-${tick.label}-${tick.x}`}>
                  <line x1={tick.x} y1="0" x2={tick.x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.55" />
                  <text x={tick.x} y="114" textAnchor={tick.anchor} fontSize="9" fill={theme.colors.textSecondary}>
                    {tick.label}
                  </text>
                </g>
              ))}
              {glucosePath ? <path d={glucosePath} stroke="#2563EB" strokeWidth="2" fill="none" /> : null}
            </svg>
            <p style={styles.trackerLegend}>{t("profile.tracker.legend.glucose")}</p>
            <p style={styles.trackerInsight}>{glucoseInsight}</p>
            <div style={styles.trackerHistory}>
              {glucoseFilteredEntries
                .slice(-7)
                .reverse()
                .map((entry) => (
                  <div key={`glucose-${entry.date}`} style={styles.trackerHistoryRow}>
                    <span>{entry.date}</span>
                    <span>{formatGlucoseValue(entry.value)} mmol/L</span>
                  </div>
                ))}
            </div>
          </div>
        </Dialog>
      ) : null}

      {activeTracker === "weight" ? (
        <Dialog
          title={t("profile.tracker.weightTitle")}
          description={t("profile.tracker.weightDescription")}
          onClose={() => setActiveTracker(null)}
          cancelLabel={t("profile.tracker.close")}
        >
          <div style={styles.trackerContent}>
            <div style={styles.trackerFormRowTwo}>
              <input
                type="date"
                value={weightDate}
                onChange={(event) => setWeightDate(event.target.value)}
                style={styles.trackerInput}
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="kg"
                value={weightValue}
                onChange={(event) => setWeightValue(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <button type="button" style={styles.trackerAddButton} onClick={addWeightEntry}>
              {t("profile.tracker.addReading")}
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>{t("profile.tracker.month")}</span>
              <select
                value={weightMonthFilter}
                onChange={(event) => setWeightMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">{t("profile.tracker.allMonths")}</option>
                {weightMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {toMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>

            <svg viewBox="0 0 300 120" style={styles.trackerChart}>
              <rect x="0" y="0" width="300" height="120" fill={theme.colors.surface} rx="8" />
              {[60, 120, 180, 240].map((x) => (
                <line key={`wt-v-${x}`} x1={x} y1="0" x2={x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.25" />
              ))}
              {[0, 24, 48, 72, 96].map((y) => (
                <line key={`wt-h-${y}`} x1="0" y1={y} x2="300" y2={y} stroke={theme.colors.divider} strokeWidth="1" opacity="0.35" />
              ))}
              {weightMonthTicks.map((tick) => (
                <g key={`wt-m-${tick.label}-${tick.x}`}>
                  <line x1={tick.x} y1="0" x2={tick.x} y2="96" stroke={theme.colors.divider} strokeWidth="1" opacity="0.55" />
                  <text x={tick.x} y="114" textAnchor={tick.anchor} fontSize="9" fill={theme.colors.textSecondary}>
                    {tick.label}
                  </text>
                </g>
              ))}
              {weightPath ? <path d={weightPath} stroke="#7C3AED" strokeWidth="2" fill="none" /> : null}
            </svg>
            <p style={styles.trackerLegend}>{t("profile.tracker.legend.weight")}</p>
            <p style={styles.trackerInsight}>{weightInsight}</p>
            <div style={styles.trackerHistory}>
              {weightFilteredEntries
                .slice(-7)
                .reverse()
                .map((entry) => (
                  <div key={`weight-${entry.date}`} style={styles.trackerHistoryRow}>
                    <span>{entry.date}</span>
                    <span>{entry.value} kg</span>
                  </div>
                ))}
            </div>
          </div>
        </Dialog>
      ) : null}

      {showImageUpload ? (
        <Dialog
          title={t("profile.image.title")}
          description={t("profile.image.description")}
          onClose={() => setShowImageUpload(false)}
          onConfirm={() => setShowImageUpload(false)}
        >
          <div style={styles.imageUploadContainer}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={styles.fileInput}
              id="avatar-upload"
            />
            <label htmlFor="avatar-upload" style={styles.uploadButton}>
              {`📷 ${t("profile.image.choose")}`}
            </label>
            {profile.avatarImage && (
              <button onClick={handleRemoveImage} style={styles.removeButton}>
                {t("profile.image.remove")}
              </button>
            )}
          </div>
        </Dialog>
      ) : null}

      {isEditingMeasurements ? (
        <Dialog
          title={t("profile.measurementsDialog.title")}
          description={t("profile.measurementsDialog.description")}
          onClose={() => setIsEditingMeasurements(false)}
          onConfirm={handleConfirmMeasurements}
        >
          <div style={styles.measurementEditor}>
            <div style={styles.measurementInput}>
              <label htmlFor="height-select" style={styles.measurementLabel}>{t("profile.measurementsDialog.height")}</label>
              <select
                id="height-select"
                value={tempHeight}
                onChange={(e) => setTempHeight(Number(e.target.value))}
                style={styles.measurementSelect}
              >
                {Array.from({ length: 101 }, (_, i) => 120 + i).map(h => (
                  <option key={h} value={h}>{h} cm</option>
                ))}
              </select>
            </div>
            <div style={styles.measurementInput}>
              <label htmlFor="weight-select" style={styles.measurementLabel}>{t("profile.measurementsDialog.weight")}</label>
              <select
                id="weight-select"
                value={tempWeight}
                onChange={(e) => setTempWeight(Number(e.target.value))}
                style={styles.measurementSelect}
              >
                {Array.from({ length: 171 }, (_, i) => 30 + i).map(w => (
                  <option key={w} value={w}>{w} kg</option>
                ))}
              </select>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
};

// Helper function for order status styling
const getStatusStyle = (status: Order["status"], theme: AppTheme) => {
  switch (status) {
    case "processing":
      return { background: "#FEF3C7", color: "#92400E" };
    case "shipped":
      return { background: "#DBEAFE", color: "#1E40AF" };
    case "delivered":
      return { background: "#D1FAE5", color: "#065F46" };
    case "cancelled":
      return { background: "#FEE2E2", color: "#991B1B" };
    default:
      return { background: theme.colors.surfaceMuted, color: theme.colors.textSecondary };
  }
};

const ProfileRow = ({ label, value, action, onEdit }: { label: string; value: string; action: string; onEdit: () => void }) => {
  const theme = useTheme();

  return (
    <button type="button" style={rowStyles(theme)} onClick={onEdit}>
      <div style={{ textAlign: "left" }}>
        <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: theme.colors.textSecondary }}>
          {label}
        </span>
        <p style={{ fontSize: 15, color: theme.colors.text, margin: `${theme.spacing.xs}px 0 0` }}>{value}</p>
      </div>
      <span style={{ fontWeight: 600, color: theme.colors.primary }}>{action}</span>
    </button>
  );
};

const InfoItem = ({ label, value, action, onEdit }: { label: string; value: string; action: string; onEdit: () => void }) => {
  const theme = useTheme();

  return (
    <button type="button" style={infoItemStyles(theme)} onClick={onEdit}>
      <span style={infoLabelStyles(theme)}>{label}</span>
      <span style={infoValueStyles(theme)}>{value}</span>
      <span style={infoActionStyles(theme)}>{action}</span>
    </button>
  );
};

const rowStyles = (theme: AppTheme) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
  borderRadius: theme.radii.lg,
  border: `1px solid ${theme.colors.divider}`,
  background: theme.colors.surface,
  cursor: "pointer",
  gap: theme.spacing.md
});

const infoItemStyles = (theme: AppTheme) => ({
  display: "flex",
  flexDirection: "column" as const,
  gap: theme.spacing.xs,
  padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
  borderRadius: theme.radii.lg,
  border: `1px solid ${theme.colors.divider}`,
  background: theme.colors.surface,
  textAlign: "left" as const,
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease"
});

const infoLabelStyles = (theme: AppTheme) => ({
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 0.6,
  fontWeight: 700,
  color: theme.colors.textSecondary
});

const infoValueStyles = (theme: AppTheme) => ({
  fontSize: 14,
  fontWeight: 600,
  color: theme.colors.text
});

const infoActionStyles = (theme: AppTheme) => ({
  fontSize: 11,
  fontWeight: 700,
  color: theme.colors.primary,
  textTransform: "uppercase" as const,
  letterSpacing: 0.4
});

const createStyles = (theme: AppTheme) => ({
  page: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.xl
  },
  hero: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md
  },
  avatarContainer: {
    position: "relative" as const
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: "linear-gradient(135deg, #FF385C 0%, #FF8A5C 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.background,
    fontSize: 28,
    fontWeight: 700,
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden",
    transition: "transform 0.2s ease"
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const
  },
  avatarOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    padding: `${theme.spacing.xs}px 0`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity 0.2s ease"
  },
  avatarOverlayText: {
    fontSize: 10,
    fontWeight: 600,
    color: theme.colors.background,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  avatarInitials: {
    letterSpacing: 1
  },
  heroInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0
  },
  email: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0
  },
  editProfileButton: {
    alignSelf: "flex-start" as const,
    border: "none",
    background: "transparent",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer"
  },
  languageIntro: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  languageSwitcher: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: theme.radii.pill,
    background: theme.colors.surface,
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
    cursor: "pointer",
    fontFamily: "inherit"
  },
  languageButtonActive: {
    background: theme.colors.primary,
    color: theme.colors.background
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm,
    width: "100%"
  },
  aiSummaryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  aiRefreshButton: {
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface,
    color: theme.colors.primary,
    borderRadius: theme.radii.md,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  aiSummaryText: {
    margin: 0,
    fontSize: 14,
    lineHeight: "22px",
    color: theme.colors.text
  },
  aiMotivationText: {
    margin: 0,
    fontSize: 14,
    lineHeight: "20px",
    color: theme.colors.primary,
    fontWeight: 600
  },
  aiSummaryError: {
    margin: 0,
    fontSize: 13,
    lineHeight: "20px",
    color: theme.colors.error
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: theme.spacing.md
  },
  logoutStack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    width: "100%"
  },
  dangerButton: {
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.error}`,
    color: theme.colors.error,
    padding: `${theme.spacing.lg}px`,
    fontWeight: 700,
    background: "transparent",
    cursor: "pointer"
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm
  },
  viewAllButton: {
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  addButton: {
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: `${theme.spacing.xl}px 0`
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    margin: 0
  },
  orderItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  orderDate: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  orderRight: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: theme.spacing.xs
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0
  },
  orderStatus: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radii.sm,
    letterSpacing: 0.5
  },
  paymentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`
  },
  paymentLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md
  },
  paymentIcon: {
    fontSize: 24
  },
  paymentBrand: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  paymentLast4: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  defaultBadge: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radii.sm,
    background: theme.colors.primary,
    color: theme.colors.background,
    letterSpacing: 0.5
  },
  addressItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    gap: theme.spacing.md
  },
  addressName: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  addressPhone: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  imageUploadContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md
  },
  fileInput: {
    display: "none"
  },
  uploadButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: `${theme.spacing.lg}px`,
    background: theme.colors.primary,
    color: theme.colors.background,
    borderRadius: theme.radii.lg,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontSize: 15,
    fontFamily: "inherit"
  },
  removeButton: {
    padding: `${theme.spacing.md}px`,
    background: "transparent",
    color: theme.colors.error,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.error}`,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit"
  },
  measurementEditor: {
    display: "flex",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md
  },
  measurementInput: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  measurementLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.textSecondary
  },
  measurementSelect: {
    width: "100%",
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.lg}px`,
    fontSize: 16,
    background: theme.colors.surface,
    fontFamily: "inherit",
    color: theme.colors.text
  },
  trackerContent: {
    display: "grid",
    gap: theme.spacing.md
  },
  trackerFormRowOne: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: theme.spacing.sm
  },
  trackerFormRowTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.sm
  },
  trackerInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box" as const,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    fontSize: 14,
    fontFamily: "inherit"
  },
  trackerAddButton: {
    border: "none",
    borderRadius: theme.radii.md,
    background: theme.colors.primary,
    color: theme.colors.background,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    justifySelf: "start"
  },
  trackerFilterRow: {
    display: "grid",
    gap: theme.spacing.xs
  },
  trackerFilterLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6
  },
  trackerSelect: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box" as const,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    fontSize: 14,
    fontFamily: "inherit",
    background: theme.colors.surface,
    color: theme.colors.text
  },
  trackerChart: {
    display: "block",
    width: "100%",
    height: 140,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    overflow: "hidden" as const
  },
  trackerLegend: {
    margin: 0,
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  trackerInsight: {
    margin: 0,
    fontSize: 13,
    lineHeight: "20px",
    color: theme.colors.text
  },
  trackerHistory: {
    borderTop: `1px solid ${theme.colors.divider}`,
    paddingTop: theme.spacing.sm,
    display: "grid",
    gap: theme.spacing.xs,
    maxHeight: 140,
    overflowY: "auto" as const
  },
  trackerHistoryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  consentGrid: {
    display: "grid",
    gap: theme.spacing.sm
  },
  consentItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface
  },
  consentLabel: {
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    fontWeight: 700,
    color: theme.colors.textSecondary
  },
  consentValue: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text
  },
  consentInlineActionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  consentActionButton: {
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.radii.pill,
    background: theme.colors.surface,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 700,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  consentMetaRow: {
    display: "grid",
    gap: 2,
    padding: `${theme.spacing.xs}px ${theme.spacing.xs}px 0`
  },
  consentMetaText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  }
});

export default ProfileScreen;
