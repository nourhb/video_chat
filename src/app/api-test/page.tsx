"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ApiTestPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('test-room-123');

  const testBasicApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test');
      const data = await response.json();
      setTestResults({ type: 'Basic API', data });
    } catch (error) {
      setTestResults({ type: 'Basic API', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testWherebyApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whereby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomName,
          participantName: 'Test User',
          action: 'create',
        }),
      });
      const data = await response.json();
      setTestResults({ type: 'Whereby API', data });
    } catch (error) {
      setTestResults({ type: 'Whereby API', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testWherebyGet = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whereby?roomName=${roomName}`);
      const data = await response.json();
      setTestResults({ type: 'Whereby GET', data });
    } catch (error) {
      setTestResults({ type: 'Whereby GET', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">API Test Page</h1>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Test Basic API</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testBasicApi} disabled={loading} className="w-full">
                Test /api/test
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Whereby API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name"
                />
              </div>
              <div className="space-y-2">
                <Button onClick={testWherebyApi} disabled={loading} className="w-full">
                  Test POST /api/whereby
                </Button>
                <Button onClick={testWherebyGet} disabled={loading} className="w-full" variant="outline">
                  Test GET /api/whereby
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results: {testResults.type}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(testResults.data || testResults.error, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Testing API...</p>
          </div>
        )}
      </div>
    </div>
  );
} 