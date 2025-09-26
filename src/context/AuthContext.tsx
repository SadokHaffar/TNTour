'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserData {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  displayName?: string;
  createdAt?: string;
}

interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (signupData: SignupData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Immediately fetch user data after successful login
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      setUserData(userDoc.data() as UserData);
    } else {
      // Create default user data if not exists
      const defaultUserData: UserData = {
        uid: user.uid,
        email: user.email!,
        role: 'user',
        displayName: user.displayName || ''
      };
      await setDoc(doc(db, 'users', user.uid), defaultUserData);
      setUserData(defaultUserData);
    }
  };

  const signup = async (signupData: SignupData) => {
    const { email, password, firstName, lastName, phoneNumber, role } = signupData;
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user document in Firestore with all the additional information
    const userDocData: UserData = {
      uid: user.uid,
      email: user.email!,
      role: role,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      displayName: `${firstName} ${lastName}`,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', user.uid), userDocData);
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
          } else {
            // Create default user data if not exists
            const defaultUserData: UserData = {
              uid: user.uid,
              email: user.email!,
              role: 'user',
              displayName: user.displayName || ''
            };
            await setDoc(doc(db, 'users', user.uid), defaultUserData);
            setUserData(defaultUserData);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    login,
    signup,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};