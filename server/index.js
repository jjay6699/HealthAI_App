import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
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

// Auth tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    pictureUrl TEXT,
    provider TEXT NOT NULL,
    providerSub TEXT NOT NULL,
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
  "SELECT id, email, name, pictureUrl, provider, providerSub, createdAt, lastLoginAt FROM users WHERE provider = ? AND providerSub = ?"
);
const stmtGetUserById = db.prepare(
  "SELECT id, email, name, pictureUrl, provider, providerSub, createdAt, lastLoginAt FROM users WHERE id = ?"
);
const stmtInsertUser = db.prepare(
  "INSERT INTO users (id, email, name, pictureUrl, provider, providerSub, createdAt, lastLoginAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtUpdateUserLogin = db.prepare(
  "UPDATE users SET email = ?, name = ?, pictureUrl = ?, lastLoginAt = ? WHERE id = ?"
);

const stmtInsertSession = db.prepare(
  "INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)"
);
const stmtGetSession = db.prepare(
  "SELECT token, userId, createdAt, expiresAt FROM sessions WHERE token = ?"
);
const stmtDeleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");
const stmtDeleteExpiredSessions = db.prepare("DELETE FROM sessions WHERE expiresAt < ?");

const upsertMany = db.transaction((clientId, items) => {
  for (const [key, value] of items) {
    stmtUpsert.run(clientId, key, value, Date.now());
  }
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

const SESSION_COOKIE = "ng_session";
const OAUTH_STATE_COOKIE = "ng_oauth_state";
const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

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

const getGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUri) return null;
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
};

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
  const { id, email, name, pictureUrl, provider, createdAt, lastLoginAt } = user;
  res.json({ user: { id, email, name, pictureUrl, provider, createdAt, lastLoginAt } });
});

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

