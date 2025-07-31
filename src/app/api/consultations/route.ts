import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
const consultations = new Map<string, {
  id: string;
  patientName: string;
  patientEmail: string;
  consultationDate: string;
  consultationTime: string;
  notes?: string;
  roomId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientName, patientEmail, consultationDate, consultationTime, notes } = body;

    if (!patientName || !patientEmail || !consultationDate || !consultationTime) {
      return NextResponse.json(
        { error: 'Patient name, email, date, and time are required' },
        { status: 400 }
      );
    }

    const consultationId = `consultation-${Math.random().toString(36).substr(2, 9)}`;
    const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;

    const consultation = {
      id: consultationId,
      patientName,
      patientEmail,
      consultationDate,
      consultationTime,
      notes: notes || '',
      roomId,
      status: 'scheduled' as const,
      createdAt: new Date(),
    };

    consultations.set(consultationId, consultation);

    return NextResponse.json({
      success: true,
      consultation: {
        id: consultation.id,
        patientName: consultation.patientName,
        patientEmail: consultation.patientEmail,
        consultationDate: consultation.consultationDate,
        consultationTime: consultation.consultationTime,
        notes: consultation.notes,
        roomId: consultation.roomId,
        status: consultation.status,
        createdAt: consultation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating consultation:', error);
    return NextResponse.json(
      { error: 'Failed to create consultation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consultationId = searchParams.get('id');
    const patientEmail = searchParams.get('patientEmail');

    if (consultationId) {
      // Get specific consultation
      const consultation = consultations.get(consultationId);
      if (!consultation) {
        return NextResponse.json(
          { error: 'Consultation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        consultation: {
          id: consultation.id,
          patientName: consultation.patientName,
          patientEmail: consultation.patientEmail,
          consultationDate: consultation.consultationDate,
          consultationTime: consultation.consultationTime,
          notes: consultation.notes,
          roomId: consultation.roomId,
          status: consultation.status,
          createdAt: consultation.createdAt,
        },
      });
    } else if (patientEmail) {
      // Get consultations by patient email
      const patientConsultations = Array.from(consultations.values())
        .filter(consultation => consultation.patientEmail === patientEmail)
        .map(consultation => ({
          id: consultation.id,
          patientName: consultation.patientName,
          patientEmail: consultation.patientEmail,
          consultationDate: consultation.consultationDate,
          consultationTime: consultation.consultationTime,
          notes: consultation.notes,
          roomId: consultation.roomId,
          status: consultation.status,
          createdAt: consultation.createdAt,
        }));

      return NextResponse.json({
        success: true,
        consultations: patientConsultations,
      });
    } else {
      // Get all consultations
      const allConsultations = Array.from(consultations.values()).map(consultation => ({
        id: consultation.id,
        patientName: consultation.patientName,
        patientEmail: consultation.patientEmail,
        consultationDate: consultation.consultationDate,
        consultationTime: consultation.consultationTime,
        notes: consultation.notes,
        roomId: consultation.roomId,
        status: consultation.status,
        createdAt: consultation.createdAt,
      }));

      return NextResponse.json({
        success: true,
        consultations: allConsultations,
      });
    }
  } catch (error) {
    console.error('Error fetching consultations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consultations' },
      { status: 500 }
    );
  }
} 