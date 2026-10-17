import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import DevicePane from './components/DevicePane';
import { networkService } from './services/socket';
import { fetchFlags, ensureBackendAwake } from './services/api';
import './App.css';

const AVAILABLE_DEVICES = [
  { id: 'deviceA', name: 'Device A' },
  { id: 'deviceB', name: 'Device B' },
  { id: 'deviceC', name: 'Device C' },
  { id: 'deviceD', name: 'Device D' }
];

export default function App() {
  const [activeDevices, setActiveDevices] = useState([
    AVAILABLE_DEVICES[0],
    AVAILABLE_DEVICES[1]
  ]);
  const [isBackendWakingUp, setIsBackendWakingUp] = useState(false);
  const [globalConnStatus, setGlobalConnStatus] = useState(networkService.getConnectionStatus());

  useEffect(() => {
    // 1. Backend wake-up check & flag prefill
    ensureBackendAwake(
      (isWaking) => setIsBackendWakingUp(isWaking),
      () => {
        setIsBackendWakingUp(false);
        networkService.connectSocket();
        fetchFlags().catch((err) => console.warn('[App] fetchFlags error:', err));
      }
    );

    // 2. Real Socket.IO connection status
    const unsubConn = networkService.on('connection_status', (status) => {
      setGlobalConnStatus(status);
    });

    return () => {
      unsubConn();
    };
  }, []);

  // Add next device (up to 4)
  const handleAddDevice = () => {
    if (activeDevices.length >= AVAILABLE_DEVICES.length) return;
    const nextDevice = AVAILABLE_DEVICES[activeDevices.length];
    setActiveDevices([...activeDevices, nextDevice]);
  };

  // Remove device (Device C or D)
  const handleRemoveDevice = (idToRemove) => {
    if (activeDevices.length <= 2) return;
    setActiveDevices(activeDevices.filter((d) => d.id !== idToRemove));
  };

  const isConnected = globalConnStatus === 'connected';

  return (
    <div className="demo-canvas real-app-canvas">
      {/* Background ambient lighting and cyber grid */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />
      <div className="cyber-grid" />

      {/* Render Free-Tier Waking Up Banner */}
      {isBackendWakingUp && (
        <div className="waking-up-banner" role="status">
          <div className="waking-spinner" />
          <div className="waking-content">
            <strong className="waking-title">Backend waking up, please wait...</strong>
            <span className="waking-sub">
              Render free tier spins down on idle. Awakening server and establishing socket connection...
            </span>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="hero-header">
        <div className="hero-badge">
          <span className="shield-icon">🛡️</span>
          <span className="badge-text">Herd Immunity Network</span>
          <span className="status-indicator-live">
            <span className={`blinking-dot ${isConnected ? 'dot-green' : 'dot-orange'}`} />
            {isConnected ? 'LIVE BACKEND' : 'CONNECTING...'}
          </span>
        </div>

        <h1 className="hero-title">HERD IMMUNITY</h1>
        <p className="hero-tagline">
          Real-time decentralized UPI fraud warning network. Community reports propagate across all peers instantly.
        </p>

        {/* Sample QRs Download Note (Requirement D) */}
        <div className="sample-download-bar">
          <span className="sample-note-icon">💡</span>
          <span className="sample-note-text">Download sample QR images for testing:</span>
          <div className="sample-links-group">
            <a href="/samples/fake-shop-1.png" download="fake-shop-1.png" className="sample-link">
              ⬇ fake-shop-1.png
            </a>
            <a href="/samples/fake-shop-2.png" download="fake-shop-2.png" className="sample-link">
              ⬇ fake-shop-2.png
            </a>
            <a href="/samples/safe-store.png" download="safe-store.png" className="sample-link safe">
              ⬇ safe-store.png
            </a>
          </div>
        </div>
      </header>

      {/* Add Device Button Tray */}
      <div className="devices-toolbar">
        <span className="devices-count-label">
          Active Devices: {activeDevices.length} / 4
        </span>

        {activeDevices.length < 4 && (
          <button
            type="button"
            className="btn btn-add-device"
            onClick={handleAddDevice}
          >
            + Add device ({AVAILABLE_DEVICES[activeDevices.length].name})
          </button>
        )}
      </div>

      {/* Devices Stage: Multi-device phone grid */}
      <main className="phones-stage multi-device-stage">
        {activeDevices.map((dev, idx) => (
          <section key={dev.id} className="device-pane-col" aria-label={dev.name}>
            <PhoneFrame
              deviceName={dev.name}
              roleName={`Node: ${dev.id}`}
              statusTag={isConnected ? 'Connected' : 'Reconnecting'}
              statusType={isConnected ? 'active' : 'warning'}
            >
              <DevicePane
                deviceId={dev.id}
                deviceName={dev.name}
                canRemove={idx >= 2}
                onRemove={() => handleRemoveDevice(dev.id)}
              />
            </PhoneFrame>
          </section>
        ))}
      </main>

      {/* Footer */}
      <footer className="demo-footer">
        <div className="footer-architecture-pills">
          <span className="arch-pill">🔒 SHA-256 Verified</span>
          <span className="arch-pill">⚡ On-Device Bloom Filter (~50KB)</span>
          <span className="arch-pill">📡 Live Socket.IO Broadcast</span>
          <span className="arch-pill">🛡️ Zero-Network Edge Verification</span>
        </div>
        <p className="footer-note">
          Herd Immunity • Real Backend Connected • Privacy-preserving Decentralized UPI Shield
        </p>
      </footer>
    </div>
  );
}
