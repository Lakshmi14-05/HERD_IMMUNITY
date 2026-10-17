/**
 * Real Socket.IO Client Service
 * Connects to VITE_API_URL (websocket + polling fallback).
 * Listens for real backend event: "flag" ({ hash, level, reports, ts })
 * Updates on-device Bloom filter + Map in real time.
 */
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { addFlag } from './bloom';

class NetworkService {
  constructor() {
    this.listeners = new Map();
    this.socket = null;
    this.connectionStatus = 'disconnected';

    this.initSocket();
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
        this.setConnectionStatus('connected');
        console.log('[Socket.IO] Connected to backend:', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        this.setConnectionStatus('reconnecting');
        console.warn('[Socket.IO] Disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.setConnectionStatus('reconnecting');
        console.warn('[Socket.IO] Connection error:', error.message);
      });

      this.socket.on('reconnect_attempt', () => {
        this.setConnectionStatus('reconnecting');
      });

      this.socket.on('reconnect', () => {
        this.setConnectionStatus('connected');
      });

      // Canonical event from backend: "flag" with { hash, level, reports, ts }
      this.socket.on('flag', (payload) => {
        if (!payload || !payload.hash) return;
        console.log('[Socket.IO] Received flag broadcast:', payload);

        // 1. Update on-device Bloom filter and Map immediately
        addFlag(payload.hash, {
          level: payload.level,
          reports: payload.reports,
          ts: payload.ts
        });

        // 2. Dispatch to all active device panes for live in-place screen updates
        this.emitLocal('flag', {
          hash: payload.hash.trim().toLowerCase(),
          level: payload.level,
          reports: Number(payload.reports || 1),
          ts: Number(payload.ts || Math.floor(Date.now() / 1000))
        });
      });
    } catch (err) {
      console.error('[Socket.IO] Initialization error:', err);
      this.setConnectionStatus('disconnected');
    }
  }

  setConnectionStatus(status) {
    this.connectionStatus = status;
    this.emitLocal('connection_status', status);
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  connectSocket() {
    if (!this.socket) {
      this.initSocket();
    } else if (this.socket.disconnected) {
      this.socket.connect();
    }
  }

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
      this.listeners.get(event).forEach((cb) => {
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
