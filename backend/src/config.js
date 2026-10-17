const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  REDIS_URL: process.env.REDIS_URL || '',
  USE_MOCK_REDIS:
    process.env.USE_MOCK_REDIS === 'true' ||
    (!process.env.REDIS_URL && process.env.USE_MOCK_REDIS !== 'false'),
  WINDOW_SECONDS: parseInt(process.env.WINDOW_SECONDS, 10) || 300,
  HARD_THRESHOLD: parseInt(process.env.HARD_THRESHOLD, 10) || 3,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5,
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60,
};

module.exports = config;
