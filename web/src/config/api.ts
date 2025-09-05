export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://5qoc71ol3a.execute-api.us-east-1.amazonaws.com/prod',
  TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
  ENDPOINTS: {
    SESSIONS: '/sessions'
  }
} as const;
