
// src/components/VideoCall.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2, Loader2, ExternalLink, Copy, Users } from 'lucide-react';
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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
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
          console.error('API Error Response:', errorData);
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
        const errorMessage = err instanceof Error ? err.message : 'Failed to create/join room';
        setError(errorMessage);
        
        // Try to get more details from the error
        if (err instanceof Error && err.message.includes('Failed to create room')) {
          setErrorDetails('This usually means the Whereby API key is invalid or expired. Please check your environment variables.');
        } else if (err instanceof Error && err.message.includes('Whereby API key not configured')) {
          setErrorDetails('The Whereby API key is not set on the server. Please configure the WHEREBY_API_KEY environment variable.');
        }
        
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
      // Open Whereby room in a new tab
      window.open(roomData.roomUrl, '_blank');
      toast({ 
        title: "Opening Video Call", 
        description: "Video call is opening in a new tab." 
      });
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
          <p className="text-white mb-2 font-medium">{error}</p>
          {errorDetails && (
            <p className="text-gray-400 text-sm mb-4">{errorDetails}</p>
          )}
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4 text-left">
            <h4 className="text-red-300 font-medium mb-2">Troubleshooting:</h4>
            <ul className="text-red-200 text-sm space-y-1">
              <li>• Check if WHEREBY_API_KEY is set in Render environment variables</li>
              <li>• Verify the API key is valid and not expired</li>
              <li>• Ensure the subdomain 'sanhome' is correct</li>
              <li>• Check Render logs for detailed error information</li>
            </ul>
          </div>
          <Button onClick={handleHangUp} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
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
          <h3 className="text-white text-lg font-medium mb-2">Whereby Video Call</h3>
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
          Join Call
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
        <p>1. Click "Join Call" to open the video room in a new tab</p>
        <p>2. Allow camera and microphone access when prompted</p>
        <p>3. Share the room link or room ID with other participants</p>
        <p>4. Use the controls in the Whereby interface to manage your call</p>
        {isHost && (
          <p className="mt-2 text-blue-400">🎯 <strong>You're the host!</strong> Others can join using the room ID above.</p>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
