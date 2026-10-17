import React from 'react';

/**
 * WarningScreen Component
 * Renders the state inside Device B:
 * - Green "Looks safe. Pay"
 * - Yellow "Proceed with caution. Reported by 1 user"
 * - Red "SCAM DETECTED. Reported by N users, X seconds ago" with disabled Pay button
 * - Shake & pulse animations on red hard detection
 * - Includes: "Checked locally. No server call" (with offline indicator when offline)
 */
export default function WarningScreen({
  level, // 'safe' | 'soft' | 'hard'
  reportersCount = 0,
  secondsAgo = 0,
  vpa = 'scammer@upi',
  merchantName = 'Fake Shop',
  isOffline = false,
  onReset,
  onPay
}) {
  const localCheckBadge = (
    <div className={`checked-locally-badge ${isOffline ? 'badge-offline-mode' : ''}`}>
      <span className="badge-shield-icon">{isOffline ? '✈️' : '⚡'}</span>
      <span>Checked locally. No server call {isOffline ? '(100% Offline)' : ''}</span>
    </div>
  );

  if (level === 'safe') {
    return (
      <div className="warning-screen screen-safe">
        <div className="status-badge-top safe-pill">
          <span className="dot-pulse green-dot" /> Verified Clean
        </div>

        <div className="screen-center-icon safe-icon-wrap">
          <svg className="safe-svg" viewBox="0 0 48 48" width="64" height="64" fill="none">
            <circle cx="24" cy="24" r="22" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="2.5" />
            <path d="M15 24.5L21 30.5L33 18.5" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3 className="result-headline safe-title">Looks safe. Pay</h3>
        <p className="result-subtext">
          Zero fraud reports in decentralized network. On-device Bloom filter check passed.
        </p>

        {localCheckBadge}

        <div className="payment-summary-box">
          <div className="payment-row">
            <span className="summary-label">Payee:</span>
            <span className="summary-val">{merchantName}</span>
          </div>
          <div className="payment-row">
            <span className="summary-label">VPA:</span>
            <span className="summary-val mono">{vpa}</span>
          </div>
          <div className="payment-row total-row">
            <span className="summary-label">Amount:</span>
            <span className="summary-val amount-val">₹500.00</span>
          </div>
        </div>

        <div className="screen-actions">
          <button type="button" className="btn btn-pay-safe" onClick={onPay}>
            <span>✓ Pay ₹500.00</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            Scan another QR
          </button>
        </div>
      </div>
    );
  }

  if (level === 'soft') {
    return (
      <div className="warning-screen screen-soft">
        <div className="status-badge-top soft-pill">
          <span className="dot-pulse yellow-dot" /> Early Community Warning
        </div>

        <div className="screen-center-icon soft-icon-wrap">
          <svg className="soft-svg" viewBox="0 0 48 48" width="64" height="64" fill="none">
            <circle cx="24" cy="24" r="22" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="2.5" />
            <path d="M24 14V26M24 32H24.02" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>

        <h3 className="result-headline soft-title">
          Proceed with caution. Reported by {reportersCount} user{reportersCount > 1 ? 's' : ''}
        </h3>
        <p className="result-subtext">
          A peer device recently flagged this QR code as suspicious. Verify seller identity before continuing.
        </p>

        {localCheckBadge}

        <div className="payment-summary-box warning-box">
          <div className="payment-row">
            <span className="summary-label">Target:</span>
            <span className="summary-val mono">{vpa}</span>
          </div>
          <div className="payment-row">
            <span className="summary-label">Risk Tier:</span>
            <span className="summary-val risk-medium">Medium Risk ({reportersCount} Peer Flag{reportersCount > 1 ? 's' : ''})</span>
          </div>
        </div>

        <div className="screen-actions">
          <button type="button" className="btn btn-caution-pay" onClick={onPay}>
            <span>Proceed Anyway (Risky)</span>
          </button>
          <button type="button" className="btn btn-danger-decline" onClick={onReset}>
            <span>Cancel &amp; Block Merchant</span>
          </button>
        </div>
      </div>
    );
  }

  // Level 'hard' (full red screen with shake and pulse animations)
  return (
    <div className="warning-screen screen-hard anim-shake-pulse">
      <div className="hazard-stripes" />

      <div className="screen-center-icon hard-icon-wrap pulse-danger">
        <svg className="hard-svg" viewBox="0 0 54 54" width="76" height="76" fill="none">
          <polygon
            points="27,4 51,48 3,48"
            fill="#ef4444"
            fillOpacity="0.25"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M27 18V32" stroke="#ff4d4d" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="27" cy="40" r="2.8" fill="#ff4d4d" />
        </svg>
      </div>

      <div className="hard-alert-header">
        <h3 className="result-headline hard-title">SCAM DETECTED</h3>
        <div className="hard-reporters-banner">
          Reported by {reportersCount} users, {secondsAgo}s ago
        </div>
      </div>

      <p className="result-subtext hard-subtext">
        High-confidence fraud match. Multiple peers reported unauthorized billing on this VPA.
      </p>

      {localCheckBadge}

      <div className="payment-summary-box danger-box">
        <div className="payment-row">
          <span className="summary-label">Flagged VPA:</span>
          <span className="summary-val mono danger-vpa">{vpa}</span>
        </div>
        <div className="payment-row">
          <span className="summary-label">Safety Status:</span>
          <span className="summary-val risk-high">BLOCKED BY HERD SHIELD</span>
        </div>
      </div>

      <div className="screen-actions">
        <button
          type="button"
          className="btn btn-disabled-pay"
          disabled
          title="Payment blocked for your protection"
        >
          <span className="lock-icon">🔒</span>
          <span>Pay ₹500 (Blocked - Scam)</span>
        </button>

        <button type="button" className="btn btn-reset-clean" onClick={onReset}>
          Scan another QR
        </button>
      </div>
    </div>
  );
}
