/**
 * Custom Lightweight On-Device Bloom Filter Service
 * Pure JavaScript & TypedArray (Uint8Array) implementation.
 * Zero external dependencies — 100% browser & web-worker native.
 *
 * Specifications:
 * - 400,000 bits (50,000 bytes = ~50KB)
 * - 7 hash functions computed via Double Hashing:
 *     gi(x) = (h1(x) + i * h2(x)) mod M
 * - Fast 32-bit FNV-1a and Murmur-style hashes
 * - Metadata storage Map: hash -> { level, reports, ts }
 */

// 32-bit FNV-1a hash
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// 32-bit Murmur-style hash
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
   * @param {number} sizeBits - Number of bits in the bitset (default 400,000 bits ≈ 50KB)
   * @param {number} numHashes - Number of hash iterations (default 7)
   */
  constructor(sizeBits = 400000, numHashes = 7) {
    this.sizeBits = sizeBits;
    this.numHashes = numHashes;
    const numBytes = Math.ceil(sizeBits / 8);
    this.bits = new Uint8Array(numBytes);
    // Map for hash -> { level, reports, ts }
    this.metadata = new Map();
  }

  /**
   * Static factory method to maintain API compatibility
   */
  static create(size = 2000, falsePositiveRate = 0.001) {
    return new BloomFilter(400000, 7);
  }

  /**
   * Add a string hash to the filter with optional metadata
   * @param {string} hash
   * @param {object} meta - { level, reports, ts }
   */
  add(hash, meta = null) {
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

    if (meta) {
      this.metadata.set(key, {
        level: meta.level || 'soft',
        reports: meta.reports || 1,
        ts: meta.ts || Date.now()
      });
    }
  }

  /**
   * Check if hash is probably in the filter
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

  /**
   * Get metadata associated with a hash
   * @param {string} hash
   * @returns {object|null}
   */
  getMeta(hash) {
    if (!hash) return null;
    const key = String(hash).trim().toLowerCase();
    return this.metadata.get(key) || null;
  }

  /**
   * Serializes filter to JSON
   */
  saveAsJSON() {
    return {
      type: 'BloomFilter',
      sizeBits: this.sizeBits,
      numHashes: this.numHashes,
      bits: Array.from(this.bits),
      metadata: Array.from(this.metadata.entries())
    };
  }

  /**
   * Reconstitutes filter from JSON
   */
  static fromJSON(json) {
    if (!json) return new BloomFilter();
    const filter = new BloomFilter(json.sizeBits || 400000, json.numHashes || 7);
    if (json.bits && Array.isArray(json.bits)) {
      filter.bits.set(json.bits);
    }
    if (json.metadata && Array.isArray(json.metadata)) {
      filter.metadata = new Map(json.metadata);
    }
    return filter;
  }
}

/**
 * Global map for hash -> { level, reports, ts }
 */
export const hashMetadataMap = new Map();

/**
 * Creates an empty Bloom filter
 */
export function createBloomFilter(size = 2000, falsePositiveRate = 0.001) {
  return new BloomFilter(400000, 7);
}

/**
 * Adds a hashed VPA to the filter and metadata store
 */
export function addHashToFilter(filter, hash, meta = null) {
  if (!filter || !hash) return;
  filter.add(hash, meta);
  if (meta) {
    hashMetadataMap.set(String(hash).toLowerCase(), meta);
  }
}

/**
 * Checks if a hashed VPA exists in the bloom filter
 */
export function hasHashInFilter(filter, hash) {
  if (!filter || !hash) return false;
  return filter.has(hash);
}

/**
 * Retrieves metadata for a hash from filter or global map
 */
export function getHashMeta(filter, hash) {
  if (!hash) return null;
  const key = String(hash).toLowerCase();
  if (filter && typeof filter.getMeta === 'function') {
    const meta = filter.getMeta(key);
    if (meta) return meta;
  }
  return hashMetadataMap.get(key) || null;
}

/**
 * Serializes bloom filter to JSON
 */
export function exportFilter(filter) {
  if (!filter || typeof filter.saveAsJSON !== 'function') return null;
  return filter.saveAsJSON();
}

/**
 * Reconstitutes bloom filter from serialized JSON
 */
export function importFilter(json) {
  return BloomFilter.fromJSON(json);
}

// Global edge filter instance representing Victim B's local on-device filter cache
export const localDeviceBloom = new BloomFilter(400000, 7);
