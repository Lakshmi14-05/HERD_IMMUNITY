const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const config = require('./src/config');
const { redisSub } = require('./src/redis');
const { checkRateLimit, processReport, getActiveFlags } = require('./src/flags');

const app = express();
const server = http.createServer(app);

// CORS open to all origins for both Express and Socket.IO
app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO client connection logging
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Redis Subscriber: dedicated connection listening on "risk" channel
redisSub.subscribe('risk', (err) => {
  if (err) {
    console.error('[Redis Sub] Error subscribing to channel "risk":', err);
  } else {
    console.log('[Redis Sub] Listening for messages on channel "risk"');
  }
});

redisSub.on('message', (channel, message) => {
  if (channel === 'risk') {
    try {
      const payload = JSON.parse(message);
      console.log('[Redis Sub] Relaying risk flag to Socket.IO:', payload);
      io.emit('flag', payload);
    } catch (err) {
      console.error('[Redis Sub] Failed to parse message on "risk":', err);
    }
  }
});

// GET /health - returns plain text "ok"
app.get('/health', (req, res) => {
  res.type('text/plain').status(200).send('ok');
});

// POST /report
app.post('/report', async (req, res) => {
  try {
    const { id, reporterId } = req.body || {};

    // Validate that both are non-empty strings, otherwise 400
    if (
      typeof id !== 'string' ||
      !id.trim() ||
      typeof reporterId !== 'string' ||
      !reporterId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: 'id and reporterId must be non-empty strings',
      });
    }

    const cleanId = id.trim();
    const cleanReporterId = reporterId.trim();

    // Check rate limit before anything else
    const allowed = await checkRateLimit(cleanReporterId);
    if (!allowed) {
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    // Process the report
    const result = await processReport(cleanId, cleanReporterId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[POST /report] Internal Error:', err);
    return res.status(500).json({ ok: false, error: 'internal_server_error' });
  }
});

// GET /flags - returns [{hash, level, reports, ts}] for all active flags
app.get('/flags', async (req, res) => {
  try {
    const flags = await getActiveFlags();
    return res.status(200).json(flags);
  } catch (err) {
    console.error('[GET /flags] Internal Error:', err);
    return res.status(500).json({ ok: false, error: 'internal_server_error' });
  }
});

// Start HTTP + WebSocket Server
server.listen(config.PORT, () => {
  console.log(`[Server] Herd Immunity Backend listening on port ${config.PORT}`);
  console.log(
    `[Server Config] Mock Redis: ${config.USE_MOCK_REDIS} | Window: ${config.WINDOW_SECONDS}s | Hard Threshold: ${config.HARD_THRESHOLD}`
  );
});

module.exports = { app, server, io };
