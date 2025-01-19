// Determine the API base URL based on the environment
const isProd = process.env.NODE_ENV === 'production';
const defaultUrl = isProd 
  ? 'https://cerebrasinference-production-server.up.railway.app'  // Production backend URL
  : 'http://127.0.0.1:8000';  // Local development URL

export const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || defaultUrl)
  : defaultUrl;
