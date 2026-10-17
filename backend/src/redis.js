const config = require('./config');

let redis;
let redisPub;
let redisSub;

if (config.USE_MOCK_REDIS) {
  const RedisMock = require('ioredis-mock');
  console.log('[Redis] Running with ioredis-mock (zero-setup local mock Redis)');
  redis = new RedisMock();
  redisPub = new RedisMock();
  redisSub = new RedisMock();
} else {
  const Redis = require('ioredis');
  const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...(config.REDIS_URL && config.REDIS_URL.startsWith('rediss://')
      ? { tls: { rejectUnauthorized: false } }
      : {}),
  };
  console.log(
    '[Redis] Connecting to Upstash/Redis at',
    config.REDIS_URL ? config.REDIS_URL.split('@')[1] || 'provided URL' : 'default'
  );
  redis = new Redis(config.REDIS_URL, redisOptions);
  redisPub = new Redis(config.REDIS_URL, redisOptions);
  redisSub = new Redis(config.REDIS_URL, redisOptions);

  redis.on('error', (err) => console.error('[Redis Commands] Error:', err.message));
  redisPub.on('error', (err) => console.error('[Redis Pub] Error:', err.message));
  redisSub.on('error', (err) => console.error('[Redis Sub] Error:', err.message));
}

module.exports = {
  redis,
  redisPub,
  redisSub,
};
