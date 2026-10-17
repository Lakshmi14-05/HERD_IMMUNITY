import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { sha256 } from '../services/hash';
import { hasFlag, getFlagDetails } from '../services/bloom';
import { reportScam, checkHashOnServer } from '../services/api';
import { networkService } from '../services/socket';

export default function DevicePane({
  deviceId, // e.g. "deviceA"
  deviceName, // e.g. "Device A"
  onRemove, // optional callback if device C/D
  canRemove = false
}) {
  const [qrText, setQrText] = useState('');
  const [qrHash, setQrHash] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [reportResult, setReportResult] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connStatus, setConnStatus] = useState(networkService.getConnectionStatus());
  const [isCameraActive, setIsCameraActive] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Real Socket Connection Status
  useEffect(() => {
    setConnStatus(networkService.getConnectionStatus());
    const unsub = networkService.on('connection_status', (status) => {
      setConnStatus(status);
    });
    return unsub;
  }, []);

  // Listen to Socket.IO "flag" event for live in-place updates (Requirement B.6)
  useEffect(() => {
    const unsubFlag = networkService.on('flag', (flagData) => {
      if (!flagData || !flagData.hash) return;

      // If this device currently displays a check result for this exact QR hash:
      setCheckResult((prev) => {
        if (!prev || !prev.hash) return prev;
        if (prev.hash === flagData.hash) {
          return {
            ...prev,
            status: flagData.level || (flagData.reports >= 3 ? 'hard' : 'soft'),
            reports: flagData.reports,
            ts: flagData.ts,
            updatedLive: true
          };
        }
        return prev;
      });
    });

    return unsubFlag;
  }, []);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Stop camera stream
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Decode QR from Image using jsQR (canvas -> ImageData -> jsQR)
  const processImageElement = (img, dataUrl) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        setQrText(code.data.trim());
        sha256(code.data).then(setQrHash);
        setPreviewUrl(dataUrl);
        setErrorMsg(null);
        setReportResult(null);
        setCheckResult(null);
      } else {
        setQrText('');
        setQrHash('');
        setPreviewUrl(dataUrl);
        setErrorMsg('No QR code found in this image');
        setReportResult(null);
        setCheckResult(null);
      }
    } catch (err) {
      console.error('[jsQR error]:', err);
      setErrorMsg('Error processing QR image');
    }
  };

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    stopCamera();
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target.result;
      const img = new Image();
      img.onload = () => processImageElement(img, dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset file input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  // Quick load sample QR from /samples
  const handleLoadSample = (samplePath) => {
    stopCamera();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => processImageElement(img, samplePath);
    img.src = samplePath;
  };

  // Optional Camera Scan Handler
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
      return;
    }

    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();

        const scanFrame = () => {
          if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            animFrameRef.current = requestAnimationFrame(scanFrame);
            return;
          }

          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            setQrText(code.data.trim());
            sha256(code.data).then(setQrHash);
            setPreviewUrl(canvas.toDataURL());
            stopCamera();
            return;
          }

          animFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraActive(false);
      setErrorMsg('Camera unavailable or permission denied.');
    }
  };

  // Action: "Report as scam"
  const handleReport = async () => {
    if (!qrText) return;

    setIsReporting(true);
    setErrorMsg(null);

    try {
      const res = await reportScam(qrText, deviceId);
      const timestampStr = new Date().toLocaleTimeString();

      setReportResult({
        ok: true,
        level: res.level,
        reports: res.reports,
        duplicate: res.duplicate,
        timestamp: timestampStr
      });
    } catch (err) {
      setErrorMsg(err.message || 'Report failed');
    } finally {
      setIsReporting(false);
    }
  };

  // Action: "Check this QR"
  const handleCheck = async () => {
    if (!qrText) return;

    setIsChecking(true);
    setErrorMsg(null);

    try {
      const hash = await sha256(qrText);
      setQrHash(hash);

      // 1. Check local Bloom filter first (no network)
      const inBloom = hasFlag(hash);

      if (!inBloom) {
        setCheckResult({
          status: 'safe',
          hash,
          message: 'Not reported. Looks safe',
          checkedLocally: true,
          updatedLive: false
        });
      } else {
        // 2. Read details from local Map (level, reports, ts)
        const details = getFlagDetails(hash);

        if (details) {
          const level = details.level || (details.reports >= 3 ? 'hard' : 'soft');
          setCheckResult({
            status: level,
            hash,
            reports: details.reports,
            ts: details.ts,
            checkedLocally: true,
            updatedLive: false
          });
        } else {
          // Bloom said yes but Map has no details -> possible Bloom false positive. Confirm with server!
          const serverCheck = await checkHashOnServer(hash);
          if (serverCheck && serverCheck.isScam) {
            setCheckResult({
              status: serverCheck.level,
              hash,
              reports: serverCheck.reportsCount,
              ts: serverCheck.reportedAt,
              checkedLocally: false,
              serverConfirmed: true,
              updatedLive: false
            });
          } else {
            setCheckResult({
              status: 'safe',
              hash,
              message: 'Not reported. Looks safe (Server verified Bloom false-positive)',
              checkedLocally: false,
              updatedLive: false
            });
          }
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Check failed');
    } finally {
      setIsChecking(false);
    }
  };

  const isConnected = connStatus === 'connected';

  return (
    <div className="upi-app device-pane-unified">
      {/* Top Header with Device Name and Real Socket Connection Status Dot */}
      <div className="app-header">
        <div className="app-branding">
          <div className="app-logo">🛡️</div>
          <div className="app-title-group">
            <h2 className="app-name">{deviceName}</h2>
            <span className="app-subtitle">Node: {deviceId}</span>
          </div>
        </div>

        {/* Real Socket Connection Indicator (Requirement A & B) */}
        <div className="header-right-tools">
          <div
            className={`connection-pill ${isConnected ? 'conn-online' : 'conn-offline'}`}
            title={`Real Socket status: ${connStatus}`}
          >
            <span className={`conn-dot ${isConnected ? 'dot-connected' : 'dot-reconnecting'}`} />
            <span className="conn-text">{isConnected ? 'Connected' : 'Reconnecting'}</span>
          </div>

          {canRemove && onRemove && (
            <button
              type="button"
              className="btn-remove-device"
              onClick={onRemove}
              title="Remove device"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="app-body">
        {/* Upload & Camera Trigger Bar */}
        <div className="qr-input-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-upload-qr"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            📁 Upload QR image
          </button>

          <button
            type="button"
            className={`btn btn-camera-qr ${isCameraActive ? 'camera-active' : ''}`}
            onClick={handleToggleCamera}
          >
            {isCameraActive ? '⏹ Stop Camera' : '📷 Use Camera'}
          </button>
        </div>

        {/* Quick Sample Selector for Easy Testing */}
        <div className="sample-quick-bar">
          <span className="sample-bar-label">Quick sample:</span>
          <button
            type="button"
            className="btn-sample-chip"
            onClick={() => handleLoadSample('/samples/fake-shop-1.png')}
          >
            Fake Shop 1
          </button>
          <button
            type="button"
            className="btn-sample-chip"
            onClick={() => handleLoadSample('/samples/fake-shop-2.png')}
          >
            Fake Shop 2
          </button>
          <button
            type="button"
            className="btn-sample-chip safe"
            onClick={() => handleLoadSample('/samples/safe-store.png')}
          >
            Safe Store
          </button>
        </div>

        {/* Camera Live Stream Viewport */}
        {isCameraActive && (
          <div className="camera-live-box">
            <video ref={videoRef} className="camera-video" />
            <div className="camera-scanner-laser" />
            <span className="camera-hint">Point at a QR code to decode...</span>
          </div>
        )}

        {/* QR Image Preview & Decoded Payload Box */}
        {previewUrl && !isCameraActive && (
          <div className="qr-preview-box">
            <img src={previewUrl} alt="QR Code Preview" className="preview-img" />
          </div>
        )}

        {/* Decoded QR Text Display */}
        {qrText && (
          <div className="decoded-text-box">
            <div className="decoded-header">
              <span className="decoded-label">Decoded QR Text:</span>
              {qrHash && <span className="hash-chip" title={qrHash}>hash: {qrHash.slice(0, 10)}...</span>}
            </div>
            <div className="decoded-string">{qrText}</div>
          </div>
        )}

        {/* Error notification banner */}
        {errorMsg && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{errorMsg}</span>
            <button type="button" className="error-dismiss" onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        {/* Action Buttons: "Report as scam" & "Check this QR" */}
        <div className="action-buttons-row">
          <button
            type="button"
            className="btn btn-action-report"
            onClick={handleReport}
            disabled={!qrText || isReporting}
          >
            {isReporting ? 'Reporting...' : '🚨 Report as scam'}
          </button>

          <button
            type="button"
            className="btn btn-action-check"
            onClick={handleCheck}
            disabled={!qrText || isChecking}
          >
            {isChecking ? 'Checking...' : '🔍 Check this QR'}
          </button>
        </div>

        {/* Report Server Response Banner */}
        {reportResult && (
          <div className="confirmation-card green-confirmation" role="alert">
            <div className="confirmation-header">
              <span className="check-icon">✓</span>
              <strong className="confirmation-title">
                {reportResult.duplicate ? 'Report already counted' : 'Report recorded by server'}
              </strong>
            </div>
            <p className="confirmation-timestamp">
              Timestamp: {reportResult.timestamp} | Level: <strong>{String(reportResult.level || '').toUpperCase()}</strong> ({reportResult.reports} report{reportResult.reports !== 1 ? 's' : ''})
            </p>
          </div>
        )}

        {/* Check Result Screen / Card */}
        {checkResult && (
          <div className={`check-result-container result-${checkResult.status} ${checkResult.status === 'hard' ? 'anim-shake-pulse' : ''}`}>
            {checkResult.updatedLive && (
              <div className="updated-live-pill">
                <span className="blinking-dot" /> Updated live via Socket.IO
              </div>
            )}

            {checkResult.status === 'safe' && (
              <div className="check-card safe-card">
                <div className="result-icon-badge safe-icon">✓</div>
                <h3 className="result-title safe-text">Not reported. Looks safe</h3>
                <p className="result-desc">
                  No scam reports found in the on-device Bloom filter.
                </p>
              </div>
            )}

            {checkResult.status === 'soft' && (
              <div className="check-card soft-card">
                <div className="result-icon-badge soft-icon">⚠️</div>
                <h3 className="result-title soft-text">
                  Proceed with caution. Reported by {checkResult.reports} user{checkResult.reports > 1 ? 's' : ''}
                </h3>
                <p className="result-desc">
                  A community member reported this QR code as suspicious.
                </p>
              </div>
            )}

            {checkResult.status === 'hard' && (
              <div className="check-card hard-card">
                <div className="result-icon-badge hard-icon">🛑</div>
                <h3 className="result-title hard-text">
                  SCAM DETECTED, reported by {checkResult.reports} users
                </h3>
                <p className="result-desc hard-alert-text">
                  High confidence fraud match! Multiple community reports received.
                </p>
              </div>
            )}

            {/* Local Bloom verification note */}
            <div className="checked-locally-badge">
              <span className="badge-shield-icon">⚡</span>
              <span>Checked locally. No server call</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
