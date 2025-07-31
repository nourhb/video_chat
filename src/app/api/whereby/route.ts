import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for room data (in production, use a database)
const rooms = new Map();

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName, action = 'create' } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    const wherebyApiKey = process.env.WHEREBY_API_KEY;
    
    // If no API key, use mock mode
    if (!wherebyApiKey) {
      console.log('No Whereby API key found, using mock mode');
      return createMockRoom(roomName, action);
    }

    // Check if room already exists
    if (action === 'join' && rooms.has(roomName)) {
      console.log(`Joining existing room: ${roomName}`);
      const existingRoom = rooms.get(roomName);
      
      try {
        // Generate a token for the new participant
        const tokenResponse = await fetch(`https://api.whereby.com/v1/meetings/${existingRoom.meetingId}/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${wherebyApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: participantName || 'Participant',
            validFrom: new Date().toISOString(),
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        });

        if (!tokenResponse.ok) {
          console.error('Whereby token error, falling back to mock mode');
          return createMockRoom(roomName, action);
        }

        const tokenData = await tokenResponse.json();
        console.log(`Successfully joined room: ${roomName}`);

        return NextResponse.json({
          roomId: existingRoom.meetingId,
          roomUrl: existingRoom.hostRoomUrl,
          token: tokenData.token,
          roomName: existingRoom.roomName,
          isExisting: true,
          isMock: false,
        });
      } catch (error) {
        console.error('Error joining room, falling back to mock mode:', error);
        return createMockRoom(roomName, action);
      }
    }

    // Create a new room
    console.log(`Creating new room: ${roomName}`);
    try {
      const roomResponse = await fetch('https://api.whereby.com/v1/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wherebyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          fields: ['hostRoomUrl', 'viewerRoomUrl'],
          roomNamePrefix: 'video-consultation',
          roomNamePattern: 'uuid',
          startDate: new Date().toISOString(),
        }),
      });

      if (!roomResponse.ok) {
        console.error('Whereby API error, falling back to mock mode');
        return createMockRoom(roomName, action);
      }

      const roomData = await roomResponse.json();
      console.log('Room created successfully:', roomData.meetingId);

      // Store room data
      rooms.set(roomName, {
        meetingId: roomData.meetingId,
        hostRoomUrl: roomData.hostRoomUrl,
        roomName: roomData.roomName,
        createdAt: new Date(),
      });

      // Generate a token for the host
      const tokenResponse = await fetch(`https://api.whereby.com/v1/meetings/${roomData.meetingId}/tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wherebyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: participantName || 'Host',
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Whereby token error, falling back to mock mode');
        return createMockRoom(roomName, action);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token generated successfully');

      return NextResponse.json({
        roomId: roomData.meetingId,
        roomUrl: roomData.hostRoomUrl,
        token: tokenData.token,
        roomName: roomData.roomName,
        isExisting: false,
        isMock: false,
      });
    } catch (error) {
      console.error('Error creating room, falling back to mock mode:', error);
      return createMockRoom(roomName, action);
    }

  } catch (error) {
    console.error('Error in Whereby API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to create mock room
function createMockRoom(roomName: string, action: string) {
  const mockRoomData = {
    meetingId: `mock-${Date.now()}`,
    hostRoomUrl: `https://whereby.com/sanhome/${roomName}`,
    roomName: roomName,
  };

  // Store room data
  rooms.set(roomName, {
    meetingId: mockRoomData.meetingId,
    hostRoomUrl: mockRoomData.hostRoomUrl,
    roomName: mockRoomData.roomName,
    createdAt: new Date(),
  });

  return NextResponse.json({
    roomId: mockRoomData.meetingId,
    roomUrl: mockRoomData.hostRoomUrl,
    token: 'mock-token',
    roomName: mockRoomData.roomName,
    isExisting: action === 'join',
    isMock: true,
  });
}

// GET endpoint to check if a room exists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get('roomName');

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    const roomExists = rooms.has(roomName);
    return NextResponse.json({ exists: roomExists });
  } catch (error) {
    console.error('Error checking room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 