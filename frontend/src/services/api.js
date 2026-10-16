/**
 * HTTP API Service for Herd Immunity
 * Bridges backend REST endpoints and provides mock fallbacks.
 */
import { API_URL, IS_MOCK } from '../config';
import { networkService } from './socket';
import { hashUpiPayload } from './hash';

/**
 * Report a suspicious UPI QR or VPA
 * @param {string} upiString - Raw UPI URI
 * @returns {Promise<{ success: boolean, timestamp: number, reportersCount: number }>}
 */
export async function submitFraudReport(upiString) {
  const { vpa, hash } = await hashUpiPayload(upiString);
  const payload = {
    vpa,
    hash,
    upiString,
    timestamp: Date.now()
  };

  if (IS_MOCK) {
    // In mock mode, networkService handles simulated local network propagation
    return networkService.reportScam(payload);
  }

  try {
    const response = await fetch(`${API_URL}/api/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('[API] Backend request failed, falling back to mock broadcast:', error);
    // Graceful fallback to local broadcast if backend isn't running yet
    return networkService.reportScam(payload);
  }
}

/**
 * Check fraud status of a UPI identifier
 * @param {string} upiString - Raw UPI URI
 * @returns {Promise<{ isScam: boolean, level: 'safe'|'soft'|'hard', reportersCount: number, reportedAt?: number }>}
 */
export async function checkFraudStatus(upiString) {
  const { vpa, hash } = await hashUpiPayload(upiString);

  if (IS_MOCK) {
    const count = networkService.mockReportCount;
    if (count === 0) {
      return { isScam: false, level: 'safe', reportersCount: 0 };
    }
    const level = count >= 3 ? 'hard' : 'soft';
    return {
      isScam: true,
      level,
      reportersCount: count,
      reportedAt: networkService.mockLastReportTime,
      hash
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/check?hash=${encodeURIComponent(hash)}&vpa=${encodeURIComponent(vpa)}`);
    if (!response.ok) {
      throw new Error(`Check failed with ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[API] Check endpoint unreachable, using local fallback:', error);
    return { isScam: false, level: 'safe', reportersCount: 0 };
  }
}
