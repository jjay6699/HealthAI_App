import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { OAuth2Client } from "google-auth-library";
import OpenAI from "openai";

const PORT = Number(process.env.PORT || 3000);

// Railway volume recommendation: mount a persistent volume at /data
// and set DATABASE_PATH=/data/app.sqlite
const DATABASE_PATH =
  process.env.DATABASE_PATH ||
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), "data", "app.sqlite");

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    clientId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updatedAt INTEGER NOT NULL,
    PRIMARY KEY (clientId, key)
  );
`);

const hasUserColumn = (columnName) =>
  db
    .prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = ?")
    .get(columnName);

if (!hasUserColumn("passwordHash")) {
  db.exec("ALTER TABLE users ADD COLUMN passwordHash TEXT");
}

if (!hasUserColumn("country")) {
  db.exec("ALTER TABLE users ADD COLUMN country TEXT");
}

if (!hasUserColumn("referralCode")) {
  db.exec("ALTER TABLE users ADD COLUMN referralCode TEXT");
}

// Auth tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    pictureUrl TEXT,
    provider TEXT NOT NULL,
    providerSub TEXT NOT NULL,
    referralCode TEXT,
    createdAt INTEGER NOT NULL,
    lastLoginAt INTEGER NOT NULL,
    UNIQUE(provider, providerSub),
    UNIQUE(email)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referralCode_unique
    ON users(referralCode)
    WHERE referralCode IS NOT NULL;

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    orderNumber TEXT NOT NULL UNIQUE,
    userId TEXT,
    userEmail TEXT,
    customerName TEXT,
    plan TEXT NOT NULL,
    planLabel TEXT,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MYR',
    paymentMethod TEXT,
    status TEXT NOT NULL,
    couponCode TEXT,
    recommendationsJson TEXT,
    deliveryAddressJson TEXT,
    stripeSessionId TEXT,
    stripePaymentIntentId TEXT,
    source TEXT NOT NULL DEFAULT 'app',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
  CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC);

  CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    consentType TEXT NOT NULL,
    granted INTEGER NOT NULL,
    policyVersion TEXT,
    acceptedAt TEXT,
    sourceIp TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_consents_userId ON user_consents(userId);
  CREATE INDEX IF NOT EXISTS idx_user_consents_userId_type ON user_consents(userId, consentType);
`);

const stmtGetAll = db.prepare(
  "SELECT key, value, updatedAt FROM kv WHERE clientId = ? ORDER BY key ASC"
);
const stmtGetOne = db.prepare(
  "SELECT key, value, updatedAt FROM kv WHERE clientId = ? AND key = ?"
);
const stmtUpsert = db.prepare(
  "INSERT INTO kv (clientId, key, value, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(clientId, key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt"
);
const stmtDeleteOne = db.prepare(
  "DELETE FROM kv WHERE clientId = ? AND key = ?"
);

