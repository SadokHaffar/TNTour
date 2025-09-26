'use client';

import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, onSnapshot } from 'firebase/firestore';

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  maxParticipants: number;
  entryFee: number;
  description: string;
  status: 'upcoming' | 'active' | 'completed' | 'playing';
  participants?: string[];
  prizePool: number;
  surface: string;
  category: string;
  winningType?: string;
  createdAt?: string;
}

export default function Dashboard() {
  const { currentUser, userData, logout } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [unsubscribingFrom, setUnsubscribingFrom] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userSubscriptions, setUserSubscriptions] = useState<string[]>([]);
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState<string | null>(null);

  const setupTournamentsListener = () => {
    const tournamentsCollection = collection(db, 'tournaments');
    
    const unsubscribe = onSnapshot(tournamentsCollection, (snapshot) => {
      const tournamentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tournament[];
      
      // Sort tournaments by status priority and creation date
      const sortedTournaments = tournamentsList.sort((a, b) => {
        const statusOrder = { upcoming: 0, active: 1, playing: 2, completed: 3 };
        const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 999;
        const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 999;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        // If same status, sort by creation date (newest first)
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      
      setTournaments(sortedTournaments);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to tournaments:', error);
      setLoading(false);
    });
    
    return unsubscribe;
  };

  const setupUserSubscriptionsListener = () => {
    if (!currentUser) return null;
    
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setUserSubscriptions(userData.tournaments || []);
      } else {
        setUserSubscriptions([]);
      }
    }, (error) => {
      console.error('Error listening to user subscriptions:', error);
    });
    
    return unsubscribe;
  };

  useEffect(() => {
    let tournamentsUnsubscribe: (() => void) | null = null;
    let userSubscriptionsUnsubscribe: (() => void) | null = null;

    // Set up real-time listeners
    tournamentsUnsubscribe = setupTournamentsListener();
    
    if (currentUser) {
      userSubscriptionsUnsubscribe = setupUserSubscriptionsListener();
    }

    // Cleanup function
    return () => {
      if (tournamentsUnsubscribe) {
        tournamentsUnsubscribe();
      }
      if (userSubscriptionsUnsubscribe) {
        userSubscriptionsUnsubscribe();
      }
    };
  }, [currentUser]);

  // Real-time listeners handle data fetching automatically

  // User subscriptions are handled by real-time listener

  const handleSubscribe = async (tournamentId: string) => {
    if (!currentUser) return;
    
    setSubscribingTo(tournamentId);
    setShowJoinModal(null);
    try {
      // Add tournament to user's subscriptions
      await updateDoc(doc(db, 'users', currentUser.uid), {
        tournaments: arrayUnion(tournamentId)
      });
      
      // Add user to tournament's participants
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        participants: arrayUnion(currentUser.uid)
      });
      
      // Real-time listener will automatically update the UI
      // setUserSubscriptions and tournaments will be updated via onSnapshot
    } catch (error) {
      console.error('Error subscribing to tournament:', error);
    } finally {
      setSubscribingTo(null);
    }
  };

  const handleUnsubscribe = async (tournamentId: string) => {
    if (!currentUser) return;
    
    // Check if tournament is in playing phase
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament?.status === 'playing') {
      return; // Prevent leaving during playing phase
    }
    
    setUnsubscribingFrom(tournamentId);
    setShowLeaveModal(null);
    try {
      // Remove tournament from user's subscriptions
      await updateDoc(doc(db, 'users', currentUser.uid), {
        tournaments: arrayRemove(tournamentId)
      });
      
      // Remove user from tournament's participants
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        participants: arrayRemove(currentUser.uid)
      });
      
      // Real-time listener will automatically update the UI
      // setUserSubscriptions and tournaments will be updated via onSnapshot
    } catch (error) {
      console.error('Error unsubscribing from tournament:', error);
    } finally {
      setUnsubscribingFrom(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'playing': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'active':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'playing':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4a1 1 0 012 0v.01a1 1 0 01-2 0V14zm.01-9a1 1 0 000 2h.01a1 1 0 100-2H9.01z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute allowedRoles={['user']}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50/50 to-green-100 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-green-200 to-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-yellow-200 to-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-green-300 to-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-4000"></div>
        </div>
        {/* Enhanced Header */}
        <header className="relative bg-white/80 backdrop-blur-xl shadow-2xl border-b border-white/50 sticky top-0 z-40">
          {/* Header gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-yellow-500/5 to-green-500/5"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="relative group">
                  <img 
                    src="/logo.png" 
                    alt="TNTour Logo" 
                    className="w-12 h-12 object-contain drop-shadow-lg group-hover:drop-shadow-xl transition-all duration-300"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse shadow-lg"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-yellow-600 bg-clip-text text-transparent">
                    TNTour
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">Tennis Tournaments</p>
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                {/* User Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-green-100 hover:bg-white/70 transition-all duration-300 shadow-lg hover:shadow-xl group"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-yellow-400 rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-800">
                          {userData?.firstName || userData?.email?.split('@')[0] || 'Player'}
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                          <div className="text-xs text-green-600 font-medium">Player</div>
                        </div>
                      </div>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {mobileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-green-100 py-3 z-50 animate-in slide-in-from-top-5 duration-200">
                      {/* User Info Card */}
                      <div className="px-4 py-3 border-b border-green-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {userData?.firstName && userData?.lastName 
                                ? `${userData.firstName} ${userData.lastName}`
                                : userData?.email?.split('@')[0] || 'Tennis Player'
                              }
                            </div>
                            <div className="text-sm text-gray-600 truncate">{userData?.email}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="px-2 py-1 bg-green-100 rounded-full">
                                <div className="flex items-center space-x-1">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-medium text-green-700">Player</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {userSubscriptions.length} Tournament{userSubscriptions.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-sm font-medium">My Profile</span>
                        </div>
                        <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-medium">Tournament History</span>
                        </div>
                        <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm font-medium">Settings</span>
                        </div>
                      </div>

                      {/* Logout Button */}
                      <div className="border-t border-green-100 pt-2 px-3">
                        <button
                          onClick={() => {
                            setShowLogoutModal(true);
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                        >
                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-sm font-medium">Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Profile Button */}
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-green-100 hover:bg-white/70 transition-all duration-300 shadow-lg"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-yellow-400 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                  <div className="absolute right-4 top-full mt-2 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-green-100 py-3 z-50 animate-in slide-in-from-top-5 duration-200">
                    {/* User Info Card */}
                    <div className="px-4 py-3 border-b border-green-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {userData?.firstName && userData?.lastName 
                              ? `${userData.firstName} ${userData.lastName}`
                              : userData?.email?.split('@')[0] || 'Tennis Player'
                            }
                          </div>
                          <div className="text-sm text-gray-600 truncate">{userData?.email}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="px-2 py-1 bg-green-100 rounded-full">
                              <div className="flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium text-green-700">Player</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {userSubscriptions.length} Tournament{userSubscriptions.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-sm font-medium">My Profile</span>
                      </div>
                      <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium">Tournament History</span>
                      </div>
                      <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-green-50 transition-colors cursor-pointer">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium">Settings</span>
                      </div>
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-green-100 pt-2 px-3">
                      <button
                        onClick={() => {
                          setShowLogoutModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                      >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Navigation - Reuse Desktop Dropdown on Mobile */}
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-12 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-200/20 to-yellow-200/20 rounded-3xl blur-3xl"></div>
            <div className="relative">
              {/* Tournament Status Display */}
              {tournaments.length > 0 ? (
                tournaments.length === 1 ? (
                  // Single Tournament View
                  <div className="mb-8">
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <div className="text-8xl animate-bounce">🏆</div>
                        <div className="absolute -top-2 -right-2 text-3xl animate-spin">⭐</div>
                      </div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-yellow-600 to-green-600 bg-clip-text text-transparent mb-4">
                      Featured Tournament
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                      {tournaments[0].name} is now available for registration! 🎯
                    </p>
                  </div>
                ) : (
                  // Multiple Tournaments View
                  <div className="mb-8">
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <div className="text-8xl animate-bounce">�</div>
                        <div className="absolute -top-2 -right-2 text-3xl animate-spin">⭐</div>
                      </div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-yellow-600 to-green-600 bg-clip-text text-transparent mb-4">
                      Tennis Tournaments
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                      Choose from {tournaments.length} available tournaments and start your tennis journey! 🎾
                    </p>
                    
                    {/* Multiple Tournaments Stats */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{tournaments.filter(t => t.status === 'active').length}</div>
                        <div className="text-sm text-gray-500">Active Now</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{tournaments.filter(t => t.status === 'upcoming').length}</div>
                        <div className="text-sm text-gray-500">Coming Soon</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600">{userSubscriptions.length}</div>
                        <div className="text-sm text-gray-500">Your Tournaments</div>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                // No Tournaments View
                <div className="mb-8">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="text-8xl opacity-50">🏆</div>
                      <div className="absolute -top-2 -right-2 text-3xl opacity-30">⭐</div>
                    </div>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400 bg-clip-text text-transparent mb-4">
                    No Tournaments Available
                  </h2>
                  <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                    New tournaments are coming soon! Check back later for exciting competitions. 🎾
                  </p>
                  
                  {/* Coming Soon Stats */}
                  <div className="mt-8 max-w-lg mx-auto">
                    <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-400 mb-2">Coming Soon</div>
                        <div className="text-sm text-gray-500">Be the first to know when new tournaments are announced!</div>
                        <button className="mt-4 px-6 py-2 bg-gradient-to-r from-green-400 to-yellow-400 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                          Notify Me
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tournament Display */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
            </div>
          ) : tournaments.length === 1 ? (
            // Elegant Single Tournament Design
            <div className="max-w-2xl mx-auto px-4">
              {(() => {
                const tournament = tournaments[0];
                const isSubscribed = userSubscriptions.includes(tournament.id);
                const participantCount = tournament.participants?.length || 0;
                const isFull = participantCount >= tournament.maxParticipants;
                
                return (
                  <div className="group relative">
                    {/* Floating Background Elements */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-400 via-yellow-400 to-green-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                    
                    {/* Main Card */}
                    <div className="relative bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-3xl">
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4 z-20">
                        <div className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center space-x-2 ${getStatusColor(tournament.status)} shadow-lg backdrop-blur-sm`}>
                          <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                          <span className="capitalize">{tournament.status}</span>
                        </div>
                      </div>
                      
                      {/* Header Section */}
                      <div className="relative p-6 pb-4">
                        {/* Tournament Icon & Title */}
                        <div className="flex items-start space-x-4 mb-6">
                          <div className="relative">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-500 via-green-600 to-yellow-500 rounded-2xl flex items-center justify-center shadow-xl transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                              <svg className="w-3 h-3 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-2 group-hover:text-green-600 transition-colors duration-300">
                              {tournament.name}
                            </h1>
                            <div className="flex items-center text-gray-600 space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span className="text-sm md:text-base font-medium">{tournament.location}</span>
                            </div>
                          </div>
                        </div>

                        {/* Compact Info Cards */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {/* Winning Type */}
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-3 border border-purple-200/50">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-purple-600 uppercase tracking-wide">Type</div>
                                <div className="text-sm font-bold text-gray-900 truncate">{tournament.winningType || 'Single Elimination'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Players Count */}
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-3 border border-blue-200/50">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Players</div>
                                <div className="text-sm font-bold text-gray-900">{participantCount}/{tournament.maxParticipants}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Created Date */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-3 mb-6 border border-gray-200/50">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Created</div>
                              <div className="text-sm font-bold text-gray-900">
                                {tournament.createdAt 
                                  ? new Date(tournament.createdAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })
                                  : 'Recently'
                                }
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="">
                          {tournament.status === 'completed' ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament Completed</span>
                            </button>
                          ) : tournament.status === 'playing' ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-orange-200 to-orange-300 text-orange-700 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4a1 1 0 012 0v.01a1 1 0 01-2 0V14zm.01-9a1 1 0 000 2h.01a1 1 0 100-2H9.01z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament In Progress</span>
                            </button>
                          ) : isSubscribed ? (
                            <button
                              onClick={() => setShowLeaveModal(tournament.id)}
                              disabled={unsubscribingFrom === tournament.id}
                              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-red-300 disabled:to-red-400 text-white px-6 py-4 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                            >
                              {unsubscribingFrom === tournament.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>Leaving...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Leave Tournament</span>
                                </>
                              )}
                            </button>
                          ) : isFull ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament Full</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowJoinModal(tournament.id)}
                              disabled={subscribingTo === tournament.id}
                              className="w-full bg-gradient-to-r from-green-500 via-green-600 to-yellow-500 hover:from-green-600 hover:via-green-700 hover:to-yellow-600 disabled:from-green-300 disabled:to-yellow-300 text-white px-6 py-4 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                            >
                              {subscribingTo === tournament.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>Joining...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  <span>Join Tournament</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            // Multiple Tournaments Grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tournaments.map((tournament) => {
                const isSubscribed = userSubscriptions.includes(tournament.id);
                const participantCount = tournament.participants?.length || 0;
                const isFull = participantCount >= tournament.maxParticipants;
                
                return (
                  <div key={tournament.id} className="group">
                    <div className="relative bg-gradient-to-br from-white/90 via-white/80 to-white/70 backdrop-blur-lg rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-700 overflow-hidden border border-white/30 transform hover:-translate-y-3 hover:scale-105">
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4 z-10">
                        <div className={`px-4 py-2 rounded-2xl text-sm font-bold flex items-center space-x-2 ${getStatusColor(tournament.status)} shadow-lg backdrop-blur-sm`}>
                          {getStatusIcon(tournament.status)}
                          <span className="capitalize">{tournament.status}</span>
                        </div>
                      </div>
                      
                      {/* Main Content */}
                      <div className="relative p-8">
                        {/* Header */}
                        <div className="flex items-start space-x-4 mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-400 via-green-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-shadow duration-500">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300 leading-tight">
                              {tournament.name}
                            </h3>
                            <div className="flex items-center space-x-2 mt-2">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <p className="text-lg text-gray-600 font-medium">{tournament.location}</p>
                            </div>
                          </div>
                        </div>

                        {/* Key Information Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          {/* Winning Type */}
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Winning Type</div>
                                <div className="text-sm font-bold text-gray-900">{tournament.winningType || 'Single Elimination'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Participants Count */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Players</div>
                                <div className="text-sm font-bold text-gray-900">
                                  {participantCount}/{tournament.maxParticipants}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Created Date */}
                        <div className="mb-6">
                          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-4 border border-gray-100">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-slate-500 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Created</div>
                                <div className="text-sm font-bold text-gray-900">
                                  {tournament.createdAt 
                                    ? new Date(tournament.createdAt).toLocaleDateString('en-US', { 
                                        month: 'long', 
                                        day: 'numeric', 
                                        year: 'numeric' 
                                      })
                                    : 'Recently'
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-6">
                          {tournament.status === 'completed' ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament Completed</span>
                            </button>
                          ) : tournament.status === 'playing' ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-orange-200 to-orange-300 text-orange-700 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4a1 1 0 012 0v.01a1 1 0 01-2 0V14zm.01-9a1 1 0 000 2h.01a1 1 0 100-2H9.01z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament In Progress</span>
                            </button>
                          ) : isSubscribed ? (
                            <button
                              onClick={() => handleUnsubscribe(tournament.id)}
                              disabled={unsubscribingFrom === tournament.id}
                              className="w-full bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 disabled:from-red-300 disabled:to-red-400 text-white px-6 py-4 rounded-2xl font-bold transition-all duration-500 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                            >
                              {unsubscribingFrom === tournament.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>Leaving Tournament...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Leave Tournament</span>
                                </>
                              )}
                            </button>
                          ) : isFull ? (
                            <button
                              disabled
                              className="w-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500 px-6 py-4 rounded-2xl font-bold cursor-not-allowed flex items-center justify-center space-x-3 shadow-inner"
                            >
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <span>Tournament Full</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSubscribe(tournament.id)}
                              disabled={subscribingTo === tournament.id}
                              className="w-full bg-gradient-to-r from-green-500 via-green-600 to-yellow-500 hover:from-green-600 hover:via-green-700 hover:to-yellow-600 disabled:from-green-300 disabled:to-yellow-300 text-white px-6 py-4 rounded-2xl font-bold transition-all duration-500 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                            >
                              {subscribingTo === tournament.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>Joining Tournament...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  <span>Join Tournament</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tournaments.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎾</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Tournaments Yet</h3>
              <p className="text-gray-600">Check back soon for exciting tennis tournaments!</p>
            </div>
          )}
        </main>

        {/* Join Tournament Confirmation Modal */}
        {showJoinModal && (() => {
          const tournament = tournaments.find(t => t.id === showJoinModal);
          if (!tournament) return null;
          
          return (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowJoinModal(null)}
            >
              <div 
                className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100 border border-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Join Tournament</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Are you ready to compete in this exciting tournament?
                    </p>
                  </div>

                  {/* Tournament Info */}
                  <div className="bg-gradient-to-r from-green-50 to-yellow-50 rounded-2xl p-6 mb-6 border border-green-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-yellow-400 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">{tournament.name}</div>
                        <div className="text-sm text-gray-600">{tournament.location}</div>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm font-medium text-green-700">
                            {tournament.participants?.length || 0}/{tournament.maxParticipants} players
                          </span>
                          <span className="text-sm font-medium text-blue-700">
                            {tournament.winningType || 'Single Elimination'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setShowJoinModal(null)}
                      className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSubscribe(tournament.id)}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-yellow-500 hover:from-green-600 hover:to-yellow-600 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Join Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Leave Tournament Confirmation Modal */}
        {showLeaveModal && (() => {
          const tournament = tournaments.find(t => t.id === showLeaveModal);
          if (!tournament) return null;
          
          const isPlaying = tournament.status === 'playing';
          
          return (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowLeaveModal(null)}
            >
              <div 
                className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100 border border-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className={`w-20 h-20 bg-gradient-to-br ${isPlaying ? 'from-orange-400 to-red-500' : 'from-red-400 to-red-600'} rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl`}>
                      {isPlaying ? (
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {isPlaying ? 'Cannot Leave Tournament' : 'Leave Tournament'}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {isPlaying 
                        ? 'This tournament is currently in progress. Players cannot leave during active play.'
                        : 'Are you sure you want to leave this tournament? This action cannot be undone.'
                      }
                    </p>
                  </div>

                  {/* Tournament Info */}
                  <div className={`bg-gradient-to-r ${isPlaying ? 'from-orange-50 to-red-50 border-orange-100' : 'from-red-50 to-pink-50 border-red-100'} rounded-2xl p-6 mb-6 border`}>
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${isPlaying ? 'from-orange-400 to-red-500' : 'from-red-400 to-red-600'} rounded-xl flex items-center justify-center`}>
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">{tournament.name}</div>
                        <div className="text-sm text-gray-600">{tournament.location}</div>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`text-sm font-medium ${getStatusColor(tournament.status).replace('bg-', 'text-').replace('-100', '-700')}`}>
                            Status: {tournament.status}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {tournament.participants?.length || 0} players joined
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={`${isPlaying ? 'flex justify-center' : 'grid grid-cols-2 gap-4'}`}>
                    {isPlaying ? (
                      <button
                        onClick={() => setShowLeaveModal(null)}
                        className="px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl"
                      >
                        Understood
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowLeaveModal(null)}
                          className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 font-semibold"
                        >
                          Stay In
                        </button>
                        <button
                          onClick={() => handleUnsubscribe(tournament.id)}
                          className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          Leave Now
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <div 
              className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100 border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                {/* Header with User Avatar */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Sign Out</h3>
                  <p className="text-gray-600 leading-relaxed">
                    You're about to sign out of your TNTour account
                  </p>
                </div>

                {/* User Info Summary */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-yellow-400 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {userData?.firstName && userData?.lastName 
                          ? `${userData.firstName} ${userData.lastName}`
                          : userData?.email?.split('@')[0] || 'Tennis Player'
                        }
                      </div>
                      <div className="text-sm text-gray-600">{userData?.email}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="px-2 py-1 bg-green-100 rounded-full">
                          <span className="text-xs font-medium text-green-700">
                            {userSubscriptions.length} Tournament{userSubscriptions.length !== 1 ? 's' : ''} Joined
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 font-semibold"
                  >
                    Stay Signed In
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}