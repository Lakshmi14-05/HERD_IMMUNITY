import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import DeviceA from './components/DeviceA';
import DeviceB from './components/DeviceB';
import NetworkBroadcast from './components/NetworkBroadcast';
import { networkService } from './services/socket';
import { fetchFlags, ensureBackendAwake } from './services/api';
import { IS_MOCK, API_URL } from './config';
import './App.css';

export default function App() {
  const [activeFlag, setActiveFlag] = useState(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(networkService.getConnectionStatus());
  const [isBackendWakingUp, setIsBackendWakingUp] = useState(false);

  useEffect(() => {
    // Requirement 2: Backend waking up check for sleeping Render free tier (only when VITE_MOCK=false)
    if (!IS_MOCK) {
      ensureBackendAwake(
        (isWaking) => setIsBackendWakingUp(isWaking),
        () => {
          setIsBackendWakingUp(false);
          // Backend is awake: connect socket and fetch flags
          networkService.connectSocket();
          fetchFlags().then((flags) => {
            if (Array.isArray(flags) && flags.length > 0) {
              setTotalReports(flags.length);
            }
          });
        }
      );
    } else {
      // Mock mode: immediate initial setup
      fetchFlags().then((flags) => {
        if (Array.isArray(flags) && flags.length > 0) {
          setTotalReports(flags.length);
        }
      });
    }

    // Listen for socket connection status
    const unsubConn = networkService.on('connection_status', (status) => {
      setConnectionStatus(status);
    });

    // Listen for broadcast start
    const unsubStart = networkService.on('network_transmit_start', () => {
      setIsBroadcasting(true);
    });

    // Listen for incoming flags (Socket.IO "flag" event or mock broadcast)
    const unsubFlag = networkService.on('flag', (flagData) => {
      setActiveFlag(flagData);
      setTotalReports(flagData.reports || flagData.reportersCount || 1);
      setIsBroadcasting(false);
    });

    // Reset handler
    const unsubReset = networkService.on('reset_state', () => {
      setActiveFlag(null);
      setIsBroadcasting(false);
      setTotalReports(0);
    });

    return () => {
      unsubConn();
      unsubStart();
      unsubFlag();
      unsubReset();
    };
  }, []);

  const handleDeviceAReported = (result) => {
    if (result && result.hash) {
      networkService.markPendingReport(result.hash);
    }
  };

  return (
    <div className="demo-canvas">
      {/* Requirement 2: Render Free-tier Wake-up Banner */}
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

      {/* Background ambient lighting and cyber grid */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />
      <div className="cyber-grid" />

      {/* Top Banner Header */}
      <header className="hero-header">
        <div className="hero-badge">
          <span className="shield-icon">🛡️</span>
          <span className="badge-text">Hackathon Live Demo</span>
          <span className="status-indicator-live">
            <span className={`blinking-dot ${connectionStatus === 'connected' ? 'dot-green' : (connectionStatus === 'offline' ? 'dot-gray' : 'dot-orange')}`} />
            {IS_MOCK ? 'MOCK MODE' : `LIVE (${connectionStatus.toUpperCase()})`}
          </span>
        </div>

        <h1 className="hero-title">HERD IMMUNITY</h1>
        <p className="hero-tagline">
          Real-time decentralized UPI fraud warning network powered by SHA-256 &amp; On-Device Bloom Filters
        </p>

        <div className="stats-strip">
          <div className="stat-pill">
            <span className="stat-label">Backend URL:</span>
            <span className="stat-value highlight">{API_URL}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Mode:</span>
            <span className="stat-value">{IS_MOCK ? 'Simulated P2P (VITE_MOCK=true)' : 'Live Backend (VITE_MOCK=false)'}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Active Flags:</span>
            <span className="stat-value">{totalReports}</span>
          </div>
        </div>
      </header>

      {/* Main Phones Stage: Side-by-Side with Network Conduit between them */}
      <main className="phones-stage">
        {/* Device A Pane: Victim A (Reporter) */}
        <section className="device-pane-col device-pane-a" aria-label="Device A - Victim A">
          <PhoneFrame
            deviceName="Device A"
            roleName="Victim A"
            statusTag="Reporter Node"
            statusType="active"
          >
            <DeviceA onReportTriggered={handleDeviceAReported} />
          </PhoneFrame>
        </section>

        {/* Central Network Broadcast Bridge / Animated Conduit */}
        <section className="network-bridge-col" aria-label="Network Broadcast Pipeline">
          <NetworkBroadcast
            isBroadcasting={isBroadcasting}
            reportCount={totalReports}
          />
        </section>

        {/* Device B Pane: Victim B (Receiver / Target) */}
        <section className="device-pane-col device-pane-b" aria-label="Device B - Victim B">
          <PhoneFrame
            deviceName="Device B"
            roleName="Victim B"
            statusTag={activeFlag ? `Alert: ${activeFlag.level.toUpperCase()}` : (connectionStatus === 'connected' ? 'Ready to Scan' : (connectionStatus === 'offline' ? 'Offline Edge' : 'Reconnecting'))}
            statusType={activeFlag ? (activeFlag.level === 'hard' ? 'danger' : 'warning') : (connectionStatus === 'offline' ? 'normal' : 'normal')}
          >
            <DeviceB
              activeFlag={activeFlag}
              connectionStatus={connectionStatus}
              onResetAll={() => networkService.resetState()}
            />
          </PhoneFrame>
        </section>
      </main>

      {/* Footer Info & Architecture Checklist */}
      <footer className="demo-footer">
        <div className="footer-architecture-pills">
          <span className="arch-pill">🔒 Web Crypto SHA-256</span>
          <span className="arch-pill">⚡ Bloom Filter (50KB / 7 Hashes)</span>
          <span className="arch-pill">📡 Socket.IO Real-Time Sync</span>
          <span className="arch-pill">🛡️ Zero-Network Edge Verification</span>
        </div>
        <p className="footer-note">
          Herd Immunity Demo • Frontend isolated in <code>/frontend</code> • Ready for Live Screen Recording
        </p>
      </footer>
    </div>
  );
}
