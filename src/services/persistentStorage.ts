type PersistMeta = Record<string, number>;

const CLIENT_ID_KEY = "ngClientId";
const META_KEY = "ngPersistMeta";
const DEFAULT_TIMEOUT_MS = 1200;

const safeNow = () => Date.now();

const getOrCreateClientId = () => {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && /^[a-zA-Z0-9._-]{8,100}$/.test(existing)) return existing;
  } catch {
    // ignore
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  try {
    localStorage.setItem(CLIENT_ID_KEY, generated);
  } catch {
    // ignore
  }
  return generated;
};

const readMeta = (): PersistMeta => {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PersistMeta;
  } catch {
    return {};
  }
};

const writeMeta = (meta: PersistMeta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
};

const withTimeout = async <T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async (url: string, init: RequestInit & { signal?: AbortSignal } = {}) => {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

let remoteEnabled: boolean | null = null;
let pendingFlush: Record<string, string> = {};
let flushTimer: number | null = null;

const scheduleFlush = () => {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushPending().catch(() => {
      // ignore network failures; we keep local persistence.
    });
  }, 350);
};

const flushPending = async () => {
  if (remoteEnabled !== true) return;
  const items = pendingFlush;
  pendingFlush = {};
  const keys = Object.keys(items);
  if (keys.length === 0) return;

  const clientId = getOrCreateClientId();
  await fetchJson(`/api/kv/${clientId}/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items })
  });
};

const queueRemoteUpsert = (key: string, value: string) => {
  if (remoteEnabled !== true) return;
  pendingFlush[key] = value;
  scheduleFlush();
};

const KNOWN_PERSIST_KEYS = [
  "appUsageStats",
  "bloodworkAnalysis",
  "bloodworkAnalysisMeta",
  "bloodworkHistory",
  "userProfile",
  "paymentMethods",
  "shippingAddresses",
  "orderHistory",
  "bloodPressureHistory",
  "fastingGlucoseHistory",
  "weightHistory",
  "orderDetails",
  "deliveryAddress",
  "lastOrder",
  "chatRecommendationExamples"
];

const listLocalKeysToPersist = (): string[] => {
  const keys = new Set<string>(KNOWN_PERSIST_KEYS);
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("analysis:")) keys.add(k);
    }
  } catch {
    // ignore
  }
  return Array.from(keys);
};

export const persistentStorage = {
  getClientId(): string {
    return getOrCreateClientId();
  },

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
      const meta = readMeta();
      meta[key] = safeNow();
      writeMeta(meta);
      queueRemoteUpsert(key, value);
    } catch {
      // ignore
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      const meta = readMeta();
      meta[key] = safeNow();
      writeMeta(meta);
      // Represent deletions as empty-string tombstones (keeps API simple).
      queueRemoteUpsert(key, "");
    } catch {
      // ignore
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    const raw = this.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: unknown): void {
    this.setItem(key, JSON.stringify(value));
  }
};

export const initPersistentStorage = async (options?: { timeoutMs?: number }) => {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (remoteEnabled !== null) return;

  // 1) Decide whether the backend is present (prod) or absent (vite dev).
  try {
    await withTimeout(
      (signal: AbortSignal) => fetchJson("/api/kv/ping", { signal }),
      timeoutMs
    );
    remoteEnabled = true;
  } catch {
    remoteEnabled = false;
    return;
  }

  const clientId = getOrCreateClientId();
  const meta = readMeta();

  // 2) Pull server state.
  let serverItems: { key: string; value: string; updatedAt: number }[] = [];
  try {
    const payload = await withTimeout(
      (signal: AbortSignal) => fetchJson(`/api/kv/${clientId}`, { signal }),
      timeoutMs
    );
    serverItems = Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    serverItems = [];
  }

  const serverMap = new Map(serverItems.map((item) => [item.key, item]));

  // 3) Merge server -> local where server is newer.
  for (const item of serverItems) {
    const localUpdatedAt = meta[item.key] || 0;
    if (item.updatedAt > localUpdatedAt) {
      try {
        if (item.value === "") {
          localStorage.removeItem(item.key);
        } else {
          localStorage.setItem(item.key, item.value);
        }
        meta[item.key] = item.updatedAt;
      } catch {
        // ignore
      }
    }
  }
  writeMeta(meta);

  // 4) Push local -> server for any keys we track that are newer locally or missing remotely.
  const keysToCheck = listLocalKeysToPersist();
  const toUpsert: Record<string, string> = {};
  for (const key of keysToCheck) {
    const localRaw = persistentStorage.getItem(key);
    if (localRaw === null) continue;

    const server = serverMap.get(key);
    const localUpdatedAt = meta[key] || 0;
    const serverUpdatedAt = server?.updatedAt || 0;
    if (!server || localUpdatedAt > serverUpdatedAt) {
      toUpsert[key] = localRaw;
    }
  }

  if (Object.keys(toUpsert).length > 0) {
    try {
      await withTimeout(
        (signal: AbortSignal) =>
          fetchJson(`/api/kv/${clientId}/batch`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: toUpsert }),
            signal
          }),
        timeoutMs
      );
    } catch {
      // ignore
    }
  }
};

