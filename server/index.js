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
import Stripe from "stripe";
import { Resend } from "resend";

const PORT = Number(process.env.PORT || 3000);
// NOTE: If your Stripe account is pinned to an old API version, Stripe may reject
// newer params (e.g. `automatic_payment_methods`) with "Received unknown parameter".
// We explicitly set a modern Stripe API version to ensure these parameters work.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || "2023-10-16"
    })
  : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "RicHealth AI <no-reply@app.richealth.ai>";
const ORDER_NOTIFICATION_EMAIL =
  process.env.ORDER_NOTIFICATION_EMAIL || "jjaytech2019@gmail.com";

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

  CREATE TABLE IF NOT EXISTS user_profiles (
    userId TEXT PRIMARY KEY,
    dataJson TEXT NOT NULL DEFAULT '{}',
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_shipping_addresses (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    fullName TEXT NOT NULL,
    phone TEXT NOT NULL,
    addressLine1 TEXT NOT NULL,
    addressLine2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    specialInstructions TEXT,
    isDefault INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_shipping_addresses_userId
    ON user_shipping_addresses(userId, updatedAt DESC);

  CREATE TABLE IF NOT EXISTS user_health_metrics (
    userId TEXT PRIMARY KEY,
    dataJson TEXT NOT NULL DEFAULT '{}',
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_bloodwork_records (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    analysisJson TEXT NOT NULL,
    metaJson TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_bloodwork_records_userId
    ON user_bloodwork_records(userId, createdAt DESC);
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
const stmtGetUserProfile = db.prepare(
  "SELECT userId, dataJson, updatedAt FROM user_profiles WHERE userId = ?"
);
const stmtUpsertUserProfile = db.prepare(`
  INSERT INTO user_profiles (userId, dataJson, updatedAt)
  VALUES (?, ?, ?)
  ON CONFLICT(userId) DO UPDATE SET
    dataJson = excluded.dataJson,
    updatedAt = excluded.updatedAt
`);
const stmtListShippingAddressesByUser = db.prepare(`
  SELECT
    id,
    userId,
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postcode,
    specialInstructions,
    isDefault,
    createdAt,
    updatedAt
  FROM user_shipping_addresses
  WHERE userId = ?
  ORDER BY isDefault DESC, updatedAt DESC
`);
const stmtDeleteShippingAddressesByUser = db.prepare(
  "DELETE FROM user_shipping_addresses WHERE userId = ?"
);
const stmtInsertShippingAddress = db.prepare(`
  INSERT INTO user_shipping_addresses (
    id,
    userId,
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postcode,
    specialInstructions,
    isDefault,
    createdAt,
    updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetUserHealthMetrics = db.prepare(
  "SELECT userId, dataJson, updatedAt FROM user_health_metrics WHERE userId = ?"
);
const stmtUpsertUserHealthMetrics = db.prepare(`
  INSERT INTO user_health_metrics (userId, dataJson, updatedAt)
  VALUES (?, ?, ?)
  ON CONFLICT(userId) DO UPDATE SET
    dataJson = excluded.dataJson,
    updatedAt = excluded.updatedAt
`);
const stmtListBloodworkRecordsByUser = db.prepare(`
  SELECT id, userId, analysisJson, metaJson, createdAt
  FROM user_bloodwork_records
  WHERE userId = ?
  ORDER BY createdAt DESC
`);
const stmtGetLatestBloodworkRecordByUser = db.prepare(`
  SELECT id, userId, analysisJson, metaJson, createdAt
  FROM user_bloodwork_records
  WHERE userId = ?
  ORDER BY createdAt DESC
  LIMIT 1
`);
const stmtDeleteBloodworkRecordsByUser = db.prepare(
  "DELETE FROM user_bloodwork_records WHERE userId = ?"
);
const stmtInsertBloodworkRecord = db.prepare(`
  INSERT INTO user_bloodwork_records (
    id,
    userId,
    analysisJson,
    metaJson,
    createdAt
  ) VALUES (?, ?, ?, ?, ?)
`);

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
const stmtGetOrderByStripeSessionId = db.prepare(`
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
  WHERE stripeSessionId = ?
  LIMIT 1
`);
const stmtListOrdersByUser = db.prepare(`
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
  WHERE userId = ?
  ORDER BY createdAt DESC
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
let authRateLimitSweepCounter = 0;

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
const isProd = process.env.NODE_ENV === "production";
const ADMIN_USERNAME = typeof process.env.ADMIN_USERNAME === "string" ? process.env.ADMIN_USERNAME.trim() : "";
const ADMIN_PASSWORD = typeof process.env.ADMIN_PASSWORD === "string" ? process.env.ADMIN_PASSWORD : "";
const sessionSecret = process.env.SESSION_SECRET;

if (isProd && !sessionSecret) {
  throw new Error("SESSION_SECRET is required in production.");
}

if (isProd && (!ADMIN_USERNAME || !ADMIN_PASSWORD)) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required in production.");
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

const safeCompare = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;

  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const requireAdminAuth = (req, res, next) => {
  const credentials = getBasicAuthCredentials(req);
  if (
    ADMIN_USERNAME &&
    ADMIN_PASSWORD &&
    credentials &&
    safeCompare(credentials.username, ADMIN_USERNAME) &&
    safeCompare(credentials.password, ADMIN_PASSWORD)
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

const formatOrderForResponse = (order) => ({
  ...order,
  recommendations: order.recommendationsJson ? JSON.parse(order.recommendationsJson) : [],
  deliveryAddress: order.deliveryAddressJson ? JSON.parse(order.deliveryAddressJson) : null,
  date: new Date(order.createdAt).toISOString()
});

const buildOrderEmailHtml = ({ heading, intro, order, recommendations, deliveryAddress }) => {
  const recommendationItems =
    recommendations.length > 0
      ? `<ul>${recommendations
          .map(
            (item) =>
              `<li><strong>${item.supplementName || "Supplement"}</strong>${
                item.dosage ? ` - ${item.dosage}` : ""
              }</li>`
          )
          .join("")}</ul>`
      : "<p>No supplement list was attached to this order.</p>";

  const addressHtml = deliveryAddress
    ? `<p>
        ${deliveryAddress.fullName || ""}<br />
        ${deliveryAddress.phone || ""}<br />
        ${deliveryAddress.addressLine1 || ""}<br />
        ${deliveryAddress.addressLine2 ? `${deliveryAddress.addressLine2}<br />` : ""}
        ${deliveryAddress.postcode || ""} ${deliveryAddress.city || ""}<br />
        ${deliveryAddress.state || ""}
      </p>`
    : "<p>No delivery address provided.</p>";

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2>${heading}</h2>
      <p>${intro}</p>
      <p><strong>Order number:</strong> ${order.orderNumber}</p>
      <p><strong>Customer:</strong> ${order.customerName || order.userEmail || "Unknown"}</p>
      <p><strong>Email:</strong> ${order.userEmail || "Not provided"}</p>
      <p><strong>Plan:</strong> ${order.planLabel || order.plan}</p>
      <p><strong>Total:</strong> ${order.currency} ${Number(order.price).toFixed(2)}</p>
      <p><strong>Payment method:</strong> ${order.paymentMethod || "Not specified"}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      ${
        order.couponCode
          ? `<p><strong>Referral / coupon code:</strong> ${order.couponCode}</p>`
          : ""
      }
      <h3>Supplements</h3>
      ${recommendationItems}
      <h3>Delivery details</h3>
      ${addressHtml}
    </div>
  `;
};

const maybeSendOrderEmails = async (orderRecord) => {
  if (!resend) {
    console.warn("Resend is not configured. Skipping order email notifications.");
    return;
  }

  const order = formatOrderForResponse(orderRecord);
  const recommendations = order.recommendations || [];
  const deliveryAddress = order.deliveryAddress || null;
  const recipients = [];

  if (order.userEmail) {
    recipients.push({
      to: order.userEmail,
      subject: `Your RicHealth AI order ${order.orderNumber}`,
      heading: "Your order is confirmed",
      intro:
        "Thank you for your order. We have received your custom blend request and will begin preparing it shortly."
    });
  }

  recipients.push({
    to: ORDER_NOTIFICATION_EMAIL,
    subject: `New RicHealth AI order ${order.orderNumber}`,
    heading: "New order received",
    intro: "A new customer order has been placed and is ready for production review."
  });

  const emailJobs = recipients.map((recipient) =>
    resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: recipient.to,
      subject: recipient.subject,
      replyTo: order.userEmail || undefined,
      html: buildOrderEmailHtml({
        heading: recipient.heading,
        intro: recipient.intro,
        order,
        recommendations,
        deliveryAddress
      })
    })
  );

  const results = await Promise.allSettled(emailJobs);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Failed to send order email:", result.reason);
    }
  });
};

const createOrderRecord = ({
  user,
  plan,
  planLabel,
  price,
  paymentMethod,
  couponCode,
  recommendations,
  deliveryAddress,
  stripeSessionId = null,
  stripePaymentIntentId = null,
  status = "processing"
}) => {
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

  return {
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
    recommendationsJson: JSON.stringify(recommendations),
    deliveryAddressJson: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
    stripeSessionId,
    stripePaymentIntentId,
    source: "app",
    createdAt: now,
    updatedAt: now
  };
};

const getRequestIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const normalizeProfilePayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  return Object.fromEntries(entries);
};

const normalizeShippingAddressList = (value) => {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

      const fullName = typeof entry.fullName === "string" ? entry.fullName.trim() : "";
      const phone = typeof entry.phone === "string" ? entry.phone.trim() : "";
      const addressLine1 = typeof entry.addressLine1 === "string" ? entry.addressLine1.trim() : "";
      const addressLine2 = typeof entry.addressLine2 === "string" ? entry.addressLine2.trim() : "";
      const city = typeof entry.city === "string" ? entry.city.trim() : "";
      const state = typeof entry.state === "string" ? entry.state.trim() : "";
      const postcode = typeof entry.postcode === "string" ? entry.postcode.trim() : "";
      const specialInstructions =
        typeof entry.specialInstructions === "string" ? entry.specialInstructions.trim() : "";

      if (!fullName || !phone || !addressLine1 || !city || !state || !postcode) {
        return null;
      }

      return {
        id:
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : `addr_${crypto.randomUUID()}`,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        postcode,
        specialInstructions,
        isDefault: index === 0
      };
    })
    .filter(Boolean);

  return normalized;
};

const normalizeHealthMetricsPayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalizeArray = (entries, mapper) =>
    Array.isArray(entries) ? entries.map(mapper).filter(Boolean) : [];

  const bloodPressureHistory = normalizeArray(value.bloodPressureHistory, (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const date = typeof entry.date === "string" ? entry.date.trim() : "";
    const systolic = Number(entry.systolic);
    const diastolic = Number(entry.diastolic);
    if (!date || !Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
    return { date, systolic, diastolic };
  });

  const fastingGlucoseHistory = normalizeArray(value.fastingGlucoseHistory, (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const date = typeof entry.date === "string" ? entry.date.trim() : "";
    const metricValue = Number(entry.value);
    if (!date || !Number.isFinite(metricValue)) return null;
    return { date, value: metricValue };
  });

  const weightHistory = normalizeArray(value.weightHistory, (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const date = typeof entry.date === "string" ? entry.date.trim() : "";
    const metricValue = Number(entry.value);
    if (!date || !Number.isFinite(metricValue)) return null;
    return { date, value: metricValue };
  });

  return {
    bloodPressureHistory,
    fastingGlucoseHistory,
    weightHistory
  };
};

const replaceShippingAddressesForUser = db.transaction((userId, addresses) => {
  stmtDeleteShippingAddressesByUser.run(userId);
  const now = Date.now();

  for (const address of addresses) {
    stmtInsertShippingAddress.run(
      address.id,
      userId,
      address.fullName,
      address.phone,
      address.addressLine1,
      address.addressLine2 || null,
      address.city,
      address.state,
      address.postcode,
      address.specialInstructions || null,
      address.isDefault ? 1 : 0,
      now,
      now
    );
  }
});

const formatBloodworkRecordForResponse = (record) => {
  let analysis = null;
  let meta = null;

  try {
    analysis = record.analysisJson ? JSON.parse(record.analysisJson) : null;
  } catch {
    analysis = null;
  }

  try {
    meta = record.metaJson ? JSON.parse(record.metaJson) : null;
  } catch {
    meta = null;
  }

  return {
    id: record.id,
    uploadedAt: new Date(record.createdAt).toISOString(),
    analysis,
    meta
  };
};

const normalizeBloodworkRecordPayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const analysis = value.analysis;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return null;
  }

  const meta =
    value.meta && typeof value.meta === "object" && !Array.isArray(value.meta) ? value.meta : {};
  const uploadedAtRaw = typeof value.uploadedAt === "string" ? value.uploadedAt : "";
  const uploadedAtMs = uploadedAtRaw ? Date.parse(uploadedAtRaw) : NaN;

  return {
    id:
      typeof value.id === "string" && value.id.trim() ? value.id.trim() : crypto.randomUUID(),
    analysis,
    meta,
    createdAt: Number.isNaN(uploadedAtMs) ? Date.now() : uploadedAtMs
  };
};

const normalizeBloodworkHistoryPayload = (value) => {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeBloodworkRecordPayload).filter(Boolean);
};

const replaceBloodworkRecordsForUser = db.transaction((userId, records) => {
  stmtDeleteBloodworkRecordsByUser.run(userId);
  for (const record of records) {
    stmtInsertBloodworkRecord.run(
      record.id,
      userId,
      JSON.stringify(record.analysis),
      record.meta ? JSON.stringify(record.meta) : null,
      record.createdAt
    );
  }
});

const sweepExpiredRateLimitEntries = (now) => {
  authRateLimitSweepCounter += 1;
  if (authRateLimitSweepCounter % 100 !== 0) return;

  for (const [key, value] of authRateLimitState.entries()) {
    if (value.resetAt <= now) {
      authRateLimitState.delete(key);
    }
  }
};

const makeRateLimiter =
  ({ windowMs, maxAttempts, scope }) =>
  (req, res, next) => {
    const now = Date.now();
    sweepExpiredRateLimitEntries(now);
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

const authGoogleStartRateLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 20,
  scope: "google_start"
});

const adminRateLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 25,
  scope: "admin"
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

app.get("/api/profile", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const record = stmtGetUserProfile.get(user.id);
  if (!record) {
    return res.json({ profile: {}, updatedAt: null });
  }

  let profile = {};
  try {
    profile = record.dataJson ? JSON.parse(record.dataJson) : {};
  } catch {
    profile = {};
  }

  return res.json({
    profile,
    updatedAt: record.updatedAt
  });
});

app.put("/api/profile", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const incomingProfile = normalizeProfilePayload(req.body?.profile);
  if (!incomingProfile) {
    return res.status(400).json({ error: "invalid_profile_payload" });
  }

  const existing = stmtGetUserProfile.get(user.id);
  let existingProfile = {};
  if (existing?.dataJson) {
    try {
      existingProfile = JSON.parse(existing.dataJson);
    } catch {
      existingProfile = {};
    }
  }

  const nextProfile = {
    ...existingProfile,
    ...incomingProfile
  };
  const updatedAt = Date.now();
  stmtUpsertUserProfile.run(user.id, JSON.stringify(nextProfile), updatedAt);

  return res.json({
    profile: nextProfile,
    updatedAt
  });
});

app.get("/api/shipping-addresses", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const addresses = stmtListShippingAddressesByUser.all(user.id).map((address) => ({
    ...address,
    isDefault: Boolean(address.isDefault)
  }));

  return res.json({ addresses });
});

app.put("/api/shipping-addresses", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const addresses = normalizeShippingAddressList(req.body?.addresses);
  if (!addresses) {
    return res.status(400).json({ error: "invalid_shipping_addresses_payload" });
  }

  replaceShippingAddressesForUser(user.id, addresses);
  return res.json({ addresses });
});

app.get("/api/health-metrics", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const record = stmtGetUserHealthMetrics.get(user.id);
  if (!record) {
    return res.json({
      metrics: {
        bloodPressureHistory: [],
        fastingGlucoseHistory: [],
        weightHistory: []
      },
      updatedAt: null
    });
  }

  let metrics = {
    bloodPressureHistory: [],
    fastingGlucoseHistory: [],
    weightHistory: []
  };
  try {
    const parsed = record.dataJson ? JSON.parse(record.dataJson) : {};
    metrics = {
      bloodPressureHistory: Array.isArray(parsed?.bloodPressureHistory)
        ? parsed.bloodPressureHistory
        : [],
      fastingGlucoseHistory: Array.isArray(parsed?.fastingGlucoseHistory)
        ? parsed.fastingGlucoseHistory
        : [],
      weightHistory: Array.isArray(parsed?.weightHistory) ? parsed.weightHistory : []
    };
  } catch {
    // keep defaults
  }

  return res.json({
    metrics,
    updatedAt: record.updatedAt
  });
});

app.put("/api/health-metrics", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const incomingMetrics = normalizeHealthMetricsPayload(req.body?.metrics);
  if (!incomingMetrics) {
    return res.status(400).json({ error: "invalid_health_metrics_payload" });
  }

  const existing = stmtGetUserHealthMetrics.get(user.id);
  let existingMetrics = {
    bloodPressureHistory: [],
    fastingGlucoseHistory: [],
    weightHistory: []
  };
  if (existing?.dataJson) {
    try {
      const parsed = JSON.parse(existing.dataJson);
      existingMetrics = {
        bloodPressureHistory: Array.isArray(parsed?.bloodPressureHistory)
          ? parsed.bloodPressureHistory
          : [],
        fastingGlucoseHistory: Array.isArray(parsed?.fastingGlucoseHistory)
          ? parsed.fastingGlucoseHistory
          : [],
        weightHistory: Array.isArray(parsed?.weightHistory) ? parsed.weightHistory : []
      };
    } catch {
      // keep defaults
    }
  }

  const nextMetrics = {
    ...existingMetrics,
    ...incomingMetrics
  };
  const updatedAt = Date.now();
  stmtUpsertUserHealthMetrics.run(user.id, JSON.stringify(nextMetrics), updatedAt);

  return res.json({
    metrics: nextMetrics,
    updatedAt
  });
});

app.get("/api/bloodwork/latest", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const record = stmtGetLatestBloodworkRecordByUser.get(user.id);
  return res.json({
    record: record ? formatBloodworkRecordForResponse(record) : null
  });
});

app.get("/api/bloodwork/history", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const records = stmtListBloodworkRecordsByUser
    .all(user.id)
    .map(formatBloodworkRecordForResponse);

  return res.json({ records });
});

app.post("/api/bloodwork/record", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const record = normalizeBloodworkRecordPayload(req.body?.record);
  if (!record) {
    return res.status(400).json({ error: "invalid_bloodwork_record_payload" });
  }

  stmtInsertBloodworkRecord.run(
    record.id,
    user.id,
    JSON.stringify(record.analysis),
    record.meta ? JSON.stringify(record.meta) : null,
    record.createdAt
  );

  return res.status(201).json({
    record: {
      id: record.id,
      uploadedAt: new Date(record.createdAt).toISOString(),
      analysis: record.analysis,
      meta: record.meta
    }
  });
});

app.put("/api/bloodwork/history", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const records = normalizeBloodworkHistoryPayload(req.body?.records);
  if (!records) {
    return res.status(400).json({ error: "invalid_bloodwork_history_payload" });
  }

  replaceBloodworkRecordsForUser(user.id, records);
  return res.json({
    records: records
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((record) => ({
        id: record.id,
        uploadedAt: new Date(record.createdAt).toISOString(),
        analysis: record.analysis,
        meta: record.meta
      }))
  });
});

app.post(
  "/api/stripe/checkout-session",
  asyncHandler(async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "stripe_not_configured" });
    }

    const user = getAuthedUser(req);
    if (!user) {
      return res.status(401).json({ error: "authentication_required" });
    }

    const plan = typeof req.body?.plan === "string" ? req.body.plan.trim() : "";
    const planLabel = typeof req.body?.planLabel === "string" ? req.body.planLabel.trim() : null;
    const price = Number(req.body?.price);
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

    if (!plan || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "invalid_order_payload" });
    }

    const normalizeOrigin = (value) => {
      if (!value || typeof value !== "string") return null;
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return `${url.protocol}//${url.host}`;
      } catch {
        return null;
      }
    };

    // Stripe requires a fully-qualified https URL for live-mode redirects.
    // In production behind Railway/Cloudflare/etc, req.protocol is often "http",
    // so we prefer forwarded headers and force https.
    const forwardedProtoRaw =
      typeof req.headers["x-forwarded-proto"] === "string"
        ? req.headers["x-forwarded-proto"].split(",")[0].trim()
        : "";
    const forwardedHostRaw =
      typeof req.headers["x-forwarded-host"] === "string"
        ? req.headers["x-forwarded-host"].split(",")[0].trim()
        : "";

    const inferredHost = forwardedHostRaw || req.get("host");
    let inferredProto = forwardedProtoRaw || req.protocol || "http";
    if (inferredProto.includes("https")) inferredProto = "https";
    if (isProd) inferredProto = "https";

    const baseOrigin =
      normalizeOrigin(process.env.APP_ORIGIN) ||
      (!isProd ? normalizeOrigin(req.headers.origin) : null) ||
      (inferredHost ? `${inferredProto}://${inferredHost}` : null);

    if (!baseOrigin) {
      return res.status(400).json({ error: "invalid_app_origin" });
    }
    if (isProd && !baseOrigin.startsWith("https://")) {
      return res.status(400).json({
        error: "invalid_app_origin",
        message: "APP_ORIGIN must be an https URL in production"
      });
    }

    const successUrl = `${baseOrigin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseOrigin}/payment?stripe_cancelled=1`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        // Stripe Checkout does NOT support `automatic_payment_methods`.
        // To show additional payment options on the hosted Stripe page,
        // you must explicitly request them via `payment_method_types`.
        // (Your Stripe dashboard still controls *whether* a method can be used.)
        //
        // For Malaysia (MYR), these commonly cover what you enabled:
        // - card (also shows Apple Pay / Google Pay when available)
        // - fpx
        // - grabpay
        payment_method_types: ["card", "fpx", "grabpay"],
        // FPX eligibility note:
        // Stripe will only *display* FPX when the session is eligible (typically MYR
        // and a Malaysia customer context). We help Stripe infer this by collecting
        // a Malaysia shipping address on the hosted page.
        shipping_address_collection: { allowed_countries: ["MY"] },
        phone_number_collection: { enabled: true },
        billing_address_collection: "required",
        customer_email: user.email || undefined,
        client_reference_id: user.id,
        customer_creation: "always",
        customer_update: { name: "auto", address: "auto", shipping: "auto" },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "myr",
              unit_amount: Math.round(price * 100),
              product_data: {
                name: `RicHealth AI Custom Blend - ${planLabel || plan}`,
                description: `${recommendations.length} nutrition item${recommendations.length === 1 ? "" : "s"}`
              }
            }
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: user.id,
          plan,
          planLabel: planLabel || "",
          couponCode: couponCode || ""
        }
      });
    } catch (error) {
      const stripeError = error && typeof error === "object" ? error : null;
      console.error("[stripe] checkout session create failed", {
        message: stripeError?.message,
        type: stripeError?.type,
        code: stripeError?.code,
        requestId: stripeError?.requestId,
        statusCode: stripeError?.statusCode,
        baseOrigin,
        successUrl,
        cancelUrl
      });

      const statusCode =
        typeof stripeError?.statusCode === "number" && Number.isFinite(stripeError.statusCode)
          ? stripeError.statusCode
          : 500;
      return res.status(statusCode).json({
        error: "stripe_error",
        message: stripeError?.message || "Stripe request failed",
        type: stripeError?.type,
        code: stripeError?.code,
        requestId: stripeError?.requestId
      });
    }

    if (!session?.url) {
      console.error("[stripe] checkout session created but no URL returned", {
        sessionId: session?.id,
        baseOrigin
      });
      return res.status(500).json({ error: "stripe_session_missing_url" });
    }

    stmtUpsert.run(
      `stripe_checkout:${session.id}`,
      "payload",
      JSON.stringify({
        plan,
        planLabel,
        price,
        // Note: the final payment method is resolved during confirm-stripe
        // (based on the PaymentIntent / Charge details).
        paymentMethod: "stripe",
        couponCode,
        recommendations,
        deliveryAddress
      }),
      Date.now()
    );

    return res.json({ url: session.url, sessionId: session.id });
  })
);

