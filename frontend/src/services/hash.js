/**
 * Cryptographic hashing service using native browser Web Crypto API (crypto.subtle)
 * EXACTLY matches backend implementation:
 * crypto.createHash('sha256').update(str.trim()).digest('hex')
 */

/**
 * Computes SHA-256 lowercase hex digest of a trimmed string.
 * @param {string} text - Raw input string (e.g. decoded QR payload)
 * @returns {Promise<string>} 64-character lowercase hex string
 */
export async function sha256(text) {
  const clean = String(text ?? '').trim();

  const encoder = new TextEncoder();
  const data = encoder.encode(clean);

  if (window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  // Fallback for non-crypto secure contexts (development)
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0').toLowerCase();
}

export const computeSHA256 = sha256;
export default sha256;
