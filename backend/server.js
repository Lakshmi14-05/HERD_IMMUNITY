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

  // Compatibility listener: handle socket.emit('report_scam') from frontend if called
  socket.on('report_scam', async (payload) => {
    try {
      const rawId = payload?.id || payload?.upiString || payload?.vpa;
      const reporterId = payload?.reporterId || `socket_${socket.id}`;
      if (rawId && typeof rawId === 'string' && rawId.trim()) {
        const allowed = await checkRateLimit(reporterId);
        if (allowed) {
          await processReport(rawId.trim(), reporterId);
        }
      }
    } catch (err) {
      console.error('[Socket.IO report_scam] Error:', err);
    }
  });

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

      // Canonical event: "flag" with exact required contract
      io.emit('flag', payload);

      // Compatibility event for frontend mock listener: "fraud_broadcast"
      io.emit('fraud_broadcast', {
        ...payload,
        reportersCount: payload.reports,
        timestamp: payload.ts * 1000,
      });
    } catch (err) {
      console.error('[Redis Sub] Failed to parse message on "risk":', err);
    }
  }
});

// GET /health - returns plain text "ok"
app.get('/health', (req, res) => {
  res.type('text/plain').status(200).send('ok');
});

// Helper handler for report endpoints
async function handleReport(req, res) {
  try {
    const rawId = req.body?.id || req.body?.upiString || req.body?.vpa;
    const rawReporterId =
      req.body?.reporterId || (req.ip ? `device_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}` : 'anonymous');

    // Validate that both are non-empty strings, otherwise 400
    if (
      typeof rawId !== 'string' ||
      !rawId.trim() ||
      typeof rawReporterId !== 'string' ||
      !rawReporterId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: 'id and reporterId must be non-empty strings',
      });
    }

    const cleanId = rawId.trim();
    const cleanReporterId = rawReporterId.trim();

    // Check rate limit before anything else
    const allowed = await checkRateLimit(cleanReporterId);
    if (!allowed) {
      return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    // Process the report
    const result = await processReport(cleanId, cleanReporterId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Report Handler] Internal Error:', err);
    return res.status(500).json({ ok: false, error: 'internal_server_error' });
  }
}

// POST /report (Canonical API Contract)
app.post('/report', handleReport);

// POST /api/report (Compatibility alias for frontend)
app.post('/api/report', handleReport);

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

// GET /api/check (Compatibility endpoint for frontend checkFraudStatus)
app.get('/api/check', async (req, res) => {
  try {
    const { hash } = req.query;
    const flags = await getActiveFlags();
    const match = flags.find((f) => f.hash === hash);
    if (!match) {
      return res.status(200).json({ isScam: false, level: 'safe', reportersCount: 0 });
    }
    return res.status(200).json({
      isScam: true,
      level: match.level,
      reportersCount: match.reports,
      reportedAt: match.ts * 1000,
      hash: match.hash,
    });
  } catch (err) {
    console.error('[GET /api/check] Internal Error:', err);
    return res.status(500).json({ isScam: false, level: 'safe', reportersCount: 0 });
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
