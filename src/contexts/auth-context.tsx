
"use client";

import { 
  createContext, 
  useContext, 
  useState, 
  type ReactNode 
} from "react";

// Simplified user interface for video consultation
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  userRole: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setUser: (user: AppUser) => void;
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
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Simplified login - in a real app, you would validate against a backend
      // For demo purposes, we'll create a mock user
      const mockUser: AppUser = {
        id: 'user-123',
        name: email.split('@')[0], // Use email prefix as name
        email: email,
        role: 'patient' // Default role
      };
      
      setCurrentUser(mockUser);
      setUserRole(mockUser.role);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole(null);
  };

  const setUser = (user: AppUser) => {
    setCurrentUser(user);
    setUserRole(user.role);
  };

  const value = {
    currentUser,
    userRole,
    loading,
    login,
    logout,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
