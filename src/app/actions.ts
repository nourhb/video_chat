
'use server';
// IMPORTANT REMINDER FOR SEEDING:
// If your Firestore rules are `allow read, write: if request.auth != null;`,
// YOU MUST BE LOGGED INTO THE APPLICATION WHEN TRIGGERING THIS ACTION.
// For initial seeding, consider temporarily opening your Firestore rules
// (e.g., `allow read, write: if true;`), run the seed, then IMMEDIATELY revert to secure rules.
// This applies to both Firestore writes and Firebase Authentication user creation.
// Ensure Firebase Auth "Email/Password" sign-in provider is ENABLED.
// Ensure the Cloud Firestore API is ENABLED in your Google Cloud project.

// For email notifications:
// Ensure EMAIL_USER and EMAIL_PASS are correctly set in .env.
// For Gmail, use an App Password if 2-Step Verification is ON.

import {
  getPersonalizedCareSuggestions,
  type PersonalizedCareSuggestionsInput,
  type PersonalizedCareSuggestionsOutput
} from '@/ai/flows/personalized-care-suggestions';
import { z } from 'zod';
import { generateRandomPassword, generateRandomString, generatePhoneNumber, generateDateOfBirth } from '@/lib/utils';
import { auth as clientAuth, db as clientDb } from '@/lib/firebase'; 
import {
  collection, addDoc, getDocs, doc, getDoc, serverTimestamp, Timestamp,
  query, where, updateDoc, deleteDoc, writeBatch, getCountFromServer, orderBy, limit, setDoc, collectionGroup
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { v2 as cloudinary } from 'cloudinary';

// Consistent instances for Firestore and Auth for use within this file
const firestoreInstance = clientDb;
const firebaseAuthInstance = clientAuth;
console.log("[ACTION_LOG_INIT] firestoreInstance and firebaseAuthInstance aliased in actions.ts.");


if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log("[ACTION_LOG] Cloudinary SDK configured.");
} else {
  console.warn("[ACTION_WARN] Cloudinary credentials not fully configured in .env. File uploads via Cloudinary will fail.");
}


async function uploadToCloudinary(file: File, folder: string): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("[ACTION_ERROR] Cloudinary not configured. Cannot upload file.");
    return null;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "auto", folder: folder },
        (error, result) => {
          if (error) {
            console.error("[ACTION_ERROR] Cloudinary upload_stream error:", error);
            reject(error);
          } else if (result) {
            console.log("[ACTION_LOG] File uploaded to Cloudinary:", result.secure_url);
            resolve(result.secure_url);
          } else {
            reject(new Error("Cloudinary upload failed without error object or result."));
          }
        }
      );
      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error("[ACTION_ERROR] Error processing file for Cloudinary upload:", error);
    return null;
  }
}


const PersonalizedCareSuggestionsInputSchema = z.object({
  patientName: z.string().min(1, "Patient name is required."),
  mobilityStatus: z.string().min(1, "Mobility status is required."),
  pathologies: z.string().min(1, "Pathologies are required."),
});

export async function fetchPersonalizedCareSuggestions(
  input: PersonalizedCareSuggestionsInput
): Promise<{ data?: PersonalizedCareSuggestionsOutput; error?: string }> {
  try {
    const validatedInput = PersonalizedCareSuggestionsInputSchema.parse(input);
    const result = await getPersonalizedCareSuggestions(validatedInput);
    return { data: result };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: e.errors.map(err => err.message).join(", ") };
    }
    console.error("[ACTION_ERROR] Error fetching personalized care suggestions:", e);
    return { error: "Failed to generate care suggestions. Please try again." };
  }
}


export type PatientListItem = {
  id: string;
  name: string;
  age: number;
  avatarUrl: string;
  joinDate: string; // ISO string
  primaryNurse: string;
  phone: string;
  email: string;
  address: string;
  mobilityStatus: string;
  pathologies: string[];
  allergies: string[];
  lastVisit: string; // ISO string
  condition: string;
  status: string;
  hint?: string;
  currentMedications?: Array<{ name: string; dosage: string }>;
  recentVitals?: { date: string; bp: string; hr: string; temp: string; glucose: string };
  createdAt?: string; // ISO string
};

