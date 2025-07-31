import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for room data (in production, use a database)
const rooms = new Map();

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName, action = 'create' } = await request.json();

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // For now, let's create a simple mock response to test the flow
    // This will help us identify if the issue is with the Whereby API or the route itself
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
      isMock: true, // Flag to indicate this is a mock response
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
    return NextResponse.json({ exists: roomExists });
  } catch (error) {
    console.error('Error checking room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 