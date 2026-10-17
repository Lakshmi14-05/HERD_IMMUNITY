# Herd Immunity — Frontend

Real-time decentralized UPI fraud warning network application. Runs multi-device interactive mobile phone panes side-by-side (Device A, Device B, and up to 4 devices via "+ Add device") connecting directly to the real Node.js + Redis backend.

---

## ⚡ Tech Stack

* **React 18 + Vite 6** (Zero heavy CSS component libraries)
* **jsQR**: Fast client-side QR code decoding in the browser (Canvas -> ImageData -> jsQR)
* **Web Crypto API (`crypto.subtle`)**: Native browser SHA-256 cryptographic hashing matching Node's `crypto` exactly
* **On-Device Bloom Filter**: ~50KB (`Uint8Array` 400,000 bits), 7 double-hashed functions ($g_i(x) = (h_1(x) + i \cdot h_2(x)) \pmod M$) with zero-latency edge checks
* **Socket.IO Client**: Real-time event synchronization over WebSockets with polling fallback

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (.env)
```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Backend REST & Socket.IO URL |

### 3. Start Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 📱 Features & Device Flow

1. **Multi-Device Support**:
   * Device A and Device B open by default.
   * Click **"+ Add device"** to spawn Device C and Device D (up to 4 devices total).
   * Each device has its own fixed `reporterId` (`deviceA`, `deviceB`, `deviceC`, `deviceD`).
2. **In-Browser QR Decoding**:
   * **Upload QR Image**: Select any image file (`image/*`). Decoded client-side with `jsQR`.
   * **Use Camera**: Live webcam viewfinder with frame scanner.
   * **Sample QRs**: 1-click loaders for `fake-shop-1.png`, `fake-shop-2.png`, and `safe-store.png`.
3. **Report as Scam**:
   * Sends `POST {VITE_API_URL}/report` with `{ id: <decoded text>, reporterId: <device id> }`.
   * Handles rate limits (429) and network errors with friendly alerts.
4. **Zero-Network Local Check**:
   * Computes `sha256(qrText.trim())` via Web Crypto API.
   * Checks the on-device Bloom filter first with **no network calls**:
     - **Safe**: Green *"Not reported. Looks safe"*.
     - **Soft (1–2 reports)**: Yellow *"Proceed with caution. Reported by N user"*.
     - **Hard (3+ reports)**: Red *"SCAM DETECTED, reported by N users"*.
   * If flagged in Bloom without cached metadata (possible false-positive), confirms with `GET /api/check?hash=<hash>`.
5. **Real-Time Live Updates**:
   * All devices listen to the Socket.IO `"flag"` event (`{ hash, level, reports, ts }`).
   * If a device already displays a result for that QR code, it updates in place from soft to hard live without having to re-scan, with an **"Updated live via Socket.IO"** indicator.

---

## 🌐 Vercel Deployment Guide

1. Import the repository into your Vercel Dashboard.
2. In the **Project Configuration** settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend` *(click **Edit** and choose `frontend`)*
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`
3. Add **Environment Variables**:
   * `VITE_API_URL` = `<your-backend-url>` (e.g., `https://herd-immunity-backend.onrender.com`)
4. Click **Deploy**.
