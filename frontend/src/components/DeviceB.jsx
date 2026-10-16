import React, { useState, useEffect } from 'react';
import WarningScreen from './WarningScreen';
import { networkService } from '../services/socket';
import { addHashToFilter, hasHashInFilter, localDeviceBloom } from '../services/bloom';
import { hashUpiPayload } from '../services/hash';

export default function DeviceB({
  activeFlag,
  onResetAll,
  isScanning,
  setIsScanning
}) {
  const [scanResult, setScanResult] = useState(null); // null | { level: 'safe'|'soft'|'hard', ... }
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [simulatedScanning, setSimulatedScanning] = useState(false);

  // When activeFlag is updated via network broadcast, insert hash into local Bloom filter
  useEffect(() => {
    if (activeFlag && activeFlag.hash) {
      addHashToFilter(localDeviceBloom, activeFlag.hash, {
        level: activeFlag.level,
        reports: activeFlag.reportersCount,
        ts: activeFlag.reportedAt
      });
    }
  }, [activeFlag]);

  // Reset scan result when demo is reset
  useEffect(() => {
    const unsub = networkService.on('reset_state', () => {
      setScanResult(null);
      setSecondsAgo(0);
    });
    return unsub;
  }, []);

  // Real-time ticking counter for "Reported by N users, X seconds ago"
  useEffect(() => {
    let timer;
    if (activeFlag && activeFlag.reportedAt) {
      const updateSeconds = () => {
        const diffMs = Math.max(0, Date.now() - activeFlag.reportedAt);
        setSecondsAgo(Math.max(1, Math.floor(diffMs / 1000)));
      };
      updateSeconds();
      timer = setInterval(updateSeconds, 1000);
    }
    return () => clearInterval(timer);
  }, [activeFlag]);

  // Handle "Scan QR" action
  const handleScanQR = async () => {
    setSimulatedScanning(true);

    const upiString = 'upi://pay?pa=scammer@upi&pn=Fake%20Shop';
    const { hash, vpa } = await hashUpiPayload(upiString);

    // Fast 300ms scanning animation
    setTimeout(() => {
      setSimulatedScanning(false);

      // Check if hash matches in local bloom filter or activeFlag
      const inBloom = hasHashInFilter(localDeviceBloom, hash);

      if (activeFlag && (activeFlag.hash === hash || inBloom)) {
        setScanResult({
          level: activeFlag.level || (activeFlag.reportersCount >= 3 ? 'hard' : 'soft'),
          reportersCount: activeFlag.reportersCount || 1,
          vpa: activeFlag.vpa || vpa,
          merchantName: 'Fake Shop'
        });
      } else {
        // Not flagged yet -> Safe
        setScanResult({
          level: 'safe',
          reportersCount: 0,
          vpa,
          merchantName: 'Fake Shop'
        });
      }
    }, 450);
  };

  const handleResetScan = () => {
    setScanResult(null);
  };

  return (
    <div className={`upi-app victim-b ${scanResult ? `mode-${scanResult.level}` : ''}`}>
      {/* App Top Header */}
      <div className="app-header">
        <div className="app-branding">
          <div className="app-logo scanner-logo">🛡️</div>
          <div className="app-title-group">
            <h2 className="app-name">HerdPay Scanner</h2>
            <span className="app-subtitle">Zero-Trust Peer Shield</span>
          </div>
        </div>
        <div className="app-vpa-pill">pa: victim2@upi</div>
      </div>

      {/* Main View: either Scanning View or Warning/Result Screen */}
      <div className="app-body">
        {scanResult ? (
          <WarningScreen
            level={scanResult.level}
            reportersCount={scanResult.reportersCount}
            secondsAgo={secondsAgo}
            vpa={scanResult.vpa}
            merchantName={scanResult.merchantName}
            onReset={handleResetScan}
            onPay={() => alert('Processing payment...')}
          />
        ) : (
          <div className="scanner-view">
            {/* Live Flag Notification Badge */}
            {activeFlag && (
              <div className="live-broadcast-badge" role="status">
                <span className="pulse-indicator-dot" />
                <span className="badge-text">
                  Flag received in <strong>{activeFlag.latencySeconds || '2.0'}s</strong>
                </span>
                <span className="badge-level-pill" data-level={activeFlag.level}>
                  {activeFlag.level === 'hard' ? '3x reports' : '1st report'}
                </span>
              </div>
            )}

            {/* Scanner Viewport / Camera Preview Mock */}
            <div className="camera-viewfinder">
              <div className="camera-overlay-corner top-left" />
              <div className="camera-overlay-corner top-right" />
              <div className="camera-overlay-corner bottom-left" />
              <div className="camera-overlay-corner bottom-right" />

              <div className={`laser-scanner-line ${simulatedScanning ? 'laser-active' : ''}`} />

              {/* Same fake QR code visible in viewfinder */}
              <div className="viewfinder-target">
                <svg className="qr-svg" viewBox="0 0 140 140" width="130" height="130">
                  <rect width="140" height="140" fill="#ffffff" rx="10" />
                  <rect x="14" y="14" width="34" height="34" fill="#0f172a" rx="4" />
                  <rect x="20" y="20" width="22" height="22" fill="#ffffff" rx="2" />
                  <rect x="25" y="25" width="12" height="12" fill="#0f172a" rx="1" />
                  <rect x="92" y="14" width="34" height="34" fill="#0f172a" rx="4" />
                  <rect x="98" y="20" width="22" height="22" fill="#ffffff" rx="2" />
                  <rect x="103" y="25" width="12" height="12" fill="#0f172a" rx="1" />
                  <rect x="14" y="92" width="34" height="34" fill="#0f172a" rx="4" />
                  <rect x="20" y="98" width="22" height="22" fill="#ffffff" rx="2" />
                  <rect x="25" y="103" width="12" height="12" fill="#0f172a" rx="1" />
                  <rect x="58" y="18" width="8" height="8" fill="#0f172a" />
                  <rect x="72" y="18" width="8" height="8" fill="#0f172a" />
                  <rect x="58" y="32" width="16" height="8" fill="#0f172a" />
                  <rect x="18" y="58" width="16" height="8" fill="#0f172a" />
                  <rect x="38" y="68" width="8" height="16" fill="#0f172a" />
                  <rect x="54" y="54" width="12" height="12" fill="#ef4444" rx="2" />
                  <rect x="74" y="54" width="12" height="12" fill="#0f172a" />
                  <rect x="92" y="58" width="20" height="8" fill="#0f172a" />
                  <rect x="58" y="74" width="24" height="8" fill="#0f172a" />
                  <rect x="58" y="92" width="8" height="18" fill="#0f172a" />
                  <rect x="74" y="98" width="14" height="8" fill="#0f172a" />
                  <rect x="96" y="92" width="14" height="14" fill="#0f172a" />
                  <rect x="114" y="98" width="12" height="12" fill="#ef4444" rx="2" />
                  <rect x="18" y="78" width="8" height="6" fill="#0f172a" />
                  <rect x="114" y="74" width="12" height="12" fill="#0f172a" />
                </svg>
              </div>

              <span className="viewfinder-label">Point camera at UPI QR</span>
            </div>

            {/* Merchant Preview */}
            <div className="target-merchant-info">
              <span className="target-label">Detected Target:</span>
              <span className="target-name">Fake Shop • scammer@upi</span>
            </div>

            {/* Scan QR Button */}
            <div className="scanner-actions">
              <button
                type="button"
                className="btn btn-scan-qr"
                onClick={handleScanQR}
                disabled={simulatedScanning}
              >
                {simulatedScanning ? (
                  <span className="btn-spinner">Analyzing QR &amp; Bloom Filter...</span>
                ) : (
                  <>
                    <span className="btn-icon">📷</span>
                    <span>Scan QR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App Bottom Tab Bar */}
      <div className="app-nav-bar">
        <div className="nav-item">
          <span className="nav-icon">💸</span>
          <span className="nav-label">Pay</span>
        </div>
        <div className="nav-item active">
          <span className="nav-icon">📷</span>
          <span className="nav-label">Scan</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">🛡️</span>
          <span className="nav-label">Shield</span>
        </div>
      </div>
    </div>
  );
}