const stmtGetUserByProviderSub = db.prepare(
  "SELECT id, email, name, pictureUrl, provider, providerSub, referralCode, createdAt, lastLoginAt FROM users WHERE provider = ? AND providerSub = ?"
);
const stmtGetPasswordUserByEmail = db.prepare(
  "SELECT id, email, name, pictureUrl, provider, providerSub, country, referralCode, passwordHash, createdAt, lastLoginAt FROM users WHERE email = ?"
);
const stmtGetUserById = db.prepare(
  "SELECT id, email, name, pictureUrl, provider, providerSub, country, referralCode, createdAt, lastLoginAt FROM users WHERE id = ?"
);
const stmtGetUserByReferralCode = db.prepare(
  "SELECT id, email, name, provider, country, referralCode, createdAt, lastLoginAt FROM users WHERE referralCode = ?"
);
const stmtInsertUser = db.prepare(
  "INSERT INTO users (id, email, name, pictureUrl, provider, providerSub, createdAt, lastLoginAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtInsertPasswordUser = db.prepare(
  "INSERT INTO users (id, email, name, pictureUrl, provider, providerSub, passwordHash, country, createdAt, lastLoginAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtUpdateUserLogin = db.prepare(
  "UPDATE users SET email = ?, name = ?, pictureUrl = ?, lastLoginAt = ? WHERE id = ?"
);
const stmtUpdatePasswordUserLogin = db.prepare(
  "UPDATE users SET name = ?, country = ?, lastLoginAt = ? WHERE id = ?"
);
const stmtUpdateUserReferralCode = db.prepare("UPDATE users SET referralCode = ? WHERE id = ?");
const stmtInsertUserConsent = db.prepare(
  "INSERT INTO user_consents (id, userId, consentType, granted, policyVersion, acceptedAt, sourceIp, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

const stmtInsertSession = db.prepare(
  "INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)"
);
const stmtGetSession = db.prepare(
  "SELECT token, userId, createdAt, expiresAt FROM sessions WHERE token = ?"
);
const stmtDeleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");
const stmtDeleteExpiredSessions = db.prepare("DELETE FROM sessions WHERE expiresAt < ?");
const stmtInsertOrder = db.prepare(`
  INSERT INTO orders (
    id,
    orderNumber,
    userId,
    userEmail,
    customerName,
    plan,
    planLabel,
    price,
    currency,
    paymentMethod,
    status,
    couponCode,
    recommendationsJson,
    deliveryAddressJson,
    stripeSessionId,
    stripePaymentIntentId,
    source,
    createdAt,
    updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtListAdminUsers = db.prepare(`
  SELECT id, email, name, provider, country, referralCode, createdAt, lastLoginAt
  FROM users
  ORDER BY createdAt DESC
  LIMIT ?
`);
const stmtListAdminOrders = db.prepare(`
  SELECT
    id,
    orderNumber,
    userId,
    userEmail,
    customerName,
    plan,
    planLabel,
    price,
    currency,
    paymentMethod,
    status,
    couponCode,
    recommendationsJson,
    deliveryAddressJson,
    stripeSessionId,
    stripePaymentIntentId,
    source,
    createdAt,
    updatedAt
  FROM orders
  ORDER BY createdAt DESC
  LIMIT ?
`);
const stmtAdminUserCount = db.prepare("SELECT COUNT(*) AS count, MAX(createdAt) AS latestCreatedAt FROM users");
const stmtAdminOrderStats = db.prepare(
  "SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue, MAX(createdAt) AS latestCreatedAt FROM orders"
);

const scryptAsync = promisify(crypto.scrypt);
const authRateLimitState = new Map();

const upsertMany = db.transaction((clientId, items) => {
  for (const [key, value] of items) {
    stmtUpsert.run(clientId, key, value, Date.now());
  }
});

const app = express();
app.disable("x-powered-by");
const allowedOrigins = new Set(
  [
    process.env.APP_ORIGIN,
    process.env.WEBSITE_ORIGIN,
    process.env.ADMIN_WEB_ORIGIN,
    process.env.MARKETING_SITE_ORIGIN,
    "https://healthai.up.railway.app",
    "https://richai.up.railway.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ].filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});
app.use(express.json({ limit: "25mb" }));

const SESSION_COOKIE = "ng_session";
const OAUTH_STATE_COOKIE = "ng_oauth_state";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "RichAIAdmin!2026";
const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (isProd && !sessionSecret) {
  throw new Error("SESSION_SECRET is required in production.");
}

app.use(sessionSecret ? cookieParser(sessionSecret) : cookieParser());

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const makeCookieOptions = (extra = {}) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/",
  ...(sessionSecret ? { signed: true } : null),
  ...extra
});

const getSessionTokenFromReq = (req) => req.signedCookies?.[SESSION_COOKIE] || req.cookies?.[SESSION_COOKIE] || null;

const getAuthedUser = (req) => {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;

  // opportunistic cleanup
  try {
    stmtDeleteExpiredSessions.run(Date.now());
  } catch {
    // ignore
  }

  const sess = stmtGetSession.get(token);
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) {
    try {
      stmtDeleteSession.run(token);
    } catch {
      // ignore
    }
    return null;
  }
  const user = stmtGetUserById.get(sess.userId);
  return user || null;
};

const createSessionForUser = (userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const createdAt = Date.now();
  const expiresAt = createdAt + 1000 * 60 * 60 * 24 * 30; // 30 days
  stmtInsertSession.run(token, userId, createdAt, expiresAt);
  return { token, expiresAt };
};

const getBasicAuthCredentials = (req) => {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
};

const requireAdminAuth = (req, res, next) => {
  const credentials = getBasicAuthCredentials(req);
  if (
    credentials &&
    credentials.username === ADMIN_USERNAME &&
    credentials.password === ADMIN_PASSWORD
  ) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
  return res.status(401).json({ error: "admin_auth_required" });
};

const getGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUri) return null;
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
};

const DEMO_EMAIL = "demo@newgene.app";
const DEMO_PASSWORD = "DemoPass!1";
const DEMO_NAME = "Demo User";

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isStrongEnoughPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
const normalizeReferralCode = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9]{4,24}$/.test(normalized)) return "__INVALID__";
  return normalized;
};

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
};

const verifyPassword = async (password, storedHash) => {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) return false;
  const [salt, hashHex] = storedHash.split(":");
  const derived = await scryptAsync(password, salt, 64);
  const storedBuffer = Buffer.from(hashHex, "hex");
  const derivedBuffer = Buffer.from(derived);
  if (storedBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
};

const ensureDemoUser = async () => {
  const existing = stmtGetPasswordUserByEmail.get(DEMO_EMAIL);
  if (existing?.provider === "password" && existing?.passwordHash) {
    return existing;
  }

  const now = Date.now();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  if (existing) {
    db.prepare(
      "UPDATE users SET name = ?, provider = ?, providerSub = ?, passwordHash = ?, country = ?, lastLoginAt = ? WHERE id = ?"
    ).run(DEMO_NAME, "password", DEMO_EMAIL, passwordHash, "Internal", now, existing.id);
    return stmtGetPasswordUserByEmail.get(DEMO_EMAIL);
  }

  const userId = crypto.randomUUID();
  stmtInsertPasswordUser.run(
    userId,
    DEMO_EMAIL,
    DEMO_NAME,
    null,
    "password",
    DEMO_EMAIL,
    passwordHash,
    "Internal",
    now,
    now
  );
  return stmtGetPasswordUserByEmail.get(DEMO_EMAIL);
};

const getRequestIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const makeRateLimiter =
  ({ windowMs, maxAttempts, scope }) =>
  (req, res, next) => {
    const now = Date.now();
    const key = `${scope}:${getRequestIp(req)}`;
    const current = authRateLimitState.get(key);
    if (!current || current.resetAt <= now) {
      authRateLimitState.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({ error: "too_many_attempts" });
    }

    current.count += 1;
    authRateLimitState.set(key, current);
    return next();
  };

const authLoginRateLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  scope: "login"
});

const authRegisterRateLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxAttempts: 10,
  scope: "register"
});

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

// If the SPA hasn't been built (no dist/), still return a 200 at / so common
// platform health-checks don't mark the service as unhealthy.
const distDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  app.get("/", (req, res) => {
    res.status(200).type("text/plain").send("ok");
  });
}

const isSafeClientId = (value) => typeof value === "string" && /^[a-zA-Z0-9._-]{8,100}$/.test(value);
const isSafeKey = (value) => typeof value === "string" && /^[a-zA-Z0-9:._-]{1,240}$/.test(value);

app.get("/api/kv/ping", (req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.post(
  "/api/ai/chat-completions",
  asyncHandler(async (req, res) => {
    const client = getOpenAIClient();
    if (!client) return res.status(501).json({ error: "openai_not_configured" });

    const {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat
    } = req.body || {};

    if (typeof model !== "string" || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const completion = await client.chat.completions.create({
      model,
      messages,
      ...(typeof temperature === "number" ? { temperature } : {}),
      ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {}),
      ...(responseFormat && typeof responseFormat === "object"
        ? { response_format: responseFormat }
        : {})
    });

    res.json({
      choices: completion.choices.map((choice) => ({
        message: {
          content: choice.message.content ?? null
        }
      }))
    });
  })
);

// --- Auth (Google OAuth) ---
app.get("/api/auth/me", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) return res.json({ user: null });
  const { id, email, name, pictureUrl, provider, country, referralCode, createdAt, lastLoginAt } = user;
  res.json({ user: { id, email, name, pictureUrl, provider, country, referralCode, createdAt, lastLoginAt } });
});

app.post(
  "/api/auth/register",
  authRegisterRateLimiter,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const country = typeof req.body?.country === "string" ? req.body.country.trim() : "";
    const termsPrivacyAccepted = req.body?.consents?.termsPrivacyAccepted === true;
    const healthDataProcessingAccepted = req.body?.consents?.healthDataProcessingAccepted === true;
    const consentVersion =
      typeof req.body?.consents?.consentVersion === "string" ? req.body.consents.consentVersion.trim() : "";
    const consentAcceptedAt =
      typeof req.body?.consents?.acceptedAt === "string" ? req.body.consents.acceptedAt.trim() : "";

    if (!name || !isValidEmail(email) || !isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: "invalid_registration_payload" });
    }

    if (!termsPrivacyAccepted || !healthDataProcessingAccepted) {
      return res.status(400).json({ error: "consent_required" });
    }

    const existing = stmtGetPasswordUserByEmail.get(email);
    if (existing) {
      return res.status(409).json({ error: "email_already_registered" });
    }

    const now = Date.now();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    stmtInsertPasswordUser.run(
      userId,
      email,
      name,
      null,
      "password",
      email,
      passwordHash,
      country || null,
      now,
      now
    );

    const requestIp = getRequestIp(req);
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
    const acceptedAt = consentAcceptedAt || new Date(now).toISOString();
    const policyVersion = consentVersion || "2026-03";

    stmtInsertUserConsent.run(
      crypto.randomUUID(),
      userId,
      "terms_privacy",
      1,
      policyVersion,
      acceptedAt,
      requestIp,
      userAgent,
      now
    );
    stmtInsertUserConsent.run(
      crypto.randomUUID(),
      userId,
      "health_data_processing",
      1,
      policyVersion,
      acceptedAt,
      requestIp,
      userAgent,
      now
    );

    const { token, expiresAt } = createSessionForUser(userId);
    res.cookie(SESSION_COOKIE, token, makeCookieOptions({ maxAge: expiresAt - now }));
    res.status(201).json({
      user: { id: userId, email, name, provider: "password", createdAt: now, lastLoginAt: now }
    });
  })
);

app.post(
  "/api/auth/login",
  authLoginRateLimiter,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "invalid_login_payload" });
    }

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const demoUser = await ensureDemoUser();
      const now = Date.now();
      stmtUpdatePasswordUserLogin.run(demoUser.name, demoUser.country || null, now, demoUser.id);
      const { token, expiresAt } = createSessionForUser(demoUser.id);
      res.cookie(SESSION_COOKIE, token, makeCookieOptions({ maxAge: expiresAt - now }));
      return res.json({
        user: {
          id: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          provider: demoUser.provider,
          createdAt: demoUser.createdAt,
          lastLoginAt: now
        }
      });
    }

    const user = stmtGetPasswordUserByEmail.get(email);
    if (!user || user.provider !== "password") {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const now = Date.now();
    stmtUpdatePasswordUserLogin.run(user.name, user.country || null, now, user.id);
    const { token, expiresAt } = createSessionForUser(user.id);
    res.cookie(SESSION_COOKIE, token, makeCookieOptions({ maxAge: expiresAt - now }));
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        createdAt: user.createdAt,
        lastLoginAt: now
      }
    });
  })
);

app.post("/api/auth/logout", (req, res) => {
  const token = getSessionTokenFromReq(req);
  if (token) {
    try {
      stmtDeleteSession.run(token);
    } catch {
      // ignore
    }
  }
  res.clearCookie(SESSION_COOKIE, makeCookieOptions({ maxAge: 0 }));
  res.json({ ok: true });
});

app.post(
  "/api/orders",
  asyncHandler(async (req, res) => {
    const user = getAuthedUser(req);
    if (!user) {
      return res.status(401).json({ error: "authentication_required" });
    }

    const plan = typeof req.body?.plan === "string" ? req.body.plan.trim() : "";
    const planLabel = typeof req.body?.planLabel === "string" ? req.body.planLabel.trim() : null;
    const price = Number(req.body?.price);
    const paymentMethod =
      typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.trim() : null;
    const couponCode =
      typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
        ? req.body.couponCode.trim()
        : null;
    const recommendations = Array.isArray(req.body?.recommendations)
      ? req.body.recommendations
      : [];
    const deliveryAddress =
      req.body?.deliveryAddress && typeof req.body.deliveryAddress === "object"
        ? req.body.deliveryAddress
        : null;
    const stripeSessionId =
      typeof req.body?.stripeSessionId === "string" ? req.body.stripeSessionId.trim() : null;
    const stripePaymentIntentId =
      typeof req.body?.stripePaymentIntentId === "string"
        ? req.body.stripePaymentIntentId.trim()
        : null;
    const status =
      typeof req.body?.status === "string" && req.body.status.trim()
        ? req.body.status.trim()
        : "processing";

    if (!plan || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "invalid_order_payload" });
    }

    const now = Date.now();
    const orderId = crypto.randomUUID();
    const orderNumber = `NG${now.toString().slice(-8)}`;
    const customerName =
      typeof deliveryAddress?.fullName === "string" && deliveryAddress.fullName.trim()
        ? deliveryAddress.fullName.trim()
        : user.name || null;

    stmtInsertOrder.run(
      orderId,
      orderNumber,
      user.id,
      user.email || null,
      customerName,
      plan,
      planLabel,
      price,
      "MYR",
      paymentMethod,
      status,
      couponCode,
      JSON.stringify(recommendations),
      deliveryAddress ? JSON.stringify(deliveryAddress) : null,
      stripeSessionId,
      stripePaymentIntentId,
      "app",
      now,
      now
    );

    res.status(201).json({
      order: {
        id: orderId,
        orderNumber,
        userId: user.id,
        userEmail: user.email || null,
        customerName,
        plan,
        planLabel,
        price,
        currency: "MYR",
        paymentMethod,
        status,
        couponCode,
        createdAt: now,
        updatedAt: now,
        date: new Date(now).toISOString(),
        recommendations
      }
    });
  })
);

app.get(
  "/api/admin/overview",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const userLimit = Math.min(500, Math.max(1, Number(req.query.userLimit) || 200));
    const orderLimit = Math.min(500, Math.max(1, Number(req.query.orderLimit) || 200));
    const userStats = stmtAdminUserCount.get();
    const orderStats = stmtAdminOrderStats.get();
    const users = stmtListAdminUsers.all(userLimit);
    const orders = stmtListAdminOrders.all(orderLimit).map((order) => ({
      ...order,
      recommendations: order.recommendationsJson ? JSON.parse(order.recommendationsJson) : [],
      deliveryAddress: order.deliveryAddressJson ? JSON.parse(order.deliveryAddressJson) : null
    }));

    res.json({
      stats: {
        totalUsers: userStats.count,
        totalSales: orderStats.count,
        totalRevenue: orderStats.revenue,
        latestUserAt: userStats.latestCreatedAt || null,
        latestSaleAt: orderStats.latestCreatedAt || null
      },
      users,
      orders
    });
  })
);

app.put(
  "/api/admin/users/:userId/referral-code",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    const existingUser = userId ? stmtGetUserById.get(userId) : null;

    if (!existingUser) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const normalizedReferralCode = normalizeReferralCode(req.body?.referralCode);
    if (normalizedReferralCode === "__INVALID__") {
      return res.status(400).json({ error: "invalid_referral_code" });
    }

    if (normalizedReferralCode) {
      const duplicateUser = stmtGetUserByReferralCode.get(normalizedReferralCode);
      if (duplicateUser && duplicateUser.id !== userId) {
        return res.status(409).json({ error: "referral_code_in_use" });
      }
    }

    stmtUpdateUserReferralCode.run(normalizedReferralCode, userId);
    const updatedUser = stmtGetUserById.get(userId);
    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        provider: updatedUser.provider,
        country: updatedUser.country || null,
        referralCode: updatedUser.referralCode || null,
        createdAt: updatedUser.createdAt,
        lastLoginAt: updatedUser.lastLoginAt
      }
    });
  })
);

app.get(
  "/api/auth/google/start",
  asyncHandler(async (req, res) => {
    const client = getGoogleOAuthClient();
    if (!client) return res.status(501).json({ error: "google_oauth_not_configured" });

    const state = crypto.randomBytes(16).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, makeCookieOptions({ maxAge: 10 * 60 * 1000 }));

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account"
    });
    res.redirect(url);
  })
);

app.get(
  "/api/auth/google/callback",
  asyncHandler(async (req, res) => {
    const client = getGoogleOAuthClient();
    if (!client) return res.status(501).json({ error: "google_oauth_not_configured" });

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const cookieState = req.signedCookies?.[OAUTH_STATE_COOKIE] || req.cookies?.[OAUTH_STATE_COOKIE] || null;
    res.clearCookie(OAUTH_STATE_COOKIE, makeCookieOptions({ maxAge: 0 }));

    if (!code) return res.status(400).json({ error: "missing_code" });
    if (!state || !cookieState || state !== cookieState) return res.status(400).json({ error: "invalid_state" });

    const { tokens } = await client.getToken(code);
    if (!tokens?.id_token) return res.status(400).json({ error: "missing_id_token" });

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const sub = payload?.sub;
    const email = payload?.email || null;
    const name = payload?.name || null;
    const pictureUrl = payload?.picture || null;
    if (!sub) return res.status(400).json({ error: "missing_sub" });

    const provider = "google";
    const now = Date.now();

    // Upsert user (by provider-sub)
    const existing = stmtGetUserByProviderSub.get(provider, sub);
    let userId;
    if (!existing) {
      userId = crypto.randomUUID();
      stmtInsertUser.run(userId, email, name, pictureUrl, provider, sub, now, now);
    } else {
      userId = existing.id;
      stmtUpdateUserLogin.run(email, name, pictureUrl, now, userId);
    }

    const { token, expiresAt } = createSessionForUser(userId);
    res.cookie(SESSION_COOKIE, token, makeCookieOptions({ maxAge: expiresAt - now }));

    const appOrigin = process.env.APP_ORIGIN;
    const redirectTo = appOrigin ? `${appOrigin.replace(/\/$/, "")}/home` : "/home";
    res.redirect(redirectTo);
  })
);

app.get("/api/kv/:clientId", (req, res) => {
  const { clientId } = req.params;
  if (!isSafeClientId(clientId)) return res.status(400).json({ error: "invalid_clientId" });
  const rows = stmtGetAll.all(clientId);
  res.json({ items: rows });
});

app.get("/api/kv/:clientId/:key", (req, res) => {
  const { clientId, key } = req.params;
  if (!isSafeClientId(clientId)) return res.status(400).json({ error: "invalid_clientId" });
  if (!isSafeKey(key)) return res.status(400).json({ error: "invalid_key" });
  const row = stmtGetOne.get(clientId, key);
  if (!row) return res.status(404).json({ error: "not_found" });
  res.json(row);
});

app.put("/api/kv/:clientId/:key", (req, res) => {
  const { clientId, key } = req.params;
  if (!isSafeClientId(clientId)) return res.status(400).json({ error: "invalid_clientId" });
  if (!isSafeKey(key)) return res.status(400).json({ error: "invalid_key" });

  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "invalid_value" });

  const updatedAt = Date.now();
  stmtUpsert.run(clientId, key, value, updatedAt);
  res.json({ ok: true, key, updatedAt });
});

app.post("/api/kv/:clientId/batch", (req, res) => {
  const { clientId } = req.params;
  if (!isSafeClientId(clientId)) return res.status(400).json({ error: "invalid_clientId" });

  const items = req.body?.items;
  if (!items || typeof items !== "object") return res.status(400).json({ error: "invalid_items" });

  const pairs = [];
  for (const [key, value] of Object.entries(items)) {
    if (!isSafeKey(key)) return res.status(400).json({ error: "invalid_key", key });
    if (typeof value !== "string") return res.status(400).json({ error: "invalid_value", key });
    pairs.push([key, value]);
  }

  upsertMany(clientId, pairs);
  res.json({ ok: true, count: pairs.length });
});

app.delete("/api/kv/:clientId/:key", (req, res) => {
  const { clientId, key } = req.params;
  if (!isSafeClientId(clientId)) return res.status(400).json({ error: "invalid_clientId" });
  if (!isSafeKey(key)) return res.status(400).json({ error: "invalid_key" });

  const info = stmtDeleteOne.run(clientId, key);
  res.json({ ok: true, deleted: info.changes });
});

// Serve the Vite SPA from /dist in production.
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not_found" });
    res.sendFile(path.join(distDir, "index.html"));
  });
}

// Express error handler
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error("[server] unhandled error", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "server_error" });
});

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on :${PORT} (db: ${DATABASE_PATH})`);
});

// Ensure common listen errors don't become an unhandled 'error' event.
server.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[server] listen error", err);
  process.exit(1);
});

// Graceful shutdown so container stops (SIGTERM) don't surface as npm "errors".
const shutdown = (signal) => {
  // eslint-disable-next-line no-console
  console.log(`[server] received ${signal}, shutting down...`);
  try {
    server.close(() => {
      try {
        db.close();
      } catch {
        // ignore
      }
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
