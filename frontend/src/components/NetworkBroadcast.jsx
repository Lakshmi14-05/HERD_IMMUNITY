import React, { useState, useEffect } from 'react';
import { networkService } from '../services/socket';
import { IS_MOCK } from '../config';

export default function NetworkBroadcast({ isBroadcasting, reportCount = 0 }) {
  const [pulseActive, setPulseActive] = useState(false);
  const [packetDetails, setPacketDetails] = useState(null);

  useEffect(() => {
    const unsubStart = networkService.on('network_transmit_start', (data) => {
      setPulseActive(true);
      setPacketDetails(data);
    });

    const unsubComplete = networkService.on('network_transmit_complete', () => {
      // Keep glow visible for a moment then return to idle
      setTimeout(() => {
        setPulseActive(false);
      }, 600);
    });

    const unsubReset = networkService.on('reset_state', () => {
      setPulseActive(false);
      setPacketDetails(null);
    });

    return () => {
      unsubStart();
      unsubComplete();
      unsubReset();
    };
  }, []);

  const handleSimulateThree = () => {
    networkService.simulateThreeReports({
      vpa: 'scammer@upi',
      upiString: 'upi://pay?pa=scammer@upi&pn=Fake%20Shop'
    });
  };

  const handleResetDemo = () => {
    networkService.resetMock();
  };

  return (
    <div className={`network-bridge-container ${pulseActive || isBroadcasting ? 'broadcasting' : ''}`}>
      {/* Network Beam Cable */}
      <div className="network-cable-line">
        <div className="cable-glow" />
        <div className={`cable-pulse-particle ${pulseActive || isBroadcasting ? 'pulse-anim' : ''}`} />
      </div>

      {/* Network Broadcast Badge & Node Indicator */}
      <div className="network-central-node">
        <div className="network-signal-rings">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
        </div>

        <div className="network-pill-badge">
          <div className="broadcast-icon-wrap">
            <span className="broadcast-radio-icon">📡</span>
          </div>
          <div className="broadcast-text-group">
            <span className="broadcast-title">NETWORK BROADCAST</span>
            <span className="broadcast-sub">
              {pulseActive || isBroadcasting ? 'Broadcasting Bloom Sync (2.0s)...' : 'Zero-Trust Peer P2P Mesh'}
            </span>
          </div>
        </div>

        {/* Dynamic Arrow Stream */}
        <div className="broadcast-arrow-stream">
          <span className="arrow-step step-1">›</span>
          <span className="arrow-step step-2">›</span>
          <span className="arrow-step step-3">›</span>
        </div>

        {/* Live Payload Preview Chip */}
        {packetDetails && (
          <div className="payload-floating-chip">
            <span className="chip-badge">SHA-256</span>
            <span className="chip-hash">{packetDetails.hash ? packetDetails.hash.slice(0, 12) + '...' : 'VPA Pseudonym'}</span>
          </div>
        )}
      </div>

      {/* Dev Controls (Tastefully positioned under network bridge) */}
      <div className="dev-controls-tray">
        <div className="dev-pill-label">
          <span className="dev-tag">DEV MODE</span>
          <span className="mock-indicator">{IS_MOCK ? 'MOCK ON' : 'LIVE API'}</span>
        </div>

        <div className="dev-buttons-group">
          {/* Requested hidden dev button "Simulate 3 reporters" */}
          <button
            type="button"
            className="dev-btn dev-btn-simulate"
            onClick={handleSimulateThree}
            title="Fast forward simulation directly to hard scam detection tier"
          >
            ⚡ Simulate 3 reporters
          </button>

          <button
            type="button"
            className="dev-btn dev-btn-reset"
            onClick={handleResetDemo}
            title="Reset simulation to initial clean state"
          >
            ↺ Reset Demo
          </button>
        </div>
      </div>
    </div>
  );
}
