
// src/components/VideoCall.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2, Loader2, ExternalLink, Copy, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [roomData, setRoomData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const { toast } = useToast();

  // Check if room exists and create/join accordingly
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        setIsLoading(true);
        
        // First, check if room exists
        const checkResponse = await fetch(`/api/whereby?roomName=${roomId}`);
        const checkData = await checkResponse.json();
        
        let action = 'create';
        if (checkData.exists) {
          action = 'join';
          setIsHost(false);
        } else {
          setIsHost(true);
        }

        // Create or join room
        const response = await fetch('/api/whereby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: roomId,
            participantName: userId,
            action: action,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create/join room');
        }

        const data = await response.json();
        setRoomData(data);
        
        if (data.isExisting) {
          toast({ 
            title: "Joined Room", 
            description: "You've joined an existing video call room." 
          });
        } else {
          toast({ 
            title: "Room Created", 
            description: "Video call room is ready. Share the link with others to join." 
          });
        }
      } catch (err) {
        console.error('Error initializing room:', err);
        setError(err instanceof Error ? err.message : 'Failed to create/join room');
        toast({ 
          variant: 'destructive', 
          title: "Room Error", 
          description: "Could not create or join video call room. Please try again." 
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [roomId, userId, toast]);

  const handleJoinCall = () => {
    if (roomData?.roomUrl) {
      if (roomData.isMock) {
        toast({ 
          title: "Mock Mode", 
          description: "This is a test mode. In production, this would open a real Whereby video call." 
        });
        // For mock mode, just show a message
        window.open('https://whereby.com', '_blank');
      } else {
        // Open Whereby room in a new tab
        window.open(roomData.roomUrl, '_blank');
        toast({ 
          title: "Opening Video Call", 
          description: "Video call is opening in a new tab." 
        });
      }
    }
  };

  const handleShareLink = async () => {
    if (roomData?.roomUrl) {
      try {
        await navigator.clipboard.writeText(roomData.roomUrl);
        toast({ title: "Link Copied", description: "Room link has been copied to clipboard." });
      } catch (error) {
        console.error("Failed to copy link:", error);
        toast({ variant: 'destructive', title: "Copy Failed", description: "Failed to copy room link." });
      }
    }
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast({ title: "Room ID Copied", description: "Room ID has been copied to clipboard." });
    } catch (error) {
      console.error("Failed to copy room ID:", error);
      toast({ variant: 'destructive', title: "Copy Failed", description: "Failed to copy room ID." });
    }
  };

  const handleHangUp = useCallback(() => {
    onHangUp();
  }, [onHangUp]);

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-white text-lg">
            {isHost ? 'Creating video call room...' : 'Joining video call room...'}
          </p>
          <p className="text-gray-400 text-sm mt-2">Please wait while we set up your call</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">⚠️ Error</div>
          <p className="text-white mb-4">{error}</p>
          <Button onClick={handleHangUp} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Mock Mode Warning */}
      {roomData?.isMock && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="text-yellow-400 font-medium">Test Mode</h3>
          </div>
          <p className="text-yellow-300 text-sm mt-1">
            This is running in test mode. The Whereby API integration is being tested. 
            Room creation and joining functionality is working, but video calls are simulated.
          </p>
        </div>
      )}

      {/* Room Info */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm mb-4">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          {isHost ? 'Room Created' : 'Joined Room'}
        </div>
        <h2 className="text-white text-xl font-semibold mb-2">Video Consultation Room</h2>
        <p className="text-gray-400 text-sm">Room ID: {roomData?.roomName || roomId}</p>
        <div className="flex items-center justify-center mt-2 text-sm text-gray-400">
          <Users className="w-4 h-4 mr-1" />
          <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Room Preview */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white text-lg font-medium mb-2">
            {roomData?.isMock ? 'Test Video Call' : 'Whereby Video Call'}
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {isHost 
              ? "Click 'Join Call' to enter the video consultation room"
              : "Click 'Join Call' to enter the existing video consultation room"
            }
          </p>
          <div className="space-y-2 text-xs text-gray-500">
            <p>• High-quality video and audio</p>
            <p>• Screen sharing capabilities</p>
            <p>• Chat functionality</p>
            <p>• Recording options (if enabled)</p>
          </div>
        </div>
      </div>

      {/* Call Controls */}
      <div className="flex justify-center items-center space-x-4 mb-6">
        <Button
          onClick={handleJoinCall}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
          size="lg"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          {roomData?.isMock ? 'Test Call' : 'Join Call'}
        </Button>

        <Button
          onClick={handleShareLink}
          variant="outline"
          size="lg"
          className="px-8 py-3"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share Link
        </Button>

        <Button
          onClick={handleHangUp}
          variant="destructive"
          size="lg"
          className="px-8 py-3"
        >
          <PhoneOff className="w-5 h-5 mr-2" />
          End Call
        </Button>
      </div>

      {/* Room Details */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h4 className="text-white font-medium mb-2">Room Information</h4>
        <div className="space-y-1 text-sm text-gray-400">
          <p><span className="text-gray-300">Room Name:</span> {roomData?.roomName || 'N/A'}</p>
          <p><span className="text-gray-300">Participant:</span> {userId}</p>
          <p><span className="text-gray-300">Role:</span> {isHost ? 'Host' : 'Participant'}</p>
          <p><span className="text-gray-300">Status:</span> Ready to join</p>
          {roomData?.isMock && (
            <p><span className="text-gray-300">Mode:</span> <span className="text-yellow-400">Test Mode</span></p>
          )}
        </div>
      </div>

      {/* Room ID for sharing */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium mb-1">Room ID for Invites</h4>
            <p className="text-gray-400 text-sm">Share this ID with others to join the same room</p>
          </div>
          <Button
            onClick={handleCopyRoomId}
            variant="outline"
            size="sm"
            className="ml-2"
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
        </div>
        <div className="mt-2 p-2 bg-gray-700 rounded text-sm font-mono text-gray-300 break-all">
          {roomId}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center text-gray-400 text-sm">
        <p className="mb-2">💡 <strong>How to use:</strong></p>
        <p>1. Click "{roomData?.isMock ? 'Test Call' : 'Join Call'}" to open the video room</p>
        <p>2. Allow camera and microphone access when prompted</p>
        <p>3. Share the room link or room ID with other participants</p>
        <p>4. Use the controls in the video interface to manage your call</p>
        {isHost && (
          <p className="mt-2 text-blue-400">🎯 <strong>You're the host!</strong> Others can join using the room ID above.</p>
        )}
        {roomData?.isMock && (
          <p className="mt-2 text-yellow-400">🧪 <strong>Test Mode:</strong> API integration is working correctly!</p>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
