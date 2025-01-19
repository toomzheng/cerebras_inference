// Determine the API base URL based on the environment
const isProd = process.env.NODE_ENV === 'production';

// In production, use the Railway URL by default
const productionUrl = 'https://cerebrasinference-production-server.up.railway.app';
const developmentUrl = 'http://127.0.0.1:8000';

// Use NEXT_PUBLIC_API_URL if set, otherwise use environment-specific default
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (isProd ? productionUrl : developmentUrl);
