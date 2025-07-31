import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
// In production, you'd use a database like PostgreSQL, MongoDB, or Firebase
const rooms = new Map<string, {
  id: string;
  name: string;
  participants: string[];
  createdAt: Date;
  isActive: boolean;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, userId } = body;

    if (!name || !userId) {
      return NextResponse.json(
        { error: 'Room name and user ID are required' },
        { status: 400 }
      );
    }

    const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;
    const room = {
      id: roomId,
      name,
      participants: [userId],
      createdAt: new Date(),
      isActive: true,
    };

    rooms.set(roomId, room);

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        participants: room.participants,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');

    if (roomId) {
      // Get specific room
      const room = rooms.get(roomId);
      if (!room) {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        room: {
          id: room.id,
          name: room.name,
          participants: room.participants,
          createdAt: room.createdAt,
          isActive: room.isActive,
        },
      });
    } else {
      // Get all rooms
      const allRooms = Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        participants: room.participants,
        createdAt: room.createdAt,
        isActive: room.isActive,
      }));

      return NextResponse.json({
        success: true,
        rooms: allRooms,
      });
    }
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
} 