import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
const rooms = new Map<string, {
  id: string;
  name: string;
  participants: string[];
  createdAt: Date;
  isActive: boolean;
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
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
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const body = await request.json();
    const { action, userId } = body;

    const room = rooms.get(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'join':
        if (!room.participants.includes(userId)) {
          room.participants.push(userId);
        }
        break;
      case 'leave':
        room.participants = room.participants.filter(id => id !== userId);
        break;
      case 'deactivate':
        room.isActive = false;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    rooms.set(roomId, room);

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
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const room = rooms.get(roomId);

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    rooms.delete(roomId);

    return NextResponse.json({
      success: true,
      message: 'Room deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
} 