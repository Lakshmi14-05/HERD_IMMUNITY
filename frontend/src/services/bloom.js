/**
 * Bloom Filter Service (~50KB Uint8Array bit array, 7 hash functions)
 * Double hashing: gi(x) = (h1(x) + i * h2(x)) mod M
 * Methods: add(hash), has(hash)
 * Keeps a Map: hash -> { level, reports, ts }
 */

// 32-bit FNV-1a
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// 32-bit Murmur32-style
function murmur32(str) {
  let hash = 0x9747b28c;
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    hash ^= k;
    hash = (hash << 13) | (hash >>> 19);
    hash = (Math.imul(hash, 5) + 0xe6546b64) | 0;
  }
  hash ^= str.length;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export class BloomFilter {
  /**
   * @param {number} sizeBits - 400,000 bits (50,000 bytes = ~50KB)
   * @param {number} numHashes - 7 hash functions
   */
  constructor(sizeBits = 400000, numHashes = 7) {
    this.sizeBits = sizeBits;
    this.numHashes = numHashes;
    this.bits = new Uint8Array(Math.ceil(sizeBits / 8));
  }

  /**
   * Adds a lowercase hex hash to the Bloom filter
   * @param {string} hash 
   */
  add(hash) {
    if (!hash) return;
    const key = String(hash).trim().toLowerCase();
    const h1 = fnv1a(key);
    let h2 = murmur32(key);
    if (h2 === 0) h2 = 1;

    for (let i = 0; i < this.numHashes; i++) {
      const bitIndex = ((h1 + i * h2) >>> 0) % this.sizeBits;
      const byteIndex = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      this.bits[byteIndex] |= (1 << bitOffset);
    }
  }

  /**
   * Checks if hash is in the Bloom filter
   * @param {string} hash 
   * @returns {boolean}
   */
  has(hash) {
    if (!hash) return false;
    const key = String(hash).trim().toLowerCase();
    const h1 = fnv1a(key);
    let h2 = murmur32(key);
    if (h2 === 0) h2 = 1;

    for (let i = 0; i < this.numHashes; i++) {
      const bitIndex = ((h1 + i * h2) >>> 0) % this.sizeBits;
      const byteIndex = bitIndex >> 3;
      const bitOffset = bitIndex & 7;
      if ((this.bits[byteIndex] & (1 << bitOffset)) === 0) {
        return false;
      }
    }
    return true;
  }

  clear() {
    this.bits.fill(0);
  }
}

// Global Map: hash -> { level, reports, ts }
export const hashDetailsMap = new Map();

// Default on-device Bloom filter singleton
export const localDeviceBloom = new BloomFilter(400000, 7);

/**
 * Register or update a flag in both the Bloom filter and the details Map
 * @param {string} hash 
 * @param {{ level: 'soft'|'hard', reports: number, ts: number }} details 
 */
export function addFlag(hash, details = null) {
  if (!hash) return;
  const key = String(hash).trim().toLowerCase();
  localDeviceBloom.add(key);

  if (details) {
    hashDetailsMap.set(key, {
      level: details.level || 'soft',
      reports: Number(details.reports || 1),
      ts: Number(details.ts || Math.floor(Date.now() / 1000))
    });
  }
}

/**
 * Check if a hash is flagged in the Bloom filter
 * @param {string} hash 
 * @returns {boolean}
 */
export function hasFlag(hash) {
  if (!hash) return false;
  return localDeviceBloom.has(String(hash).trim().toLowerCase());
}

/**
 * Get details for a flagged hash from the Map
 * @param {string} hash 
 * @returns {{ level: 'soft'|'hard', reports: number, ts: number }|null}
 */
export function getFlagDetails(hash) {
  if (!hash) return null;
  return hashDetailsMap.get(String(hash).trim().toLowerCase()) || null;
}

/**
 * Reset both Bloom filter and Map
 */
export function resetBloomStorage() {
  localDeviceBloom.clear();
  hashDetailsMap.clear();
}

// Compatibility wrappers for existing components
export const addHashToFilter = (filter, hash, meta) => {
  if (filter && typeof filter.add === 'function') filter.add(hash);
  else localDeviceBloom.add(hash);
  if (meta && hash) {
    hashDetailsMap.set(String(hash).trim().toLowerCase(), meta);
  }
};
export const hasHashInFilter = (filter, hash) => {
  if (filter && typeof filter.has === 'function') return filter.has(hash);
  return localDeviceBloom.has(hash);
};
export const createBloomFilter = () => new BloomFilter(400000, 7);
export const hashMetadataMap = hashDetailsMap;
