export type BloodPressureEntry = {
  date: string;
  systolic: number;
  diastolic: number;
};

export type FastingGlucoseEntry = {
  date: string;
  value: number;
};

export type WeightEntry = {
  date: string;
  value: number;
};

export type HealthMetricsPayload = {
  bloodPressureHistory: BloodPressureEntry[];
  fastingGlucoseHistory: FastingGlucoseEntry[];
  weightHistory: WeightEntry[];
};

export const fetchHealthMetrics = async () => {
  const response = await fetch("/api/health-metrics", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const metrics = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : {};

  return {
    bloodPressureHistory: Array.isArray(metrics.bloodPressureHistory)
      ? (metrics.bloodPressureHistory as BloodPressureEntry[])
      : [],
    fastingGlucoseHistory: Array.isArray(metrics.fastingGlucoseHistory)
      ? (metrics.fastingGlucoseHistory as FastingGlucoseEntry[])
      : [],
    weightHistory: Array.isArray(metrics.weightHistory)
      ? (metrics.weightHistory as WeightEntry[])
      : []
  } satisfies HealthMetricsPayload;
};

export const saveHealthMetrics = async (metrics: HealthMetricsPayload) => {
  const response = await fetch("/api/health-metrics", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ metrics })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const nextMetrics = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : {};

  return {
    bloodPressureHistory: Array.isArray(nextMetrics.bloodPressureHistory)
      ? (nextMetrics.bloodPressureHistory as BloodPressureEntry[])
      : [],
    fastingGlucoseHistory: Array.isArray(nextMetrics.fastingGlucoseHistory)
      ? (nextMetrics.fastingGlucoseHistory as FastingGlucoseEntry[])
      : [],
    weightHistory: Array.isArray(nextMetrics.weightHistory)
      ? (nextMetrics.weightHistory as WeightEntry[])
      : []
  } satisfies HealthMetricsPayload;
};
