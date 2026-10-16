/**
 * Application configuration
 * Defaults VITE_MOCK to true unless explicitly set to 'false'
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const IS_MOCK = import.meta.env.VITE_MOCK !== 'false';

export const CONFIG = {
  apiUrl: API_URL,
  isMock: IS_MOCK,
  broadcastDelayMs: 2000, // 2-second mock propagation delay
  mockVpa: 'scammer@upi',
  mockPayload: 'upi://pay?pa=scammer@upi&pn=Fake%20Shop',
  mockMerchantName: 'Fake Shop'
};

export default CONFIG;
