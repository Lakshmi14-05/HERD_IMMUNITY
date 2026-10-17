/**
 * Backend API Service
 * Implements exact contract:
 * - POST /report body: {"id": "<qr string>", "reporterId": "deviceA"} -> {"ok": true, "hash": "...", "level": "soft"|"hard", "reports": N}
 * - GET /flags -> [{hash, level, reports, ts}]
 * - GET /health -> "ok"
 *
 * Includes Render free-tier wake-up handler that polls every 3s if server is sleeping.
 */
import { API_URL, IS_MOCK } from '../config';
import { sha256 } from './hash';
import { addFlag } from './bloom';
import { networkService } from './socket';

/**
 * Report a fraudulent QR code or VPA
 * @param {string} qrString - The exact QR string
 * @param {string} reporterId - Reporter device ID (e.g. 'deviceA', 'deviceC', etc.)
 * @returns {Promise<{ ok: boolean, hash: string, level: 'soft'|'hard', reports: number }>}
 */
export async function reportFraud(qrString, reporterId = 'deviceA') {
  const qrHash = await sha256(qrString);

  if (IS_MOCK) {
    return networkService.mockReportScam({
      id: qrString,
      hash: qrHash,
      reporterId
    });
  }

  try {
    const response = await fetch(`${API_URL}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: qrString,
        reporterId
      })
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded: Please wait a moment before reporting again.');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Report failed (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[API] Error submitting report:', err);
    throw err;
  }
}

/**
 * Fetches all registered fraud flags from the server
 * @returns {Promise<Array<{ hash: string, level: 'soft'|'hard', reports: number, ts: number }>>}
 */
export async function fetchFlags() {
  if (IS_MOCK) {
    return [];
  }

  try {
    const res = await fetch(`${API_URL}/flags`);
    if (!res.ok) {
      throw new Error(`Failed to fetch flags: ${res.status}`);
    }
    const flags = await res.json();
    if (Array.isArray(flags)) {
      for (const item of flags) {
        if (item && item.hash) {
          addFlag(item.hash, {
            level: item.level,
            reports: item.reports,
            ts: item.ts
          });
        }
      }
    }
    return flags;
  } catch (err) {
    console.warn('[API] Could not fetch initial flags from backend:', err.message);
    return [];
  }
}

/**
 * Check backend health status with timeout
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth(timeoutMs = 3000) {
  if (IS_MOCK) return true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const text = await res.text();
    return text.trim().toLowerCase() === 'ok';
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Polls backend health when sleeping on free Render tier
 * If health check takes >3s or fails, calls onWakingUp(true) and retries every 3s.
 * Once awake, calls onAwake() and onWakingUp(false).
 */
export async function ensureBackendAwake(onWakingUp, onAwake) {
  if (IS_MOCK) {
    if (onAwake) onAwake();
    return true;
  }

  let isAwake = false;
  let timerFired = false;

  // If initial health check takes more than 3s, show the waking-up banner
  const wakingTimeout = setTimeout(() => {
    if (!isAwake) {
      timerFired = true;
      if (onWakingUp) onWakingUp(true);
    }
  }, 3000);

  // Check first attempt
  isAwake = await checkBackendHealth(3000);

  if (isAwake) {
    clearTimeout(wakingTimeout);
    if (timerFired && onWakingUp) onWakingUp(false);
    if (onAwake) onAwake();
    return true;
  }

  // If not awake, show waking banner and poll every 3 seconds
  if (onWakingUp) onWakingUp(true);

  return new Promise((resolve) => {
    const intervalId = setInterval(async () => {
      const ok = await checkBackendHealth(2800);
      if (ok) {
        clearInterval(intervalId);
        clearTimeout(wakingTimeout);
        if (onWakingUp) onWakingUp(false);
        if (onAwake) onAwake();
        resolve(true);
      }
    }, 3000);
  });
}

// Aliases for compatibility
export const submitFraudReport = (qrString, reporterId = 'deviceA') => reportFraud(qrString, reporterId);
export default {
  reportFraud,
  fetchFlags,
  checkBackendHealth,
  ensureBackendAwake
};
