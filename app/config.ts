// Determine the API base URL based on the environment
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://cerebrasinference-production.up.railway.app'  // Production API URL
    : 'http://127.0.0.1:8000');  // Local development API URL
