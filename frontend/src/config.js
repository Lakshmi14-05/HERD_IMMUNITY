/**
 * Application configuration
 * Talks directly to real backend API (default http://localhost:3000)
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default {
  API_URL
};
