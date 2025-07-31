
"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, LogIn, XCircle, AlertCircle, CalendarPlus, List, RefreshCw, User, BriefcaseMedical, Clock, PhoneOff } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from '@/components/ui/scroll-area';
import VideoCall from '@/components/VideoCall';

export default function VideoConsultPage() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualRoomIdInput, setManualRoomIdInput] = useState<string>('');
  const { toast } = useToast();
  const [userId] = useState<string>('demo-user-' + Math.random().toString(36).substr(2, 9));

  const handleJoinCall = useCallback((roomIdToJoin: string) => {
    if (!roomIdToJoin || roomIdToJoin.trim() === "") {
      toast({ variant: 'destructive', title: 'Input Error', description: 'Room ID cannot be empty.' });
      return;
    }
    console.log(`[VideoConsultPage] Attempting to join/start call in room: ${roomIdToJoin} by user: ${userId}`);
    setCurrentRoomId(roomIdToJoin.trim());
    setErrorMsg(null);
  }, [toast, userId]);

  const handleLeaveCall = useCallback(() => {
    console.log("[VideoConsultPage] User requested to leave call. Current Room ID:", currentRoomId);
    setCurrentRoomId(null);
    setManualRoomIdInput('');
    toast({ title: "Call Ended", description: "You have left the video consultation." });
  }, [toast, currentRoomId]);

  const handleCreateNewCall = useCallback(() => {
    const newRoomId = 'room-' + Math.random().toString(36).substr(2, 9);
    setManualRoomIdInput(newRoomId);
    handleJoinCall(newRoomId);
  }, [handleJoinCall]);

  const handleManualJoin = useCallback(() => {
    handleJoinCall(manualRoomIdInput);
  }, [handleJoinCall, manualRoomIdInput]);

  if (currentRoomId) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-white text-xl font-semibold">Video Consultation</h1>
            <Button onClick={handleLeaveCall} variant="destructive" size="sm">
              <PhoneOff className="w-4 h-4 mr-2" />
              Leave Call
            </Button>
          </div>
          <VideoCall
            userId={userId}
            roomId={currentRoomId}
            onHangUp={handleLeaveCall}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Consultation</h1>
          <p className="text-gray-600">Start or join a secure video consultation</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create New Call */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Create New Call</CardTitle>
                  <CardDescription>Start a new video consultation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Create a new consultation room and share the room ID with others to join.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={handleCreateNewCall} className="w-full" size="lg">
                <Video className="w-4 h-4 mr-2" />
                Create New Call
              </Button>
            </CardFooter>
          </Card>

          {/* Join Existing Call */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Join Existing Call</CardTitle>
                  <CardDescription>Enter a room ID to join</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomId">Room ID</Label>
                  <Input
                    id="roomId"
                    placeholder="Enter room ID"
                    value={manualRoomIdInput}
                    onChange={(e) => setManualRoomIdInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualJoin()}
                  />
                </div>
                {errorMsg && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleManualJoin} 
                className="w-full" 
                size="lg"
                disabled={!manualRoomIdInput.trim()}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Join Call
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarPlus className="w-5 h-5" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Link href="/video-consult/schedule">
                  <Button variant="outline" className="w-full h-16 flex flex-col space-y-2">
                    <CalendarPlus className="w-5 h-5" />
                    <span>Schedule Consultation</span>
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col space-y-2"
                  onClick={() => setManualRoomIdInput('demo-room-123')}
                >
                  <Video className="w-5 h-5" />
                  <span>Demo Room</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col space-y-2"
                  onClick={() => window.open('https://github.com/nourhb/sanhome', '_blank')}
                >
                  <List className="w-5 h-5" />
                  <span>View Source</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>What you can do with this platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Video className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">High-Quality Video Calls</h3>
                      <p className="text-sm text-gray-600">Crystal clear video and audio for effective consultations</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Shield className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Secure & Private</h3>
                      <p className="text-sm text-gray-600">End-to-end encryption ensures your privacy</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Clock className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Easy Scheduling</h3>
                      <p className="text-sm text-gray-600">Book appointments at your convenience</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Professional Care</h3>
                      <p className="text-sm text-gray-600">Connect with qualified healthcare professionals</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Add missing Shield icon component
const Shield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

    