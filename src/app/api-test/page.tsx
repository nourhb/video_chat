"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { roomApi, consultationApi } from '@/lib/api';

export default function ApiTestPage() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testRoomApi = async () => {
    try {
      addResult('Testing Room API...');
      
      // Test creating a room
      const createResult = await roomApi.createRoom('Test Room', 'test-user-123');
      if (createResult.success) {
        addResult(`✅ Room created: ${createResult.data?.id}`);
        
        // Test getting the room
        const getResult = await roomApi.getRoom(createResult.data!.id);
        if (getResult.success) {
          addResult(`✅ Room retrieved: ${getResult.data?.name}`);
        } else {
          addResult(`❌ Failed to get room: ${getResult.error}`);
        }
      } else {
        addResult(`❌ Failed to create room: ${createResult.error}`);
      }
    } catch (error) {
      addResult(`❌ Room API test failed: ${error}`);
    }
  };

  const testConsultationApi = async () => {
    try {
      addResult('Testing Consultation API...');
      
      // Test creating a consultation
      const createResult = await consultationApi.createConsultation({
        patientName: 'John Doe',
        patientEmail: 'john@example.com',
        consultationDate: '2024-01-15',
        consultationTime: '14:30',
        notes: 'Test consultation'
      });
      
      if (createResult.success) {
        addResult(`✅ Consultation created: ${createResult.data?.id}`);
        addResult(`✅ Room ID generated: ${createResult.data?.roomId}`);
      } else {
        addResult(`❌ Failed to create consultation: ${createResult.error}`);
      }
    } catch (error) {
      addResult(`❌ Consultation API test failed: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">API Test Page</h1>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Room API Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testRoomApi} className="w-full">
                Test Room API
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consultation API Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={testConsultationApi} className="w-full">
                Test Consultation API
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Test Results</CardTitle>
              <Button onClick={clearResults} variant="outline" size="sm">
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500">No test results yet. Run some tests to see results here.</p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 