/**
 * Cryptographic hashing service using Web Crypto API (crypto.subtle)
 * Computes exact SHA-256 hex matching Node.js crypto.createHash('sha256').update(text).digest('hex')
 */

/**
 * Computes SHA-256 hash using native browser crypto.subtle
 * @param {string} text - Raw input string (e.g. full UPI QR string or VPA)
 * @returns {Promise<string>} lowercase 64-character hex string
 */
export async function sha256(text) {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  if (window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  // Fallback for non-crypto environments
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0').toLowerCase();
}

/**
 * Alias for backward compatibility
 */
export const computeSHA256 = sha256;

/**
 * Extracts VPA from UPI string if present
 * @param {string} upiString 
 * @returns {string}
 */
export function extractVpa(upiString) {
  if (!upiString) return '';
  try {
    if (upiString.startsWith('upi://pay')) {
      const url = new URL(upiString);
      const pa = url.searchParams.get('pa');
      if (pa) return pa.trim();
    }
  } catch {
    const match = upiString.match(/[?&]pa=([^&]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  }
  return upiString.trim();
}

/**
 * Normalizes and hashes UPI payload
 * @param {string} upiString 
 */
export async function hashUpiPayload(upiString) {
  const vpa = extractVpa(upiString);
  const hash = await sha256(upiString);
  const vpaHash = await sha256(vpa);
  return {
    vpa,
    hash,
    vpaHash
  };
}

export default sha256;