app.post(
  "/api/orders/confirm-stripe",
  asyncHandler(async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "stripe_not_configured" });
    }

    const user = getAuthedUser(req);
    if (!user) {
      return res.status(401).json({ error: "authentication_required" });
    }

    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      return res.status(400).json({ error: "stripe_session_required" });
    }

    const existing = stmtGetOrderByStripeSessionId.get(sessionId);
    if (existing) {
      return res.json({ order: formatOrderForResponse(existing) });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.mode !== "payment") {
      return res.status(404).json({ error: "stripe_session_not_found" });
    }

    if (session.client_reference_id && session.client_reference_id !== user.id) {
      return res.status(403).json({ error: "stripe_session_forbidden" });
    }

    if (session.payment_status !== "paid") {
      return res.status(409).json({ error: "stripe_session_not_paid" });
    }

    let resolvedPaymentMethod = null;
    let resolvedPaymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    // Best-effort: store the actual payment method used (e.g. card, fpx, grabpay).
    // This is helpful for admin/order reporting and avoids hard-coding "stripe_card".
    if (resolvedPaymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(resolvedPaymentIntentId, {
          expand: ["latest_charge"]
        });

        const latestCharge =
          paymentIntent?.latest_charge && typeof paymentIntent.latest_charge === "object"
            ? paymentIntent.latest_charge
            : null;

        const type = latestCharge?.payment_method_details?.type;
        if (typeof type === "string" && type.trim()) {
          resolvedPaymentMethod = `stripe_${type.trim()}`;
        } else if (
          Array.isArray(paymentIntent?.payment_method_types) &&
          typeof paymentIntent.payment_method_types[0] === "string"
        ) {
          resolvedPaymentMethod = `stripe_${paymentIntent.payment_method_types[0]}`;
        }
      } catch (error) {
        console.warn("[stripe] failed to resolve payment method type:", error);
      }
    }

    const pending = stmtGetOne.get(`stripe_checkout:${sessionId}`, "payload");
    if (!pending?.value) {
      return res.status(404).json({ error: "stripe_checkout_payload_missing" });
    }

    const payload = JSON.parse(pending.value);
    const orderRecord = createOrderRecord({
      user,
      plan: payload.plan,
      planLabel: payload.planLabel,
      price: payload.price,
      paymentMethod: resolvedPaymentMethod || payload.paymentMethod || "stripe",
      couponCode: payload.couponCode || null,
      recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
      deliveryAddress: payload.deliveryAddress || null,
      stripeSessionId: session.id,
      stripePaymentIntentId: resolvedPaymentIntentId,
      status: "paid"
    });

    await maybeSendOrderEmails(orderRecord);
    stmtDeleteOne.run(`stripe_checkout:${sessionId}`, "payload");

    return res.status(201).json({ order: formatOrderForResponse(orderRecord) });
  })
);

app.get("/api/orders", (req, res) => {
  const user = getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "auth_required" });
  }

  const orders = stmtListOrdersByUser.all(user.id).map(formatOrderForResponse);
  return res.json({ orders });
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

    const orderRecord = createOrderRecord({
      user,
      plan,
      planLabel,
      price,
      paymentMethod,
      couponCode,
      recommendations,
      deliveryAddress,
      stripeSessionId,
      stripePaymentIntentId,
      status
    });

    await maybeSendOrderEmails(orderRecord);

    res.status(201).json({ order: formatOrderForResponse(orderRecord) });
  })
);

app.get(
  "/api/admin/overview",
  adminRateLimiter,
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
  adminRateLimiter,
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
  authGoogleStartRateLimiter,
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