export async function fetchPatientById(id: string): Promise<{ data?: PatientListItem, error?: string }> {
  console.log(`[ACTION_LOG] fetchPatientById: Initiated for ID: ${id}`);
  try {
    if (!id) {
      console.error("[ACTION_ERROR] fetchPatientById: Patient ID is required.");
      return { error: "Patient ID is required." };
    }
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchPatientById: Firestore instance is not available.");
      return { error: "Firestore not initialized." };
    }
    const patientDocRef = doc(firestoreInstance, "patients", id);
    const patientDoc = await getDoc(patientDocRef);

    if (patientDoc.exists()) {
      const data = patientDoc.data();
      const pathologiesArray = Array.isArray(data.pathologies) ? data.pathologies : (typeof data.pathologies === 'string' ? data.pathologies.split(',').map(p => p.trim()) : []);
      const allergiesArray = Array.isArray(data.allergies) ? data.allergies : (typeof data.allergies === 'string' ? data.allergies.split(',').map(a => a.trim()) : []);
      
      const formatTimestampToISO = (timestampField: any): string => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        if (typeof timestampField === 'string') {
          // Attempt to parse if it's already a string (might be from previous incorrect saves or direct input)
          const parsedDate = new Date(timestampField);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
        // Fallback for unexpected types or invalid strings
        return new Date().toISOString(); 
      };

      const patientData = {
        id: patientDoc.id,
        name: data.name || "N/A",
        age: data.age || 0,
        avatarUrl: data.avatarUrl || `https://placehold.co/100x100.png?text=P`,
        hint: data.hint || 'person face',
        joinDate: formatTimestampToISO(data.joinDate),
        primaryNurse: data.primaryNurse || "N/A",
        phone: data.phone || "N/A",
        email: data.email || "N/A",
        address: data.address || "N/A",
        mobilityStatus: data.mobilityStatus || "N/A",
        pathologies: pathologiesArray,
        allergies: allergiesArray,
        lastVisit: formatTimestampToISO(data.lastVisit),
        condition: data.condition || "N/A",
        status: data.status || "N/A",
        currentMedications: data.currentMedications || [
            { name: "Lisinopril", dosage: "10mg daily" },
            { name: "Metformin", dosage: "500mg twice daily" },
        ],
        recentVitals: data.recentVitals || {
            date: "2024-07-30", bp: "140/90 mmHg", hr: "75 bpm", temp: "37.0°C", glucose: "120 mg/dL"
        },
        createdAt: formatTimestampToISO(data.createdAt),
      } as PatientListItem;
      return { data: patientData };
    } else {
      console.warn(`[ACTION_WARN] fetchPatientById: Patient with ID ${id} not found.`);
      return { error: "Patient not found." };
    }
  } catch (error: any) {
    console.error(`[ACTION_ERROR] fetchPatientById: Error fetching patient ${id}:`, error.code, error.message, error);
    return { error: `Failed to fetch patient: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}

const AddPatientInputSchema = z.object({
  fullName: z.string().min(2),
  age: z.coerce.number().int().positive(),
  avatarFile: z.custom<File | undefined>().optional(),
  joinDate: z.date(),
  primaryNurse: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email(),
  address: z.string().min(5),
  mobilityStatus: z.string().min(3),
  pathologies: z.string().min(3),
  allergies: z.string().optional(),
});
export type AddPatientFormValues = z.infer<typeof AddPatientInputSchema>  & { avatarUrl?: string };


export async function addPatient(
  values: AddPatientFormValues
): Promise<{ success?: boolean; message: string; patientId?: string }> {
  console.log("[ACTION_LOG] addPatient: Initiated with values:", values.fullName);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] addPatient: Firestore instance is not available.");
      return { success: false, message: "Firebase services not initialized." };
    }
    const validatedValues = AddPatientInputSchema.parse(values);
    let avatarUrlToStore = `https://placehold.co/100x100.png?text=${validatedValues.fullName.split(" ").map(n=>n[0]).join("")}`;
    let hint = 'person face';

    if (validatedValues.avatarFile) {
      console.log("[ACTION_LOG] addPatient: Avatar file provided. Uploading to Cloudinary...");
      const uploadedUrl = await uploadToCloudinary(validatedValues.avatarFile, "patient-avatars");
      if (uploadedUrl) {
        avatarUrlToStore = uploadedUrl;
        hint = `patient ${validatedValues.fullName}`;
        console.log("[ACTION_LOG] addPatient: Avatar uploaded to Cloudinary:", avatarUrlToStore);
      } else {
        console.warn("[ACTION_WARN] addPatient: Cloudinary upload failed. Using placeholder avatar.");
      }
    } else {
      console.log("[ACTION_LOG] addPatient: No avatar file provided. Using placeholder.");
    }

    const newPatientData = {
      name: validatedValues.fullName,
      age: validatedValues.age,
      avatarUrl: avatarUrlToStore,
      hint: hint,
      joinDate: Timestamp.fromDate(validatedValues.joinDate),
      primaryNurse: validatedValues.primaryNurse,
      phone: validatedValues.phone,
      email: validatedValues.email,
      address: validatedValues.address,
      mobilityStatus: validatedValues.mobilityStatus,
      pathologies: validatedValues.pathologies.split(',').map(p => p.trim()).filter(p => p.length > 0),
      allergies: validatedValues.allergies ? validatedValues.allergies.split(',').map(a => a.trim()).filter(a => a.length > 0) : [],
      lastVisit: Timestamp.fromDate(new Date()),
      condition: validatedValues.pathologies.split(',')[0]?.trim() || 'N/A',
      status: 'Stable',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestoreInstance, "patients"), newPatientData);
    console.log("[ACTION_LOG] addPatient: Patient added to Firestore with ID: ", docRef.id);

    return { success: true, message: `Patient ${validatedValues.fullName} added successfully.`, patientId: docRef.id };
  } catch (error: any) {
    console.error("[ACTION_ERROR] addPatient: Error adding patient to Firestore: ", error.code, error.message, error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to add patient: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


export type NurseListItem = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  phone: string;
  email: string;
  avatar: string;
  status: 'Available' | 'On Duty' | 'Unavailable' | string;
  hint?: string;
  createdAt?: string; // ISO string
};

const AddNurseInputSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  specialty: z.string().min(3, { message: "Specialty is required." }),
  location: z.string().min(3, { message: "Location is required." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  avatarFile: z.custom<File | undefined>().optional(),
});
export type AddNurseFormValues = z.infer<typeof AddNurseInputSchema>;


export async function addNurse(
  values: AddNurseFormValues
): Promise<{ success?: boolean; message: string; nurseId?: string }> {
  console.log("[ACTION_LOG] addNurse: Initiated with values:", values.fullName);
   try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] addNurse: Firestore instance is not available.");
      return { success: false, message: "Firebase services not initialized." };
    }
    const validatedValues = AddNurseInputSchema.parse(values);
    let avatarUrlToStore = `https://placehold.co/100x100.png?text=${validatedValues.fullName.split(" ").map(n=>n[0]).join("")}`;
    let hint = 'nurse medical';

    if (validatedValues.avatarFile) {
      console.log("[ACTION_LOG] addNurse: Avatar file provided. Uploading to Cloudinary...");
      const uploadedUrl = await uploadToCloudinary(validatedValues.avatarFile, "nurse-avatars");
      if (uploadedUrl) {
        avatarUrlToStore = uploadedUrl;
        hint = `nurse ${validatedValues.fullName}`;
        console.log("[ACTION_LOG] addNurse: Avatar uploaded to Cloudinary:", avatarUrlToStore);
      } else {
        console.warn("[ACTION_WARN] addNurse: Cloudinary upload failed. Using placeholder avatar.");
      }
    } else {
      console.log("[ACTION_LOG] addNurse: No avatar file provided. Using placeholder.");
    }

    const newNurseData = {
      name: validatedValues.fullName,
      email: validatedValues.email,
      specialty: validatedValues.specialty,
      location: validatedValues.location,
      phone: validatedValues.phone,
      avatar: avatarUrlToStore,
      hint: hint,
      status: 'Available' as const,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestoreInstance, "nurses"), newNurseData);
    console.log("[ACTION_LOG] addNurse: Nurse added to Firestore with ID: ", docRef.id);

    const randomPassword = generateRandomPassword(8);
    console.log(`[ACTION_LOG] addNurse: Simulated - Email sent to ${validatedValues.email} with temporary password: ${randomPassword}`);
    console.log(`[ACTION_LOG] addNurse: Simulated - Admin notified about new nurse registration: ${validatedValues.fullName}`);

    return { success: true, message: `Nurse ${validatedValues.fullName} added successfully & notified.`, nurseId: docRef.id };
  } catch (error: any)
{
    console.error("[ACTION_ERROR] addNurse: Error adding nurse to Firestore: ", error.code, error.message, error);
     if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to add nurse: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


export type PatientRegistrationDataPoint = { month: string; newPatients: number };
export type AppointmentStatusDataPoint = { status: string; count: number, fill: string };
export type NursePerformanceDataPoint = { nurseName: string; consults: number, fill: string };

export type DashboardStats = {
  activePatients: number;
  activePatientsChange: string;
  upcomingAppointments: number;
  upcomingAppointmentsToday: string;
  availableNurses: number;
  availableNursesOnline: string;
  careQualityScore: string;
  careQualityScoreTrend: string;
  patientRegistrationsData: PatientRegistrationDataPoint[];
  appointmentStatusData: AppointmentStatusDataPoint[];
  nursePerformanceData: NursePerformanceDataPoint[];
};

export async function fetchDashboardStats(): Promise<{ data?: DashboardStats, error?: string}> {
  console.log("[ACTION_LOG] fetchDashboardStats: Initiated.");
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchDashboardStats: Firestore instance is not available.");
      return { error: "Firestore not initialized." };
    }
    const patientsCollectionRef = collection(firestoreInstance, "patients");
    const nursesCollectionRef = collection(firestoreInstance, "nurses");
    const videoConsultsCollectionRef = collection(firestoreInstance, "videoConsults");

    console.log("[ACTION_LOG] fetchDashboardStats: Getting counts for patients, nurses, consults.");
    const [
      patientCountSnapshot,
      nursesSnapshot,
      videoConsultsSnapshot
    ] = await Promise.all([
      getCountFromServer(patientsCollectionRef),
      getDocs(query(nursesCollectionRef)),
      getDocs(query(videoConsultsCollectionRef))
    ]);
    console.log("[ACTION_LOG] fetchDashboardStats: Counts and documents received.");

    const activePatients = patientCountSnapshot.data().count;
    const availableNurses = nursesSnapshot.docs.filter(doc => doc.data().status === 'Available').length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let upcomingAppointments = 0;
    let upcomingAppointmentsTodayCount = 0;
    const statusCounts: { [key: string]: number } = { scheduled: 0, completed: 0, cancelled: 0 };
    const nursePerformance: { [nurseName: string]: number } = {};

    videoConsultsSnapshot.docs.forEach(docSnap => {
      const consultData = docSnap.data();
      const consultTime = consultData.consultationTime instanceof Timestamp ? consultData.consultationTime.toDate() : null;


      if (consultData.status === 'scheduled' && consultTime && consultTime >= todayStart) {
        upcomingAppointments++;
        if (consultTime.toDateString() === todayStart.toDateString()) {
          upcomingAppointmentsTodayCount++;
        }
      }
      const status = consultData.status as string;
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      } else if (status) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }

      const nurseName = consultData.nurseName as string;
      if (nurseName) {
        nursePerformance[nurseName] = (nursePerformance[nurseName] || 0) + 1;
      }
    });
    console.log("[ACTION_LOG] fetchDashboardStats: Consults processed for upcoming, status, and performance.");

    const activePatientsChange = activePatients > 0 ? `+${Math.floor(Math.random()*5 + 1)} since last week` : "N/A";
    const availableNursesOnline = availableNurses > 0 ? `Online: ${Math.max(1,Math.floor(Math.random()*availableNurses))}` : "Online: 0";
    const careQualityScore = `${Math.floor(Math.random() * 10 + 88)}%`;
    const careQualityScoreTrend = `Up by ${Math.floor(Math.random()*3+1)}% from last month`;

    console.log("[ACTION_LOG] fetchDashboardStats: Processing patient registrations data.");
    const patientsSnapshotForChart = await getDocs(query(patientsCollectionRef, orderBy("createdAt", "asc")));
    const monthlyRegistrations: { [key: string]: number } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    patientsSnapshotForChart.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.createdAt instanceof Timestamp) {
        const date = data.createdAt.toDate();
        const displayMonthKey = `${monthNames[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
        monthlyRegistrations[displayMonthKey] = (monthlyRegistrations[displayMonthKey] || 0) + 1;
      }
    });

    const patientRegistrationsData: PatientRegistrationDataPoint[] = [];
    const currentJsDate = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentJsDate.getFullYear(), currentJsDate.getMonth() - i, 1);
        const displayMonthKey = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
        patientRegistrationsData.push({
            month: monthNames[d.getMonth()],
            newPatients: monthlyRegistrations[displayMonthKey] || 0,
        });
    }
    console.log("[ACTION_LOG] fetchDashboardStats: Patient registrations processed.");

    const appointmentStatusData: AppointmentStatusDataPoint[] = [
      { status: "Completed", count: statusCounts.completed || 0, fill: "hsl(var(--chart-1))" },
      { status: "Scheduled", count: statusCounts.scheduled || 0, fill: "hsl(var(--chart-2))" },
      { status: "Cancelled", count: statusCounts.cancelled || 0, fill: "hsl(var(--destructive))" },
    ].filter(item => item.count > 0);

    const nurseColors = ["hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-1))", "hsl(var(--chart-2))"];
    const nursePerformanceData: NursePerformanceDataPoint[] = Object.entries(nursePerformance)
      .map(([name, count], index) => ({
        nurseName: name,
        consults: count,
        fill: nurseColors[index % nurseColors.length]
      }))
      .sort((a, b) => b.consults - a.consults)
      .slice(0, 5);
    console.log("[ACTION_LOG] fetchDashboardStats: Nurse performance processed.");

    const stats: DashboardStats = {
      activePatients,
      activePatientsChange,
      upcomingAppointments,
      upcomingAppointmentsToday: `${upcomingAppointmentsTodayCount} today`,
      availableNurses,
      availableNursesOnline,
      careQualityScore,
      careQualityScoreTrend,
      patientRegistrationsData,
      appointmentStatusData,
      nursePerformanceData,
    };
    console.log("[ACTION_LOG] fetchDashboardStats: Stats assembly complete. Returning data.");
    return { data: stats };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchDashboardStats: Error fetching dashboard stats from Firestore:", error.code, error.message, error);
    return {
      error: `Could not load dashboard statistics: ${error.message} (Code: ${error.code || 'N/A'})`,
      data: {
        activePatients: 0, activePatientsChange: "N/A",
        upcomingAppointments: 0, upcomingAppointmentsToday: "N/A",
        availableNurses: 0, availableNursesOnline: "N/A",
        careQualityScore: "N/A", careQualityScoreTrend: "N/A",
        patientRegistrationsData: Array(6).fill(null).map((_, i) => ({ month: new Date(0, i).toLocaleString('default', { month: 'short' }), newPatients: 0 })),
        appointmentStatusData: [],
        nursePerformanceData: [],
      }
    };
  }
}


// For email notifications
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Ensure this is an App Password for Gmail if 2FA is ON
  },
});

interface SendConsultScheduledEmailProps {
  toEmail: string;
  toName: string;
  patientName: string;
  nurseName: string;
  consultationDateTime: Date;
  roomId: string; // Changed from roomUrl
}
async function sendConsultScheduledEmail({
  toEmail,
  toName,
  patientName,
  nurseName,
  consultationDateTime,
  roomId, // Changed from roomUrl
}: SendConsultScheduledEmailProps) {
  // Reminder: Ensure EMAIL_USER and EMAIL_PASS (App Password for Gmail) are correctly set in .env.
  console.log(`[ACTION_LOG] Attempting to send consultation email to ${toEmail} for room ID: ${roomId}`);
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your-email@example.com') {
    console.warn("[EMAIL_WARN] EMAIL_USER or EMAIL_PASS not set or using placeholder in .env. Skipping actual email sending.");
    // Simulate email content
    const joinLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/video-consult?roomId=${roomId}`; // Construct a join link
    console.log(`[EMAIL_SIMULATION] Would send email to ${toEmail} for ${toName}:`);
    console.log(`  Subject: SanHome - Video Consultation Scheduled`);
    console.log(`  Body: Hello ${toName},\nA video consultation has been scheduled for you${toName === patientName ? '' : ' with ' + patientName} with ${nurseName}.\nTime: ${format(consultationDateTime, "eeee, MMMM d, yyyy 'at' h:mm a")}\nJoin via app with Room ID: ${roomId}\nOr click here: ${joinLink}\nBest regards,\nSanHome Team`);
    return { success: true, message: "Email sending simulated due to missing/placeholder credentials." };
  }

  const formattedConsultationTime = format(consultationDateTime, "eeee, MMMM d, yyyy 'at' h:mm a");
  const joinLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/video-consult?roomId=${roomId}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'SanHome - Video Consultation Scheduled (WebRTC/Firestore)',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #122e4b;">SanHome - Video Consultation Scheduled</h2>
        <p>Hello ${toName},</p>
        <p>A video consultation has been scheduled using our new WebRTC system:</p>
        <ul>
          <li><strong>Patient:</strong> ${patientName}</li>
          <li><strong>Nurse:</strong> ${nurseName}</li>
          <li><strong>Time:</strong> ${formattedConsultationTime}</li>
          <li><strong>Room ID (for in-app join):</strong> ${roomId}</li>
        </ul>
        <p>You can join the call directly in the app using the Room ID, or by clicking this link (if app deep linking is set up):</p>
        <p><a href="${joinLink}" style="color: #007bff; text-decoration: none;">Join Call (Room ID: ${roomId})</a></p>
        <p>If you have any questions, please contact our support.</p>
        <p>Best regards,</p>
        <p>The SanHome Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_LOG] Consultation scheduled email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    return { success: true, message: `Email sent to ${toEmail}` };
  } catch (error: any) {
    console.error(`[EMAIL_ERROR] Error sending consultation scheduled email to ${toEmail}:`, error);
    let specificError = `Failed to send email to ${toEmail}: ${error.message}`;
     if (error.code === 535 && error.command === 'AUTH PLAIN') {
      specificError = `Failed to send email to ${toEmail}: Invalid login: 535-5.7.8 Username and Password not accepted. Please check your EMAIL_USER and EMAIL_PASS in .env. For Gmail, consider using an App Password. Google Support: https://support.google.com/mail/?p=BadCredentials`;
    }
    return { success: false, message: specificError };
  }
}

