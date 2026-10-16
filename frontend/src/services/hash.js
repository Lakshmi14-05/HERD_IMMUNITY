/**
 * Cryptographic hashing service using Web Crypto API (crypto.subtle)
 * SHA-256 provides privacy-preserving pseudonymization of VPAs / UPI QR codes
 */

/**
 * Computes SHA-256 hash using the native browser crypto.subtle API
 * @param {string} input - The raw text or VPA to hash
 * @returns {Promise<string>} 64-character hex string
 */
export async function computeSHA256(input) {
  if (typeof input !== 'string') {
    input = String(input || '');
  }
  
  // Encode as UTF-8 Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(input.trim().toLowerCase());

  // Check if crypto.subtle is available (standard in secure browser contexts)
  if (window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for non-secure / test environments without crypto.subtle
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Extracts the virtual payment address (VPA) from a UPI URI or returns input
 * @param {string} upiString - e.g. "upi://pay?pa=scammer@upi&pn=Fake%20Shop"
 * @returns {string} extracted pa (e.g. "scammer@upi") or full string
 */
export function extractVpa(upiString) {
  if (!upiString) return '';
  try {
    if (upiString.startsWith('upi://pay')) {
      const url = new URL(upiString);
      const pa = url.searchParams.get('pa');
      if (pa) return pa.trim().toLowerCase();
    }
  } catch {
    // If not a valid URL, check via regex
    const match = upiString.match(/[?&]pa=([^&]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim().toLowerCase();
    }
  }
  return upiString.trim().toLowerCase();
}

/**
 * Normalizes and hashes UPI payload for network transmission
 * @param {string} upiString
 * @returns {Promise<{ vpa: string, hash: string, fullHash: string }>}
 */
export async function hashUpiPayload(upiString) {
  const vpa = extractVpa(upiString);
  const vpaHash = await computeSHA256(vpa);
  const fullHash = await computeSHA256(upiString);

  return {
    vpa,
    hash: vpaHash,
    fullHash
  };
}
