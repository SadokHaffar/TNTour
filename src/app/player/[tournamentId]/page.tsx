'use client';

import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';

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

interface Match {
  id?: string;
  tournamentId?: string;
  round: number;
  matchNumber: number;
  bracket: string;
  roundName: string;
  player1: Player;
  player2: Player;
  status?: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'pending' | 'playing';
  winner?: string;
  score?: string;
  createdAt?: string;
  hasBye?: boolean;
  seedInfo?: string;
  sets?: Array<{
    setNumber: number;
    player1Score: number;
    player2Score: number;
  }>;
  player1SetsWon?: number;
  player2SetsWon?: number;
  detailedScore?: string;
  player1Seed?: number;
  player2Seed?: number;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  createdAt?: string;
  tournamentRegistered?: string[]; // Array of tournament IDs
  isPlaceholder?: boolean; // For TBD players (winners from previous rounds)
  isBye?: boolean; // For bye players in uneven brackets
  matchId?: number; // Reference to match for placeholders
  wins?: number;
  losses?: number;
  points?: number;
  matchesPlayed?: number;
  roundRobinStats?: {
    matches: number;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
    points: number;
  };
}

export default function PlayerDashboard() {
  const { currentUser, userData, logout } = useAuth();
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerMatches, setPlayerMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<Player[]>([]);
  const [rankings, setRankings] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingMatch, setUpdatingMatch] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreForm, setScoreForm] = useState({
    player1SetsWon: 0,
    player2SetsWon: 0,
    detailedScore: ''
  });
  const [error, setError] = useState<string | null>(null);

  // Calculate Round-Robin Standings with real-time updates
  useEffect(() => {
    if (!tournamentPlayers.length || !allMatches.length) {
      setRankings([]);
      return;
    }

    console.log('Calculating rankings with:', { 
      players: tournamentPlayers.length, 
      allMatches: allMatches.length,
      completedMatches: allMatches.filter(m => m.status === 'completed').length
    });

    // Initialize stats for each player
    const playerStats = tournamentPlayers.map(player => ({
      ...player,
      roundRobinStats: {
        matches: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0
      }
    }));

    // Calculate stats from ALL completed matches (not just player's matches)
    allMatches.forEach(match => {
      if (match.status === 'completed' && match.winner) {
        const player1 = playerStats.find(p => p.id === match.player1?.id);
        const player2 = playerStats.find(p => p.id === match.player2?.id);
        
        console.log('Processing completed match:', {
          matchId: match.id,
          player1: `${match.player1?.firstName} ${match.player1?.lastName}`,
          player2: `${match.player2?.firstName} ${match.player2?.lastName}`,
          winner: match.winner,
          score: `${match.player1SetsWon}-${match.player2SetsWon}`
        });
        
        if (player1 && player2) {
          // Update matches played
          player1.roundRobinStats.matches++;
          player2.roundRobinStats.matches++;
          
          // Update sets
          const p1Sets = match.player1SetsWon || 0;
          const p2Sets = match.player2SetsWon || 0;
          
          player1.roundRobinStats.setsWon += p1Sets;
          player1.roundRobinStats.setsLost += p2Sets;
          player2.roundRobinStats.setsWon += p2Sets;
          player2.roundRobinStats.setsLost += p1Sets;
          
          // Update wins/losses and points (ATP style: 2 points for win, 0 for loss)
          if (match.winner === `${match.player1.firstName} ${match.player1.lastName}`) {
            player1.roundRobinStats.wins++;
            player1.roundRobinStats.points += 2;
            player2.roundRobinStats.losses++;
          } else {
            player2.roundRobinStats.wins++;
            player2.roundRobinStats.points += 2;
            player1.roundRobinStats.losses++;
          }
        }
      }
    });

    // Sort by points, then by sets difference, then by sets won
    const sortedRankings = playerStats.sort((a, b) => {
      if (b.roundRobinStats.points !== a.roundRobinStats.points) {
        return b.roundRobinStats.points - a.roundRobinStats.points;
      }
      const aSetsDiff = a.roundRobinStats.setsWon - a.roundRobinStats.setsLost;
      const bSetsDiff = b.roundRobinStats.setsWon - b.roundRobinStats.setsLost;
      if (bSetsDiff !== aSetsDiff) {
        return bSetsDiff - aSetsDiff;
      }
      return b.roundRobinStats.setsWon - a.roundRobinStats.setsWon;
    });

    console.log('Final rankings:', sortedRankings.map(p => ({
      name: `${p.firstName} ${p.lastName}`,
      points: p.roundRobinStats.points,
      matches: p.roundRobinStats.matches,
      wins: p.roundRobinStats.wins
    })));

    setRankings(sortedRankings);
  }, [tournamentPlayers, allMatches]);

  // Set up real-time listeners
  useEffect(() => {
    console.log('useEffect triggered with:', { tournamentId, currentUserId: currentUser?.uid });
    
    if (!tournamentId || !currentUser) {
      console.log('Missing required data:', { tournamentId, currentUser: !!currentUser });
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Tournament listener
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const unsubscribeTournament = onSnapshot(tournamentRef, (doc) => {
      console.log('Tournament snapshot received, exists:', doc.exists());
      if (doc.exists()) {
        const tournamentData = { id: doc.id, ...doc.data() } as Tournament;
        console.log('Tournament data:', tournamentData);
        setTournament(tournamentData);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tournament:', error);
      setLoading(false);
    });
    unsubscribers.push(unsubscribeTournament);

    // Matches listener - from tournaments subcollection (like admin dashboard)
    const matchesQuery = query(
      collection(db, 'tournaments', tournamentId, 'matches'),
      orderBy('round'),
      orderBy('matchNumber')
    );
    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      console.log('Matches snapshot received:', snapshot.docs.length, 'documents');
      const allMatchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Match[];

      console.log('All matches:', allMatchesData);

      // Store ALL matches for rankings calculation
      setAllMatches(allMatchesData);

      // Filter matches where current user is a participant (check both player1 and player2 objects)
      const userMatches = allMatchesData.filter(match => {
        const player1Match = match.player1?.id === currentUser.uid || 
                            (match.player1?.firstName && match.player1?.lastName && 
                             `${match.player1.firstName} ${match.player1.lastName}` === `${userData?.firstName} ${userData?.lastName}`);
        const player2Match = match.player2?.id === currentUser.uid || 
                            (match.player2?.firstName && match.player2?.lastName && 
                             `${match.player2.firstName} ${match.player2.lastName}` === `${userData?.firstName} ${userData?.lastName}`);
        return player1Match || player2Match;
      });

      console.log('User matches for', currentUser.uid, ':', userMatches);
      setPlayerMatches(userMatches);
    }, (error) => {
      console.error('Error fetching matches:', error);
    });
    unsubscribers.push(unsubscribeMatches);

    // Players/Rankings listener - from users collection (like admin dashboard)
    const playersQuery = query(
      collection(db, 'users'),
      where('tournaments', 'array-contains', tournamentId),
      where('role', '==', 'user')
    );
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot) => {
      console.log('Players snapshot received:', snapshot.docs.length, 'documents');
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        firstName: doc.data().firstName || '',
        lastName: doc.data().lastName || '',
        email: doc.data().email || '',
        name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim(),
        wins: 0,
        losses: 0,
        points: 0,
        matchesPlayed: 0
      })) as Player[];
      console.log('Tournament players:', playersData);
      setTournamentPlayers(playersData);
    }, (error) => {
      console.error('Error fetching players:', error);
    });
    unsubscribers.push(unsubscribePlayers);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUser, tournamentId]);



  const updateMatchScore = async (matchId: string, player1SetsWon: number, player2SetsWon: number) => {
    if (!currentUser || !editingMatch) return;

    // Check if current user is part of this match
    if (editingMatch.player1?.id !== currentUser.uid && editingMatch.player2?.id !== currentUser.uid) {
      setError('You can only update scores for your own matches');
      return;
    }

    setUpdatingMatch(matchId);
    setError(null);
    
    try {
      const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId);

      // Determine winner and status based on sets won
      let winner = '';
      let status: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'pending' | 'playing' = 'ready';

      if (player1SetsWon === 0 && player2SetsWon === 0) {
        status = 'ready';
      } else if (player1SetsWon > 0 || player2SetsWon > 0) {
        status = 'playing';
      }

      // Tennis match: first to win majority of sets (best of 3 or 5)
      const maxSets = 3; // Best of 3 sets
      const setsToWin = Math.ceil(maxSets / 2);

      if (player1SetsWon >= setsToWin || player2SetsWon >= setsToWin) {
        status = 'completed';
        winner = player1SetsWon > player2SetsWon 
          ? `${editingMatch.player1.firstName} ${editingMatch.player1.lastName}`
          : `${editingMatch.player2.firstName} ${editingMatch.player2.lastName}`;
      }

      await updateDoc(matchRef, {
        player1SetsWon,
        player2SetsWon,
        winner,
        status,
        score: `${player1SetsWon}-${player2SetsWon}`,
        detailedScore: scoreForm.detailedScore || '',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      });

      // Close modal on success
      setEditingMatch(null);
      setScoreForm({ player1SetsWon: 0, player2SetsWon: 0, detailedScore: '' });

    } catch (error) {
      console.error('Error updating match score:', error);
      setError('Failed to update match score. Please try again.');
    } finally {
      setUpdatingMatch(null);
    }
  };

  const getMatchStatus = (match: Match) => {
    switch (match.status) {
      case 'waiting':
        return { text: 'Waiting', color: 'bg-gray-100 text-gray-800' };
      case 'ready':
        return { text: 'Ready', color: 'bg-blue-100 text-blue-800' };
      case 'in_progress':
      case 'playing':
        return { text: 'In Progress', color: 'bg-yellow-100 text-yellow-800' };
      case 'completed':
        return { text: 'Completed', color: 'bg-green-100 text-green-800' };
      default:
        return { text: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    }
  };

  // Initialize modal when match is clicked
  const handleMatchClick = (match: Match) => {
    setEditingMatch(match);
    setScoreForm({
      player1SetsWon: match.player1SetsWon || 0,
      player2SetsWon: match.player2SetsWon || 0,
      detailedScore: match.detailedScore || ''
    });
    setError(null);
  };

  const isCurrentUserMatch = (match: Match) => {
    return match.player1?.id === currentUser?.uid || match.player2?.id === currentUser?.uid;
  };

  const getCurrentUserInMatch = (match: Match) => {
    return match.player1?.id === currentUser?.uid ? 'player1' : 'player2';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50/50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50/50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎾</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tournament Not Found</h2>
          <p className="text-gray-600 mb-6">The tournament you're looking for doesn't exist or has been removed.</p>
          <p className="text-gray-500">Please navigate back to the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        </div>

        {/* Enhanced Header */}
        <header className="relative bg-white/80 backdrop-blur-xl shadow-2xl border-b border-white/50 sticky top-0 z-40">
          {/* Header gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5"></div>
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
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse shadow-lg"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
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
                    className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-blue-100 hover:bg-white/70 transition-all duration-300 shadow-lg hover:shadow-xl group"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-800">
                          {userData?.firstName || userData?.email?.split('@')[0] || 'Player'}
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                          <div className="text-xs text-blue-600 font-medium">Player</div>
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
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-100 py-3 z-50 animate-in slide-in-from-top-5 duration-200">
                      {/* User Info Card */}
                      <div className="px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
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
                              <div className="px-2 py-1 bg-blue-100 rounded-full">
                                <div className="flex items-center space-x-1">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-medium text-blue-700">Player</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                Tournament Player
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          onClick={() => {
                            router.push('/dashboard');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 7l5-5 5 5" />
                          </svg>
                          <span className="text-sm font-medium">Back to Dashboard</span>
                        </button>
                        <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-sm font-medium">My Profile</span>
                        </div>
                        <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-medium">Tournament History</span>
                        </div>
                      </div>

                      {/* Logout Button */}
                      <div className="border-t border-blue-100 pt-2 px-3">
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
              <div className="md:hidden relative">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="flex items-center px-3 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-blue-100 hover:bg-white/70 transition-all duration-300 shadow-lg"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform duration-300 ml-1 ${mobileMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-100 py-3 z-50 animate-in slide-in-from-top-5 duration-200">
                    {/* User Info Card */}
                    <div className="px-4 py-3 border-b border-blue-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
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
                            <div className="px-2 py-1 bg-blue-100 rounded-full">
                              <div className="flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium text-blue-700">Player</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Tournament Player
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          router.push('/dashboard');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors"
                      >
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 7l5-5 5 5" />
                        </svg>
                        <span className="text-sm font-medium">Back to Dashboard</span>
                      </button>
                      <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-sm font-medium">My Profile</span>
                      </div>
                      <div className="px-4 py-2 flex items-center space-x-3 text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium">Tournament History</span>
                      </div>
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-blue-100 pt-2 px-3">
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
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          
          {/* Professional Tournament Header */}
          <div className="mb-6 md:mb-8">
            <div className="relative bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden backdrop-blur-xl">
              {/* Animated Background Pattern - Hidden on mobile */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-emerald-500/5"></div>
              <div className="hidden md:block absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full -translate-y-48 translate-x-48"></div>
              <div className="hidden md:block absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-full translate-y-48 -translate-x-48"></div>
              
              <div className="relative p-4 md:p-6 lg:p-7">
                {/* Header Section */}
                <div className="mb-4 md:mb-6">
                  {/* Tournament Title & Description */}
                  <div className="flex-1">
                    <div className="flex items-center mb-2 md:mb-3">
                      {/* Professional Tennis Racquet Icon - More compact */}
                      <div className="relative group">
                        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-600 p-2 md:p-3 rounded-xl md:rounded-2xl shadow-xl mr-3 md:mr-4">
                          {/* Custom Tennis Racquet SVG - Smaller on desktop */}
                          <svg className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <ellipse cx="12" cy="8" rx="6" ry="5" strokeWidth="2"/>
                            <path d="M12 13v8" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M8 6h8M8 8h8M8 10h8" strokeWidth="1" opacity="0.7"/>
                            <path d="M10 4v8M12 4v8M14 4v8" strokeWidth="1" opacity="0.7"/>
                          </svg>
                          <div className="absolute -top-1 -right-1 w-2 h-2 md:w-2.5 md:h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-lg"></div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black bg-gradient-to-r from-slate-800 via-blue-700 to-purple-800 bg-clip-text text-transparent mb-1 tracking-tight leading-tight">
                          {tournament.name}
                        </h1>
                        <div className="flex items-center space-x-1 md:space-x-2">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <p className="text-slate-600 font-medium text-xs md:text-sm uppercase tracking-wider">Professional Tennis</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-slate-700 text-sm md:text-base lg:text-lg leading-relaxed font-medium max-w-3xl">
                      {tournament.description}
                    </p>
                  </div>
                </div>

                {/* Professional Statistics Dashboard - More compact */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 lg:p-5 border border-white/40 shadow-inner">
                  <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
                    
                    {/* Total Matches Card */}
                    <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-100 p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl border border-blue-200/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="hidden md:block absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-10 translate-x-10"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2 md:mb-4">
                          <div className="bg-blue-500 p-2 md:p-3 rounded-lg md:rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="text-right">
                            <p className="text-xl md:text-3xl xl:text-4xl font-black text-blue-700 mb-0 md:mb-1">{allMatches.length}</p>
                            <p className="text-blue-600 font-bold text-xs md:text-sm uppercase tracking-wider">Total</p>
                          </div>
                        </div>
                        <div className="bg-blue-500/10 rounded-lg p-1 md:p-2">
                          <p className="text-xs text-blue-800 font-semibold text-center">Matches</p>
                        </div>
                      </div>
                    </div>

                    {/* Completed Matches Card */}
                    <div className="group relative bg-gradient-to-br from-emerald-50 to-green-100 p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl border border-emerald-200/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="hidden md:block absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-10 translate-x-10"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                          <div className="bg-emerald-500 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-right">
                            <p className="text-xl md:text-2xl lg:text-3xl font-black text-emerald-700 mb-0 md:mb-1">{allMatches.filter(m => m.status === 'completed').length}</p>
                            <p className="text-emerald-600 font-bold text-xs md:text-sm uppercase tracking-wider">Done</p>
                          </div>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-1 md:p-2">
                          <p className="text-xs text-emerald-800 font-semibold text-center">Finished</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Percentage Card */}
                    <div className="group relative bg-gradient-to-br from-purple-50 to-violet-100 p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl border border-purple-200/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="hidden md:block absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-10 translate-x-10"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                          <div className="bg-purple-500 p-2 md:p-2.5 rounded-lg md:rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div className="text-right">
                            <p className="text-xl md:text-2xl lg:text-3xl font-black text-purple-700 mb-0 md:mb-1">
                              {allMatches.length > 0 ? Math.round((allMatches.filter(m => m.status === 'completed').length / allMatches.length) * 100) : 0}%
                            </p>
                            <p className="text-purple-600 font-bold text-xs md:text-sm uppercase tracking-wider">Progress</p>
                          </div>
                        </div>
                        <div className="bg-purple-500/10 rounded-lg p-1 md:p-2">
                          <div className="w-full bg-purple-200 rounded-full h-1.5 md:h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-violet-600 h-1.5 md:h-2 rounded-full transition-all duration-1000"
                              style={{ width: `${allMatches.length > 0 ? Math.round((allMatches.filter(m => m.status === 'completed').length / allMatches.length) * 100) : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tournament Format Card */}
                    <div className="group relative bg-gradient-to-br from-amber-50 to-orange-100 p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl border border-amber-200/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="hidden md:block absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-10 translate-x-10"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2 md:mb-4">
                          <div className="bg-amber-500 p-2 md:p-3 rounded-lg md:rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                          </div>
                          <div className="text-right">
                            <p className="text-sm md:text-lg xl:text-xl font-black text-amber-700 mb-0 md:mb-1">Round</p>
                            <p className="text-amber-600 font-bold text-xs md:text-sm uppercase tracking-wider">Robin</p>
                          </div>
                        </div>
                        <div className="bg-amber-500/10 rounded-lg p-1 md:p-2">
                          <p className="text-xs text-amber-800 font-semibold text-center">Format</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Tournament Rankings - Round Robin Style (Same as Admin) */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-purple-200/50 overflow-hidden h-[600px] md:h-[600px] flex flex-col">
              <div className="bg-gradient-to-r from-purple-500 to-blue-600 p-4 md:p-6 flex-shrink-0">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center">
                  🏆 Tournament Rankings
                </h2>
                <p className="text-purple-100 mt-1 md:mt-2 text-sm md:text-base">Live league standings</p>
              </div>
              
              {/* Round-Robin ranking table */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 md:p-6 rounded-xl border border-purple-200 flex-1 flex flex-col m-3 md:m-6 mt-0 min-h-0">
                <div className="flex-1 overflow-hidden rounded-lg border border-purple-200 bg-white">
                  <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                    <table className="w-full min-w-[550px] md:min-w-[600px]">
                      <thead className="sticky top-0 bg-white z-20 shadow-sm">
                        <tr className="border-b-2 border-purple-200">
                          <th className="text-left py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">Pos</th>
                          <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs font-bold text-purple-700 min-w-[100px] md:min-w-[120px] bg-white">Player</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">PTS</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">P</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">W</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">L</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">Sets</th>
                          <th className="text-center py-2 md:py-3 px-1 md:px-3 text-xs font-bold text-purple-700 whitespace-nowrap bg-white">Win%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.map((player, index) => {
                          const isCurrentUser = player.id === currentUser?.uid;
                          return (
                            <tr key={player.id} className={`border-b border-purple-100 hover:bg-purple-50 transition-colors duration-200 h-16 sm:h-18 ${
                              isCurrentUser ? 'bg-gradient-to-r from-blue-50 to-purple-50 ring-2 ring-blue-300' :
                              index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' :
                              index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100' :
                              index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100' : ''
                            }`}>
                              <td className="py-4 px-2 sm:px-3">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                                  isCurrentUser ? 'bg-blue-500 text-white ring-2 ring-blue-300' :
                                  index === 0 ? 'bg-yellow-500 text-white' :
                                  index === 1 ? 'bg-gray-500 text-white' :
                                  index === 2 ? 'bg-orange-500 text-white' :
                                  'bg-purple-200 text-purple-700'
                                }`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="py-4 px-3 sm:px-4">
                                <div className="min-w-0">
                                  <p className={`font-semibold text-gray-800 text-sm sm:text-base whitespace-nowrap truncate ${
                                    isCurrentUser ? 'text-blue-800' : 'text-gray-800'
                                  }`}>
                                    {player.firstName?.charAt(0)}. {player.lastName?.toUpperCase()}
                                    {isCurrentUser && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">(You)</span>}
                                  </p>
                                  <p className="text-xs text-gray-500 whitespace-nowrap">Seed #{index + 1}</p>
                                </div>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-bold text-base sm:text-lg text-green-600 whitespace-nowrap">
                                  {player.roundRobinStats?.points || 0}
                                </span>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-semibold text-sm sm:text-base text-gray-700 whitespace-nowrap">
                                  {player.roundRobinStats?.matches || 0}
                                </span>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-semibold text-sm sm:text-base text-green-600 whitespace-nowrap">
                                  {player.roundRobinStats?.wins || 0}
                                </span>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-semibold text-sm sm:text-base text-red-600 whitespace-nowrap">
                                  {player.roundRobinStats?.losses || 0}
                                </span>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-semibold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
                                  {player.roundRobinStats?.setsWon || 0}-{player.roundRobinStats?.setsLost || 0}
                                </span>
                              </td>
                              <td className="py-4 px-2 sm:px-3 text-center">
                                <span className="font-semibold text-purple-600 text-xs sm:text-sm whitespace-nowrap">
                                  {(player.roundRobinStats?.matches || 0) > 0 ? 
                                   Math.round(((player.roundRobinStats?.wins || 0) / (player.roundRobinStats?.matches || 1)) * 100) : 0}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* My Matches Section - Professional Cards */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-200/50 overflow-hidden h-[600px] flex flex-col">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 flex-shrink-0">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  🎾 My Matches
                </h2>
                <p className="text-blue-100 mt-2">Your tournament matches</p>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                <div className="space-y-4">
                  {playerMatches.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🎾</span>
                      </div>
                      <p className="text-gray-500 text-lg font-medium">No matches scheduled yet</p>
                      <p className="text-gray-400 text-sm mt-2">Check back when the tournament begins</p>
                    </div>
                  ) : (
                    playerMatches.map((match) => (
                      <div 
                        key={match.id} 
                        className="group relative bg-gradient-to-br from-blue-50/50 to-purple-50/50 backdrop-blur-sm border-2 border-blue-100/50 rounded-2xl p-5 hover:shadow-xl hover:border-blue-300/70 transition-all duration-300 cursor-pointer"
                        onClick={() => handleMatchClick(match)}
                      >
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                              match.status === 'completed' ? 'bg-green-100 text-green-700' :
                              match.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {match.status === 'completed' ? '✅ Completed' :
                               match.status === 'ready' ? '⏳ Ready' :
                               '⏸️ Waiting'}
                            </div>
                            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                              Round {match.round}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            Match #{match.matchNumber}
                          </div>
                        </div>

                        {/* Compact Players Section */}
                        <div className="space-y-1.5">
                          {/* Player 1 */}
                          <div className={`rounded-lg p-2 transition-all duration-300 ${
                            match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md ring-2 ring-yellow-300/50' 
                              : match.player1?.id === currentUser?.uid
                              ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 ring-2 ring-blue-300'
                              : 'bg-white/70 backdrop-blur-sm text-gray-800'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                  match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                                    ? 'bg-white/30 text-white' 
                                    : match.player1?.id === currentUser?.uid
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {(playerMatches.findIndex(m => m.id === match.id) % 8) + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-xs truncate">
                                    {match.player1.firstName?.charAt(0)}. {match.player1.lastName?.toUpperCase()}
                                    {match.player1?.id === currentUser?.uid && ' (YOU)'}
                                  </p>
                                </div>
                              </div>
                              <div className={`text-lg font-black ${
                                match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                                  ? 'text-white drop-shadow-sm' 
                                  : match.player1?.id === currentUser?.uid
                                  ? 'text-blue-700'
                                  : 'text-blue-600'
                              }`}>
                                {match.player1SetsWon !== undefined ? match.player1SetsWon :
                                 match.score ? match.score.split('-')[0] || '-' :
                                 match.winner === `${match.player1.firstName} ${match.player1.lastName}` ? 'W' :
                                 match.winner ? 'L' : '-'}
                              </div>
                            </div>
                          </div>

                          {/* Compact VS Divider */}
                          <div className="flex items-center justify-center">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              VS
                            </div>
                          </div>

                          {/* Player 2 */}
                          <div className={`rounded-lg p-2 transition-all duration-300 ${
                            match.winner === `${match.player2.firstName} ${match.player2.lastName}` 
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md ring-2 ring-yellow-300/50' 
                              : match.player2?.id === currentUser?.uid
                              ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 ring-2 ring-blue-300'
                              : 'bg-white/70 backdrop-blur-sm text-gray-800'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                  match.winner === `${match.player2.firstName} ${match.player2.lastName}` 
                                    ? 'bg-white/30 text-white' 
                                    : match.player2?.id === currentUser?.uid
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {(playerMatches.findIndex(m => m.id === match.id) % 8) + 2}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-xs truncate">
                                    {match.player2.firstName?.charAt(0)}. {match.player2.lastName?.toUpperCase()}
                                    {match.player2?.id === currentUser?.uid && ' (YOU)'}
                                  </p>
                                </div>
                              </div>
                              <div className={`text-lg font-black ${
                                match.winner === `${match.player2.firstName} ${match.player2.lastName}` 
                                  ? 'text-white drop-shadow-sm' 
                                  : match.player2?.id === currentUser?.uid
                                  ? 'text-blue-700'
                                  : 'text-blue-600'
                              }`}>
                                {match.player2SetsWon !== undefined ? match.player2SetsWon :
                                 match.score ? match.score.split('-')[1] || '-' :
                                 match.winner === `${match.player2.firstName} ${match.player2.lastName}` ? 'W' :
                                 match.winner ? 'L' : '-'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Compact Detailed Score */}
                        {match.detailedScore && (
                          <div className="mt-2 p-1.5 bg-white/60 backdrop-blur-sm rounded-lg">
                            <p className="text-xs text-gray-700 text-center font-medium">
                              {match.detailedScore}
                            </p>
                          </div>
                        )}

                        {/* Compact Action Hint */}
                        <div className="mt-2 flex items-center justify-center">
                          <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full">
                            <p className="text-xs text-gray-600 font-medium flex items-center space-x-1">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>{match.status === 'completed' ? 'Edit' : 'Enter'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Hover Effect Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Score Update Modal - Admin Style */}
        {editingMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl">
                <h2 className="text-xl font-bold">🎾 Match Result</h2>
                <p className="text-blue-100 text-sm mt-1">Enter final set wins</p>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Match Details Section */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Match Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 font-medium">Round:</span>
                      <p className="font-semibold text-gray-800">Round {editingMatch.round}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Match #:</span>
                      <p className="font-semibold text-gray-800">{editingMatch.matchNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Status:</span>
                      <p className={`font-semibold ${
                        editingMatch.status === 'completed' ? 'text-green-600' :
                        editingMatch.status === 'playing' ? 'text-yellow-600' :
                        editingMatch.status === 'ready' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {editingMatch.status === 'completed' ? 'Completed' :
                         editingMatch.status === 'playing' ? 'In Progress' :
                         editingMatch.status === 'ready' ? 'Ready' :
                         'Waiting'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Tournament:</span>
                      <p className="font-semibold text-gray-800 truncate">{tournament?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Player 1 */}
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">
                      {editingMatch.player1.firstName} {editingMatch.player1.lastName}
                      {editingMatch.player1?.id === currentUser?.uid && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">(You)</span>
                      )}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={scoreForm.player1SetsWon}
                      onChange={(e) => setScoreForm({
                        ...scoreForm,
                        player1SetsWon: parseInt(e.target.value) || 0
                      })}
                      className="w-16 px-3 py-2 border-2 border-blue-300 rounded-lg text-center font-bold text-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* VS Divider */}
                <div className="text-center text-gray-400 font-bold mb-4">VS</div>

                {/* Player 2 */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">
                      {editingMatch.player2.firstName} {editingMatch.player2.lastName}
                      {editingMatch.player2?.id === currentUser?.uid && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">(You)</span>
                      )}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={scoreForm.player2SetsWon}
                      onChange={(e) => setScoreForm({
                        ...scoreForm,
                        player2SetsWon: parseInt(e.target.value) || 0
                      })}
                      className="w-16 px-3 py-2 border-2 border-blue-300 rounded-lg text-center font-bold text-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Detailed Score Section */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    📝 Detailed Score (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 6-4, 6-3, 7-5"
                    value={scoreForm.detailedScore}
                    onChange={(e) => setScoreForm({
                      ...scoreForm,
                      detailedScore: e.target.value
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the game-by-game score for each set</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingMatch(null);
                      setError(null);
                      setScoreForm({ player1SetsWon: 0, player2SetsWon: 0, detailedScore: '' });
                    }}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateMatchScore(editingMatch.id || '', scoreForm.player1SetsWon, scoreForm.player2SetsWon)}
                    disabled={updatingMatch === editingMatch.id}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 flex items-center justify-center"
                  >
                    {updatingMatch === editingMatch.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Score'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logout Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-red-100 to-pink-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Logout Confirmation</h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to logout? You'll need to sign in again to access your tournaments.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}