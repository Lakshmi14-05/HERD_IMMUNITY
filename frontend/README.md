# Herd Immunity — Frontend

Real-time decentralized UPI fraud warning network demo. Runs two interactive mobile phone panes side-by-side: **Victim A (Reporter Node)** and **Victim B (Scanner Node)** with decentralized SHA-256 pseudonymization and zero-latency on-device Bloom filter edge verification.

---

## ⚡ Tech Stack

* **React 18 + Vite 6** (JavaScript, zero heavy CSS component libraries)
* **Web Crypto API (`crypto.subtle`)**: Native browser SHA-256 cryptographic hashing matching Node's `crypto`
* **On-Device Bloom Filter**: ~50KB (`Uint8Array` 400,000 bits), 7 double-hashed functions ($g_i(x) = (h_1(x) + i \cdot h_2(x)) \pmod M$) with zero-latency edge checks
* **Socket.IO Client**: Real-time event synchronization with WebSocket + polling fallback

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (.env)
Copy the example file:
```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Backend REST & Socket.IO URL |
| `VITE_MOCK` | `true` | Set to `false` when running against a live backend |

### 3. Start Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🎬 Hackathon Demo Features

1. **Reporter Selector Dropdown**:
   * Switch between `deviceA`, `deviceC`, `deviceD`, and `deviceE` to simulate reports from distinct community members.
   * Demonstrates collective intelligence transitioning risk tiers from soft to hard.
2. **Live In-Place Upgrade**:
   * If Device B already has the yellow cautionary screen open, submitting the 3rd distinct report dynamically transitions the open screen to the red **"SCAM DETECTED"** screen in real time without having to re-scan.
3. **Simulate Offline Mode (Edge Shield)**:
   * Toggle **"Simulate offline"** on Device B to disconnect network calls.
   * Scanning QR codes continues to detect fraudulent VPAs instantly from the local on-device Bloom filter with the label: `⚡ Checked locally. No server call (100% Offline)`.
4. **Render Free-Tier Wake-Up Handling**:
   * When `VITE_MOCK=false`, the frontend polls `GET /health`. If the sleeping free-tier instance takes $>3\text{s}$, a non-blocking banner *"Backend waking up, please wait..."* appears until the instance wakes, then auto-connects Socket.IO and pre-loads flags via `GET /flags`.

---

## 🌐 Vercel Deployment Guide

To deploy the frontend to Vercel:

1. **Import the repository** into Vercel.
2. In the Project Configuration settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend` *(click Edit and select `frontend`)*
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`
3. Add **Environment Variables**:
   * `VITE_API_URL` = `<your-backend-url>` (e.g., `https://herd-immunity-backend.onrender.com`)
   * `VITE_MOCK` = `false`
4. Click **Deploy**. Vercel will build the SPA using `vercel.json` rewrites for seamless client-side routing.
