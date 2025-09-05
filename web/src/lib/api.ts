import { SessionResponse } from '@/types';
import { API_CONFIG } from '@/config/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiService {
  private static async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout');
      }
      throw error;
    }
  }

  static async startSession(): Promise<SessionResponse> {
    try {
      console.log('🌐 API 호출 시작 - startSession');
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSIONS}`;
      console.log('📍 API URL:', url);
      
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ Real API Session Created:', data);
      return data;
    } catch (error) {
      console.error('❌ Session creation failed:', error);
      throw error;
    }
  }

  static async updateProfile(sessionId: string, profile: any, userPrompt?: string): Promise<any> {
    try {
      console.log('🔄 API 호출 시작 - updateProfile');
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE}`;
      console.log('📍 API URL:', url);
      
      const requestBody: any = { 
        sessionId,
        ...profile 
      };
      if (userPrompt) {
        requestBody.userPrompt = userPrompt;
      }
      
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'NON_FOOD_RELATED_PROMPT') {
          throw new Error('NON_FOOD_RELATED_PROMPT');
        }
        throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ Profile Updated:', data);
      return data;
    } catch (error) {
      console.error('❌ Profile update failed:', error);
      throw error;
    }
  }

  static async processRecipe(sessionId: string): Promise<any> {
    try {
      console.log('🍳 API 호출 시작 - processRecipe');
      const url = `${API_CONFIG.BASE_URL}/process`;
      console.log('📍 API URL:', url);
      
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ Recipe Processing Started:', data);
      return data;
    } catch (error) {
      console.error('❌ Recipe processing failed:', error);
      throw error;
    }
  }
}
