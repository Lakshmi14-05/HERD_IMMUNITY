# Herd Immunity — Frontend

Real-time UPI fraud warning hackathon demonstration UI.

## Architecture

- **`src/components/PhoneFrame.jsx`**: Realistic 340px mobile phone chassis with notch, status bar, and home indicator.
- **`src/components/DeviceA.jsx`**: "Victim A" (Reporter device) with fake UPI QR, prefilled VPA payload input, and "Report scam QR" trigger with timestamped confirmation.
- **`src/components/DeviceB.jsx`**: "Victim B" (Scanner device) with live "Flag received in Xs" badge, camera scanner, and dynamic risk states.
- **`src/components/WarningScreen.jsx`**: Result screen inside phone for:
  - Green "Looks safe. Pay" (0 reports)
  - Yellow "Proceed with caution. Reported by 1 user" (1 report)
  - Red "SCAM DETECTED. Reported by N users, X seconds ago" (3+ reports) with disabled Pay button.
- **`src/components/NetworkBroadcast.jsx`**: Animated P2P conduit between devices with pulsing waves, beam animation, and dev shortcut.
- **`src/services/hash.js`**: SHA-256 pseudonymization via native `crypto.subtle`.
- **`src/services/bloom.js`**: Zero-latency decentralized edge verification using `bloom-filters`.
- **`src/services/socket.js`**: Socket.io live connection + mock mode simulation with 2-second propagation latency.
- **`src/services/api.js`**: Backend REST communication with mock fallbacks.
- **`src/config.js`**: Config reading `VITE_API_URL` and `VITE_MOCK` (defaults to `true`).

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will start at `http://localhost:5173`.
