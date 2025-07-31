// API utility functions for the video consultation platform

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Types
export interface Room {
  id: string;
  name: string;
  participants: string[];
  createdAt: Date;
  isActive: boolean;
}

export interface Consultation {
  id: string;
  patientName: string;
  patientEmail: string;
  consultationDate: string;
  consultationTime: string;
  notes?: string;
  roomId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Room API functions
export const roomApi = {
  // Create a new room
  async createRoom(name: string, userId: string): Promise<ApiResponse<Room>> {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create room' };
      }

      return { success: true, data: data.room };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Get all rooms
  async getRooms(): Promise<ApiResponse<Room[]>> {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch rooms' };
      }

      return { success: true, data: data.rooms };
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Get a specific room
  async getRoom(roomId: string): Promise<ApiResponse<Room>> {
    try {
      const response = await fetch(`/api/rooms?id=${roomId}`);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch room' };
      }

      return { success: true, data: data.room };
    } catch (error) {
      console.error('Error fetching room:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Join a room
  async joinRoom(roomId: string, userId: string): Promise<ApiResponse<Room>> {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to join room' };
      }

      return { success: true, data: data.room };
    } catch (error) {
      console.error('Error joining room:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Leave a room
  async leaveRoom(roomId: string, userId: string): Promise<ApiResponse<Room>> {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'leave', userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to leave room' };
      }

      return { success: true, data: data.room };
    } catch (error) {
      console.error('Error leaving room:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Delete a room
  async deleteRoom(roomId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete room' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting room:', error);
      return { success: false, error: 'Network error' };
    }
  },
};

// Consultation API functions
export const consultationApi = {
  // Create a new consultation
  async createConsultation(consultationData: {
    patientName: string;
    patientEmail: string;
    consultationDate: string;
    consultationTime: string;
    notes?: string;
  }): Promise<ApiResponse<Consultation>> {
    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consultationData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create consultation' };
      }

      return { success: true, data: data.consultation };
    } catch (error) {
      console.error('Error creating consultation:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Get all consultations
  async getConsultations(): Promise<ApiResponse<Consultation[]>> {
    try {
      const response = await fetch('/api/consultations');
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch consultations' };
      }

      return { success: true, data: data.consultations };
    } catch (error) {
      console.error('Error fetching consultations:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Get consultations by patient email
  async getConsultationsByEmail(patientEmail: string): Promise<ApiResponse<Consultation[]>> {
    try {
      const response = await fetch(`/api/consultations?patientEmail=${encodeURIComponent(patientEmail)}`);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch consultations' };
      }

      return { success: true, data: data.consultations };
    } catch (error) {
      console.error('Error fetching consultations:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // Get a specific consultation
  async getConsultation(consultationId: string): Promise<ApiResponse<Consultation>> {
    try {
      const response = await fetch(`/api/consultations?id=${consultationId}`);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch consultation' };
      }

      return { success: true, data: data.consultation };
    } catch (error) {
      console.error('Error fetching consultation:', error);
      return { success: false, error: 'Network error' };
    }
  },
};

// Example usage in your components:
/*
import { roomApi, consultationApi } from '@/lib/api';

// Create a room
const createRoom = async () => {
  const result = await roomApi.createRoom('My Video Call', 'user123');
  if (result.success) {
    console.log('Room created:', result.data);
  } else {
    console.error('Error:', result.error);
  }
};

// Schedule a consultation
const scheduleConsultation = async () => {
  const result = await consultationApi.createConsultation({
    patientName: 'John Doe',
    patientEmail: 'john@example.com',
    consultationDate: '2024-01-15',
    consultationTime: '14:30',
    notes: 'Follow-up consultation'
  });
  
  if (result.success) {
    console.log('Consultation scheduled:', result.data);
  } else {
    console.error('Error:', result.error);
  }
};
*/ 