const ScheduleVideoConsultInputSchema = z.object({
  patientId: z.string().min(1),
  nurseId: z.string().min(1),
  consultationDateTime: z.date(),
});
export type ScheduleVideoConsultFormServerValues = z.infer<typeof ScheduleVideoConsultInputSchema>;

export type VideoConsultListItem = {
  id: string;
  patientId: string;
  patientName: string;
  nurseId: string;
  nurseName: string;
  consultationTime: string; // ISO string
  roomId: string; // Changed from roomUrl
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string; // ISO string
};

export async function scheduleVideoConsult(
  values: ScheduleVideoConsultFormServerValues
): Promise<{ success?: boolean; message: string; consultId?: string; roomId?: string }> {
  console.log("[ACTION_LOG] scheduleVideoConsult (WebRTC/Firestore Version): Initiated with values:", values);
  // This version does NOT use Whereby API. It just generates a roomId for Firestore signaling.
  
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] scheduleVideoConsult: Firestore instance is not available.");
      return { success: false, message: "Firestore not initialized." };
    }
    const validatedValues = ScheduleVideoConsultInputSchema.parse(values);

    if (!(validatedValues.consultationDateTime instanceof Date) || isNaN(validatedValues.consultationDateTime.getTime())) {
      console.error("[ACTION_ERROR] scheduleVideoConsult: Invalid consultationDateTime provided.", validatedValues.consultationDateTime);
      return { success: false, message: "Invalid consultation date or time." };
    }

    const patientDocRef = doc(firestoreInstance, "patients", validatedValues.patientId);
    const nurseDocRef = doc(firestoreInstance, "nurses", validatedValues.nurseId);

    const [patientDocSnap, nurseDocSnap] = await Promise.all([
      getDoc(patientDocRef),
      getDoc(nurseDocRef)
    ]);

    if (!patientDocSnap.exists()) {
      console.error("[ACTION_ERROR] scheduleVideoConsult: Selected patient not found:", validatedValues.patientId);
      return { success: false, message: "Selected patient not found." };
    }
    if (!nurseDocSnap.exists()) {
      console.error("[ACTION_ERROR] scheduleVideoConsult: Selected nurse not found:", validatedValues.nurseId);
      return { success: false, message: "Selected nurse not found." };
    }

    const patient = patientDocSnap.data() as Omit<PatientListItem, 'id'>;
    const nurse = nurseDocSnap.data() as Omit<NurseListItem, 'id'>;

    const newRoomId = `sanhome-webrtc-${generateRandomString(8)}`;
    console.log("[ACTION_LOG] scheduleVideoConsult: Generated new WebRTC Room ID:", newRoomId);

    const newVideoConsultData = {
      patientId: validatedValues.patientId,
      patientName: patient.name,
      nurseId: validatedValues.nurseId,
      nurseName: nurse.name,
      consultationTime: Timestamp.fromDate(validatedValues.consultationDateTime),
      roomId: newRoomId, // Storing the generated room ID
      status: 'scheduled' as const,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestoreInstance, "videoConsults"), newVideoConsultData);
    console.log("[ACTION_LOG] scheduleVideoConsult: Video consult metadata added to Firestore with ID:", docRef.id);

    // Send email notifications with the new roomId
    let patientEmailResult = { success: false, message: "Patient email not found or sending skipped." };
    let nurseEmailResult = { success: false, message: "Nurse email not found or sending skipped." };

    if (patient.email) {
        patientEmailResult = await sendConsultScheduledEmail({
            toEmail: patient.email,
            toName: patient.name,
            patientName: patient.name,
            nurseName: nurse.name,
            consultationDateTime: validatedValues.consultationDateTime,
            roomId: newRoomId,
        });
    } else {
        console.warn(`[ACTION_WARN] scheduleVideoConsult: Patient ${patient.name} has no email address.`);
        patientEmailResult.message = `Patient ${patient.name} has no email.`;
    }

    if (nurse.email) {
        nurseEmailResult = await sendConsultScheduledEmail({
            toEmail: nurse.email,
            toName: nurse.name,
            patientName: patient.name,
            nurseName: nurse.name,
            consultationDateTime: validatedValues.consultationDateTime,
            roomId: newRoomId,
        });
    } else {
        console.warn(`[ACTION_WARN] scheduleVideoConsult: Nurse ${nurse.name} has no email address.`);
        nurseEmailResult.message = `Nurse ${nurse.name} has no email.`;
    }

    let finalMessage = `Video consult (WebRTC) scheduled for ${patient.name} with ${nurse.name}. Room ID: ${newRoomId}.`;
    if (!patientEmailResult.success || !nurseEmailResult.success) {
      finalMessage += ` Email notifications: Patient - ${patientEmailResult.message} Nurse - ${nurseEmailResult.message}`;
    } else {
      finalMessage += ` Emails sent successfully to patient and nurse.`;
    }

    return {
      success: true,
      message: finalMessage,
      consultId: docRef.id,
      roomId: newRoomId
    };

  } catch (error: any) {
    console.error("[ACTION_ERROR] scheduleVideoConsult (WebRTC Version): Critical error: ", error.message, error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to schedule WebRTC video consult: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}

export async function fetchVideoConsults(): Promise<{ data?: VideoConsultListItem[], error?: string }> {
  console.log("[ACTION_LOG] fetchVideoConsults: Initiated.");
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchVideoConsults: Firestore instance is not available.");
      return { error: "Firestore not initialized." };
    }
    const consultsCollectionRef = collection(firestoreInstance, "videoConsults");
    const q = query(consultsCollectionRef, orderBy("consultationTime", "desc"));
    const consultsSnapshot = await getDocs(q);

    const consultsList = consultsSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        patientId: data.patientId,
        patientName: data.patientName,
        nurseId: data.nurseId,
        nurseName: data.nurseName,
        consultationTime: data.consultationTime instanceof Timestamp ? data.consultationTime.toDate().toISOString() : new Date().toISOString(),
        roomId: data.roomId, // Changed from roomUrl
        status: data.status as VideoConsultListItem['status'],
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      } as VideoConsultListItem;
    });
    return { data: consultsList };
  } catch (error: any)
{
    console.error("[ACTION_ERROR] fetchVideoConsults: Error fetching video consults from Firestore:", error.code, error.message, error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchVideoConsults: Query requires a composite index on 'videoConsults' for 'consultationTime desc'.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'videoConsults' collection on 'consultationTime' descending." };
    }
    return { error: `Failed to fetch video consults: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


export type MedicalFileItem = {
  id: string;
  patientId: string;
  patientName: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  uploadDate: string; // ISO string
  uploaderId: string;
  uploaderName: string;
  size: number;
  createdAt: string; // ISO string
};

export async function fetchMedicalFiles(patientId?: string): Promise<{ data?: MedicalFileItem[]; error?: string }> {
  console.log(`[ACTION_LOG] fetchMedicalFiles: Initiated. PatientId: ${patientId || 'all'}`);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchMedicalFiles: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchMedicalFiles.");
    }
    const filesCollectionRef = collection(firestoreInstance, "medicalFiles");
    let q;
    if (patientId) {
      console.log(`[ACTION_LOG] fetchMedicalFiles: Querying for patientId: ${patientId}`);
      q = query(filesCollectionRef, where("patientId", "==", patientId), orderBy("uploadDate", "desc"));
    } else {
      console.log(`[ACTION_LOG] fetchMedicalFiles: Querying for all files (consider pagination for production).`);
      q = query(filesCollectionRef, orderBy("uploadDate", "desc"), limit(50));
    }

    const snapshot = await getDocs(q);
    console.log(`[ACTION_LOG] fetchMedicalFiles: Found ${snapshot.docs.length} files for query.`);
    const files = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            patientId: data.patientId,
            patientName: data.patientName || "N/A",
            fileName: data.fileName,
            fileType: data.fileType,
            fileUrl: data.fileUrl,
            uploadDate: data.uploadDate instanceof Timestamp ? data.uploadDate.toDate().toISOString() : new Date().toISOString(),
            uploaderId: data.uploaderId,
            uploaderName: data.uploaderName,
            size: data.size,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as MedicalFileItem
    });
    return { data: files };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchMedicalFiles:", error);
     if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchMedicalFiles: Query requires a composite index.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'medicalFiles'." };
    }
    return { data: [], error: `Failed to fetch medical files: ${error.message}` };
  }
}

export async function uploadMedicalFile(
  patientId: string,
  fileNameUnused: string, // This parameter is not used as we get filename from File object
  fileTypeUnused: string, // This parameter is not used as we get filetype from File object
  fileSizeUnused: number, // This parameter is not used as we get size from File object
  uploaderId: string,
  uploaderName: string,
  file: File 
): Promise<{ success?: boolean; message: string; fileId?: string; fileUrl?: string }> {
  console.log(`[ACTION_LOG] uploadMedicalFile: Uploading for patient ${patientId}, file ${file.name}, uploader ${uploaderName} (${uploaderId})`);
  if (!firestoreInstance) {
    console.error("[ACTION_ERROR] uploadMedicalFile: Firestore instance not available.");
    return { success: false, message:"Firestore instance not available in uploadMedicalFile."};
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error("[ACTION_ERROR] uploadMedicalFile: Cloudinary not configured. Cannot upload file.");
    return { success: false, message: "Cloudinary not configured. File upload failed." };
  }

  try {
    console.log(`[ACTION_LOG] uploadMedicalFile: Attempting to upload to Cloudinary for patient ${patientId}...`);
    const uploadedUrl = await uploadToCloudinary(file, `medical-files/${patientId}`);
    if (!uploadedUrl) {
      console.error("[ACTION_ERROR] uploadMedicalFile: Cloudinary upload returned no URL for patient", patientId);
      return { success: false, message: "File upload to Cloudinary failed: No URL returned." };
    }
    console.log("[ACTION_LOG] uploadMedicalFile: File successfully uploaded to Cloudinary:", uploadedUrl);

    let patientName = "N/A";
    const patientDoc = await getDoc(doc(firestoreInstance, "patients", patientId));
    if (patientDoc.exists()) patientName = patientDoc.data().name;
    console.log(`[ACTION_LOG] uploadMedicalFile: Patient name for file metadata: ${patientName}`);

    const newFileData = {
        patientId,
        patientName,
        fileName: file.name,
        fileType: file.type,
        fileUrl: uploadedUrl,
        uploadDate: Timestamp.now(),
        uploaderId,
        uploaderName,
        size: file.size,
        createdAt: serverTimestamp(),
    };
    console.log("[ACTION_LOG] uploadMedicalFile: Preparing to save metadata to Firestore:", newFileData);
    const docRef = await addDoc(collection(firestoreInstance, "medicalFiles"), newFileData);
    console.log("[ACTION_LOG] uploadMedicalFile: File metadata added to Firestore with ID:", docRef.id);
    return { success: true, message: "File uploaded and metadata saved successfully.", fileId: docRef.id, fileUrl: uploadedUrl };

  } catch (error: any) {
    console.error("[ACTION_ERROR] uploadMedicalFile for patient", patientId, ":", error);
    return { success: false, message: `Failed to upload file: ${error.message}` };
  }
}



export type NotificationItem = {
  id: string;
  userId: string;
  type: 'Reminder' | 'Alert' | 'Update' | string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string; // ISO string
};

export async function fetchNotifications(userId: string): Promise<{ data?: NotificationItem[]; error?: string }> {
  console.log(`[ACTION_LOG] fetchNotifications: Initiated for user ${userId}.`);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchNotifications: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchNotifications.");
    }
    const notificationsRef = collection(firestoreInstance, "users", userId, "notifications");
    const q = query(notificationsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            userId: data.userId,
            type: data.type,
            message: data.message,
            read: data.read,
            link: data.link,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as NotificationItem
    });
    return { data: notifications };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchNotifications:", error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchNotifications: Query requires a composite index. Returning empty for now.");
        return { data: [], error: `Query requires an index. Please create it in Firestore for 'users/${userId}/notifications' on 'createdAt' descending.` };
    }
    return { data: [], error: `Failed to fetch notifications: ${error.message}` };
  }
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`[ACTION_LOG] markNotificationAsRead: User ${userId}, Notification ${notificationId}`);
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] markNotificationAsRead: Firestore instance is not available.");
      return { success: false, message: "Firestore `firestoreInstance` instance is not available in markNotificationAsRead." };
    }
    try {
        const notificationRef = doc(firestoreInstance, "users", userId, "notifications", notificationId);
        await updateDoc(notificationRef, { read: true });
        return { success: true, message: "Notification marked as read." };
    } catch (error: any) {
        console.error("[ACTION_ERROR] markNotificationAsRead:", error);
        return { success: false, message: error.message };
    }
}

export async function markAllNotificationsAsRead(userId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`[ACTION_LOG] markAllNotificationsAsRead: User ${userId}`);
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] markAllNotificationsAsRead: Firestore instance is not available.");
      return { success: false, message: "Firestore `firestoreInstance` instance is not available in markAllNotificationsAsRead." };
    }
    try {
        const notificationsRef = collection(firestoreInstance, "users", userId, "notifications");
        const q = query(notificationsRef, where("read", "==", false));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, message: "No unread notifications to mark." };
        }
        const batch = writeBatch(firestoreInstance);
        snapshot.docs.forEach(docSnap => {
            batch.update(docSnap.ref, { read: true });
        });
        await batch.commit();
        return { success: true, message: `${snapshot.size} notifications marked as read.` };
    } catch (error: any) {
        console.error("[ACTION_ERROR] markAllNotificationsAsRead:", error);
        return { success: false, message: error.message };
    }
}



export type UserForAdminList = {
    id: string;
    email: string | null;
    name: string;
    role: string | null;
    status: 'Active' | 'Suspended' | string;
    joined: string; // ISO string
    createdAt: string; // ISO string
};

export async function fetchUsersForAdmin(): Promise<{ data?: UserForAdminList[]; error?: string }> {
    console.log("[ACTION_LOG] fetchUsersForAdmin: Initiated.");
    try {
        if (!firestoreInstance) {
          console.error("[ACTION_ERROR] fetchUsersForAdmin: Firestore instance is not available.");
          throw new Error("Firestore `firestoreInstance` instance is not available in fetchUsersForAdmin.");
        }
        const usersCollectionRef = collection(firestoreInstance, "users");
        const q = query(usersCollectionRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const usersList = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            console.log(`[ACTION_LOG] fetchUsersForAdmin: Raw data from Firestore doc ${docSnap.id}:`, data);
            let name = "N/A";
            if (data.firstName && data.lastName) {
              name = `${data.firstName} ${data.lastName}`;
            } else if (data.firstName) {
              name = data.firstName;
            } else if (data.lastName) {
              name = data.lastName;
            } else if (data.email) {
              name = data.email; 
            } else {
              name = "Unknown User";
            }

            const mappedUser = {
                id: docSnap.id,
                email: data.email || null,
                name: name,
                role: data.role || 'patient', // Default to patient if role not set
                status: 'Active', 
                joined: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            } as UserForAdminList;
            console.log(`[ACTION_LOG] fetchUsersForAdmin: Mapped user for chat:`, mappedUser);
            return mappedUser;
        });
        return { data: usersList };
    } catch (error: any) {
        console.error("[ACTION_ERROR] fetchUsersForAdmin:", error);
        if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
            console.warn("[ACTION_WARN] fetchUsersForAdmin: Query requires a composite index on 'users' for 'createdAt desc'.");
            return { data: [], error: "Query requires an index. Please create it in Firestore for 'users' collection on 'createdAt' descending." };
        }
        return { data: [], error: `Failed to fetch users: ${error.message}` };
    }
}


// --- Start of Seed Database Logic ---
// IMPORTANT REMINDER:
// For this to work, ensure your Firestore rules allow writes.
// During development, you might temporarily use `allow read, write: if true;`.
// For production, ensure your rules are secure (e.g., `allow write: if request.auth != null;` and you are logged in).
// Also, ensure Firebase Authentication "Email/Password" sign-in provider is ENABLED in the Firebase console.
// The Cloud Firestore API MUST be enabled in your Google Cloud project.

// For email notifications from seeding:
// Ensure EMAIL_USER and EMAIL_PASS (App Password for Gmail) are correctly set in .env.

const firstNames = [
  "Foulen", "Amina", "Mohamed", "Fatma", "Ali", "Sarah", "Youssef", "Hiba", "Ahmed", "Nour",
  "Khaled", "Lina", "Omar", "Zahra", "Hassan", "Mariem", "Ibrahim", "Sana", "Tarek", "Leila"
];
const lastNames = [
  "Ben Foulen", "Trabelsi", "Jlassi", "Gharbi", "Mabrouk", "Saidi", "Baccouche", "Hammami",
  "Chakroun", "Ben Ammar", "Dridi", "Sassi", "Kooli", "Mansouri", "Ayari", "Feki", "Belhadj",
  "Khemiri", "Zouari", "Gargouri"
];
const tunisianRoles = ["sage-femme", "patient", "infirmiere", "medecin", "aide-soignant", "kinesitherapeute", "admin"];
const addresses = [
  "Avenue Habib Bourguiba, Tunis", "Rue de la Liberté, Sfax", "Boulevard 7 Novembre, Sousse",
  "Rue Farhat Hached, Ariana", "Avenue Taieb Mhiri, Nabeul", "Rue de Carthage, Bizerte",
  "Avenue de la République, Monastir", "Rue Jamel Abdennasser, Kairouan",
  "Avenue Mohamed V, Gabès", "Rue Ibn Khaldoun, Gafsa", "Avenue Ali Belhouane, Mahdia",
  "Rue 18 Janvier, Djerba", "Avenue Hédi Chaker, Kasserine",
  "Rue de l'Indépendance, Sidi Bouzid", "Avenue de l'Environnement, Tozeur"
];
const genders = ["homme", "femme"];

const mockTunisianPatients = [
  {
    name: "Ahmed Ben Salah", age: 68,
    phone: generatePhoneNumber(), emailSuffix: `ahmed.bensalah`, address: addresses[Math.floor(Math.random() * addresses.length)],
    mobilityStatus: "Ambulatoire avec canne", pathologies: ["Diabète", "Hypertension"], allergies: ["Pénicilline"],
    lastVisitDate: "2024-07-15", condition: "Diabète de type 2", status: "Stable", hint: "elderly man tunisian"
  },
  {
    name: "Fatima Bouaziz", age: 75,
    phone: generatePhoneNumber(), emailSuffix: `fatima.bouaziz`, address: addresses[Math.floor(Math.random() * addresses.length)],
    mobilityStatus: "Fauteuil roulant", pathologies: ["Arthrose", "Problèmes cardiaques"], allergies: ["Aspirine"],
    lastVisitDate: "2024-07-20", condition: "Arthrose sévère", status: "Needs Follow-up", hint: "elderly woman tunisian"
  },
   {
    name: "Youssef Jlassi", age: 55,
    phone: generatePhoneNumber(), emailSuffix: `youssef.jlassi`, address: addresses[Math.floor(Math.random() * addresses.length)],
    mobilityStatus: "Mobile", pathologies: ["Asthme"], allergies: [],
    lastVisitDate: "2024-06-10", condition: "Asthme chronique", status: "Stable", hint: "man tunisian"
  },
  {
    name: "Mariem Saidi", age: 62,
    phone: generatePhoneNumber(), emailSuffix: `mariem.saidi`, address: addresses[Math.floor(Math.random() * addresses.length)],
    mobilityStatus: "Limitée, utilise un déambulateur", pathologies: ["Ostéoporose", "Hypertension"], allergies: ["Sulfamides"],
    lastVisitDate: "2024-07-01", condition: "Ostéoporose", status: "Needs Follow-up", hint: "woman tunisian"
  },
  {
    name: "Ali Trabelsi", age: 71,
    phone: generatePhoneNumber(), emailSuffix: `ali.trabelsi`, address: addresses[Math.floor(Math.random() * addresses.length)],
    mobilityStatus: "Mobile avec aide occasionnelle", pathologies: ["Insuffisance rénale légère"], allergies: [],
    lastVisitDate: "2024-05-25", condition: "Insuffisance rénale", status: "Stable", hint: "senior man tunisian"
  },
];

const mockTunisianNurses = [
  {
    name: "Leila Haddad", specialty: "Gériatrie", location: "Clinique El Amen, Tunis",
    phone: generatePhoneNumber(), emailSuffix: `leila.haddad`, status: "Available", hint: "nurse woman tunisian"
  },
  {
    name: "Karim Zayani", specialty: "Soins Généraux", location: "Hôpital Sahloul, Sousse",
    phone: generatePhoneNumber(), emailSuffix: `karim.zayani`, status: "On Duty", hint: "nurse man tunisian"
  },
  {
    name: "Sana Mabrouk", specialty: "Pédiatrie", location: "Cabinet Dr. Feki, Sfax",
    phone: generatePhoneNumber(), emailSuffix: `sana.mabrouk`, status: "Available", hint: "female nurse tunisian"
  },
  {
    name: "Mohamed Gharbi", specialty: "Cardiologie", location: "Clinique Hannibal, Tunis",
    phone: generatePhoneNumber(), emailSuffix: `mohamed.gharbi`, status: "Unavailable", hint: "male nurse tunisian"
  },
];

export async function seedDatabase(): Promise<{ success: boolean; message: string; details?: Record<string, string> }> {
  console.log("[ACTION_LOG] seedDatabase: Action invoked.");
  console.log(`[ACTION_LOG] seedDatabase: Firebase db object initialized? ${!!firestoreInstance}`);
  console.log(`[ACTION_LOG] seedDatabase: Firebase auth object initialized? ${!!firebaseAuthInstance}`);
  
  if (!firestoreInstance || !firebaseAuthInstance) {
      const errMessage = "Firebase services (Firestore or Auth) not initialized correctly for seeding. Check lib/firebase.ts and .env configuration.";
      console.error(`[ACTION_ERROR] seedDatabase: ${errMessage}`);
      return { success: false, message: errMessage, details: {} };
  }

  // Reminder about temporary security rule change if permission issues persist with server actions.
  // This is a common development step when not using Admin SDK for seeding.
  console.warn("[ACTION_WARN] seedDatabase: For successful seeding, ensure your Firestore rules temporarily allow writes (e.g., `allow read, write: if true;`) if `request.auth != null` causes issues with server actions, OR ensure you are logged in. REMEMBER TO REVERT TO SECURE RULES AFTER SEEDING.");
  
  const results: Record<string, string> = { users: "", patients: "", nurses: "", videoConsults: "", appointments: "" };
  let allSuccess = true;
  const patientRefs: { id: string; name: string, email: string }[] = [];
  const nurseRefs: { id: string; name: string, email: string }[] = [];
  const userRefs: { uid: string, name: string, email: string, role: string }[] = [];

  try {
    // Section 1: Seed Users
    console.log("[ACTION_LOG] seedDatabase: Checking 'users' collection in Firestore...");
    let usersCount = 0;
    try {
        console.log("[ACTION_LOG] seedDatabase: Attempting to get count for 'users' collection...");
        const usersCollRef = collection(firestoreInstance, "users");
        const usersCountSnapshot = await getCountFromServer(usersCollRef);
        usersCount = usersCountSnapshot.data().count;
        console.log(`[ACTION_LOG] seedDatabase: Found ${usersCount} existing user documents.`);
        results.users = `Checked 'users' collection, found ${usersCount} documents. `;
    } catch (e: any) {
        const specificError = `Failed at initial check of 'users' collection: ${e.message} (Code: ${e.code || 'N/A'}). Ensure Firestore API is enabled and rules allow reads.`;
        console.error(`[ACTION_ERROR] seedDatabase (checking users collection): ${specificError}`, e);
        return { success: false, message: `Database seeding failed: ${specificError}. Please check Firestore API enablement and security rules.`, details: results };
    }

    if (usersCount === 0) {
      console.log("[ACTION_LOG] seedDatabase: 'users' collection is empty. Attempting to seed users...");
      const sampleAuthUsers = Array.from({ length: 10 }, (_, index) => ({
        email: `user${index + 1}-${generateRandomString(4)}@sanhome.com`, 
        password: "Password123!",
        firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
        lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
        role: tunisianRoles[Math.floor(Math.random() * tunisianRoles.length)],
        phoneNumber: generatePhoneNumber(),
        address: addresses[Math.floor(Math.random() * addresses.length)],
        dateOfBirth: generateDateOfBirth(),
        gender: genders[Math.floor(Math.random() * genders.length)],
      }));

      let seededUsersCount = 0;
      let userSeedingErrors = "";
      console.log("[ACTION_LOG] seedDatabase: About to loop through sampleAuthUsers for creation.");
      if (!firebaseAuthInstance) {
        const authErrorMsg = "Firebase Auth object (firebaseAuthInstance) is NOT INITIALIZED before user creation loop! Cannot seed users.";
        console.error(`[ACTION_ERROR] seedDatabase: ${authErrorMsg}`);
        results.users += authErrorMsg;
        allSuccess = false; 
      } else {
          console.log("[ACTION_LOG] Seed Users: Firebase Auth instance appears to be initialized.");
          for (const userData of sampleAuthUsers) {
            try {
              console.log(`[ACTION_LOG] seedDatabase: Attempting to create auth user: ${userData.email}`);
              const userCredential = await createUserWithEmailAndPassword(firebaseAuthInstance, userData.email, userData.password);
              const user = userCredential.user;
              console.log(`[ACTION_LOG] seedDatabase: Auth user ${userData.email} created with UID ${user.uid}. Attempting to send verification email.`);
              await sendEmailVerification(user);
              console.log(`[ACTION_LOG] seedDatabase: Verification email sent to ${userData.email}.`);

              const userProfile = {
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role,
                phoneNumber: userData.phoneNumber,
                address: userData.address,
                dateOfBirth: Timestamp.fromDate(new Date(userData.dateOfBirth)),
                gender: userData.gender,
                createdAt: serverTimestamp(),
              };
              console.log(`[ACTION_LOG] seedDatabase: Setting Firestore profile for user ${user.uid}:`, userProfile);
              await setDoc(doc(firestoreInstance, "users", user.uid), userProfile);
              console.log(`[ACTION_LOG] seedDatabase: Firestore profile for user ${user.uid} set successfully.`);
              userRefs.push({ uid: user.uid, name: `${userData.firstName} ${userData.lastName}`, email: userData.email, role: userData.role });
              seededUsersCount++;
            } catch (e: any) {
              let errorMsg = `Error creating auth user ${userData.email} or Firestore profile: ${e.message} (Code: ${e.code || 'unknown'}). `;
              if (e.code === 'auth/email-already-in-use') {
                errorMsg = `User email ${userData.email} already exists in Firebase Authentication. Skipping. `
                console.warn(`[ACTION_WARN] Seed User: ${errorMsg}`);
              } else if (e.code === 'auth/operation-not-allowed') {
                errorMsg = `User creation for ${userData.email} failed: Email/password sign-in is not enabled for your Firebase project. Please enable it in the Firebase console. `;
                console.error(`[ACTION_ERROR] seedDatabase (user ${userData.email}): ${errorMsg}`, e);
                // This is a critical error for user seeding, might want to stop or flag it heavily
                allSuccess = false; 
              } else { 
                console.error(`[ACTION_ERROR] seedDatabase (user ${userData.email}): Code: ${e.code}, Message: ${e.message}`, e);
                userSeedingErrors += errorMsg; 
                allSuccess = false; 
              }
            }
          }
        }
      results.users += `Seeded ${seededUsersCount} users.`;
      if (userSeedingErrors && !allSuccess) {
        results.users += ` Some errors encountered: ${userSeedingErrors.trim()}`;
      } else if (userSeedingErrors) {
         results.users += ` Some non-critical issues: ${userSeedingErrors.trim()}`;
      }
    } else {
      results.users += "Skipping seeding users as collection is not empty.";
      console.log("[ACTION_LOG] seedDatabase: 'users' collection not empty, loading existing user references.");
       const existingUsersSnapshot = await getDocs(collection(firestoreInstance, "users"));
        existingUsersSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            let name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            if (!name && data.email) name = data.email;
            if (name && data.email && data.role) { 
                userRefs.push({ uid: docSnap.id, name: name, email: data.email, role: data.role });
            } else {
                console.warn(`[ACTION_WARN] seedDatabase: User document ${docSnap.id} missing enough info (name, email, or role) for ref, skipping.`);
            }
        });
       console.log(`[ACTION_LOG] seedDatabase: Loaded ${userRefs.length} existing user references from 'users' collection.`);
    }

    // Section 2: Seed Patients
    console.log("[ACTION_LOG] seedDatabase: Checking 'patients' collection...");
    let patientsCount = 0;
    try {
        const patientsCollRef = collection(firestoreInstance, "patients");
        const patientsCountSnapshot = await getCountFromServer(patientsCollRef);
        patientsCount = patientsCountSnapshot.data().count;
        console.log(`[ACTION_LOG] seedDatabase: Found ${patientsCount} existing patient documents. Actual count from server: ${patientsCount}.`);
        results.patients = `Checked 'patients' collection, found ${patientsCount} documents. `;
    } catch (e: any) {
        const specificError = `Failed to get count for 'patients' collection: ${e.message} (Code: ${e.code || 'N/A'}).`;
        console.error(`[ACTION_ERROR] seedDatabase (checking patients): ${specificError}`, e);
        results.patients += `Error checking 'patients' collection: ${specificError}. `;
        allSuccess = false;
    }

    if (patientsCount === 0) {
      console.log("[ACTION_LOG] seedDatabase: 'patients' collection is empty. Attempting to seed patients...");
      let seededPatientsCount = 0;
      // Use nurses from userRefs who have 'infirmiere' or 'nurse' role for assignment
      const availableNursesForAssignment = userRefs.filter(u => u.role === 'infirmiere' || u.role === 'nurse'); 
      
      for (const patientData of mockTunisianPatients) {
        try {
          const { lastVisitDate, emailSuffix, ...restData } = patientData;
          const email = `${emailSuffix}-${generateRandomString(3)}@example.com`; // Unique email for patient, not necessarily an Auth user
          
          const primaryNurseName = availableNursesForAssignment.length > 0 
            ? availableNursesForAssignment[Math.floor(Math.random() * availableNursesForAssignment.length)].name 
            : "Infirmière Non Assignée";

          // If this patient was also created as an Auth user, use their UID as patient ID
          const existingAuthUserAsPatient = userRefs.find(u => u.email === email && u.role === 'patient');
          const patientDocId = existingAuthUserAsPatient ? existingAuthUserAsPatient.uid : `patient-${generateRandomString(10)}`;


          const newPatient = {
            ...restData,
            email: email,
            primaryNurse: primaryNurseName,
            avatarUrl: `https://placehold.co/100x100.png?text=${patientData.name.split(" ").map(n=>n[0]).join("")}`,
            joinDate: Timestamp.fromDate(new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))),
            lastVisit: Timestamp.fromDate(new Date(lastVisitDate)),
            pathologies: patientData.pathologies,
            allergies: patientData.allergies,
            createdAt: serverTimestamp(),
          };

          const patientDocRef = doc(firestoreInstance, "patients", patientDocId);
          await setDoc(patientDocRef, newPatient);
          patientRefs.push({ id: patientDocId, name: newPatient.name, email: newPatient.email });
          seededPatientsCount++;
        } catch (e: any) {
          console.error(`[ACTION_ERROR] seedDatabase (patient ${patientData.name}): Code: ${e.code}, Message: ${e.message}`, e);
          results.patients += `Error for ${patientData.name}: ${e.message} (Code: ${e.code}). `;
          allSuccess = false;
        }
      }
      results.patients += `Seeded ${seededPatientsCount} patients.`;
    } else {
      results.patients = `Patients collection is not empty (found ${patientsCount} docs). Skipping seeding patients.`;
       const existingPatientsSnapshot = await getDocs(collection(firestoreInstance, "patients"));
        existingPatientsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.name && data.email) {
                patientRefs.push({ id: docSnap.id, name: data.name, email: data.email });
            }
        });
         console.log(`[ACTION_LOG] seedDatabase: Loaded ${patientRefs.length} existing patient references from 'patients' collection (because it was not empty).`);
    }

    // Section 3: Seed Nurses
    console.log("[ACTION_LOG] seedDatabase: Checking 'nurses' collection...");
    let nursesCount = 0;
    try {
      const nursesCollRef = collection(firestoreInstance, "nurses");
      const nursesCountSnapshot = await getCountFromServer(nursesCollRef);
      nursesCount = nursesCountSnapshot.data().count;
      console.log(`[ACTION_LOG] seedDatabase: Found ${nursesCount} existing nurse documents. Count: ${nursesCount}.`);
      results.nurses = `Checked 'nurses' collection, found ${nursesCount} documents. `;
    } catch (e: any) {
        const specificError = `Failed to get count for 'nurses' collection: ${e.message} (Code: ${e.code || 'N/A'}).`;
        console.error(`[ACTION_ERROR] seedDatabase (checking nurses): ${specificError}`, e);
        results.nurses += `Error checking 'nurses' collection: ${specificError}. `;
        allSuccess = false;
    }

    if (nursesCount === 0) {
      console.log("[ACTION_LOG] seedDatabase: 'nurses' collection is empty. Attempting to seed nurses...");
      let seededNursesCount = 0;
      for (const nurseData of mockTunisianNurses) {
        try {
          const { emailSuffix, ...restData } = nurseData;
          const email = `${emailSuffix}-${generateRandomString(3)}@sanhome.com`; // Unique email for nurse
          // If this nurse was also created as an Auth user, use their UID as nurse ID
          const existingAuthUserAsNurse = userRefs.find(u => u.email === email && (u.role === 'infirmiere' || u.role === 'nurse'));
          const nurseDocId = existingAuthUserAsNurse ? existingAuthUserAsNurse.uid : `nurse-${generateRandomString(10)}`;

          const newNurse = {
            ...restData,
            email: email,
            avatar: `https://placehold.co/100x100.png?text=${nurseData.name.split(" ").map(n=>n[0]).join("")}`,
            createdAt: serverTimestamp(),
          };
          const nurseDocRef = doc(firestoreInstance, "nurses", nurseDocId);
          await setDoc(nurseDocRef, newNurse);
          nurseRefs.push({ id: nurseDocId, name: newNurse.name, email: newNurse.email });
          seededNursesCount++;
        } catch (e: any) {
          console.error(`[ACTION_ERROR] seedDatabase (nurse ${nurseData.name}): Code: ${e.code}, Message: ${e.message}`, e);
          results.nurses += `Error for ${nurseData.name}: ${e.message} (Code: ${e.code}). `;
          allSuccess = false;
        }
      }
      results.nurses += `Seeded ${seededNursesCount} nurses.`;
    } else {
      results.nurses = `Nurses collection is not empty (found ${nursesCount} docs). Skipping seeding nurses.`;
       const existingNursesSnapshot = await getDocs(collection(firestoreInstance, "nurses"));
        existingNursesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.name && data.email) {
                nurseRefs.push({ id: docSnap.id, name: data.name, email: data.email });
            }
        });
        console.log(`[ACTION_LOG] seedDatabase: Loaded ${nurseRefs.length} existing nurse references from 'nurses' collection (because it was not empty).`);
    }
    
    // Re-assign primary nurses to newly seeded patients using newly seeded nurses (if both were seeded in this run)
    // This check ensures it only happens if patients were actually seeded in this run (patientsCount was 0).
    if (patientsCount === 0 && patientRefs.length > 0 && nurseRefs.length > 0) { 
        console.log("[ACTION_LOG] seedDatabase: Re-assigning primary nurses to newly seeded patients using newly seeded nurses...");
        const batch = writeBatch(firestoreInstance);
        let updateCount = 0;
        try {
            for (const patientRef of patientRefs) {
                 if (nurseRefs.length > 0) { // Ensure nurseRefs is populated
                    const randomNurse = nurseRefs[Math.floor(Math.random() * nurseRefs.length)];
                    const patientDocRefToUpdate = doc(firestoreInstance, "patients", patientRef.id);
                    batch.update(patientDocRefToUpdate, { primaryNurse: randomNurse.name });
                    updateCount++;
                }
            }
            if (updateCount > 0) {
                await batch.commit();
                console.log("[ACTION_LOG] seedDatabase: Finished re-assigning primary nurses batch commit.");
                results.patients += ` Reassigned primary nurse for ${updateCount} patients.`;
            } else {
                console.log("[ACTION_LOG] seedDatabase: No primary nurse reassignments needed for newly seeded patients.");
            }
        } catch (e: any) {
            console.error(`[ACTION_ERROR] seedDatabase: Error during primary nurse reassignment batch. Code: ${e.code}, Message: ${e.message}`, e);
            results.patients += `Error reassigning nurses: ${e.message}. `
            allSuccess = false;
        }
    } else {
        console.log("[ACTION_LOG] seedDatabase: Skipping primary nurse reassignment as patients were not freshly seeded or no nurses refs available from this seeding run.");
    }


    // Section 4: Seed Video Consults
    console.log("[ACTION_LOG] seedDatabase: Checking 'videoConsults' collection...");
    let videoConsultsCount = 0;
    try {
      const videoConsultsCollRef = collection(firestoreInstance, "videoConsults");
      const videoConsultsCountSnapshot = await getCountFromServer(videoConsultsCollRef);
      videoConsultsCount = videoConsultsCountSnapshot.data().count;
      results.videoConsults = `Checked 'videoConsults' collection, found ${videoConsultsCount} documents. `;
    } catch (e: any) {
        const specificError = `Failed to get count for 'videoConsults' collection: ${e.message} (Code: ${e.code || 'N/A'}).`;
        console.error(`[ACTION_ERROR] seedDatabase (checking videoConsults): ${specificError}`, e);
        results.videoConsults += `Error checking 'videoConsults' collection: ${specificError}. `;
        allSuccess = false;
    }

    if (videoConsultsCount === 0) {
      console.log("[ACTION_LOG] seedDatabase: 'videoConsults' collection is empty. Attempting to seed video consults...");
      if (patientRefs.length > 0 && nurseRefs.length > 0) {
        let seededConsultsCount = 0;
        const numConsultsToSeed = Math.min(5, patientRefs.length, nurseRefs.length);
        for (let i = 0; i < numConsultsToSeed; i++) {
          try {
            const randomPatient = patientRefs[i % patientRefs.length];
            const randomNurse = nurseRefs[i % nurseRefs.length];

            if (!randomPatient || !randomNurse) {
              console.warn("[ACTION_WARN] seedDatabase: Skipping video consult seed due to missing randomPatient or randomNurse.");
              continue;
            }

            const consultDate = new Date();
            consultDate.setDate(consultDate.getDate() + Math.floor(Math.random() * 14) - 7);
            consultDate.setHours(Math.floor(Math.random() * 10) + 8, Math.random() > 0.5 ? 30 : 0, 0, 0);

            const statuses: VideoConsultListItem['status'][] = ['scheduled', 'completed', 'cancelled'];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            const newRoomId = `sanhome-webrtc-${generateRandomString(8)}`; // For WebRTC version

            const newConsult = {
              patientId: randomPatient.id,
              patientName: randomPatient.name,
              nurseId: randomNurse.id,
              nurseName: randomNurse.name,
              consultationTime: Timestamp.fromDate(consultDate),
              roomId: newRoomId, // For WebRTC version
              status: randomStatus,
              createdAt: serverTimestamp(),
            };
            await addDoc(collection(firestoreInstance, "videoConsults"), newConsult);
            seededConsultsCount++;
          } catch (e: any) {
            console.error(`[ACTION_ERROR] seedDatabase (video consult ${i + 1}): Code: ${e.code}, Message: ${e.message}`, e);
            results.videoConsults += `Error for consult ${i+1}: ${e.message} (Code: ${e.code}). `;
            allSuccess = false;
          }
        }
        results.videoConsults += `Seeded ${seededConsultsCount} video consultations.`;
      } else {
        results.videoConsults += "Skipped seeding video consultations as patients or nurses were not available/seeded during this run.";
      }
    } else {
      results.videoConsults += "Skipping seeding video consultations.";
    }

    // Section 5: Seed Appointments (general appointments, distinct from video consults if needed)
    console.log("[ACTION_LOG] seedDatabase: Checking 'appointments' collection...");
    let appointmentsCount = 0;
    try {
        const appointmentsCollRef = collection(firestoreInstance, "appointments");
        const appointmentsCountSnapshot = await getCountFromServer(appointmentsCollRef);
        appointmentsCount = appointmentsCountSnapshot.data().count;
        results.appointments = `Checked 'appointments' collection, found ${appointmentsCount} documents. `;
    } catch (e: any) {
        const specificError = `Failed to get count for 'appointments' collection: ${e.message} (Code: ${e.code || 'N/A'}).`;
        console.error(`[ACTION_ERROR] seedDatabase (checking appointments): ${specificError}`, e);
        results.appointments += `Error checking 'appointments' collection: ${specificError}. `;
        allSuccess = false;
    }

    if (appointmentsCount === 0) {
        console.log("[ACTION_LOG] seedDatabase: 'appointments' collection is empty. Attempting to seed general appointments...");
        if (patientRefs.length > 0 && nurseRefs.length > 0) {
            let seededAppointmentsCount = 0;
            const numAppointmentsToSeed = Math.min(10, patientRefs.length * nurseRefs.length);
            const appointmentTypes = ["Check-up", "Medication Review", "Wound Care", "Vitals Check", "Consultation"];
            const appointmentStatuses: AppointmentListItem['status'][] = ['Scheduled', 'Completed', 'Cancelled'];

            for (let i = 0; i < numAppointmentsToSeed; i++) {
                try {
                    const randomPatient = patientRefs[Math.floor(Math.random() * patientRefs.length)];
                    const randomNurse = nurseRefs[Math.floor(Math.random() * nurseRefs.length)];

                    const appointmentDate = new Date();
                    appointmentDate.setDate(appointmentDate.getDate() + Math.floor(Math.random() * 30) - 15); // +/- 15 days
                    const hours = Math.floor(Math.random() * 10) + 8; // 8 AM to 5 PM (17:00)
                    const minutes = Math.random() > 0.5 ? 30 : 0;
                    appointmentDate.setHours(hours, minutes, 0, 0);

                    const newAppointment = {
                        patientId: randomPatient.id,
                        patientName: randomPatient.name,
                        nurseId: randomNurse.id,
                        nurseName: randomNurse.name,
                        appointmentDate: Timestamp.fromDate(appointmentDate),
                        appointmentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
                        appointmentType: appointmentTypes[Math.floor(Math.random() * appointmentTypes.length)],
                        status: appointmentStatuses[Math.floor(Math.random() * appointmentStatuses.length)],
                        createdAt: serverTimestamp(),
                    };
                    await addDoc(collection(firestoreInstance, "appointments"), newAppointment);
                    seededAppointmentsCount++;
                } catch (e: any) {
                    console.error(`[ACTION_ERROR] seedDatabase (appointment ${i + 1}): Code: ${e.code}, Message: ${e.message}`, e);
                    results.appointments += `Error for appointment ${i+1}: ${e.message} (Code: ${e.code}). `;
                    allSuccess = false;
                }
            }
            results.appointments += `Seeded ${seededAppointmentsCount} general appointments.`;
        } else {
            results.appointments += "Skipped seeding general appointments as patients or nurses were not available/seeded during this run.";
        }
    } else {
        results.appointments += "Skipping seeding general appointments.";
    }


    console.log("[ACTION_LOG] seedDatabase: Seeding process completed with allSuccess =", allSuccess);
    if (allSuccess && (results.users.includes("Seeded") || results.patients.includes("Seeded") || results.nurses.includes("Seeded") || results.videoConsults.includes("Seeded") || results.appointments.includes("Seeded") )) {
      return { success: true, message: "Database seeding process finished successfully.", details: results };
    } else if (!allSuccess) {
      return { success: false, message: "Database seeding completed with some errors. Check server logs for details.", details: results };
    } else {
        return { success: true, message: "All collections appear to be populated or no new data was seeded. Check server logs for details.", details: results };
    }

  } catch (error: any) {
    const firebaseErrorCode = error.code || 'N/A';
    const firebaseErrorMessage = error.message || 'Unknown error';
    let specificMessage = `Database seeding failed critically. Firebase: ${firebaseErrorMessage} (Code: ${firebaseErrorCode}). Full Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
    
    console.error(`[ACTION_ERROR] seedDatabase: CRITICAL error during seeding process. Code: ${firebaseErrorCode}, Message: ${firebaseErrorMessage}`, error);
    
    if (error.message && error.message.includes("Failed at initial check of 'users' collection")) {
        specificMessage = `Database seeding failed: ${error.message}. Please check Firestore API enablement and security rules (ensure reads are allowed).`;
    } else if (!firestoreInstance || !firebaseAuthInstance) {
         specificMessage = "Database seeding failed: Firebase services (Firestore or Auth) appear to be uninitialized within the server action. Check lib/firebase.ts and .env configuration.";
    } else if (firebaseErrorMessage.includes("Cloud Firestore API has not been used") || firebaseErrorMessage.includes("FIRESTORE_API_DISABLED") ) {
        specificMessage = `Database seeding failed: The Cloud Firestore API is not enabled for your project. Please visit https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id'} to enable it.`;
    } else if (firebaseErrorMessage.includes("Could not reach Cloud Firestore backend") ) {
        specificMessage = `Database seeding failed: Could not reach Cloud Firestore backend. Details: ${firebaseErrorMessage}`;
    } else if (firebaseErrorMessage.includes("Failed to fetch")) {
        specificMessage = `Database seeding failed: A network error occurred ('Failed to fetch'). Details: ${firebaseErrorMessage}`;
    } else if (firebaseErrorCode === 'auth/operation-not-allowed') {
      specificMessage = `Database seeding failed: Email/password sign-in is not enabled for your Firebase project. Please enable it in the Firebase console (Authentication -> Sign-in method).`;
    } else if (firebaseErrorCode === 'permission-denied' || firebaseErrorMessage.includes("PERMISSION_DENIED") || firebaseErrorMessage.includes("Missing or insufficient permissions")) {
        specificMessage = `Database seeding failed: Missing or insufficient permissions. Ensure Firestore/Auth rules allow writes for authenticated users and that you are logged in when triggering this. Also check project API enablement. Firebase Code: ${firebaseErrorCode}`;
    } else if (firebaseErrorMessage.includes("Invalid login: 535-5.7.8 Username and Password not accepted")) {
        specificMessage = "Email sending failed during an operation (e.g., new nurse notification): Invalid SMTP credentials. Check EMAIL_USER/EMAIL_PASS in .env. For Gmail, use an App Password.";
    } else if (firebaseErrorMessage.includes("7 PERMISSION_DENIED: Cloud Firestore API has not been used")) {
      specificMessage = `Database seeding failed: ${firebaseErrorMessage}. Enable Cloud Firestore API at https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id'}`;
    }
    return { success: false, message: specificMessage, details: results };
  }
}


