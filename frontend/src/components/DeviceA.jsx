import React, { useState } from 'react';
import { submitFraudReport } from '../services/api';
import { hashUpiPayload } from '../services/hash';

export default function DeviceA({ onReportTriggered }) {
  const [upiString, setUpiString] = useState('upi://pay?pa=scammer@upi&pn=Fake%20Shop');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [hashPreview, setHashPreview] = useState('');

  const handleReport = async (e) => {
    e.preventDefault();
    if (!upiString.trim()) return;

    setIsSubmitting(true);
    try {
      const hashInfo = await hashUpiPayload(upiString);
      setHashPreview(hashInfo.hash.slice(0, 16) + '...');

      const result = await submitFraudReport(upiString);
      const timestampStr = new Date(result.timestamp || Date.now()).toLocaleTimeString();

      setReportResult({
        success: true,
        timestamp: timestampStr,
        rawTimestamp: result.timestamp,
        reportersCount: result.reportersCount || 1
      });

      if (onReportTriggered) {
        onReportTriggered(result);
      }
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setReportResult(null);
    setHashPreview('');
  };

  return (
    <div className="upi-app victim-a">
      {/* UPI App Top Navbar */}
      <div className="app-header">
        <div className="app-branding">
          <div className="app-logo">⚡</div>
          <div className="app-title-group">
            <h2 className="app-name">HerdPay</h2>
            <span className="app-subtitle">UPI 2.0 Secure Pay</span>
          </div>
        </div>
        <div className="app-vpa-pill">pa: victim1@upi</div>
      </div>

      <div className="app-body">
        {/* Merchant Card */}
        <div className="merchant-card">
          <div className="merchant-avatar">🏪</div>
          <div className="merchant-details">
            <h3 className="merchant-name">Fake Shop (Unverified)</h3>
            <span className="merchant-vpa">scammer@upi</span>
          </div>
          <span className="fraud-tag">Flagged VPA</span>
        </div>

        {/* QR Code Graphic Placeholder */}
        <div className="qr-container">
          <div className="qr-box">
            <svg className="qr-svg" viewBox="0 0 140 140" width="140" height="140">
              <rect width="140" height="140" fill="#ffffff" rx="12" />
              {/* Corner 1 */}
              <rect x="14" y="14" width="34" height="34" fill="#0f172a" rx="4" />
              <rect x="20" y="20" width="22" height="22" fill="#ffffff" rx="2" />
              <rect x="25" y="25" width="12" height="12" fill="#0f172a" rx="1" />
              {/* Corner 2 */}
              <rect x="92" y="14" width="34" height="34" fill="#0f172a" rx="4" />
              <rect x="98" y="20" width="22" height="22" fill="#ffffff" rx="2" />
              <rect x="103" y="25" width="12" height="12" fill="#0f172a" rx="1" />
              {/* Corner 3 */}
              <rect x="14" y="92" width="34" height="34" fill="#0f172a" rx="4" />
              <rect x="20" y="98" width="22" height="22" fill="#ffffff" rx="2" />
              <rect x="25" y="103" width="12" height="12" fill="#0f172a" rx="1" />
              {/* Fake Data matrix blocks */}
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
            <div className="qr-scan-line-anim" />
          </div>
          <span className="qr-hint">Scan with any UPI app to pay</span>
        </div>

        {/* UPI Payload Input Form */}
        <form onSubmit={handleReport} className="upi-form">
          <label className="form-label" htmlFor="upi-string-input">
            UPI QR Payload:
          </label>
          <div className="input-group">
            <span className="input-prefix">🔗</span>
            <input
              id="upi-string-input"
              type="text"
              className="text-input"
              value={upiString}
              onChange={(e) => setUpiString(e.target.value)}
              placeholder="upi://pay?pa=..."
              required
            />
          </div>

          {/* Action Button: Report Scam */}
          <button
            type="submit"
            className="btn btn-report-scam"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-spinner">Broadcasting...</span>
            ) : (
              <>
                <span className="btn-icon">🚨</span>
                <span>Report scam QR</span>
              </>
            )}
          </button>
        </form>

        {/* Confirmation Banner */}
        {reportResult && (
          <div className="confirmation-card green-confirmation" role="alert">
            <div className="confirmation-header">
              <span className="check-icon">✓</span>
              <strong className="confirmation-title">Report submitted</strong>
            </div>
            <p className="confirmation-timestamp">
              Timestamp: <span>{reportResult.timestamp}</span>
            </p>
            <div className="confirmation-meta">
              <span className="badge-bloom">Bloom Sync Queued</span>
              {hashPreview && (
                <span className="badge-hash" title="Privacy-preserving SHA-256 hash">
                  SHA-256: {hashPreview}
                </span>
              )}
            </div>
            <button type="button" className="btn-text-dismiss" onClick={handleReset}>
              Reset Device
            </button>
          </div>
        )}
      </div>

      {/* App Bottom Tab Bar */}
      <div className="app-nav-bar">
        <div className="nav-item active">
          <span className="nav-icon">💸</span>
          <span className="nav-label">Pay</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">📊</span>
          <span className="nav-label">History</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">🛡️</span>
          <span className="nav-label">Shield</span>
        </div>
      </div>
    </div>
  );
}
