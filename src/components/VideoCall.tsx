
// src/components/VideoCall.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  userId: string;
  roomId: string;
  onHangUp: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ userId, roomId, onHangUp }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<string>("Initializing...");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const { toast } = useToast();

  // Initialize local media stream
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        setCallStatus("Requesting camera and microphone permissions...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCallStatus("Connected - Waiting for other participants...");
        toast({ title: "Media Access Granted", description: "Camera and microphone are now active." });
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setCallStatus("Failed to access camera/microphone");
        toast({ 
          variant: 'destructive', 
          title: "Media Access Error", 
          description: "Please allow camera and microphone access to use video calls." 
        });
      }
    };

    initializeMedia();

    // Cleanup function
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const handleToggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast({ 
          title: audioTrack.enabled ? "Microphone Unmuted" : "Microphone Muted",
          description: audioTrack.enabled ? "Your microphone is now active" : "Your microphone is now muted"
        });
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        toast({ 
          title: videoTrack.enabled ? "Camera Turned On" : "Camera Turned Off",
          description: videoTrack.enabled ? "Your camera is now visible" : "Your camera is now hidden"
        });
      }
    }
  };

  const handleHangUp = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setCallStatus("Call ended");
    onHangUp();
  }, [localStream, onHangUp]);

  const handleShareLink = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast({ title: "Link Copied", description: "Room link has been copied to clipboard." });
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({ variant: 'destructive', title: "Copy Failed", description: "Failed to copy room link." });
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Call Status */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
          {callStatus}
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Local Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            You
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover"
          />
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">Waiting for other participant...</p>
              <p className="text-xs opacity-75 mt-1">Room ID: {roomId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call Controls */}
      <div className="flex justify-center items-center space-x-4">
        <Button
          onClick={handleToggleMute}
          variant={isMuted ? "destructive" : "outline"}
          size="lg"
          className="w-16 h-16 rounded-full"
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button
          onClick={handleHangUp}
          variant="destructive"
          size="lg"
          className="w-16 h-16 rounded-full"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>

        <Button
          onClick={handleToggleVideo}
          variant={isVideoOff ? "destructive" : "outline"}
          size="lg"
          className="w-16 h-16 rounded-full"
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
        </Button>

        <Button
          onClick={handleShareLink}
          variant="outline"
          size="lg"
          className="w-16 h-16 rounded-full"
        >
          <Share2 className="w-6 h-6" />
        </Button>
      </div>

      {/* Call Info */}
      <div className="mt-6 text-center text-gray-400 text-sm">
        <p>Room: {roomId}</p>
        <p>User: {userId}</p>
        <p className="mt-2 text-xs">
          This is a demo implementation. In a real application, this would connect to other participants via WebRTC.
        </p>
      </div>
    </div>
  );
};

export default VideoCall;
