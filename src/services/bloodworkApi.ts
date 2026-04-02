import type { BloodworkAnalysis } from "./openai";

export type BloodworkMeta = {
  uploadedAt?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

export type BloodworkRecord = {
  id: string;
  uploadedAt: string;
  analysis: BloodworkAnalysis;
  meta?: BloodworkMeta | null;
};

export const fetchLatestBloodworkRecord = async (): Promise<BloodworkRecord | null> => {
  const response = await fetch("/api/bloodwork/latest", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload?.record ? (payload.record as BloodworkRecord) : null;
};

export const fetchBloodworkHistory = async (): Promise<BloodworkRecord[]> => {
  const response = await fetch("/api/bloodwork/history", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.records) ? (payload.records as BloodworkRecord[]) : [];
};

export const saveBloodworkRecord = async (record: BloodworkRecord): Promise<BloodworkRecord> => {
  const response = await fetch("/api/bloodwork/record", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ record })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.record as BloodworkRecord;
};

export const replaceBloodworkHistory = async (
  records: BloodworkRecord[]
): Promise<BloodworkRecord[]> => {
  const response = await fetch("/api/bloodwork/history", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ records })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.records) ? (payload.records as BloodworkRecord[]) : [];
};
