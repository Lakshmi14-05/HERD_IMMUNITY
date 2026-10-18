# 🛡️ Herd Immunity

**A real-time collective fraud intelligence network for UPI.**
When one user reports a scam QR / VPA, every other user's app is warned within seconds, before they tap "Pay".

> *We're not making fraud detection smarter. We're making fraud protection faster.*

![Status](https://img.shields.io/badge/status-working%20prototype-blue)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)
![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Socket.IO-339933)
![Realtime](https://img.shields.io/badge/realtime-Redis%20Pub%2FSub-dc382d)



---

## 📌 Table of Contents
- [The Problem](#-the-problem)
- [Our Solution](#-our-solution)
- [How It Works](#-how-it-works)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Demo Walkthrough](#-demo-walkthrough)
- [API Reference](#-api-reference)
- [Privacy & Abuse Resistance](#-privacy--abuse-resistance)
- [Limitations (Being Upfront)](#-limitations-being-upfront)
- [Future Scope](#-future-scope)
- [Team](#-team)

---

## 🚨 The Problem

If Victim A is scammed by a fraudulent QR at **10:00 AM**, Victim B in another city can be scammed by the **exact same QR at 10:05 AM**, because fraud reports sit in a backend review queue (hours to days) instead of acting as an active defense.

The real vulnerability isn't detection accuracy. It is **the delay between the first victim and everyone else being protected**. This is a distributed-systems problem, not a model-accuracy problem.

**Target users:** everyday UPI users (students, shoppers, small merchants), plus banks and payment apps that want to protect them.

## 💡 Our Solution

Herd Immunity is a **faster nervous system for UPI**. The moment any QR / VPA is flagged, that signal is pushed to every connected device, which keeps a compact on-device cache of flagged identifiers. The next user is warned **before the payment is confirmed**.

It complements existing fraud-scoring engines (like per-transaction risk scoring or DoT's FRI for mobile numbers) instead of replacing them. It adds the missing layer: **peer-triggered, QR/VPA-level warnings in seconds.**

## ⚙️ How It Works

```
 Device A                Backend                         Device B / C / D
 --------                -------                         ----------------
 Upload QR  ──┐
 Report scam ─┴─► POST /report
                   │ 1. SHA-256 hash of the QR string
                   │ 2. Track unique reporters (5-min window, Redis)
                   │ 3. Decide level: soft (1) / hard (3+ unique)
                   │ 4. Publish on Redis Pub/Sub channel
                   ▼
              Socket.IO "flag" event ───────────────►  Update local Bloom filter
                                                       Update any open result live
                                                       Check QR locally (no server call)
```

| Level | Trigger | What the user sees |
|---|---|---|
| ✅ Not reported | Hash not in local Bloom filter | Green: "Not reported. Looks safe" |
| ⚠️ Soft | 1 report | Yellow: "Proceed with caution" |
| 🚫 Hard | 3+ independent reporters within 5 minutes | Red: "SCAM DETECTED" |

## ✨ Key Features

- ⚡ **Real-time propagation**: flags reach other devices in seconds through Socket.IO push.
- 📷 **Real QR flow**: upload a QR image (or use the camera) on any device, then **Report as scam** or **Check this QR**.
- 🧠 **Confidence-weighted escalation**: one report never blocks anyone; multiple independent reporters escalate to a hard warning.
- 📦 **On-device Bloom filter (~50 KB)**: checks run locally first, with no server round trip.
- 🔄 **Live in-place updates**: a result card already on screen upgrades from soft to hard without re-scanning.
- 🔒 **Privacy by design**: only a SHA-256 hash is stored and broadcast, never the raw QR / VPA.
- 🛑 **Abuse resistance**: per-reporter rate limiting and a multi-reporter threshold.
- 📱 **Multi-device simulation**: add up to 4 devices (A, B, C, D) side by side to demo distinct reporters.

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, plain CSS |
| QR decoding | `jsqr` (in-browser) |
| Hashing | Web Crypto API (SHA-256) on the client, Node `crypto` on the server |
| Edge cache | Custom browser Bloom filter (~50 KB, 7 hash functions) |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Pub/Sub & state | Redis (Upstash or local) |
| Hosting (optional) | Render (backend), Vercel (frontend) |

## 📁 Project Structure

```
HERD_IMMUNITY/
├── backend/                 # Node.js + Express + Socket.IO + Redis
│   ├── server.js            # API routes and Socket.IO setup
│   ├── src/
│   │   ├── config.js        # Environment config
│   │   └── flags.js         # Hashing, reporter tracking, confidence logic
│   └── package.json
├── frontend/                # React + Vite app
│   ├── public/samples/      # Sample QR images for testing
│   ├── src/
│   │   ├── App.jsx          # Multi-device manager
│   │   ├── components/      # DevicePane, PhoneFrame, ...
│   │   └── services/        # api.js, socket.js, bloom.js, hash.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Redis instance (free [Upstash](https://upstash.com) database or local Redis)

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/HERD_IMMUNITY.git
cd HERD_IMMUNITY
```

### 2. Run the backend
```bash
cd backend
npm install
```
Create `backend/.env` (see `backend/.env.example` if present for exact variable names):
```env
PORT=3000
REDIS_URL=<your redis connection url>
```
Start it:
```bash
npm start
```
Check: open `http://localhost:3000/health`, which should return `ok`.

### 3. Run the frontend
Open a **second terminal**:
```bash
cd frontend
npm install
cp .env.example .env     # on Windows PowerShell: copy .env.example .env
```
`frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
```
Start it:
```bash
npm run dev
```
Open **http://localhost:5173**. Every device pane should show a green **Connected** status.

> After changing `.env`, restart `npm run dev`.

### 4. Test on your phone (optional)
Connect the phone to the same Wi-Fi, run `npm run dev -- --host`, and open `http://<laptop-ip>:5173`. Camera scanning needs HTTPS (works on a deployed Vercel link), while image upload works anywhere.

## 🎬 Demo Walkthrough

1. **Check a clean QR.** On Device B, upload `frontend/public/samples/fake-shop-2.png` and press **Check this QR**. Result: green, *Not reported*.
2. **First report.** On Device A, upload the same QR and press **Report as scam**. Device B updates **live** to yellow, *Proceed with caution*.
3. **Escalation.** Click **+ Add device**, then report the same QR from Device C and Device D. Device B flips live to red, **SCAM DETECTED (3 reports)**.
4. **No false alarm.** Upload `safe-store.png` on any device. It stays green.

> ⚠️ Use only fake VPAs for testing (like the provided samples). Never report real merchants.

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns `ok` |
| `POST` | `/report` | Body: `{ "id": "<qr string>", "reporterId": "deviceA" }`. Returns `{ ok, hash, level, reports }` |
| `GET` | `/flags` | Returns all active flags: `[{ hash, level, reports, ts }]` |
| `GET` | `/api/check?hash=<sha256>` | Server-side confirmation for a hash (used when the Bloom filter reports a possible match) |
| `POST` | `/api/report` | Compatibility alias for `/report` |

**Socket.IO event** `flag`, broadcast to all clients on each accepted report:
```json
{ "hash": "8969058d...", "level": "soft", "reports": 1, "ts": 1792212055 }
```
`level` is `"soft"` or `"hard"`, and `ts` is a Unix timestamp in seconds. The hash is the lowercase-hex SHA-256 of the **trimmed** QR string.

## 🔐 Privacy & Abuse Resistance

- **Privacy:** raw QR / VPA strings are never stored or broadcast, only their SHA-256 hash.
- **Rate limiting** per reporter identity, and duplicate reports from the same reporter are ignored.
- **Threshold escalation:** a hard warning needs multiple independent reporters inside a short window.
- **Soft vs hard wording:** the UI says "reported by N users, verify", which is a warning rather than a final verdict.

## ⚠️ Limitations (Being Upfront)

This is a **working prototype / proof of concept**. It demonstrates the core mechanism (report → broadcast → on-device warning) with a real backend, but:

- It is **not integrated with real UPI apps, NPCI or banks**. Devices are simulated as panes in a browser.
- **Reporter identity is not verified** yet, so a determined attacker could still abuse it. Production needs verified accounts (see Future Scope).
- **First-victim problem:** a never-before-seen scam identifier still claims its first victim. Herd Immunity protects the **second victim onward**.
- Single-node backend and a single Redis instance.

## 🔭 Future Scope

- 📲 Ship as a built-in feature / SDK inside UPI apps, with NPCI and bank partnerships.
- 📈 Scale the pipeline with **Kafka** and a **graph database**, with partitioned event buses.
- 🧾 Bind reporters to **verified UPI accounts**, accept **transaction-proof** reports and apply **reputation weighting**.
- 🏪 Merchant appeal and bank review process to protect legitimate businesses.
- 🗺️ **Geo / time clustering**: the same VPA spiking across cities in minutes is itself a fraud signal.
- 🔔 Push notifications and background sync so warnings arrive even when the app is closed.

## 👩‍💻 Team

| Name | Role |
|---|---|
| **Manaswini** | Frontend (React UI, QR upload and scan, Bloom filter, live socket updates) |
| **<Lakshmi sai sri>** ([@Lakshmi14-05](https://github.com/Lakshmi14-05)) | Backend (API, Redis Pub/Sub, Socket.IO, confidence logic) |

Built for **CodeNoir**

