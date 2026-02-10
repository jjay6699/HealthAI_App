# Railway SQLite persistence

This repo is a Vite SPA, but it now includes a small Node server that:

1. Serves the built SPA from `dist/`
2. Exposes a `/api/kv/*` API backed by SQLite
3. Syncs all “stored” app data (the keys that used to live only in `localStorage`) to the server.

## What changed

- Server entrypoint: [`server/index.js`](server/index.js:1)
- Client persistence wrapper: [`src/services/persistentStorage.ts`](src/services/persistentStorage.ts:1)
- App boot hydrates from server (when available): [`src/main.tsx`](src/main.tsx:1)

In production (Railway), the browser still uses `localStorage` for instant reads/writes, but all values are also written to SQLite so they survive deploys/restarts and are available across sessions on the same device.

## Railway setup

### 1) Add a Volume

Create a **Volume** in Railway for this service and mount it at:

- Mount path: `/data`

### 2) Add environment variables

Add:

- `DATABASE_PATH=/data/app.sqlite`

Notes:

- `PORT` is provided automatically by Railway.

### 3) Build + start

Use these commands:

- Build command: `npm run build`
- Start command: `npm start`

The start script runs [`server/index.js`](server/index.js:1), which serves `dist/` and the API.

## API endpoints

These are internal (used by the client persistence wrapper):

- `GET /api/kv/ping`
- `GET /api/kv/:clientId`
- `PUT /api/kv/:clientId/:key` with JSON body `{ "value": "..." }`
- `POST /api/kv/:clientId/batch` with JSON body `{ "items": { "key": "value" } }`
- `DELETE /api/kv/:clientId/:key`

## Persisted keys (full scan)

The client sync layer persists these keys (and also any `analysis:*` cache keys):

- `appUsageStats`
- `bloodworkAnalysis`
- `bloodworkAnalysisMeta`
- `bloodworkHistory`
- `userProfile`
- `paymentMethods`
- `shippingAddresses`
- `orderHistory`
- `bloodPressureHistory`
- `fastingGlucoseHistory`
- `weightHistory`
- `orderDetails`
- `deliveryAddress`
- `lastOrder`

Implementation reference: [`listLocalKeysToPersist()`](src/services/persistentStorage.ts:118)

