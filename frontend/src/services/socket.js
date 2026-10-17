/**
 * WebSocket & Socket.IO Client Service
 * Connects to VITE_API_URL with websocket + polling fallback.
 * Listens for "flag" event: {"hash": "...", "level": "soft"|"hard", "reports": N, "ts": <unix seconds>}
 * Automatically adds incoming flags to Bloom filter and Map.
 * Provides connection status (Connected / Reconnecting) for UI display.
 */
import { io } from 'socket.io-client';
import { API_URL, IS_MOCK } from '../config';
import { addFlag, resetBloomStorage } from './bloom';
import { sha256 } from './hash';

class NetworkService {
  constructor() {
    this.listeners = new Map();
    this.socket = null;
    this.isOffline = false;
    this.connectionStatus = IS_MOCK ? 'connected' : 'disconnected';
    this.mockReportCount = 0;
    this.mockLastReportTime = null;
    this.localPendingReports = new Map(); // hash -> local timestamp for latency calculation

    if (!IS_MOCK) {
      this.initSocket();
    }
  }

  initSocket() {
    if (this.socket) return;
    try {
      this.socket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        if (!this.isOffline) {
          this.setConnectionStatus('connected');
        }
        console.log('[Socket.IO] Connected to backend:', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        if (!this.isOffline) {
          this.setConnectionStatus('reconnecting');
        }
        console.warn('[Socket.IO] Disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        if (!this.isOffline) {
          this.setConnectionStatus('reconnecting');
        }
        console.warn('[Socket.IO] Connection error:', error.message);
      });

      this.socket.on('reconnect_attempt', () => {
        if (!this.isOffline) {
          this.setConnectionStatus('reconnecting');
        }
      });

      this.socket.on('reconnect', () => {
        if (!this.isOffline) {
          this.setConnectionStatus('connected');
        }
      });

      // Contract: Socket.IO event "flag" payload: {"hash": "...", "level": "soft"|"hard", "reports": N, "ts": <unix seconds>}
      this.socket.on('flag', (flagPayload) => {
        if (!this.isOffline) {
          this.handleIncomingFlag(flagPayload);
        }
      });
    } catch (err) {
      console.error('[Socket.IO] Init error:', err);
      if (!this.isOffline) {
        this.setConnectionStatus('disconnected');
      }
    }
  }

  connectSocket() {
    if (!this.socket) {
      this.initSocket();
    } else if (this.socket.disconnected) {
      this.socket.connect();
    }
  }

  setOffline(isOffline) {
    this.isOffline = Boolean(isOffline);
    if (this.isOffline) {
      this.setConnectionStatus('offline');
    } else {
      if (IS_MOCK) {
        this.setConnectionStatus('connected');
      } else {
        this.setConnectionStatus(this.socket && this.socket.connected ? 'connected' : 'reconnecting');
      }
    }
    this.emitLocal('offline_toggled', this.isOffline);
  }

  setConnectionStatus(status) {
    this.connectionStatus = status;
    this.emitLocal('connection_status', status);
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Processes a received flag payload
   */
  handleIncomingFlag(payload) {
    const { hash, level, reports, ts } = payload;
    if (!hash) return;

    // 1. Add to Bloom filter and Map immediately
    addFlag(hash, { level, reports, ts });

    // 2. Compute latency if this client submitted the report
    const now = Date.now();
    let latencySeconds = '0.1';
    const localPending = this.localPendingReports.get(hash);
    if (localPending) {
      latencySeconds = ((now - localPending) / 1000).toFixed(1);
      this.localPendingReports.delete(hash);
    } else if (ts) {
      // Time difference from timestamp
      const diffSec = Math.max(0, Math.floor(now / 1000) - ts);
      latencySeconds = diffSec <= 2 ? `${diffSec}.0` : `${diffSec}`;
    }

    const flagData = {
      hash,
      level: level || (reports >= 3 ? 'hard' : 'soft'),
      reports: Number(reports || 1),
      reportersCount: Number(reports || 1),
      ts: ts || Math.floor(now / 1000),
      reportedAt: ts ? ts * 1000 : now,
      latencySeconds
    };

    // 3. Emit local events for UI components
    this.emitLocal('flag', flagData);
    this.emitLocal('flag_broadcast', flagData);
    this.emitLocal('network_transmit_complete', flagData);
  }

  /**
   * Tracks local report timestamp to measure arrival latency
   */
  markPendingReport(hash) {
    this.localPendingReports.set(hash, Date.now());
    this.emitLocal('network_transmit_start', {
      hash,
      timestamp: Date.now()
    });
  }

  /**
   * Mock Mode Report Simulation
   */
  mockReportScam({ id, hash, reporterId }) {
    const reportTimestamp = Date.now();
    this.mockReportCount += 1;
    this.mockLastReportTime = reportTimestamp;

    this.markPendingReport(hash);

    // 1st report -> soft, 3rd or more -> hard
    const level = this.mockReportCount >= 3 ? 'hard' : 'soft';

    // 2-second mock network propagation delay
    setTimeout(() => {
      this.handleIncomingFlag({
        hash,
        level,
        reports: this.mockReportCount,
        ts: Math.floor(reportTimestamp / 1000)
      });
    }, 2000);

    return Promise.resolve({
      ok: true,
      hash,
      level,
      reports: this.mockReportCount
    });
  }

  /**
   * Dev Helper: Simulate 3 reporters straight to hard
   */
  async simulateThreeReports(qrString = 'upi://pay?pa=scammer@upi&pn=Fake%20Shop', hash = null) {
    const reportTimestamp = Date.now();
    this.mockReportCount = 3;
    this.mockLastReportTime = reportTimestamp;
    const targetHash = hash || await sha256(qrString);

    this.markPendingReport(targetHash);

    setTimeout(() => {
      this.handleIncomingFlag({
        hash: targetHash,
        level: 'hard',
        reports: 3,
        ts: Math.floor(reportTimestamp / 1000)
      });
    }, 800);
  }

  /**
   * Reset demo state
   */
  resetState() {
    this.mockReportCount = 0;
    this.mockLastReportTime = null;
    this.localPendingReports.clear();
    resetBloomStorage();
    this.emitLocal('reset_state', {});
  }

  // Pub-Sub Event Bus
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emitLocal(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in socket listener for ${event}:`, e);
        }
      });
    }
  }
}

export const networkService = new NetworkService();
export default networkService;
