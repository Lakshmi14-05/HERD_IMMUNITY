import React, { useState, useEffect } from 'react';
import WarningScreen from './WarningScreen';
import { networkService } from '../services/socket';
import { hasFlag, getFlagDetails, addHashToFilter, localDeviceBloom } from '../services/bloom';
import { sha256 } from '../services/hash';

export default function DeviceB({
  activeFlag,
  onResetAll,
  connectionStatus = 'connected'
}) {
  const [scanResult, setScanResult] = useState(null); // null | { level: 'safe'|'soft'|'hard', ... }
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [simulatedScanning, setSimulatedScanning] = useState(false);
  const [localConnStatus, setLocalConnStatus] = useState(connectionStatus);
  const [isOffline, setIsOffline] = useState(false);

  // Subscribe to connection status changes
  useEffect(() => {
    setLocalConnStatus(networkService.getConnectionStatus());
    const unsubConn = networkService.on('connection_status', (status) => {
      setLocalConnStatus(status);
    });
    const unsubOff = networkService.on('offline_toggled', (offline) => {
      setIsOffline(offline);
    });
    return () => {
      unsubConn();
      unsubOff();
    };
  }, []);

  // Update Bloom filter and metadata when activeFlag arrives
  // Requirement 3: If Device B already has soft result open, live-update it to hard in place without pressing Scan again!
  useEffect(() => {
    if (activeFlag && activeFlag.hash) {
      addHashToFilter(localDeviceBloom, activeFlag.hash, {
        level: activeFlag.level,
        reports: activeFlag.reports || activeFlag.reportersCount || 1,
        ts: activeFlag.reportedAt
      });

      // Requirement 3: Live update currently open scan result without needing to re-scan
      setScanResult((prev) => {
        if (!prev) return null;
        const currentReports = activeFlag.reports || activeFlag.reportersCount || prev.reportersCount;
        const isHardTier = activeFlag.level === 'hard' || currentReports >= 3;
        return {
          ...prev,
          level: isHardTier ? 'hard' : (prev.level || 'soft'),
          reportersCount: currentReports
        };
      });
    }
  }, [activeFlag]);

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

  // Reset scan result when demo is reset
  useEffect(() => {
    const unsub = networkService.on('reset_state', () => {
      setScanResult(null);
      setSecondsAgo(0);
    });
    return unsub;
  }, []);

  // Handle "Simulate offline" toggle
  const handleToggleOffline = (checked) => {
    setIsOffline(checked);
    networkService.setOffline(checked);
  };

  // Handle "Scan QR" action (Requirement 4 & 5: Hash QR, check Bloom locally with NO network call, works offline)
  const handleScanQR = async () => {
    setSimulatedScanning(true);

    const upiString = 'upi://pay?pa=scammer@upi&pn=Fake%20Shop';
    // 1. Hash QR string via crypto.subtle (pure local calculation)
    const hash = await sha256(upiString);

    // Short visual laser animation for realistic scanner feedback
    setTimeout(() => {
      setSimulatedScanning(false);

      // 2. Check the Bloom filter locally with NO network call (works 100% offline)
      const isFlaggedInBloom = hasFlag(hash);

      if (isFlaggedInBloom) {
        // 3. Look up Map for level, reports, ts
        const details = getFlagDetails(hash);
        const level = details ? details.level : (activeFlag ? activeFlag.level : 'soft');
        const reports = details ? details.reports : (activeFlag ? (activeFlag.reports || activeFlag.reportersCount) : 1);

        setScanResult({
          level: (level === 'hard' || reports >= 3) ? 'hard' : 'soft',
          reportersCount: reports,
          vpa: 'scammer@upi',
          merchantName: 'Fake Shop'
        });
      } else {
        // Not in Bloom filter -> Safe
        setScanResult({
          level: 'safe',
          reportersCount: 0,
          vpa: 'scammer@upi',
          merchantName: 'Fake Shop'
        });
      }
    }, 380);
  };

  const handleResetScan = () => {
    setScanResult(null);
  };

  const isConnected = !isOffline && localConnStatus === 'connected';

  return (
    <div className={`upi-app victim-b ${scanResult ? `mode-${scanResult.level}` : ''}`}>
      {/* App Top Header with Connection Status Dot */}
      <div className="app-header">
        <div className="app-branding">
          <div className="app-logo scanner-logo">🛡️</div>
          <div className="app-title-group">
            <h2 className="app-name">HerdPay Scanner</h2>
            <span className="app-subtitle">Zero-Trust Peer Shield</span>
          </div>
        </div>

        {/* Small Connection Status Dot on Device B pane */}
        <div
          className={`connection-pill ${isOffline ? 'conn-offline-mode' : (isConnected ? 'conn-online' : 'conn-offline')}`}
          title={`Network status: ${isOffline ? 'Offline Mode Active' : localConnStatus}`}
        >
          <span className={`conn-dot ${isOffline ? 'dot-gray' : (isConnected ? 'dot-connected' : 'dot-reconnecting')}`} />
          <span className="conn-text">
            {isOffline ? 'Offline' : (isConnected ? 'Connected' : 'Reconnecting')}
          </span>
        </div>
      </div>

      {/* Main View: either Scanning View or Warning/Result Screen */}
      <div className="app-body">
        {/* Offline Demo Toggle Bar */}
        <div className="offline-control-bar">
          <label className="offline-toggle-container" htmlFor="offline-demo-toggle">
            <input
              id="offline-demo-toggle"
              type="checkbox"
              className="offline-checkbox"
              checked={isOffline}
              onChange={(e) => handleToggleOffline(e.target.checked)}
            />
            <span className="toggle-switch-ui" />
            <span className="toggle-switch-text">
              {isOffline ? '✈️ Offline Mode (Edge Shield Active)' : 'Simulate offline'}
            </span>
          </label>
        </div>

        {scanResult ? (
          <WarningScreen
            level={scanResult.level}
            reportersCount={scanResult.reportersCount}
            secondsAgo={secondsAgo}
            vpa={scanResult.vpa}
            merchantName={scanResult.merchantName}
            isOffline={isOffline}
            onReset={handleResetScan}
            onPay={() => alert('Processing payment...')}
          />
        ) : (
          <div className="scanner-view">
            {/* Live Flag Notification Badge (if not offline or previously received) */}
            {activeFlag && !isOffline && (
              <div className="live-broadcast-badge" role="status">
                <span className="pulse-indicator-dot" />
                <span className="badge-text">
                  Flag received in <strong>{activeFlag.latencySeconds || '2.0'}s</strong>
                </span>
                <span className="badge-level-pill" data-level={activeFlag.level}>
                  {activeFlag.level === 'hard' || (activeFlag.reports >= 3) ? `${activeFlag.reports || activeFlag.reportersCount} reports` : '1 report'}
                </span>
              </div>
            )}

            {/* Offline Notification Notice */}
            {isOffline && (
              <div className="offline-banner-notice">
                <span className="plane-icon">✈️</span>
                <span className="offline-notice-text">
                  Device is offline. Verification runs 100% on-device via Bloom filter.
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

              {/* Fake QR code visible in viewfinder */}
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
              <span className="target-label">Target:</span>
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
                  <span className="btn-spinner">Verifying Bloom Filter locally...</span>
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
