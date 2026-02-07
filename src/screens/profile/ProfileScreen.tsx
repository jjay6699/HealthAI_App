import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import Dialog from "../../components/Dialog";
import { AppTheme, useTheme } from "../../theme";

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

const ProfileScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const defaultProfile: ProfileState = {
    avatarImage: null,
    name: "JJAY TECH",
    email: "contact@jjay.info",
    dob: "1986-07-28",
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
    const saved = localStorage.getItem("userProfile");
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
    const saved = localStorage.getItem("paymentMethods");
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
    const saved = localStorage.getItem("shippingAddresses");
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
    const saved = localStorage.getItem("orderHistory");
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
    const saved = localStorage.getItem("bloodPressureHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [glucoseHistory, setGlucoseHistory] = useState<FastingGlucoseEntry[]>(() => {
    const saved = localStorage.getItem("fastingGlucoseHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(() => {
    const saved = localStorage.getItem("weightHistory");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Temporary state for measurement editor
  const [tempHeight, setTempHeight] = useState(profile.height);
  const [tempWeight, setTempWeight] = useState(profile.weight);

  // Auto-generate initials from name
  const avatarInitials = useMemo(() => getInitials(profile.name), [profile.name]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("userProfile", JSON.stringify(profile));
  }, [profile]);

  // Save payment methods to localStorage
  useEffect(() => {
    localStorage.setItem("paymentMethods", JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  // Save shipping addresses to localStorage
  useEffect(() => {
    localStorage.setItem("shippingAddresses", JSON.stringify(shippingAddresses));
  }, [shippingAddresses]);

  // Save order history to localStorage
  useEffect(() => {
    localStorage.setItem("orderHistory", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem("bloodPressureHistory", JSON.stringify(bpHistory));
  }, [bpHistory]);

  useEffect(() => {
    localStorage.setItem("fastingGlucoseHistory", JSON.stringify(glucoseHistory));
  }, [glucoseHistory]);

  useEffect(() => {
    localStorage.setItem("weightHistory", JSON.stringify(weightHistory));
  }, [weightHistory]);

  const editConfig: Record<EditKey, EditConfig> = {
    avatarImage: { label: "Profile photo" },
    name: { label: "Full name" },
    email: { label: "Email address", type: "email" },
    dob: { label: "Date of birth", type: "date" },
    gender: { label: "Gender", options: ["Female", "Male"] },
    height: { label: "Height (cm)", type: "number", inputMode: "numeric" },
    weight: { label: "Weight (kg)", type: "number", inputMode: "numeric" },
    activityLevel: { label: "Activity level", options: ["Sedentary", "Lightly active", "Moderately active", "Very active"] },
    exerciseDays: { label: "Exercise days (per week)", type: "number", inputMode: "numeric" },
    minutesPerSession: { label: "Minutes per session", type: "number", inputMode: "numeric" },
    sleepDuration: { label: "Sleep duration", options: ["Under 5 hrs", "5-6 hrs", "6-7 hrs", "7-8 hrs", "8+ hrs"] },
    stressLevel: { label: "Stress level", options: ["Low", "Moderate", "High"] },
    bloodPressure: { label: "Blood pressure", helper: "Format: 120/80" },
    fastingGlucose: { label: "Fasting glucose (mg/dL)", type: "number", inputMode: "numeric" },
    hba1c: { label: "HbA1c (%)", type: "number", inputMode: "decimal" },
    restingHeartRate: { label: "Resting HR (bpm)", type: "number", inputMode: "numeric" },
    waistCircumference: { label: "Waist circumference (cm)", type: "number", inputMode: "numeric" },
    bodyFat: { label: "Body fat (%)", type: "number", inputMode: "decimal" },
    dietPattern: { label: "Diet pattern", options: ["Balanced", "Mediterranean", "Plant-based", "Vegetarian", "Vegan", "Low-carb", "Keto", "Paleo"] },
    mealsPerDay: { label: "Meals per day", type: "number", inputMode: "numeric" },
    caffeineIntake: { label: "Caffeine intake", options: ["None", "Low (1 cup)", "Moderate (2-3 cups)", "High (4+ cups)"] },
    waterIntake: { label: "Water intake (cups/day)", type: "number", inputMode: "numeric" },
    allergies: { label: "Medications or supplements allergy history" },
    conditions: { label: "Conditions" },
    surgeries: { label: "Surgeries history" },
    medications: { label: "Medications history" },
    supplements: { label: "Current nutrition" },
    topPriorities: { label: "Top priorities" },
    dataProcessingConsent: { label: "Data processing consent" },
    dataProcessing: { label: "Data processing" },
    dataStorage: { label: "Health data storage" },
    research: { label: "Research participation" },
    appleHealth: { label: "Apple Health status" },
    googleFit: { label: "Google Fit status" }
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

  const handleLogout = () => {
    // Clear all user-related data from local storage
    localStorage.removeItem("userProfile");
    localStorage.removeItem("paymentMethods");
    localStorage.removeItem("shippingAddresses");
    localStorage.removeItem("orderHistory");
    localStorage.removeItem("bloodworkAnalysis");
    localStorage.removeItem("lastOrder");

    // Navigate to the login screen
    navigate("/login");
  };

  const formatValue = (value: string) => (value && value.trim() ? value : "Not set");
  const formatNumber = (value: number, unit?: string) =>
    value && value > 0 ? `${value}${unit ? ` ${unit}` : ""}` : "Not set";

  const getLatestBp = () => {
    if (bpHistory.length === 0) return formatValue(profile.bloodPressure);
    const sorted = [...bpHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${sorted[0].systolic}/${sorted[0].diastolic}`;
  };

  const getLatestGlucose = () => {
    if (glucoseHistory.length === 0) return formatNumber(profile.fastingGlucose, "mg/dL");
    const sorted = [...glucoseHistory].sort((a, b) => b.date.localeCompare(a.date));
    return `${sorted[0].value} mg/dL`;
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
    if (bpFilteredEntries.length < 2) return "Add daily readings to see blood pressure trends.";
    const avgSystolic =
      bpFilteredEntries.reduce((sum, entry) => sum + entry.systolic, 0) / bpFilteredEntries.length;
    const avgDiastolic =
      bpFilteredEntries.reduce((sum, entry) => sum + entry.diastolic, 0) / bpFilteredEntries.length;
    const trend = bpFilteredEntries[bpFilteredEntries.length - 1].systolic - bpFilteredEntries[0].systolic;
    const trendText = trend > 0 ? "rising" : trend < 0 ? "improving" : "stable";
    if (avgSystolic >= 130 || avgDiastolic >= 80) {
      return `Recent average is ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} and trend is ${trendText}. Keep tracking and monitor response to your nutrition routine.`;
    }
    return `Recent average is ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} with a ${trendText} pattern. Current range looks stable.`;
  })();

  const glucoseInsight = (() => {
    if (glucoseFilteredEntries.length < 2) return "Add daily readings to see fasting glucose trends.";
    const avg = glucoseFilteredEntries.reduce((sum, entry) => sum + entry.value, 0) / glucoseFilteredEntries.length;
    const trend = glucoseFilteredEntries[glucoseFilteredEntries.length - 1].value - glucoseFilteredEntries[0].value;
    const trendText = trend > 0 ? "rising" : trend < 0 ? "improving" : "stable";
    if (avg >= 100) {
      return `Recent average fasting glucose is ${Math.round(avg)} mg/dL and trend is ${trendText}. Keep monitoring daily while using your nutrition plan.`;
    }
    return `Recent average fasting glucose is ${Math.round(avg)} mg/dL with a ${trendText} pattern. Current range looks good.`;
  })();

  const weightInsight = (() => {
    if (weightFilteredEntries.length < 2) return "Add daily weight readings to see your trend.";
    const avg = weightFilteredEntries.reduce((sum, entry) => sum + entry.value, 0) / weightFilteredEntries.length;
    const delta = weightFilteredEntries[weightFilteredEntries.length - 1].value - weightFilteredEntries[0].value;
    const trendText = delta > 0 ? "upward" : delta < 0 ? "downward" : "stable";
    const changeText = `${Math.abs(delta).toFixed(1)} kg`;
    return `Average is ${avg.toFixed(1)} kg with a ${trendText} trend (${changeText} change in this period).`;
  })();

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div className="profile-avatar-container" style={styles.avatarContainer}>
          <div className="profile-avatar-shell" style={styles.avatarShell} onClick={() => setShowImageUpload(true)}>
            {profile.avatarImage ? (
              <>
                <img src={profile.avatarImage} alt="Profile" style={styles.avatarImage} />
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>Change</span>
                </div>
              </>
            ) : (
              <>
                <span style={styles.avatarInitials}>{avatarInitials}</span>
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>Upload</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={styles.heroInfo}>
          <h1 style={styles.name}>{profile.name}</h1>
          <p style={styles.email}>{profile.email}</p>
          <button type="button" style={styles.editProfileButton} onClick={() => openEdit("name", "Full name")}>
            Edit profile
          </button>
        </div>
      </header>
      <Card style={styles.card}>
        <SectionHeader title="Personal info" />
        <ProfileRow label="Full name" value={profile.name} action="Edit" onEdit={() => openEdit("name")} />
        <ProfileRow label="Email" value={profile.email} action="Edit" onEdit={() => openEdit("email")} />
        <ProfileRow label="Date of birth" value={profile.dob} action="Edit" onEdit={() => openEdit("dob")} />
        <ProfileRow label="Gender" value={formatValue(profile.gender)} action="Edit" onEdit={() => openEdit("gender")} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Health data" />
        <ProfileRow label="Measurements" value={`${profile.height} cm • ${profile.weight} kg`} action="Update" onEdit={() => setIsEditingMeasurements(true)} />
        <ProfileRow label="Daily weight" value={getLatestWeight()} action="Track" onEdit={() => setActiveTracker("weight")} />
        <ProfileRow label="Activity level" value={formatValue(profile.activityLevel)} action="Update" onEdit={() => openEdit("activityLevel")} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Vitals & markers" />
        <div style={styles.infoGrid}>
          <InfoItem label="Blood pressure" value={getLatestBp()} action="Track" onEdit={() => setActiveTracker("bloodPressure")} />
          <InfoItem label="Fasting glucose" value={getLatestGlucose()} action="Track" onEdit={() => setActiveTracker("fastingGlucose")} />
          <InfoItem label="HbA1c" value={formatNumber(profile.hba1c, "%")} action="Set" onEdit={() => openEdit("hba1c")} />
          <InfoItem label="Resting HR" value={formatNumber(profile.restingHeartRate, "bpm")} action="Set" onEdit={() => openEdit("restingHeartRate")} />
          <InfoItem label="Waist circumference" value={formatNumber(profile.waistCircumference, "cm")} action="Set" onEdit={() => openEdit("waistCircumference")} />
          <InfoItem label="Body fat" value={formatNumber(profile.bodyFat, "%")} action="Set" onEdit={() => openEdit("bodyFat")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Lifestyle & diet" />
        <div style={styles.infoGrid}>
          <InfoItem label="Exercise days" value={formatNumber(profile.exerciseDays, "days/week")} action="Set" onEdit={() => openEdit("exerciseDays")} />
          <InfoItem label="Minutes per session" value={formatNumber(profile.minutesPerSession, "min")} action="Set" onEdit={() => openEdit("minutesPerSession")} />
          <InfoItem label="Sleep duration" value={formatValue(profile.sleepDuration)} action="Set" onEdit={() => openEdit("sleepDuration")} />
          <InfoItem label="Stress level" value={formatValue(profile.stressLevel)} action="Set" onEdit={() => openEdit("stressLevel")} />
          <InfoItem label="Diet pattern" value={formatValue(profile.dietPattern)} action="Set" onEdit={() => openEdit("dietPattern")} />
          <InfoItem label="Meals per day" value={formatNumber(profile.mealsPerDay)} action="Set" onEdit={() => openEdit("mealsPerDay")} />
          <InfoItem label="Caffeine intake" value={formatValue(profile.caffeineIntake)} action="Set" onEdit={() => openEdit("caffeineIntake")} />
          <InfoItem label="Water intake" value={formatNumber(profile.waterIntake, "cups/day")} action="Set" onEdit={() => openEdit("waterIntake")} />
          <InfoItem label="Medications or supplements allergy history" value={formatValue(profile.allergies)} action="Set" onEdit={() => openEdit("allergies")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Medical History" />
        <div style={styles.infoGrid}>
          <InfoItem label="Conditions" value={formatValue(profile.conditions)} action="Set" onEdit={() => openEdit("conditions")} />
          <InfoItem label="Surgeries history" value={formatValue(profile.surgeries)} action="Set" onEdit={() => openEdit("surgeries")} />
          <InfoItem label="Medications history" value={formatValue(profile.medications)} action="Set" onEdit={() => openEdit("medications")} />
          <InfoItem label="Current nutrition" value={formatValue(profile.supplements)} action="Set" onEdit={() => openEdit("supplements")} />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Goals & consent" />
        <div style={styles.infoGrid}>
          <InfoItem label="Top priorities" value={formatValue(profile.topPriorities)} action="Set" onEdit={() => openEdit("topPriorities")} />
          <InfoItem label="Data consent" value={formatValue(profile.dataProcessingConsent)} action="Set" onEdit={() => openEdit("dataProcessingConsent")} />
        </div>
      </Card>

      {/* Order History */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Order History" />
          {orders.length > 0 && (
            <button style={styles.viewAllButton} onClick={() => navigate("/orders")}>
              View All
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No orders yet</p>
            <Button title="Start Shopping" onClick={() => navigate("/upload")} variant="secondary" />
          </div>
        ) : (
          orders.slice(0, 3).map((order) => (
            <div key={order.orderNumber} style={styles.orderItem}>
              <div>
                <p style={styles.orderNumber}>#{order.orderNumber}</p>
                <p style={styles.orderDate}>{new Date(order.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div style={styles.orderRight}>
                <p style={styles.orderPrice}>RM{order.price}</p>
                <span style={{...styles.orderStatus, ...getStatusStyle(order.status, theme)}}>{order.status}</span>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Payment Methods */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Payment Methods" />
          <button style={styles.addButton} onClick={() => navigate("/add-payment")}>
            + Add
          </button>
        </div>
        {paymentMethods.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No payment methods added</p>
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
              {method.isDefault && <span style={styles.defaultBadge}>Default</span>}
            </div>
          ))
        )}
      </Card>

      {/* Shipping Addresses */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Shipping Addresses" />
          <button style={styles.addButton} onClick={() => navigate("/add-address")}>
            + Add
          </button>
        </div>
        {shippingAddresses.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No shipping addresses added</p>
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
              {address.isDefault && <span style={styles.defaultBadge}>Default</span>}
            </div>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Privacy & connections" />
        <ProfileRow label="Data processing" value={profile.dataProcessing} action="Manage" onEdit={() => openEdit("dataProcessing") } />
        <ProfileRow label="Health data storage" value={profile.dataStorage} action="Manage" onEdit={() => openEdit("dataStorage") } />
        <ProfileRow label="Research participation" value={profile.research} action="Manage" onEdit={() => openEdit("research") } />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Linked services" />
        <ProfileRow label="Apple Health" value={profile.appleHealth} action="Connect" onEdit={() => openEdit("appleHealth") } />
        <ProfileRow label="Google Fit" value={profile.googleFit} action="Connect" onEdit={() => openEdit("googleFit") } />
      </Card>

      <div style={styles.logoutStack}>
        <Button title="Log out" variant="secondary" fullWidth onClick={handleLogout} />
        <button type="button" style={styles.dangerButton}>Delete my account</button>
      </div>

      {editState ? (
        <Dialog
          title={`Edit ${editState.label.toLowerCase()}`}
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
                Select
              </option>
              {editState.options.map((option) => (
                <option key={option} value={option}>
                  {option}
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
          title="Blood pressure daily tracker"
          description="Log your morning readings daily to monitor trend and response to nutrition."
          onClose={() => setActiveTracker(null)}
          cancelLabel="Close"
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
                placeholder="Systolic"
                value={bpSystolic}
                onChange={(event) => setBpSystolic(event.target.value)}
                style={styles.trackerInput}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="Diastolic"
                value={bpDiastolic}
                onChange={(event) => setBpDiastolic(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <button type="button" style={styles.trackerAddButton} onClick={addBloodPressureEntry}>
              Add reading
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>Month</span>
              <select
                value={bpMonthFilter}
                onChange={(event) => setBpMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">All months</option>
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
            <p style={styles.trackerLegend}>Red: systolic • Amber: diastolic</p>
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
          title="Fasting glucose daily tracker"
          description="Log your morning fasting glucose to see trend and progression."
          onClose={() => setActiveTracker(null)}
          cancelLabel="Close"
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
                inputMode="numeric"
                placeholder="mg/dL"
                value={glucoseValue}
                onChange={(event) => setGlucoseValue(event.target.value)}
                style={styles.trackerInput}
              />
            </div>
            <button type="button" style={styles.trackerAddButton} onClick={addGlucoseEntry}>
              Add reading
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>Month</span>
              <select
                value={glucoseMonthFilter}
                onChange={(event) => setGlucoseMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">All months</option>
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
            <p style={styles.trackerLegend}>Blue: fasting glucose</p>
            <p style={styles.trackerInsight}>{glucoseInsight}</p>
            <div style={styles.trackerHistory}>
              {glucoseFilteredEntries
                .slice(-7)
                .reverse()
                .map((entry) => (
                  <div key={`glucose-${entry.date}`} style={styles.trackerHistoryRow}>
                    <span>{entry.date}</span>
                    <span>{entry.value} mg/dL</span>
                  </div>
                ))}
            </div>
          </div>
        </Dialog>
      ) : null}

      {activeTracker === "weight" ? (
        <Dialog
          title="Weight daily tracker"
          description="Log your morning weight daily to monitor trend and progression."
          onClose={() => setActiveTracker(null)}
          cancelLabel="Close"
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
              Add reading
            </button>
            <div style={styles.trackerFilterRow}>
              <span style={styles.trackerFilterLabel}>Month</span>
              <select
                value={weightMonthFilter}
                onChange={(event) => setWeightMonthFilter(event.target.value)}
                style={styles.trackerSelect}
              >
                <option value="all">All months</option>
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
            <p style={styles.trackerLegend}>Purple: weight</p>
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
          title="Profile Picture"
          description="Upload a custom profile picture or use your initials"
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
              📷 Choose Image
            </label>
            {profile.avatarImage && (
              <button onClick={handleRemoveImage} style={styles.removeButton}>
                Remove Image
              </button>
            )}
          </div>
        </Dialog>
      ) : null}

      {isEditingMeasurements ? (
        <Dialog
          title="Edit Measurements"
          description="Update your height and weight."
          onClose={() => setIsEditingMeasurements(false)}
          onConfirm={handleConfirmMeasurements}
        >
          <div style={styles.measurementEditor}>
            <div style={styles.measurementInput}>
              <label htmlFor="height-select" style={styles.measurementLabel}>Height</label>
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
              <label htmlFor="weight-select" style={styles.measurementLabel}>Weight</label>
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
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm,
    width: "100%"
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
  }
});

export default ProfileScreen;

