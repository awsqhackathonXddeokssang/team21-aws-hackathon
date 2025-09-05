'use client';

import { useState } from 'react';
import { ApiService } from '@/lib/api';

export default function TestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testApiCall = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing API Gateway call...');
      const sessionData = await ApiService.startSession();
      console.log('API Response:', sessionData);
      setResult(sessionData);
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">API Gateway Test</h1>
        
        <button
          onClick={testApiCall}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Session API'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h3 className="font-bold">Error:</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            <h3 className="font-bold">Success! API Gateway Response:</h3>
            <pre className="mt-2 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-200 rounded">
          <h3 className="font-bold mb-2">Test Details:</h3>
          <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_BASE_URL}/sessions</p>
          <p><strong>Method:</strong> POST</p>
          <p><strong>Expected:</strong> sessionId, createdAt, expiresAt</p>
        </div>
      </div>
    </div>
  );
}