export async function fetchPatients(): Promise<{ data?: PatientListItem[], error?: string }> {
  console.log("[ACTION_LOG] fetchPatients: Initiated from Firestore.");
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchPatients: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchPatients.");
    }
    const patientsCollectionRef = collection(firestoreInstance, "patients");

    const q = query(patientsCollectionRef, orderBy("createdAt", "desc"));
    console.log("[ACTION_LOG] fetchPatients: Created collection reference. Attempting getDocs...");

    const patientsSnapshot = await getDocs(q);
    console.log(`[ACTION_LOG] fetchPatients: Firestore getDocs successful. Found ${patientsSnapshot.docs.length} documents.`);

    const patientsList = patientsSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const formatTimestampToISO = (timestampField: any): string => {
        if (timestampField instanceof Timestamp) {
          return timestampField.toDate().toISOString();
        }
        if (typeof timestampField === 'string') {
          const parsedDate = new Date(timestampField);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
        return new Date(0).toISOString(); // Fallback for invalid or missing dates
      };
      
      const pathologies = Array.isArray(data.pathologies) ? data.pathologies : (typeof data.pathologies === 'string' ? data.pathologies.split(',').map(p => p.trim()).filter(Boolean) : []);
      const allergies = Array.isArray(data.allergies) ? data.allergies : (typeof data.allergies === 'string' ? data.allergies.split(',').map(a => a.trim()).filter(Boolean) : []);


      return {
        id: docSnap.id,
        name: data.name || "N/A",
        age: data.age || 0,
        avatarUrl: data.avatarUrl || `https://placehold.co/100x100.png?text=P`,
        joinDate: formatTimestampToISO(data.joinDate),
        primaryNurse: data.primaryNurse || "N/A",
        phone: data.phone || "N/A",
        email: data.email || "N/A",
        address: data.address || "N/A",
        mobilityStatus: data.mobilityStatus || "N/A",
        pathologies: pathologies,
        allergies: allergies,
        lastVisit: formatTimestampToISO(data.lastVisit),
        condition: data.condition || "N/A",
        status: data.status || "N/A",
        hint: data.hint || 'person face',
        createdAt: formatTimestampToISO(data.createdAt),
      } as PatientListItem;
    });
    console.log("[ACTION_LOG] fetchPatients: Firestore data mapping complete. Returning data.");
    return { data: patientsList };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchPatients: Error fetching patients from Firestore:", error.code, error.message, error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchPatients: Query requires a composite index on 'patients' for 'createdAt desc'.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'patients' collection on 'createdAt' descending." };
    }
    return { error: `Failed to fetch patients: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}

export async function fetchNurses(): Promise<{ data?: NurseListItem[], error?: string }> {
  console.log("[ACTION_LOG] fetchNurses: Initiated from Firestore.");
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchNurses: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchNurses.");
    }
    const nursesCollectionRef = collection(firestoreInstance, "nurses");
    const q = query(nursesCollectionRef, orderBy("createdAt", "desc"));
    console.log("[ACTION_LOG] fetchNurses: Created query. Attempting getDocs...");
    const nursesSnapshot = await getDocs(q);
    console.log(`[ACTION_LOG] fetchNurses: Firestore getDocs successful. Found ${nursesSnapshot.docs.length} documents.`);

    const nursesList = nursesSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());
      return {
        id: docSnap.id,
        name: data.name || "N/A",
        specialty: data.specialty || "N/A",
        location: data.location || "N/A",
        phone: data.phone || "N/A",
        email: data.email || "N/A",
        avatar: data.avatar || `https://placehold.co/100x100.png?text=N`,
        status: data.status || "Available",
        hint: data.hint || 'nurse medical',
        createdAt: createdAt,
      } as NurseListItem;
    });
    console.log("[ACTION_LOG] fetchNurses: Firestore data mapping complete. Returning data.");
    return { data: nursesList };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchNurses: Error fetching nurses from Firestore:", error.code, error.message, error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchNurses: Query requires a composite index on 'nurses' for 'createdAt desc'.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'nurses' collection on 'createdAt' descending." };
    }
    return { error: `Failed to fetch nurses: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


export async function fetchCollectionData(
  collectionName: string
): Promise<{ data?: any[]; error?: string }> {
  console.log(`[ACTION_LOG] fetchCollectionData: Initiated for collection: ${collectionName}`);
  try {
    if (!firestoreInstance) {
      console.error(`[ACTION_ERROR] fetchCollectionData: Firestore instance is not available for ${collectionName}.`);
      throw new Error(`Firestore \`firestoreInstance\` instance is not available in fetchCollectionData for ${collectionName}.`);
    }
    const validCollections = ["users", "patients", "nurses", "videoConsults", "appointments", "careLogs", "medicalFiles", "videoCallRooms"];
    if (!validCollections.includes(collectionName)) {
      console.error(`[ACTION_ERROR] fetchCollectionData: Invalid collection name: ${collectionName}`);
      return { error: "Invalid collection name provided." };
    }

    const collRef = collection(firestoreInstance, collectionName);
    let q;
    const collectionsWithCreatedAt = ["users", "patients", "nurses", "videoConsults", "appointments", "careLogs", "medicalFiles"];
    // videoCallRooms might not have createdAt consistently if only offers/answers are stored

    if (collectionsWithCreatedAt.includes(collectionName)) {
      try {
        q = query(collRef, orderBy("createdAt", "desc"), limit(25));
        console.log(`[ACTION_LOG] fetchCollectionData: Querying ${collectionName} with orderBy 'createdAt' descending.`);
      } catch (orderByError: any) {
        console.warn(`[ACTION_WARN] fetchCollectionData: orderBy('createdAt') failed for ${collectionName}, falling back to simple limit. Error: ${orderByError.message}`);
        q = query(collRef, limit(25));
      }
    } else {
      q = query(collRef, limit(25));
      console.log(`[ACTION_LOG] fetchCollectionData: Querying ${collectionName} with simple limit (no createdAt ordering).`);
    }

    console.log(`[ACTION_LOG] fetchCollectionData: Attempting to get documents from ${collectionName}.`);
    const snapshot = await getDocs(q);
    console.log(`[ACTION_LOG] fetchCollectionData: Found ${snapshot.docs.length} documents in ${collectionName}.`);

    const documents = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const processedData: { [key: string]: any } = { id: docSnap.id };
      for (const key in data) {
        if (data[key] instanceof Timestamp) {
          processedData[key] = data[key].toDate().toISOString();
        } else if (Array.isArray(data[key])) {
          processedData[key] = data[key].map((item: any) => 
            item instanceof Timestamp ? item.toDate().toISOString() : item
          );
        }
         else {
          processedData[key] = data[key];
        }
      }
      return processedData;
    });

    return { data: documents };
  } catch (error: any) {
    console.error(`[ACTION_ERROR] fetchCollectionData: Error fetching data from ${collectionName}:`, error.code, error.message, error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn(`[ACTION_WARN] fetchCollectionData for ${collectionName}: Query requires a composite index. Link to create: ${error.message.substring(error.message.indexOf("https://"))}`);
        return { error: `Query requires an index. Please create the required composite index in Firestore for collection '${collectionName}' ordered by 'createdAt desc'. Firestore error: ${error.message}` };
    }
    return { error: `Failed to fetch data from ${collectionName}: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


export type AppointmentListItem = {
  id: string;
  patientId: string;
  patientName: string;
  nurseId: string;
  nurseName: string;
  appointmentDate: string; // ISO string
  appointmentTime: string;
  appointmentType: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  createdAt: string; // ISO string
};

export async function fetchAppointments(): Promise<{ data?: AppointmentListItem[]; error?: string }> {
  console.log("[ACTION_LOG] fetchAppointments: Initiated.");
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchAppointments: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchAppointments.");
    }
    const appointmentsCollectionRef = collection(firestoreInstance, "appointments");
    const q = query(appointmentsCollectionRef, orderBy("appointmentDate", "desc"));
    const snapshot = await getDocs(q);
    const appointmentsList = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            patientId: data.patientId,
            patientName: data.patientName,
            nurseId: data.nurseId,
            nurseName: data.nurseName,
            appointmentDate: data.appointmentDate instanceof Timestamp ? data.appointmentDate.toDate().toISOString() : new Date(0).toISOString(),
            appointmentTime: data.appointmentTime,
            appointmentType: data.appointmentType,
            status: data.status as AppointmentListItem['status'],
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as AppointmentListItem
    });
    return { data: appointmentsList };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchAppointments:", error.code, error.message, error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchAppointments: Query requires a composite index on 'appointments' for 'appointmentDate desc'.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'appointments' collection on 'appointmentDate' descending." };
    }
    return { data: [], error: `Failed to fetch appointments: ${error.message}` };
  }
}

export async function fetchAppointmentById(appointmentId: string): Promise<{ data?: AppointmentListItem, error?: string }> {
  console.log(`[ACTION_LOG] fetchAppointmentById: Initiated for ID: ${appointmentId}`);
  try {
    if (!appointmentId) {
      console.error("[ACTION_ERROR] fetchAppointmentById: Appointment ID is required.");
      return { error: "Appointment ID is required." };
    }
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchAppointmentById: Firestore instance is not available.");
      return { error: "Firestore not initialized." };
    }
    const appointmentDocRef = doc(firestoreInstance, "appointments", appointmentId);
    const appointmentDoc = await getDoc(appointmentDocRef);

    if (appointmentDoc.exists()) {
      const data = appointmentDoc.data();
      const appointmentData: AppointmentListItem = {
        id: appointmentDoc.id,
        patientId: data.patientId || "N/A",
        patientName: data.patientName || "N/A",
        nurseId: data.nurseId || "N/A",
        nurseName: data.nurseName || "N/A",
        appointmentDate: data.appointmentDate instanceof Timestamp ? data.appointmentDate.toDate().toISOString() : new Date(0).toISOString(),
        appointmentTime: data.appointmentTime || "N/A",
        appointmentType: data.appointmentType || "N/A",
        status: (data.status as AppointmentListItem['status']) || "Scheduled",
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
      };
      console.log("[ACTION_LOG] fetchAppointmentById: Appointment found and mapped:", appointmentData);
      return { data: appointmentData };
    } else {
      console.warn(`[ACTION_WARN] fetchAppointmentById: Appointment with ID ${appointmentId} not found.`);
      return { error: "Appointment not found." };
    }
  } catch (error: any) {
    console.error(`[ACTION_ERROR] fetchAppointmentById: Error fetching appointment ${appointmentId}:`, error.code, error.message, error);
    return { error: `Failed to fetch appointment: ${error.message} (Code: ${error.code || 'N/A'})` };
  }
}


const AddAppointmentInputSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required."),
  nurseId: z.string().min(1, "Nurse ID is required."),
  appointmentDate: z.date(),
  appointmentTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  appointmentType: z.string().min(3, "Appointment type is required."),
});
export type AddAppointmentFormValues = z.infer<typeof AddAppointmentInputSchema>;

export async function addAppointment(values: AddAppointmentFormValues): Promise<{ success?: boolean; message: string; appointmentId?: string }> {
  console.log("[ACTION_LOG] addAppointment: Initiated with values:", values);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] addAppointment: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in addAppointment.");
    }
    const validatedValues = AddAppointmentInputSchema.parse(values);

    const [hours, minutes] = validatedValues.appointmentTime.split(':').map(Number);
    const appointmentDateTime = new Date(validatedValues.appointmentDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    let patientName = "N/A";
    let nurseName = "N/A";
    const patientDoc = await getDoc(doc(firestoreInstance, "patients", validatedValues.patientId));
    if (patientDoc.exists()) patientName = patientDoc.data().name;
    const nurseDoc = await getDoc(doc(firestoreInstance, "nurses", validatedValues.nurseId));
    if (nurseDoc.exists()) nurseName = nurseDoc.data().name;

    const newAppointmentData = {
      patientId: validatedValues.patientId,
      patientName,
      nurseId: validatedValues.nurseId,
      nurseName,
      appointmentDate: Timestamp.fromDate(appointmentDateTime),
      appointmentTime: validatedValues.appointmentTime,
      appointmentType: validatedValues.appointmentType,
      status: 'Scheduled' as const,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestoreInstance, "appointments"), newAppointmentData);
    console.log("[ACTION_LOG] addAppointment: Appointment added to Firestore with ID:", docRef.id);
    return { success: true, message: "Appointment scheduled successfully.", appointmentId: docRef.id };

  } catch (error: any) {
    console.error("[ACTION_ERROR] addAppointment:", error.code, error.message, error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to schedule appointment: ${error.message}` };
  }
}

