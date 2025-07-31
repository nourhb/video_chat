'use server';

// Simplified actions for video consultation platform
// This file contains only the essential server actions needed for the video consultation app

import { z } from 'zod';
import { generateRandomString } from '@/lib/utils';

// Types for video consultation
export interface VideoConsultListItem {
  id: string;
  patientName: string;
  patientEmail: string;
  consultationDate: string;
  consultationTime: string;
  roomId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

// Schema for creating a consultation
const CreateConsultationSchema = z.object({
  patientName: z.string().min(1, "Patient name is required"),
  patientEmail: z.string().email("Valid email is required"),
  consultationDate: z.string().min(1, "Consultation date is required"),
  consultationTime: z.string().min(1, "Consultation time is required"),
  notes: z.string().optional(),
});

export type CreateConsultationFormValues = z.infer<typeof CreateConsultationSchema>;

// Create a new consultation
export async function createConsultation(
  values: CreateConsultationFormValues
): Promise<{ success: boolean; message: string; consultationId?: string; roomId?: string }> {
  try {
    const validatedValues = CreateConsultationSchema.parse(values);
    
    // Generate a unique room ID for the video call
    const roomId = `room-${generateRandomString(8)}`;
    
    // In a real application, you would save this to a database
    // For now, we'll just return success
    console.log('Creating consultation:', { ...validatedValues, roomId });
    
    return {
      success: true,
      message: `Consultation scheduled for ${validatedValues.patientName} on ${validatedValues.consultationDate} at ${validatedValues.consultationTime}. Room ID: ${roomId}`,
      consultationId: `consultation-${generateRandomString(8)}`,
      roomId
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}`
      };
    }
    return {
      success: false,
      message: 'Failed to create consultation'
    };
  }
}

// Get all consultations (simulated)
export async function getConsultations(): Promise<{ data?: VideoConsultListItem[]; error?: string }> {
  try {
    // In a real application, you would fetch from a database
    // For now, return mock data
    const mockConsultations: VideoConsultListItem[] = [
      {
        id: '1',
        patientName: 'John Doe',
        patientEmail: 'john@example.com',
        consultationDate: '2024-01-15',
        consultationTime: '14:30',
        roomId: 'room-abc123',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        patientName: 'Jane Smith',
        patientEmail: 'jane@example.com',
        consultationDate: '2024-01-16',
        consultationTime: '10:00',
        roomId: 'room-def456',
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
    ];
    
    return { data: mockConsultations };
  } catch (error) {
    return { error: 'Failed to fetch consultations' };
  }
}

// Create a video room
export async function createVideoRoom(
  name: string,
  userId: string
): Promise<{ success: boolean; message: string; roomId?: string }> {
  try {
    if (!name.trim()) {
      return { success: false, message: 'Room name is required' };
    }
    
    const roomId = `room-${generateRandomString(8)}`;
    
    console.log('Creating video room:', { name, userId, roomId });
    
    return {
      success: true,
      message: `Video room "${name}" created successfully`,
      roomId
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to create video room'
    };
  }
}

// Join a video room
export async function joinVideoRoom(
  roomId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!roomId.trim()) {
      return { success: false, message: 'Room ID is required' };
    }
    
    console.log('Joining video room:', { roomId, userId });
    
    return {
      success: true,
      message: `Successfully joined room ${roomId}`
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to join video room'
    };
  }
}

// Get room information
export async function getRoomInfo(
  roomId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (!roomId.trim()) {
      return { success: false, error: 'Room ID is required' };
    }
    
    // In a real application, you would fetch room data from a database
    const mockRoomData = {
      id: roomId,
      name: 'Video Consultation Room',
      participants: ['user1', 'user2'],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    
    return { success: true, data: mockRoomData };
  } catch (error) {
    return { success: false, error: 'Failed to get room information' };
  }
}

    