export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tlg1j21vgf.execute-api.us-east-1.amazonaws.com',
  TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
  ENDPOINTS: {
    SESSIONS: '/dev/sessions'
  }
} as const;