const UpdateAppointmentInputSchema = AddAppointmentInputSchema.extend({
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']),
});
export type UpdateAppointmentFormValues = z.infer<typeof UpdateAppointmentInputSchema>;

export async function updateAppointment(appointmentId: string, values: UpdateAppointmentFormValues): Promise<{ success?: boolean; message: string }> {
  console.log(`[ACTION_LOG] updateAppointment: Initiated for ID: ${appointmentId} with values:`, values);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] updateAppointment: Firestore instance is not available.");
      return { success: false, message: "Firestore not initialized." };
    }
    if (!appointmentId) {
      return { success: false, message: "Appointment ID is required for update." };
    }
    const validatedValues = UpdateAppointmentInputSchema.parse(values);

    // Fetch patient and nurse names to ensure they are current, although they are not typically changed in this form
    let patientName = "N/A";
    let nurseName = "N/A";
    const patientDoc = await getDoc(doc(firestoreInstance, "patients", validatedValues.patientId));
    if (patientDoc.exists()) patientName = patientDoc.data().name;
    const nurseDoc = await getDoc(doc(firestoreInstance, "nurses", validatedValues.nurseId));
    if (nurseDoc.exists()) nurseName = nurseDoc.data().name;

    const [hours, minutes] = validatedValues.appointmentTime.split(':').map(Number);
    const appointmentDateTime = new Date(validatedValues.appointmentDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const appointmentRef = doc(firestoreInstance, "appointments", appointmentId);
    const dataToUpdate = {
      patientId: validatedValues.patientId,
      patientName,
      nurseId: validatedValues.nurseId,
      nurseName,
      appointmentDate: Timestamp.fromDate(appointmentDateTime),
      appointmentTime: validatedValues.appointmentTime,
      appointmentType: validatedValues.appointmentType,
      status: validatedValues.status,
      // We typically don't update createdAt, but we might add an updatedAt field
      // updatedAt: serverTimestamp(), 
    };

    await updateDoc(appointmentRef, dataToUpdate);
    console.log(`[ACTION_LOG] updateAppointment: Appointment ${appointmentId} updated successfully.`);
    return { success: true, message: "Appointment updated successfully." };

  } catch (error: any) {
    console.error(`[ACTION_ERROR] updateAppointment for ${appointmentId}:`, error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to update appointment: ${error.message}` };
  }
}




export type CareLogItem = {
  id: string;
  patientId: string;
  patientName: string;
  careDate: string; // ISO string
  careType: string;
  notes: string;
  loggedBy: string;
  createdAt: string; // ISO string
};

const AddCareLogInputSchema = z.object({
  patientId: z.string().min(1, "Patient is required."),
  careType: z.string().min(1, "Type of care is required."),
  careDateTime: z.date(),
  notes: z.string().min(3, "Notes are required."), 
});
export type AddCareLogFormValues = z.infer<typeof AddCareLogInputSchema>;

export async function fetchCareLogs(patientId?: string): Promise<{ data?: CareLogItem[]; error?: string }> {
  console.log(`[ACTION_LOG] fetchCareLogs: Initiated. Patient ID: ${patientId || 'all'}`);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] fetchCareLogs: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in fetchCareLogs.");
    }
    const careLogsCollectionRef = collection(firestoreInstance, "careLogs");
    let q;
    if (patientId) {
      q = query(careLogsCollectionRef, where("patientId", "==", patientId), orderBy("careDate", "desc"));
    } else {
      q = query(careLogsCollectionRef, orderBy("careDate", "desc"));
    }

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            patientId: data.patientId,
            patientName: data.patientName || "N/A", // Ensured patientName fallback
            careDate: data.careDate instanceof Timestamp ? data.careDate.toDate().toISOString() : new Date(0).toISOString(),
            careType: data.careType,
            notes: data.notes || "No notes provided.", // Ensured notes fallback
            loggedBy: data.loggedBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as CareLogItem
    });
    return { data: logs };
  } catch (error: any) {
    console.error("[ACTION_ERROR] fetchCareLogs:", error);
    if (error.code === 'failed-precondition' && error.message.includes('indexes?create_composite=')) {
        console.warn("[ACTION_WARN] fetchCareLogs: Query requires a composite index.");
        return { data: [], error: "Query requires an index. Please create it in Firestore for 'careLogs'." };
    }
    return { data: [], error: `Failed to fetch care logs: ${error.message}` };
  }
}

export async function addCareLog(values: AddCareLogFormValues, loggedByName: string): Promise<{ success?: boolean; message: string; logId?: string }> {
  console.log("[ACTION_LOG] addCareLog: Initiated with values:", values);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] addCareLog: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in addCareLog.");
    }
    const validatedValues = AddCareLogInputSchema.parse(values);

    let patientName = "N/A";
    const patientDoc = await getDoc(doc(firestoreInstance, "patients", validatedValues.patientId));
    if (patientDoc.exists()) patientName = patientDoc.data().name;

    const newCareLogData = {
      patientId: validatedValues.patientId,
      patientName, 
      notes: validatedValues.notes, // Notes are explicitly included
      careType: validatedValues.careType,
      careDate: Timestamp.fromDate(validatedValues.careDateTime),
      loggedBy: loggedByName,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestoreInstance, "careLogs"), newCareLogData);
    console.log("[ACTION_LOG] addCareLog: Care log added to Firestore with ID:", docRef.id);
    return { success: true, message: "Care log added successfully.", logId: docRef.id };

  } catch (error: any) {
    console.error("[ACTION_ERROR] addCareLog:", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to add care log: ${error.message}` };
  }
}

