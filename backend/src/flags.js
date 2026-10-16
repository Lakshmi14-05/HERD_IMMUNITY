const crypto = require('crypto');
const config = require('./config');
const { redis, redisPub } = require('./redis');

/**
 * Computes SHA-256 hex digest of a trimmed string.
 * @param {string} str
 * @returns {string}
 */
function sha256(str) {
  return crypto.createHash('sha256').update(str.trim()).digest('hex');
}

/**
 * Rate limit check: max 5 reports per 60 seconds per reporterId.
 * @param {string} reporterId
 * @returns {Promise<boolean>} true if allowed, false if rate limited
 */
async function checkRateLimit(reporterId) {
  const key = `ratelimit:${reporterId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, config.RATE_LIMIT_WINDOW);
  }
  return count <= config.RATE_LIMIT_MAX;
}

/**
 * Process a report for a UPI ID or QR payload.
 * @param {string} rawId
 * @param {string} reporterId
 * @returns {Promise<{ok: boolean, hash: string, level: ('soft'|'hard'), reports: number, duplicate: boolean}>}
 */
async function processReport(rawId, reporterId) {
  const hash = sha256(rawId);
  const now = Date.now();
  const windowMs = config.WINDOW_SECONDS * 1000;
  const minScore = now - windowMs;
  const sortedSetKey = `reporters:${hash}`;

  // 1. Prune reports older than sliding window
  await redis.zremrangebyscore(sortedSetKey, 0, minScore);

  // 2. Check if this reporter has already reported within active window
  const existingScore = await redis.zscore(sortedSetKey, reporterId);
  if (existingScore !== null && existingScore !== undefined) {
    const reports = await redis.zcard(sortedSetKey);
    const level = reports >= config.HARD_THRESHOLD ? 'hard' : 'soft';
    return {
      ok: true,
      hash,
      level,
      reports,
      duplicate: true,
    };
  }

  // 3. Record new reporter in sorted set (score = timestamp in ms)
  await redis.zadd(sortedSetKey, now, reporterId);
  await redis.expire(sortedSetKey, config.WINDOW_SECONDS * 2);

  // 4. Count unique active reports
  const reports = await redis.zcard(sortedSetKey);
  const level = reports >= config.HARD_THRESHOLD ? 'hard' : 'soft';
  const nowSeconds = Math.floor(now / 1000);

  // 5. Update active flags set & timestamp hash
  await redis.sadd('active_flags', hash);
  await redis.hset('flag_timestamps', hash, nowSeconds.toString());

  // 6. Broadcast to Redis "risk" channel
  const eventPayload = {
    hash,
    level,
    reports,
    ts: nowSeconds,
  };
  await redisPub.publish('risk', JSON.stringify(eventPayload));

  return {
    ok: true,
    hash,
    level,
    reports,
    duplicate: false,
  };
}

/**
 * Get all active flags with expired entries pruned.
 * @returns {Promise<Array<{hash: string, level: string, reports: number, ts: number}>>}
 */
async function getActiveFlags() {
  const hashes = await redis.smembers('active_flags');
  const now = Date.now();
  const windowMs = config.WINDOW_SECONDS * 1000;
  const minScore = now - windowMs;
  const activeFlags = [];

  for (const hash of hashes) {
    const sortedSetKey = `reporters:${hash}`;
    await redis.zremrangebyscore(sortedSetKey, 0, minScore);
    const reports = await redis.zcard(sortedSetKey);

    if (reports === 0) {
      await redis.srem('active_flags', hash);
      await redis.hdel('flag_timestamps', hash);
    } else {
      const tsStr = await redis.hget('flag_timestamps', hash);
      const ts = tsStr ? parseInt(tsStr, 10) : Math.floor(now / 1000);
      const level = reports >= config.HARD_THRESHOLD ? 'hard' : 'soft';
      activeFlags.push({
        hash,
        level,
        reports,
        ts,
      });
    }
  }

  return activeFlags;
}

module.exports = {
  sha256,
  checkRateLimit,
  processReport,
  getActiveFlags,
};
