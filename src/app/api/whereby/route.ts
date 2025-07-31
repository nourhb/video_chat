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
    if (!wherebyApiKey) {
      return NextResponse.json({ error: 'Whereby API key not configured on server.' }, { status: 500 });
    }

    // Check if room already exists
    if (action === 'join' && rooms.has(roomName)) {
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
        return NextResponse.json({ error: 'Failed to generate token', details: errorData }, { status: 500 });
      }
      const tokenData = await tokenResponse.json();
      return NextResponse.json({
        roomId: existingRoom.meetingId,
        roomUrl: existingRoom.hostRoomUrl,
        token: tokenData.token,
        roomName: existingRoom.roomName,
        isExisting: true,
        isMock: false,
      });
    }

    // Create a new room
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
      return NextResponse.json({ error: 'Failed to create room', details: errorData }, { status: 500 });
    }
    const roomData = await roomResponse.json();
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
      return NextResponse.json({ error: 'Failed to generate token', details: errorData }, { status: 500 });
    }
    const tokenData = await tokenResponse.json();
    return NextResponse.json({
      roomId: roomData.meetingId,
      roomUrl: roomData.hostRoomUrl,
      token: tokenData.token,
      roomName: roomData.roomName,
      isExisting: false,
      isMock: false,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
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
    return NextResponse.json({ exists: roomExists });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 