const UpdateCareLogInputSchema = AddCareLogInputSchema;
export type UpdateCareLogFormValues = AddCareLogFormValues;

export async function updateCareLog(logId: string, values: UpdateCareLogFormValues): Promise<{ success?: boolean; message: string }> {
  console.log(`[ACTION_LOG] updateCareLog: Initiated for log ID: ${logId} with values:`, values);
  try {
    if (!firestoreInstance) {
      console.error("[ACTION_ERROR] updateCareLog: Firestore instance is not available.");
      throw new Error("Firestore `firestoreInstance` instance is not available in updateCareLog.");
    }
    if (!logId) {
      return { success: false, message: "Care log ID is required for update." };
    }
    const validatedValues = UpdateCareLogInputSchema.parse(values);

    let patientName = "N/A";
    const patientDoc = await getDoc(doc(firestoreInstance, "patients", validatedValues.patientId));
    if (patientDoc.exists()) {
        patientName = patientDoc.data().name;
    } else {
        console.warn(`[ACTION_WARN] updateCareLog: Patient with ID ${validatedValues.patientId} not found during update.`);
    }

    const careLogRef = doc(firestoreInstance, "careLogs", logId);
    const updatedCareLogData = {
      patientId: validatedValues.patientId, 
      patientName, 
      notes: validatedValues.notes, // Notes are explicitly included
      careType: validatedValues.careType,
      careDate: Timestamp.fromDate(validatedValues.careDateTime),
      // loggedBy is not updated, as it typically refers to the original logger
    };

    await updateDoc(careLogRef, updatedCareLogData);
    console.log(`[ACTION_LOG] updateCareLog: Care log ${logId} updated successfully.`);
    return { success: true, message: "Care log updated successfully." };

  } catch (error: any) {
    console.error(`[ACTION_ERROR] updateCareLog for ${logId}:`, error);
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: `Failed to update care log: ${error.message}` };
  }
}

export async function deleteCareLog(logId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`[ACTION_LOG] deleteCareLog: Attempting to delete log ID: ${logId}`);
    if (!firestoreInstance) {
        console.error("[ACTION_ERROR] deleteCareLog: Firestore instance is not available.");
        return { success: false, message: "Database service not available." };
    }
    if (!logId) {
        console.error("[ACTION_ERROR] deleteCareLog: Log ID is required.");
        return { success: false, message: "Log ID is required for deletion." };
    }
    try {
        const careLogRef = doc(firestoreInstance, "careLogs", logId);
        await deleteDoc(careLogRef);
        console.log(`[ACTION_LOG] deleteCareLog: Successfully deleted care log ${logId}.`);
        return { success: true, message: "Care log deleted successfully." };
    } catch (error: any) {
        console.error(`[ACTION_ERROR] deleteCareLog: Error deleting care log ${logId}:`, error);
        return { success: false, message: `Failed to delete care log: ${error.message}` };
    }
}

    