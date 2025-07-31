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
    console.log('Whereby API Key available:', !!wherebyApiKey);
    console.log('Whereby API Key length:', wherebyApiKey?.length || 0);
    
    if (!wherebyApiKey) {
      console.error('WHEREBY_API_KEY environment variable is not set');
      return NextResponse.json({ 
        error: 'Whereby API key not configured',
        details: 'Please check environment variables'
      }, { status: 500 });
    }

    // Check if room already exists
    if (action === 'join' && rooms.has(roomName)) {
      console.log(`Joining existing room: ${roomName}`);
      const existingRoom = rooms.get(roomName);
      
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
        const errorData = await tokenResponse.text();
        console.error('Whereby token error:', errorData);
        return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
      }

      const tokenData = await tokenResponse.json();
      console.log(`Successfully joined room: ${roomName}`);

      return NextResponse.json({
        roomId: existingRoom.meetingId,
        roomUrl: existingRoom.hostRoomUrl,
        token: tokenData.token,
        roomName: existingRoom.roomName,
        isExisting: true,
      });
    }

    // Create a new room
    console.log(`Creating new room: ${roomName}`);
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
      const errorData = await roomResponse.text();
      console.error('Whereby API error:', errorData);
      console.error('Response status:', roomResponse.status);
      console.error('Response headers:', Object.fromEntries(roomResponse.headers.entries()));
      return NextResponse.json({ 
        error: 'Failed to create room',
        details: errorData
      }, { status: 500 });
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
      const errorData = await tokenResponse.text();
      console.error('Whereby token error:', errorData);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    console.log('Token generated successfully');

    return NextResponse.json({
      roomId: roomData.meetingId,
      roomUrl: roomData.hostRoomUrl,
      token: tokenData.token,
      roomName: roomData.roomName,
      isExisting: false,
    });

  } catch (error) {
    console.error('Error in Whereby API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
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
    console.log(`Checking room existence: ${roomName} -> ${roomExists}`);
    return NextResponse.json({ exists: roomExists });
  } catch (error) {
    console.error('Error checking room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 