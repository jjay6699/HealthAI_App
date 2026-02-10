import express from "express";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

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

const upsertMany = db.transaction((clientId, items) => {
  for (const [key, value] of items) {
    stmtUpsert.run(clientId, key, value, Date.now());
  }
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

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

