import React from 'react';

/**
 * PhoneFrame - Reusable mobile device container
 * Features realistic bezel, camera notch / dynamic island, status bar, and home indicator.
 */
export default function PhoneFrame({ deviceName, roleName, statusTag, statusType = 'normal', children }) {
  // Current time display (formatted like 09:41)
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="phone-wrapper">
      {/* Device Header label above the frame */}
      <div className="device-header-pill">
        <div className="device-title-group">
          <span className="device-dot" data-status={statusType} />
          <span className="device-title">{deviceName}</span>
          <span className="device-role">({roleName})</span>
        </div>
        {statusTag && (
          <span className={`device-status-badge ${statusType}`}>
            {statusTag}
          </span>
        )}
      </div>

      {/* Physical Phone Frame */}
      <div className="phone-chassis">
        {/* Top Speaker Ear-piece */}
        <div className="phone-speaker" />

        {/* Dynamic Island / Camera Notch */}
        <div className="phone-notch">
          <div className="notch-camera" />
          <div className="notch-sensor" />
        </div>

        {/* Status Bar */}
        <div className="phone-status-bar">
          <span className="status-time">{currentTime}</span>
          <div className="status-icons">
            {/* 5G icon */}
            <svg className="icon-5g" width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
              <path d="M1 9h2V5h2v4h2V3H1v6zm8-6h4v1.5h-2.5V6H13v3H9V3zm1.5 4.5h2v-1h-2v1z" opacity="0.9"/>
            </svg>
            {/* Wifi Icon */}
            <svg width="14" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3c3.5 0 6.6 1.4 8.8 3.7L15.3 8C13.4 6.1 10.8 5 8 5s-5.4 1.1-7.3 3L-0.8 6.7C1.4 4.4 4.5 3 8 3zm0 4c2.4 0 4.5 1 6.1 2.6L12.7 11C11.5 9.7 9.8 9 8 9s-3.5.7-4.7 2L1.9 9.6C3.5 8 5.6 7 8 7zm0 4c1.3 0 2.4.5 3.3 1.4L8 15.6 4.7 12.4C5.6 11.5 6.7 11 8 11z"/>
            </svg>
            {/* Battery Icon */}
            <div className="status-battery">
              <div className="battery-level" />
            </div>
          </div>
        </div>

        {/* App Viewport / Screen content */}
        <div className="phone-viewport">
          {children}
        </div>

        {/* Bottom Home Indicator Bar */}
        <div className="phone-home-indicator">
          <div className="home-bar" />
        </div>
      </div>
    </div>
  );
}
