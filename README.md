# HERD_IMMUNITY
Herd Immunity is a real-time UPI fraud prevention network that shares suspicious QR codes and VPAs across users within seconds. Using Redis/Kafka, on-device Bloom filters, and community-driven reports, it delivers instant risk warnings, works offline, and protects users through collective intelligence and privacy-preserving hashing.



#BACKEND
Step 1: Upstash (Free Cloud Redis)
Go to https://console.upstash.com/ and sign up or log in.
Click Create Database.
Name it herd-immunity-redis, select your preferred region (e.g., closest to your Render server), and select the Free tier.
Click Create.
In the database details page, scroll down to the Node.js or ioredis section.
Copy the connection URL starting with rediss://default:.... This is your REDIS_URL.
Step 2: Render (Free Web Service)
Go to https://dashboard.render.com/ and click New + -> Web Service.
Connect your GitHub repository: Lakshmi14-05/HERD_IMMUNITY.
Configure settings:
Name: herd-immunity-backend
Root Directory: backend
Environment: Node
Build Command: npm install
Start Command: npm start
Plan: Free
In Environment Variables, add:
REDIS_URL: <your-rediss-url-from-upstash>
USE_MOCK_REDIS: false
WINDOW_SECONDS: 300
HARD_THRESHOLD: 3
Click Create Web Service.
Once deployed, Render provides a public URL (e.g. https://herd-immunity-backend.onrender.com).
Test the deployment:
bash test.sh https://herd-immunity-backend.onrender.com
⚠️ Render Free Tier Note: Free tier web services go to sleep after 15 minutes of inactivity. The first request after sleeping may take 30–50 seconds to wake up the server.

🤝 Teammate Integration Guide
React + Vite Connection 

Example:
import { io } from 'socket.io-client';

const BACKEND_URL = 'https://herd-immunity-backend.onrender.com'; // or http://localhost:3000 for local dev

// 1. Initialize Socket.IO connection
export const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to Herd Immunity backend:', socket.id);
});

// 2. Listen for real-time fraud alerts
socket.on('flag', ({ hash, level, reports, ts }) => {
  console.log(`Alert! Hash ${hash} has ${reports} reports (${level})`);
  // update React state or show banner:
  // if (level === 'hard') -> Show red modal "SCAM DETECTED"
  // if (level === 'soft') -> Show yellow banner "Proceed with caution"
});

// 3. Submitting a report
export async function submitReport(scamUpiId, deviceReporterId) {
  const response = await fetch(`${BACKEND_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: scamUpiId,
      reporterId: deviceReporterId
    }),
  });
  return await response.json();
}
