# Herd Immunity - Real-Time UPI Fraud Prevention Backend

A high-speed, privacy-preserving UPI fraud warning network backend. When Victim A reports a scam QR code or VPA, all connected users receive an instantaneous warning before they complete a payment.

- **1 Report**: Soft flag (`"soft"` - "Proceed with caution")
- **3+ Different Reporters within 5 minutes**: Hard warning (`"hard"` - "SCAM DETECTED")
- **Privacy-first**: Reported IDs (VPAs, QR payment payloads) are SHA-256 hashed server-side before storage or broadcast. The raw ID is never stored or sent over the wire.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **HTTP Framework**: Express.js
- **Real-Time WebSockets**: Socket.IO
- **In-Memory Store & Pub/Sub**: Redis / Upstash (`ioredis`)
- **Zero-Setup Local Dev**: `ioredis-mock`
- **Security**: Node.js `crypto` (SHA-256), rate limiting (`INCR` + `EXPIRE`), `cors`

---

## 📡 API Contract (For Frontend Integration)

### 1. `GET /health`
- **Response**: `200 OK`
- **Body**: Plain text `ok`

### 2. `POST /report`
Reports a suspicious UPI ID or QR payload.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "id": "upi://pay?pa=scam@upi",
    "reporterId": "deviceA"
  }
  ```
- **Validation**: Both `id` and `reporterId` must be non-empty strings. If invalid, returns HTTP `400`.
- **Rate Limit**: Max 5 reports per 60 seconds per `reporterId`. If exceeded, returns HTTP `429`:
  ```json
  {
    "ok": false,
    "error": "rate_limited"
  }
  ```
- **Success (New Report)**: HTTP `200`
  ```json
  {
    "ok": true,
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "level": "soft",
    "reports": 1,
    "duplicate": false
  }
  ```
- **Duplicate (Same Reporter again within 5 min window)**: HTTP `200` (does NOT trigger socket broadcast)
  ```json
  {
    "ok": true,
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "level": "soft",
    "reports": 1,
    "duplicate": true
  }
  ```

### 3. `GET /flags`
Returns all currently active flags within the active sliding window (expired flags are automatically pruned).
- **Response**: HTTP `200`
  ```json
  [
    {
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "level": "hard",
      "reports": 3,
      "ts": 1792165000
    }
  ]
  ```

### 4. Real-Time Socket.IO Event: `"flag"`
Broadcast to all connected clients whenever an accepted, non-duplicate report arrives.
- **Event Name**: `flag`
- **Payload**:
  ```json
  {
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "level": "soft",
    "reports": 1,
    "ts": 1792165000
  }
  ```

---

## 🚀 Running Locally (Zero Setup)

By default, the server runs with `USE_MOCK_REDIS=true`, which uses an in-memory mock Redis (`ioredis-mock`). You do not need to install or run Redis locally!

1. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   Server will start on `http://localhost:3000`.

---

## 🧪 Running Tests

### 1. REST & Logic Test Suite (`test.sh`)
Tests health check, soft warning, duplicate handling, hard escalation (3 unique reporters), `/flags`, and the 6th-request rate limit (HTTP 429).
```bash
bash test.sh http://localhost:3000
```

### 2. Socket.IO Real-Time Test (`sock-test.js`)
Connects a real Socket.IO client, posts a report, and verifies that the `"flag"` event is received within 5 seconds.
```bash
node sock-test.js
```

---

## ☁️ Deployment Guide

### Step 1: Upstash (Free Cloud Redis)
1. Go to [https://console.upstash.com/](https://console.upstash.com/) and sign up or log in.
2. Click **Create Database**.
3. Name it `herd-immunity-redis`, select your preferred region (e.g., closest to your Render server), and select the **Free** tier.
4. Click **Create**.
5. In the database details page, scroll down to the **Node.js** or **ioredis** section.
6. Copy the connection URL starting with `rediss://default:...`. This is your `REDIS_URL`.

### Step 2: Render (Free Web Service)
1. Go to [https://dashboard.render.com/](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `Lakshmi14-05/HERD_IMMUNITY`.
3. Configure settings:
   - **Name**: `herd-immunity-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. In **Environment Variables**, add:
   - `REDIS_URL`: `<your-rediss-url-from-upstash>`
   - `USE_MOCK_REDIS`: `false`
   - `WINDOW_SECONDS`: `300`
   - `HARD_THRESHOLD`: `3`
5. Click **Create Web Service**.
6. Once deployed, Render provides a public URL (e.g. `https://herd-immunity-backend.onrender.com`).
7. Test the deployment:
   ```bash
   bash test.sh https://herd-immunity-backend.onrender.com
   ```
> ⚠️ **Render Free Tier Note**: Free tier web services go to sleep after 15 minutes of inactivity. The first request after sleeping may take 30–50 seconds to wake up the server.

---

## 🤝 Teammate Integration Guide (Frontend by Manaswini)

### React + Vite Connection Example:
```javascript
import { io } from 'socket.io-client';

const BACKEND_URL = 'https://herd-immunity-backend.onrender.com'; // or http://localhost:3000 for local dev

// 1. Initialize Socket.IO connection
export const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to Herd Immunity backend:', socket.id);
});

// 2. Listen for real-time fraud alerts
socket.on('flag', ({ hash, level, reports, ts }) => {
  console.log(`Alert! Hash ${hash} has ${reports} reports (${level})`);
  // update React state or show banner:
  // if (level === 'hard') -> Show red modal "SCAM DETECTED"
  // if (level === 'soft') -> Show yellow banner "Proceed with caution"
});

// 3. Submitting a report
export async function submitReport(scamUpiId, deviceReporterId) {
  const response = await fetch(`${BACKEND_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: scamUpiId,
      reporterId: deviceReporterId
    }),
  });
  return await response.json();
}
```
