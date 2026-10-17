const { io } = require('socket.io-client');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
console.log(`Connecting Socket.IO client to ${BASE_URL}...`);

const socket = io(BASE_URL, {
  transports: ['websocket', 'polling'],
  timeout: 5000,
});

const testId = `upi://pay?pa=sock_scam_${Date.now()}_${Math.floor(Math.random() * 1000)}@upi`;
const expectedHash = crypto.createHash('sha256').update(testId.trim()).digest('hex');
const reporterId = `device_sock_${Date.now()}`;

let timeoutId;

timeoutId = setTimeout(() => {
  console.error('FAILED: Timed out waiting for "flag" Socket.IO event after 5 seconds');
  socket.disconnect();
  process.exit(1);
}, 5000);

socket.on('connect', async () => {
  console.log(`Socket connected with id: ${socket.id}`);

  // Once connected, trigger a report via POST /report
  try {
    console.log(`Sending POST /report with ID: ${testId}`);
    const res = await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: testId, reporterId }),
    });

    const data = await res.json();
    console.log('POST /report response:', data);

    if (!data.ok) {
      console.error('POST /report failed:', data);
      clearTimeout(timeoutId);
      socket.disconnect();
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to send POST /report:', err.message);
    clearTimeout(timeoutId);
    socket.disconnect();
    process.exit(1);
  }
});

socket.on('flag', (payload) => {
  console.log('Received "flag" event payload:', payload);

  if (payload.hash === expectedHash) {
    console.log('SUCCESS: Received matching "flag" event for reported hash!');
    console.log(`Hash: ${payload.hash}`);
    console.log(`Level: ${payload.level}`);
    console.log(`Reports: ${payload.reports}`);
    console.log(`Timestamp: ${payload.ts}`);
    clearTimeout(timeoutId);
    socket.disconnect();
    process.exit(0);
  }
});

socket.on('connect_error', (err) => {
  console.error('Socket connect error:', err.message);
});
