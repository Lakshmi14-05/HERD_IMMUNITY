/**
 * Real Backend API Client
 * Endpoints:
 * - POST {API_URL}/report -> { ok: true, hash, level, reports }
 * - GET  {API_URL}/flags  -> [{ hash, level, reports, ts }]
 * - GET  {API_URL}/health -> "ok"
 * - GET  {API_URL}/api/check?hash=<hash> -> { isScam, level, reportsCount, reportedAt, hash }
 */
import { API_URL } from '../config';
import { addFlag } from './bloom';

/**
 * Report a scam QR payload to the real backend
 * @param {string} qrString - The exact decoded QR text
 * @param {string} reporterId - Device reporter ID ('deviceA', 'deviceB', 'deviceC', 'deviceD')
 * @returns {Promise<{ ok: boolean, hash: string, level: 'soft'|'hard', reports: number, duplicate?: boolean }>}
 */
export async function reportScam(qrString, reporterId) {
  const cleanId = String(qrString ?? '').trim();
  const cleanReporter = String(reporterId ?? '').trim();

  if (!cleanId) {
    throw new Error('QR payload is empty');
  }

  try {
    const response = await fetch(`${API_URL}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: cleanId,
        reporterId: cleanReporter
      })
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded: Max 5 reports per minute per device.');
    }

    if (!response.ok) {
      let errDetail = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errDetail = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(`Report failed (${response.status}): ${errDetail}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error(`Backend server unreachable at ${API_URL}. Please verify the server is running.`);
    }
    throw err;
  }
}

/**
 * Prefills Bloom filter + Map from GET /flags
 * @returns {Promise<Array<{ hash: string, level: string, reports: number, ts: number }>>}
 */
export async function fetchFlags() {
  try {
    const res = await fetch(`${API_URL}/flags`);
    if (!res.ok) {
      throw new Error(`Failed to fetch flags: HTTP ${res.status}`);
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
    console.warn('[API] fetchFlags failed:', err.message);
    return [];
  }
}

/**
 * Fallback confirmation for Bloom filter false-positives
 * GET /api/check?hash=<hash>
 * @param {string} hash
 * @returns {Promise<{ isScam: boolean, level: 'soft'|'hard', reportsCount: number, reportedAt?: number, hash: string }>}
 */
export async function checkHashOnServer(hash) {
  try {
    const res = await fetch(`${API_URL}/api/check?hash=${encodeURIComponent(hash)}`);
    if (!res.ok) {
      throw new Error(`Check failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data && data.isScam) {
      addFlag(hash, {
        level: data.level,
        reports: data.reportersCount,
        ts: data.reportedAt ? Math.floor(data.reportedAt / 1000) : Math.floor(Date.now() / 1000)
      });
    }
    return data;
  } catch (err) {
    console.warn('[API] checkHashOnServer error:', err.message);
    return { isScam: false, level: 'safe', reportsCount: 0, hash };
  }
}

/**
 * Polls backend health when waking from sleep
 */
export async function ensureBackendAwake(onWakingUp, onAwake) {
  let isAwake = false;
  let timerFired = false;

  const wakingTimeout = setTimeout(() => {
    if (!isAwake) {
      timerFired = true;
      if (onWakingUp) onWakingUp(true);
    }
  }, 3000);

  const checkOnce = async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 2800);
      const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) return false;
      const text = await res.text();
      return text.trim() === 'ok';
    } catch {
      return false;
    }
  };

  isAwake = await checkOnce();
  if (isAwake) {
    clearTimeout(wakingTimeout);
    if (timerFired && onWakingUp) onWakingUp(false);
    if (onAwake) onAwake();
    return true;
  }

  if (onWakingUp) onWakingUp(true);

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const ok = await checkOnce();
      if (ok) {
        clearInterval(interval);
        clearTimeout(wakingTimeout);
        if (onWakingUp) onWakingUp(false);
        if (onAwake) onAwake();
        resolve(true);
      }
    }, 3000);
  });
}

export default {
  reportScam,
  fetchFlags,
  checkHashOnServer,
  ensureBackendAwake
};
