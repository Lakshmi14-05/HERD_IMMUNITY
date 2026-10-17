/**
 * Application configuration
 * Defaults VITE_API_URL to http://localhost:3000
 * Defaults VITE_MOCK to true unless set to 'false'
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const IS_MOCK = import.meta.env.VITE_MOCK === undefined 
  ? true 
  : import.meta.env.VITE_MOCK !== 'false';

export const CONFIG = {
  apiUrl: API_URL,
  isMock: IS_MOCK,
  defaultQr: 'upi://pay?pa=scammer@upi&pn=Fake%20Shop',
  defaultVpa: 'scammer@upi',
  reporterOptions: ['deviceA', 'deviceC', 'deviceD', 'deviceE']
};

export default CONFIG;
