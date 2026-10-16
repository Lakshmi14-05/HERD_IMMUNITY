/**
 * WebSocket & Network Event Synchronization Service
 * Supports live socket.io connection as well as mock mode simulation.
 */
import { io } from 'socket.io-client';
import { API_URL, IS_MOCK } from '../config';

class NetworkService {
  constructor() {
    this.listeners = new Map();
    this.socket = null;
    this.mockReportCount = 0;
    this.mockLastReportTime = null;

    if (!IS_MOCK) {
      this.initRealSocket();
    }
  }

  initRealSocket() {
    try {
      this.socket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 5000
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to Herd Immunity backend:', this.socket.id);
        this.emitLocal('connected', { id: this.socket.id });
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected from backend');
        this.emitLocal('disconnected', {});
      });

      this.socket.on('fraud_broadcast', (data) => {
        this.emitLocal('flag_broadcast', data);
      });

      this.socket.on('bloom_sync', (data) => {
        this.emitLocal('bloom_sync', data);
      });
    } catch (err) {
      console.warn('[Socket] Failed to initialize socket.io:', err);
    }
  }

  // Subscribe to local or network events
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
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Broadcast a scam report from Device A
   * @param {object} payload - { vpa, hash, upiString, reporterId, timestamp }
   */
  reportScam(payload) {
    const reportTimestamp = payload.timestamp || Date.now();

    // Notify visual network pipeline immediately (start pulse animation)
    this.emitLocal('network_transmit_start', {
      ...payload,
      timestamp: reportTimestamp
    });

    if (IS_MOCK) {
      this.mockReportCount += 1;
      this.mockLastReportTime = reportTimestamp;

      // Determine level: 1st report -> soft, 3rd report or higher -> hard
      const level = this.mockReportCount >= 3 ? 'hard' : (this.mockReportCount === 1 ? 'soft' : 'soft');

      // 2 seconds propagation delay as per requirement
      setTimeout(() => {
        const arrivalTimestamp = Date.now();
        const latencySeconds = ((arrivalTimestamp - reportTimestamp) / 1000).toFixed(1);

        const flagData = {
          vpa: payload.vpa || 'scammer@upi',
          hash: payload.hash,
          upiString: payload.upiString,
          level, // 'soft' | 'hard'
          reportersCount: this.mockReportCount,
          reportedAt: reportTimestamp,
          receivedAt: arrivalTimestamp,
          latencySeconds: latencySeconds
        };

        this.emitLocal('flag_broadcast', flagData);
        this.emitLocal('network_transmit_complete', flagData);
      }, 2000);

      return Promise.resolve({
        success: true,
        reportersCount: this.mockReportCount,
        timestamp: reportTimestamp
      });
    } else {
      if (this.socket && this.socket.connected) {
        this.socket.emit('report_scam', payload);
      }
      return Promise.resolve({ success: true, timestamp: reportTimestamp });
    }
  }

  /**
   * Dev helper to simulate 3 reports going straight to hard alert
   */
  simulateThreeReports(payload = {}) {
    const reportTimestamp = Date.now();
    this.mockReportCount = 3;
    this.mockLastReportTime = reportTimestamp;

    this.emitLocal('network_transmit_start', {
      ...payload,
      timestamp: reportTimestamp,
      simulated: true
    });

    // Short 800ms animation for instant dev preview
    setTimeout(() => {
      const arrivalTimestamp = Date.now();
      const latencySeconds = ((arrivalTimestamp - reportTimestamp) / 1000).toFixed(1);

      const flagData = {
        vpa: payload.vpa || 'scammer@upi',
        hash: payload.hash || 'mock-sha256-hash',
        upiString: payload.upiString || 'upi://pay?pa=scammer@upi&pn=Fake%20Shop',
        level: 'hard',
        reportersCount: 3,
        reportedAt: reportTimestamp,
        receivedAt: arrivalTimestamp,
        latencySeconds: latencySeconds
      };

      this.emitLocal('flag_broadcast', flagData);
      this.emitLocal('network_transmit_complete', flagData);
    }, 800);
  }

  /**
   * Resets mock state back to fresh clean state
   */
  resetMock() {
    this.mockReportCount = 0;
    this.mockLastReportTime = null;
    this.emitLocal('reset_state', {});
  }
}

export const networkService = new NetworkService();
export default networkService;
