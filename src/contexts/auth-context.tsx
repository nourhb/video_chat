
"use client";

import type { User as FirebaseUser, AuthError } from "firebase/auth";
import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  type ReactNode 
} from "react";
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification
} from "firebase/auth";
import { auth, db } from '@/lib/firebase'; // Import db
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore"; // Import Firestore functions

// Define types for login and signup form values if not already available
// For now, using simple email/password structure
interface AuthFormValues {
  email: string;
  password: string;
}

// Extend FirebaseUser to include our custom role if needed, or manage role separately
export interface AppUser extends FirebaseUser {
  appRole?: string; // Or 'admin', 'patient', 'nurse' etc.
}

interface AuthContextType {
  currentUser: AppUser | null;
  userRole: string | null; // e.g., 'admin', 'patient', 'nurse'
  loading: boolean;
  signup: (values: AuthFormValues & { // Include additional signup fields
    firstName: string;
    lastName: string;
    role: string;
    phoneNumber: string;
    address: string;
    dateOfBirth: Date;
    gender: string;
  }) => Promise<{ user?: FirebaseUser; error?: AuthError }>;
  login: (values: AuthFormValues) => Promise<{ user?: FirebaseUser; error?: AuthError }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, now fetch their role from Firestore
        // The 'role' field is expected in the 'users' collection, document ID = user.uid
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Role is fetched from the user's document in the 'users' collection in Firestore.
          // This 'role' field is set during signup or can be manually edited in Firestore.
          setCurrentUser({ ...user, appRole: userData.role || 'patient' } as AppUser); // Default appRole
          setUserRole(userData.role || 'patient'); // Default userRole to 'patient' if not found
          console.log(`[AuthContext] User ${user.uid} authenticated. Role from Firestore: ${userData.role || 'patient (defaulted)'}`);
        } else {
          // No custom profile yet, or role not set
          setCurrentUser(user as AppUser);
          setUserRole('patient'); // Assign a default role if no Firestore profile exists
          console.warn(`[AuthContext] No Firestore profile found for user ${user.uid} in 'users' collection. Defaulting role to 'patient'.`);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signup = async (values: AuthFormValues & { 
    firstName: string; 
    lastName: string; 
    role: string;
    phoneNumber: string;
    address: string;
    dateOfBirth: Date;
    gender: string;
   }) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const fbUser = userCredential.user;
      if (fbUser) {
        // Save additional user info to Firestore users collection
        const userDocRef = doc(db, "users", fbUser.uid);
        await setDoc(userDocRef, {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role, // This is the role selected during signup
          phoneNumber: values.phoneNumber,
          address: values.address,
          dateOfBirth: Timestamp.fromDate(values.dateOfBirth), // Store as Firestore Timestamp
          gender: values.gender,
          createdAt: serverTimestamp(),
        });
        setCurrentUser({ ...fbUser, appRole: values.role } as AppUser);
        setUserRole(values.role);

        // If the user signed up as a patient, create a corresponding record in the "patients" collection
        if (values.role === 'patient') {
          const patientDocRef = doc(db, "patients", fbUser.uid); // Use UID as patient doc ID for easy linking
          
          // Calculate age
          const today = new Date();
          const birthDate = values.dateOfBirth;
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
          }

          const patientData = {
            name: `${values.firstName} ${values.lastName}`,
            age: age,
            avatarUrl: `https://placehold.co/100x100.png?text=${values.firstName[0] || 'P'}${values.lastName[0] || ''}`,
            hint: "person face",
            joinDate: Timestamp.now(), // Or Timestamp.fromDate(new Date())
            primaryNurse: "Not Assigned",
            phone: values.phoneNumber,
            email: values.email,
            address: values.address,
            mobilityStatus: "Unknown",
            pathologies: [],
            allergies: [],
            lastVisit: Timestamp.now(), // Or Timestamp.fromDate(new Date())
            condition: "General Checkup", 
            status: "Active", 
            createdAt: serverTimestamp(),
            // Ensure all fields expected by PatientListItem are present, even if with default values
            // For fields not collected at signup (e.g. currentMedications, recentVitals), they can be omitted
            // or added later through a profile editing feature.
          };
          await setDoc(patientDocRef, patientData);
          console.log(`[AuthContext] Created patient record for ${fbUser.uid} in 'patients' collection.`);
        }

        await sendEmailVerification(fbUser);
      }
      return { user: fbUser };
    } catch (error) {
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  const login = async (values: AuthFormValues) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      // Auth state change will trigger useEffect to fetch role
      return { user: userCredential.user };
    } catch (error) {
      return { error: error as AuthError };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      // Auth state change will clear user and role
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    userRole,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
