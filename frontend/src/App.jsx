import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import DeviceA from './components/DeviceA';
import DeviceB from './components/DeviceB';
import NetworkBroadcast from './components/NetworkBroadcast';
import { networkService } from './services/socket';
import { IS_MOCK } from './config';
import './App.css';

export default function App() {
  const [activeFlag, setActiveFlag] = useState(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [totalReports, setTotalReports] = useState(0);

  useEffect(() => {
    // Listen for broadcast start (shows immediate transmitting indicator)
    const unsubStart = networkService.on('network_transmit_start', () => {
      setIsBroadcasting(true);
    });

    // Listen for arrival on Device B (after 2s mock delay or socket push)
    const unsubBroadcast = networkService.on('flag_broadcast', (flagData) => {
      setActiveFlag(flagData);
      setTotalReports(flagData.reportersCount);
      setIsBroadcasting(false);
    });

    // Reset handler
    const unsubReset = networkService.on('reset_state', () => {
      setActiveFlag(null);
      setIsBroadcasting(false);
      setTotalReports(0);
    });

    return () => {
      unsubStart();
      unsubBroadcast();
      unsubReset();
    };
  }, []);

  const handleDeviceAReported = (result) => {
    // Device A triggered report
    console.log('[App] Device A report triggered:', result);
  };

  return (
    <div className="demo-canvas">
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
            <span className="blinking-dot" /> LIVE P2P
          </span>
        </div>

        <h1 className="hero-title">HERD IMMUNITY</h1>
        <p className="hero-tagline">
          Real-time decentralized UPI fraud warning network powered by SHA-256 &amp; On-Device Bloom Filters
        </p>

        <div className="stats-strip">
          <div className="stat-pill">
            <span className="stat-label">Network Mode:</span>
            <span className="stat-value highlight">{IS_MOCK ? 'Simulated P2P Mesh (VITE_MOCK=true)' : 'Live Backend Socket'}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Active Flags:</span>
            <span className="stat-value">{totalReports}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Verification Time:</span>
            <span className="stat-value">&lt; 1 ms (Bloom Filter)</span>
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
            statusTag={activeFlag ? `Alert: ${activeFlag.level.toUpperCase()}` : 'Ready to Scan'}
            statusType={activeFlag ? (activeFlag.level === 'hard' ? 'danger' : 'warning') : 'normal'}
          >
            <DeviceB
              activeFlag={activeFlag}
              onResetAll={() => networkService.resetMock()}
            />
          </PhoneFrame>
        </section>
      </main>

      {/* Footer Info & Architecture Checklist */}
      <footer className="demo-footer">
        <div className="footer-architecture-pills">
          <span className="arch-pill">🔒 Web Crypto SHA-256</span>
          <span className="arch-pill">⚡ Bloom Filters (Zero-Latency)</span>
          <span className="arch-pill">📡 Socket.io / Event Mesh</span>
          <span className="arch-pill">📱 React 18 + Vite</span>
        </div>
        <p className="footer-note">
          Herd Immunity Demo • Frontend isolated in <code>/frontend</code> • Ready for backend integration
        </p>
      </footer>
    </div>
  );
}
