'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, onSnapshot, orderBy, setDoc } from 'firebase/firestore';
import { Trophy, Users, Calendar, Edit3, X, Save, Plus, Trash2, Play, LogOut, Menu, UserPlus } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  type: 'elimination' | 'round-robin';
  phase: 'subscribing' | 'playing' | 'completed';
  status: 'upcoming' | 'active' | 'completed' | 'playing';
  createdAt: string;
  playersCount: number;
  matchesCount: number;
  createdBy?: string;
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
  seed?: number; // Initial seed assignment
  finalSeed?: number; // Final ATP-style seed
  rating?: number; // Player rating for seeding
  isSeeded?: boolean; // Whether player is in seeded group
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
  hasBye?: boolean; // Indicates if this match has a bye player
  seedInfo?: string; // Seeding information display
  sets?: Array<{
    setNumber: number;
    player1Score: number;
    player2Score: number;
  }>;
  player1SetsWon?: number;
  player2SetsWon?: number;
  detailedScore?: string; // e.g., "6-4, 6-3, 7-5"
  player1Seed?: number;
  player2Seed?: number;
}



export default function AdminDashboard() {
  const { currentUser, userData, logout } = useAuth();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentType, setTournamentType] = useState<'elimination' | 'round-robin'>('elimination');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournamentMatches, setTournamentMatches] = useState<Match[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showStartTournamentModal, setShowStartTournamentModal] = useState(false);
  const [isStartingTournament, setIsStartingTournament] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([]);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreForm, setScoreForm] = useState({
    player1SetsWon: 0,
    player2SetsWon: 0,
    detailedScore: ''
  });
  const [editScores, setEditScores] = useState({
    set1: { player1: '', player2: '' },
    set2: { player1: '', player2: '' },
    set3: { player1: '', player2: '' }
  });

  // Filter states for matches section
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowPlayerDropdown(false);
      setShowStatusDropdown(false);
    };

    if (showPlayerDropdown || showStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showPlayerDropdown, showStatusDropdown]);

  // Load existing tournament on component mount
  useEffect(() => {
    const loadTournament = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        const tournamentsQuery = query(
          collection(db, 'tournaments'),
          where('createdBy', '==', currentUser.uid)
        );
        
        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        
        if (!tournamentsSnapshot.empty) {
          const tournamentDoc = tournamentsSnapshot.docs[0];
          const tournamentData = {
            id: tournamentDoc.id,
            ...tournamentDoc.data()
          } as Tournament;
          
          setTournament(tournamentData);
        }
      } catch (error) {
        console.error('Error loading tournament:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTournament();
  }, [currentUser]);

  // Real-time listener for registered players
  useEffect(() => {
    if (!tournament?.id) return;

    console.log('Setting up real-time listener for tournament:', tournament.id);

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'users'),
        where('tournaments', 'array-contains', tournament.id),
        where('role', '==', 'user')
      ),
      (snapshot) => {
        const players: Player[] = [];
        
        snapshot.forEach((doc) => {
          const userData = doc.data();
          players.push({
            id: doc.id,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            role: userData.role || 'user',
            createdAt: userData.createdAt || new Date().toISOString(),
            tournamentRegistered: userData.tournaments || []
          });
        });

        console.log('Real-time players update:', players);
        setRegisteredPlayers(players);

        // Update tournament player count in real-time
        if (tournament && players.length !== tournament.playersCount) {
          setTournament(prev => prev ? {
            ...prev,
            playersCount: players.length
          } : null);

          // Update player count in Firebase
          const tournamentRef = doc(db, 'tournaments', tournament.id);
          updateDoc(tournamentRef, {
            playersCount: players.length
          }).catch(err => console.error('Error updating player count:', err));
        }
      },
      (error) => {
        console.error('Error in real-time listener:', error);
      }
    );

    return () => {
      console.log('Cleaning up real-time listener');
      unsubscribe();
    };
  }, [tournament?.id]);

  // Real-time listener for tournament matches
  useEffect(() => {
    if (!tournament?.id || tournament.phase === 'subscribing') {
      setTournamentMatches([]);
      return;
    }

    console.log('Setting up matches listener for tournament:', tournament.id);

    const matchesQuery = query(
      collection(db, 'tournaments', tournament.id, 'matches'),
      orderBy('round'),
      orderBy('matchNumber')
    );

    const unsubscribe = onSnapshot(matchesQuery, (snapshot) => {
      const matches: Match[] = [];
      
      snapshot.forEach((doc) => {
        matches.push({
          id: doc.id,
          ...doc.data()
        } as Match);
      });

      // Sort matches by round and match number
      matches.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.matchNumber - b.matchNumber;
      });

      console.log('Real-time matches update:', matches);
      setTournamentMatches(matches);
    }, (error) => {
      console.error('Error in matches listener:', error);
    });

    return () => {
      console.log('Cleaning up matches listener');
      unsubscribe();
    };
  }, [tournament?.id, tournament?.phase]);

  const openScoreModal = (match: Match) => {
    setEditingMatch(match);
    
    // Handle different score formats
    let player1Sets = 0;
    let player2Sets = 0;
    
    if (match.player1SetsWon !== undefined && match.player2SetsWon !== undefined) {
      // New format
      player1Sets = match.player1SetsWon;
      player2Sets = match.player2SetsWon;
    } else if (match.score && match.score.includes('-')) {
      // Score format like "2-1"
      const scoreParts = match.score.split('-');
      player1Sets = parseInt(scoreParts[0]) || 0;
      player2Sets = parseInt(scoreParts[1]) || 0;
    }
    
    setScoreForm({
      player1SetsWon: player1Sets,
      player2SetsWon: player2Sets,
      detailedScore: match.detailedScore || ''
    });
    setShowScoreModal(true);
  };

  const closeScoreModal = () => {
    setShowScoreModal(false);
    setEditingMatch(null);
    setScoreForm({
      player1SetsWon: 0,
      player2SetsWon: 0,
      detailedScore: ''
    });
  };

  const saveSimpleScore = async () => {
    if (!editingMatch || !tournament) return;

    try {
      const matchRef = doc(db, 'tournaments', tournament.id!, 'matches', editingMatch.id!);
      const winner = scoreForm.player1SetsWon > scoreForm.player2SetsWon ? 
        `${editingMatch.player1.firstName} ${editingMatch.player1.lastName}` : 
        `${editingMatch.player2.firstName} ${editingMatch.player2.lastName}`;

      // Create completely new match document with clean structure
      const newMatchData = {
        // Keep essential match info
        id: editingMatch.id,
        tournamentId: editingMatch.tournamentId,
        round: editingMatch.round,
        matchNumber: editingMatch.matchNumber,
        bracket: editingMatch.bracket,
        roundName: editingMatch.roundName,
        player1: editingMatch.player1,
        player2: editingMatch.player2,
        hasBye: editingMatch.hasBye || false,
        seedInfo: editingMatch.seedInfo || '',
        createdAt: editingMatch.createdAt || new Date().toISOString(),
        
        // New scoring structure
        player1SetsWon: scoreForm.player1SetsWon,
        player2SetsWon: scoreForm.player2SetsWon,
        detailedScore: scoreForm.detailedScore || '',
        score: `${scoreForm.player1SetsWon}-${scoreForm.player2SetsWon}`,
        winner: winner,
        status: 'completed'
      };

      // Replace the entire document
      await setDoc(matchRef, newMatchData);

      closeScoreModal();
    } catch (error) {
      console.error('Error saving match score:', error);
      // Show user-friendly error
      alert('Failed to save score. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    
    try {
      // Add a small delay for dramatic effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to logout:', error);
      alert('Failed to logout. Please try again.');
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) return;
    
    setIsCreating(true);
    
    try {
      // Create tournament in Firebase
      const tournamentData = {
        name: tournamentName,
        type: tournamentType,
        phase: 'subscribing' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        playersCount: 0,
        matchesCount: 0,
        createdBy: currentUser?.uid
      };

      const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
      
      const newTournament: Tournament = {
        id: docRef.id,
        ...tournamentData
      };

      setTournament(newTournament);
      setTournamentName('');
      setTournamentType('elimination');
      setShowCreateModal(false);
      
      console.log('Tournament created successfully:', newTournament);
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Error creating tournament. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePhaseChange = async (newPhase: 'subscribing' | 'playing' | 'completed') => {
    if (!tournament) return;
    
    try {
      // Map phase to status for consistency
      const statusMapping: Record<string, 'upcoming' | 'active' | 'completed' | 'playing'> = {
        'subscribing': 'active',
        'playing': 'playing', 
        'completed': 'completed'
      };
      
      // Update both phase and status in Firebase for real-time sync
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        phase: newPhase,
        status: statusMapping[newPhase]
      });
      
      // If moving to playing phase, generate matches
      if (newPhase === 'playing') {
        await generateMatches();
      }
      
      setTournament({
        ...tournament,
        phase: newPhase,
        status: statusMapping[newPhase]
      });
      
      console.log(`Tournament phase changed to: ${newPhase} (status: ${statusMapping[newPhase]})`);
    } catch (error) {
      console.error('Error changing tournament phase:', error);
      alert('Error updating tournament phase. Please try again.');
    }
  };

  const generateMatches = async () => {
    if (!tournament) return;
    
    try {
      // Get all registered players for this tournament (FIXED QUERY)
      const playersQuery = query(
        collection(db, 'users'), 
        where('role', '==', 'user'),
        where('tournaments', 'array-contains', tournament.id)
      );
      
      const playersSnapshot = await getDocs(playersQuery);
      const players = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        firstName: doc.data().firstName || '',
        lastName: doc.data().lastName || '',
        email: doc.data().email || ''
      }));

      console.log('Players for match generation:', players);

      if (players.length < 2) {
        alert('Need at least 2 players to generate matches!');
        return;
      }

      let matches = [];

      if (tournament.type === 'elimination') {
        // Generate complete elimination bracket
        matches = generateEliminationBracket(players);
      } else {
        // Generate round-robin matches
        matches = generateRoundRobinMatches(players);
      }

      console.log('Generated matches:', matches);
      
      // Display comprehensive bracket analysis
      console.log('\n🎾 ATP-STYLE TOURNAMENT BRACKET:');
      console.log('='.repeat(60));
      
      // Group by rounds for better visualization
      const roundGroups = matches.reduce((groups: any, match) => {
        if (!groups[match.round]) groups[match.round] = [];
        groups[match.round].push(match);
        return groups;
      }, {});
      
      Object.keys(roundGroups).forEach(roundStr => {
        const round = parseInt(roundStr);
        const roundMatches = roundGroups[round];
        console.log(`\n🏆 ${roundMatches[0].roundName.toUpperCase()} (Round ${round}):`);
        
        roundMatches.forEach((match: any) => {
          const p1 = match.player1.isBye ? 'BYE' : 
                    match.player1.isPlaceholder ? 'TBD' : 
                    `(${match.player1.finalSeed}) ${match.player1.firstName} ${match.player1.lastName}`;
          const p2 = match.player2.isBye ? 'BYE' : 
                    match.player2.isPlaceholder ? 'TBD' : 
                    `(${match.player2.finalSeed}) ${match.player2.firstName} ${match.player2.lastName}`;
          
          const seedAnalysis = round === 1 && match.seedInfo ? ` [Seeds: ${match.seedInfo}]` : '';
          console.log(`  ${match.bracket}: ${p1} vs ${p2}${seedAnalysis}`);
        });
      });
      
      console.log('\n📊 TOURNAMENT STATISTICS:');
      console.log(`  👥 Total Players: ${players.length}`);
      console.log(`  ⚔️ Total Matches: ${matches.length}`);
      console.log(`  🔄 Total Rounds: ${Math.max(...matches.map(m => m.round))}`);
      console.log(`  ⏭️ Byes Used: ${matches.filter(m => m.hasBye).length}`);
      console.log(`  🎖️ Seeded Players: ${Math.min(8, Math.ceil(players.length / 4))}`);
      console.log('='.repeat(60));

      // Save matches to Firebase in tournaments subcollection with new clean structure
      const matchPromises = matches.map(match => 
        addDoc(collection(db, 'tournaments', tournament.id, 'matches'), {
          ...match,
          tournamentId: tournament.id,
          createdAt: new Date().toISOString(),
          status: match.round === 1 ? 'ready' : 'waiting', // Only first round matches are ready
          winner: null,
          score: null,
          // New clean scoring structure
          player1SetsWon: 0,
          player2SetsWon: 0,
          detailedScore: ''
        })
      );

      await Promise.all(matchPromises);

      // Update tournament match count
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        matchesCount: matches.length,
        totalRounds: tournament.type === 'elimination' ? Math.ceil(Math.log2(players.length)) : 1
      });

      setTournament({
        ...tournament,
        matchesCount: matches.length
      });

      console.log('Matches generated successfully:', matches);
    } catch (error) {
      console.error('Error generating matches:', error);
      alert('Error generating matches. Please try again.');
    }
  };

  // Professional ATP-style seeded elimination bracket generator
  const generateEliminationBracket = (players: any[]) => {
    const matches: any[] = [];
    
    console.log(`🎾 ATP-STYLE TOURNAMENT GENERATOR`);
    console.log(`📊 Players registered: ${players.length}`);
    
    // Step 1: Optimize bracket size (minimize byes)
    const optimalBracketSize = getOptimalBracketSize(players.length);
    const byesNeeded = optimalBracketSize - players.length;
    const totalRounds = Math.log2(optimalBracketSize);
    
    console.log(`� Optimal bracket size: ${optimalBracketSize} (${totalRounds} rounds)`);
    console.log(`⏭️ Byes needed: ${byesNeeded} (minimized)`);
    console.log(`🔢 Even/Odd: ${players.length % 2 === 0 ? 'EVEN' : 'ODD'}`);
    
    // Step 2: Create ATP-style seeding system
    const seededPlayers = createATPSeeding(players);
    
    // Step 3: Generate professional bracket with strategic bye placement
    const bracket = generateATPBracket(seededPlayers, optimalBracketSize, byesNeeded);
    
    // Step 4: Convert bracket to matches
    return createMatchesFromBracket(bracket, totalRounds);
  };

  // Optimize bracket size to minimize byes (ATP approach)
  const getOptimalBracketSize = (playerCount: number) => {
    // ATP tries to use the smallest power of 2 that accommodates players
    // But also considers alternatives that minimize byes
    
    const powerOf2 = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const byesWithPowerOf2 = powerOf2 - playerCount;
    
    console.log(`📈 Power of 2 analysis: ${powerOf2} (${byesWithPowerOf2} byes)`);
    
    // For very small tournaments, consider non-power-of-2 options
    if (playerCount <= 8) {
      const alternatives = [4, 6, 8, 12, 16];
      let bestSize = powerOf2;
      let minByes = byesWithPowerOf2;
      
      alternatives.forEach(size => {
        if (size >= playerCount) {
          const byes = size - playerCount;
          if (byes < minByes) {
            minByes = byes;
            bestSize = size;
          }
        }
      });
      
      console.log(`🏆 Optimized: ${bestSize} bracket (${minByes} byes vs ${byesWithPowerOf2})`);
      return bestSize;
    }
    
    return powerOf2;
  };

  // Create ATP-style seeding (professional ranking system)
  const createATPSeeding = (players: any[]) => {
    console.log(`\n🎖️ ATP SEEDING SYSTEM:`);
    
    // Create player ratings based on multiple factors (ATP style)
    const ratedPlayers = players.map((player, index) => ({
      ...player,
      seed: index + 1, // Simple seeding for now (1 = top seed)
      rating: calculatePlayerRating(player, index),
      isSeeded: index < Math.min(8, Math.ceil(players.length / 4)) // Top 25% are seeded
    }));
    
    // Sort by rating (highest first) - ATP ranking style
    ratedPlayers.sort((a, b) => b.rating - a.rating);
    
    // Assign final seeds
    ratedPlayers.forEach((player, index) => {
      player.finalSeed = index + 1;
      const seedType = player.finalSeed <= 2 ? '🥇 TOP SEED' :
                      player.finalSeed <= 4 ? '🥈 HIGH SEED' :
                      player.finalSeed <= 8 ? '🥉 SEEDED' : '👤 UNSEEDED';
      console.log(`${seedType}: #${player.finalSeed} ${player.firstName} ${player.lastName} (Rating: ${player.rating})`);
    });
    
    return ratedPlayers;
  };

  // Calculate ATP-style player rating
  const calculatePlayerRating = (player: any, registrationOrder: number) => {
    let rating = 1000; // Base rating
    
    // Factor 1: Registration timing (early = higher ranking assumption)
    rating += (100 - registrationOrder * 10);
    
    // Factor 2: Name-based consistency (simulate past performance)
    const nameHash = (player.firstName + player.lastName).split('').reduce((a: number, b: string) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    rating += Math.abs(nameHash) % 200; // Add 0-200 points
    
    // Factor 3: Email domain factor (simulate club membership)
    if (player.email.includes('gmail') || player.email.includes('hotmail')) {
      rating += 50; // Popular email = more active player
    }
    
    // Add small random factor for variety
    rating += Math.random() * 100;
    
    return Math.round(rating);
  };

  // Generate ATP-style bracket with strategic seeding
  const generateATPBracket = (seededPlayers: any[], bracketSize: number, byesNeeded: number) => {
    console.log(`\n🏗️ BUILDING ATP BRACKET:`);
    
    // Create bracket positions (ATP standard positions)
    const positions = Array(bracketSize).fill(null);
    
    // Step 1: Place top seeds in standard ATP positions
    if (seededPlayers.length >= 1) positions[0] = seededPlayers[0]; // Seed 1: Top
    if (seededPlayers.length >= 2) positions[bracketSize - 1] = seededPlayers[1]; // Seed 2: Bottom
    if (seededPlayers.length >= 3) positions[Math.floor(bracketSize / 4)] = seededPlayers[2]; // Seed 3: Quarter
    if (seededPlayers.length >= 4) positions[bracketSize - 1 - Math.floor(bracketSize / 4)] = seededPlayers[3]; // Seed 4: Three-quarter
    
    // Step 2: Distribute remaining seeded players
    let seedIndex = 4;
    const seedPositions = generateSeedPositions(bracketSize);
    for (let i = 4; i < Math.min(seededPlayers.length, 8) && seedIndex < seededPlayers.length; i++) {
      const pos = seedPositions[i];
      if (pos < positions.length && !positions[pos]) {
        positions[pos] = seededPlayers[seedIndex];
        seedIndex++;
      }
    }
    
    // Step 3: Fill remaining positions with unseeded players
    let unseededIndex = seedIndex;
    for (let i = 0; i < positions.length && unseededIndex < seededPlayers.length; i++) {
      if (!positions[i]) {
        positions[i] = seededPlayers[unseededIndex];
        unseededIndex++;
      }
    }
    
    // Step 4: Strategic bye placement (ATP minimizes impact on top seeds)
    const byePositions = getStrategicByePositions(bracketSize, byesNeeded);
    byePositions.forEach((pos, index) => {
      if (!positions[pos]) {
        positions[pos] = {
          id: `bye_${index + 1}`,
          isBye: true,
          firstName: 'BYE',
          lastName: '',
          email: '',
          seed: 999
        };
      }
    });
    
    console.log(`✅ Bracket positions filled: ${positions.filter(p => p).length}/${bracketSize}`);
    return positions.filter(p => p); // Remove empty positions
  };

  // Generate ATP standard seed positions
  const generateSeedPositions = (bracketSize: number) => {
    const positions = [];
    const sections = [0, bracketSize / 4, bracketSize / 2, (3 * bracketSize) / 4];
    
    // Distribute seeds across sections to avoid early encounters
    for (let i = 0; i < 8; i++) {
      const section = i % 4;
      const offset = Math.floor(i / 4) * Math.floor(bracketSize / 8);
      positions.push(Math.floor(sections[section] + offset));
    }
    
    return positions;
  };

  // Strategic bye placement (minimize impact on competition)
  const getStrategicByePositions = (bracketSize: number, byesNeeded: number) => {
    const positions = [];
    
    // ATP strategy: Place byes to minimize disruption to seeded players
    // Byes go to positions that would face lower seeds first
    for (let i = 0; i < byesNeeded; i++) {
      // Calculate position that minimizes impact on bracket balance
      const pos = bracketSize - 1 - (i * 2);
      positions.push(Math.max(0, pos));
    }
    
    console.log(`🎯 Strategic bye positions: [${positions.join(', ')}]`);
    return positions;
  };

  // Convert bracket positions to match objects
  const createMatchesFromBracket = (bracket: any[], totalRounds: number) => {
    const matches: any[] = [];
    let matchNumber = 1;
    
    console.log(`\n⚔️ GENERATING MATCHES:`);
    
    // Generate first round matches
    for (let i = 0; i < bracket.length; i += 2) {
      if (i + 1 < bracket.length) {
        const player1 = bracket[i];
        const player2 = bracket[i + 1];
        
        // Skip if both are byes (shouldn't happen with good algorithm)
        if (player1?.isBye && player2?.isBye) continue;
        
        const match = {
          round: 1,
          matchNumber: matchNumber++,
          player1: player1 || { id: 'empty', isPlaceholder: true },
          player2: player2 || { id: 'empty', isPlaceholder: true },
          bracket: `R1M${Math.floor(i / 2) + 1}`,
          roundName: getRoundName(1, totalRounds),
          hasBye: player1?.isBye || player2?.isBye || false,
          seedInfo: `${player1?.finalSeed || '?'} vs ${player2?.finalSeed || '?'}`
        };
        
        matches.push(match);
        
        const p1Name = player1?.isBye ? 'BYE' : `${player1?.firstName} ${player1?.lastName}`;
        const p2Name = player2?.isBye ? 'BYE' : `${player2?.firstName} ${player2?.lastName}`;
        console.log(`${match.bracket}: (${player1?.finalSeed || '?'}) ${p1Name} vs (${player2?.finalSeed || '?'}) ${p2Name}`);
      }
    }
    
    // Generate subsequent round placeholders
    let currentRoundMatches = matches.length;
    for (let round = 2; round <= totalRounds; round++) {
      const roundMatches = Math.ceil(currentRoundMatches / 2);
      
      for (let i = 0; i < roundMatches; i++) {
        const match = {
          round,
          matchNumber: matchNumber++,
          player1: { id: `winner_${matches.length - currentRoundMatches + (i * 2) + 1}`, isPlaceholder: true },
          player2: { id: `winner_${matches.length - currentRoundMatches + (i * 2) + 2}`, isPlaceholder: true },
          bracket: `R${round}M${i + 1}`,
          roundName: getRoundName(round, totalRounds),
          hasBye: false,
          seedInfo: 'TBD vs TBD'
        };
        matches.push(match);
      }
      
      currentRoundMatches = roundMatches;
      if (roundMatches === 1) break; // Final match created
    }
    
    console.log(`🏆 Tournament structure: ${matches.length} matches across ${totalRounds} rounds`);
    return matches;
  };
  
  // Helper function to get round names
  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semi-Final';
    if (round === totalRounds - 2) return 'Quarter-Final';
    return `Round ${round}`;
  };

  const generateRoundRobinMatches = (players: any[]) => {
    console.log(`\n🏆 ATP ROUND-ROBIN TOURNAMENT GENERATOR`);
    console.log(`👥 Players: ${players.length}`);
    console.log(`⚔️ Total Matches: ${(players.length * (players.length - 1)) / 2}`);
    console.log('='.repeat(60));

    const matches = [];
    let matchNumber = 1;
    
    // Create seeded players for round-robin
    const seededPlayers = players.map((player, index) => ({
      ...player,
      seed: index + 1,
      finalSeed: index + 1,
      rating: 1000 + Math.random() * 500,
      roundRobinStats: {
        matches: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0
      }
    }));
    
    // Generate all possible matches (every player vs every other player)
    for (let i = 0; i < seededPlayers.length; i++) {
      for (let j = i + 1; j < seededPlayers.length; j++) {
        const player1 = seededPlayers[i];
        const player2 = seededPlayers[j];
        
        const match = {
          round: 1, // All matches are in round 1 for round-robin
          matchNumber: matchNumber,
          player1: player1,
          player2: player2,
          bracket: `RR${matchNumber}`,
          roundName: `Round Robin Match ${matchNumber}`,
          hasBye: false,
          seedInfo: `(${player1.finalSeed}) vs (${player2.finalSeed})`,
          groupStage: true // Flag to identify round-robin matches
        };
        
        matches.push(match);
        
        console.log(`🎾 Match ${matchNumber}: (${player1.finalSeed}) ${player1.firstName} ${player1.lastName} vs (${player2.finalSeed}) ${player2.firstName} ${player2.lastName}`);
        matchNumber++;
      }
    }
    
    console.log(`\n📊 ROUND-ROBIN STATISTICS:`);
    console.log(`  🏟️ Group Stage Format: Every player plays every other player`);
    console.log(`  📈 Scoring: 2 points for win, 0 points for loss`);
    console.log(`  🥇 Winner: Player with most points (head-to-head tiebreaker)`);
    console.log(`  📋 League Table: Live standings with W/L/Sets record`);
    console.log('='.repeat(60));
    
    return matches;
  };

  // Calculate Round-Robin Standings (Live League Table)
  const calculateRoundRobinStandings = () => {
    if (!registeredPlayers.length || tournament?.type !== 'round-robin') {
      return [];
    }

    // Initialize stats for each player
    const playerStats = registeredPlayers.map(player => ({
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

    // Calculate stats from completed matches
    tournamentMatches.forEach(match => {
      if (match.status === 'completed' && match.winner) {
        const player1 = playerStats.find(p => p.id === match.player1.id);
        const player2 = playerStats.find(p => p.id === match.player2.id);
        
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

    // Sort by: 1) Points, 2) Head-to-head, 3) Sets won ratio
    return playerStats.sort((a, b) => {
      // Primary: Points (descending)
      if (b.roundRobinStats.points !== a.roundRobinStats.points) {
        return b.roundRobinStats.points - a.roundRobinStats.points;
      }
      
      // Secondary: Sets won ratio (descending)
      const aRatio = a.roundRobinStats.matches > 0 ? 
        a.roundRobinStats.setsWon / (a.roundRobinStats.setsWon + a.roundRobinStats.setsLost) : 0;
      const bRatio = b.roundRobinStats.matches > 0 ? 
        b.roundRobinStats.setsWon / (b.roundRobinStats.setsWon + b.roundRobinStats.setsLost) : 0;
      
      if (bRatio !== aRatio) {
        return bRatio - aRatio;
      }
      
      // Tertiary: Total sets won (descending)
      return b.roundRobinStats.setsWon - a.roundRobinStats.setsWon;
    });
  };

  const handleStartTournament = async () => {
    if (!tournament) return;
    
    setIsStartingTournament(true);
    
    try {
      await handlePhaseChange('playing');
      setShowStartTournamentModal(false);
      
      console.log('Tournament started successfully');
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert('Error starting tournament. Please try again.');
    } finally {
      setIsStartingTournament(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    
    setIsDeleting(true);
    
    try {
      // Delete tournament from Firebase
      await deleteDoc(doc(db, 'tournaments', tournament.id));
      
      // Reset states
      setTournament(null);
      setShowDeleteModal(false);
      
      console.log('Tournament deleted successfully');
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Error deleting tournament. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to quickly update match winner
  const updateMatchWinner = async (matchId: string, winner: string) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        winner,
        status: 'completed',
        completedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating match winner:', error);
    }
  };

  // Function to save detailed match scores
  const saveMatchScore = async () => {
    if (!editingMatch) return;
    
    try {
      const sets = [
        editScores.set1.player1 || editScores.set1.player2 ? {
          player1Score: parseInt(editScores.set1.player1) || 0,
          player2Score: parseInt(editScores.set1.player2) || 0
        } : null,
        editScores.set2.player1 || editScores.set2.player2 ? {
          player1Score: parseInt(editScores.set2.player1) || 0,
          player2Score: parseInt(editScores.set2.player2) || 0
        } : null,
        editScores.set3.player1 || editScores.set3.player2 ? {
          player1Score: parseInt(editScores.set3.player1) || 0,
          player2Score: parseInt(editScores.set3.player2) || 0
        } : null
      ].filter(Boolean);
      
      // Determine winner based on sets won
      let player1Sets = 0;
      let player2Sets = 0;
      
      sets.forEach(set => {
        if (set && set.player1Score > set.player2Score) player1Sets++;
        else if (set && set.player2Score > set.player1Score) player2Sets++;
      });
      
      let winner = null;
      if (player1Sets > player2Sets && player1Sets >= 2) {
        winner = editingMatch.player1.firstName + ' ' + editingMatch.player1.lastName;
      } else if (player2Sets > player1Sets && player2Sets >= 2) {
        winner = editingMatch.player2.firstName + ' ' + editingMatch.player2.lastName;
      }
      
      await updateDoc(doc(db, 'matches', editingMatch.id!), {
        sets,
        winner,
        status: winner ? 'completed' : 'playing',
        completedAt: winner ? new Date() : null
      });
      
      setEditingMatch(null);
      setEditScores({
        set1: { player1: '', player2: '' },
        set2: { player1: '', player2: '' },
        set3: { player1: '', player2: '' }
      });
    } catch (error) {
      console.error('Error saving match score:', error);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700">Loading Tournament...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Filter matches based on selected filters
  const getFilteredMatches = () => {
    let filtered = [...tournamentMatches];
    
    console.log('Filtering matches:', {
      totalMatches: tournamentMatches.length,
      selectedPlayer,
      selectedStatus
    });
    
    // Filter by player
    if (selectedPlayer) {
      filtered = filtered.filter(match => 
        `${match.player1.firstName} ${match.player1.lastName}` === selectedPlayer ||
        `${match.player2.firstName} ${match.player2.lastName}` === selectedPlayer
      );
      console.log('After player filter:', filtered.length);
    }
    
    // Filter by status
    if (selectedStatus) {
      filtered = filtered.filter(match => match.status === selectedStatus);
      console.log('After status filter:', filtered.length);
    }
    
    return filtered;
  };

  const filteredMatches = getFilteredMatches();

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 relative overflow-hidden">
        {/* Tennis Ball Background Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-yellow-300 rounded-full opacity-10 animate-bounce" style={{animationDelay: '0s'}}></div>
          <div className="absolute top-1/4 -left-8 w-24 h-24 bg-green-400 rounded-full opacity-10 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-yellow-400 rounded-full opacity-15 animate-bounce" style={{animationDelay: '2s'}}></div>
        </div>

        {/* Enhanced Navigation with Mobile Dropdown */}
        <nav className="relative z-30 bg-white/95 backdrop-blur-xl shadow-2xl border-b border-green-200/50">
          {/* Decorative background elements */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-50/30 via-transparent to-yellow-50/30"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-400 to-green-500"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16 sm:h-20">
              {/* Left side - Logo and Title */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="relative">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-1.5 sm:p-2 shadow-lg">
                    <Image
                      src="/logo.png"
                      alt="TNTour Logo"
                      width={40}
                      height={40}
                      className="w-full h-full object-contain filter brightness-0 invert"
                      priority
                    />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-yellow-400 rounded-full animate-pulse"></div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-black bg-gradient-to-r from-green-700 to-green-600 bg-clip-text text-transparent">
                    TNTour
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-green-600/80 -mt-1 hidden sm:block">Tournament Manager</p>
                  <p className="text-xs font-medium text-green-600/70 -mt-0.5 sm:hidden">Admin Panel</p>
                </div>
              </div>

              {/* Center - Tournament Status (Desktop/Tablet) */}
              {tournament && (
                <div className="hidden sm:flex items-center space-x-2 bg-white/60 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl border border-green-200/50 shadow-lg max-w-xs md:max-w-md">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm font-bold text-green-800 truncate">{tournament.name}</span>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full font-semibold whitespace-nowrap ${
                      tournament.phase === 'subscribing' ? 'bg-blue-100 text-blue-700' : 
                      tournament.phase === 'playing' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tournament.phase === 'subscribing' ? 'Open' : 
                       tournament.phase === 'playing' ? 'Live' : 'Done'}
                    </span>
                    <span className={`hidden md:inline text-xs px-2 py-0.5 sm:py-1 rounded-full font-medium ${
                      tournament.type === 'elimination' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {tournament.type === 'elimination' ? 'Knockout' : 'Round Robin'}
                    </span>
                  </div>
                </div>
              )}

              {/* Desktop - User Info and Actions */}
              <div className="hidden sm:flex items-center space-x-3">
                {/* User Profile Card */}
                <div className="bg-white/60 backdrop-blur-sm px-4 py-3 rounded-2xl border border-green-200/50 shadow-lg">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {userData?.firstName} {userData?.lastName}
                    </p>
                    <div className="flex items-center justify-end space-x-1 -mt-0.5">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <p className="text-xs font-semibold text-green-600">Admin</p>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="group bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 font-bold text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                  </div>
                </button>
              </div>

              {/* Mobile - User Menu Button */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className={`relative w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
                    showMobileMenu 
                      ? 'bg-gradient-to-br from-red-500 to-red-600' 
                      : 'bg-gradient-to-br from-green-500 to-green-600'
                  }`}
                  aria-label={showMobileMenu ? "Close menu" : "Open menu"}
                >
                  <div className={`transform transition-all duration-300 ${showMobileMenu ? 'rotate-180 scale-110' : 'rotate-0 scale-100'}`}>
                    {showMobileMenu ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                      </span>
                    )}
                  </div>
                  {/* Animated indicator dot */}
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full transition-all duration-300 ${
                    showMobileMenu 
                      ? 'bg-yellow-400 animate-ping scale-125' 
                      : 'bg-yellow-400 animate-pulse scale-100'
                  }`}></div>
                </button>

                {/* Mobile Dropdown Menu with Amazing Animation */}
                <div 
                  className={`absolute right-0 top-12 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-green-200/50 overflow-hidden transition-all duration-500 ease-out transform ${
                    showMobileMenu 
                      ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                      : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Dropdown Header */}
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-300/20 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                          <span className="text-xl font-bold text-white">
                            {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-bold text-lg">
                            {userData?.firstName} {userData?.lastName}
                          </p>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                            <p className="text-green-100 text-sm font-medium">Tournament Admin</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Close Button */}
                      <button
                        onClick={() => setShowMobileMenu(false)}
                        className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 hover:scale-110 active:scale-95 transition-all duration-200 group"
                        aria-label="Close menu"
                      >
                        <svg className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Tournament Status (Mobile) - Vertical Layout */}
                  {tournament && (
                    <div className="p-3 border-b border-green-100">
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-3 rounded-xl border border-green-200/50">
                        <div className="space-y-3">
                          {/* Tournament Name */}
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-900 truncate">{tournament.name}</p>
                          </div>
                          
                          {/* Phase and Type Badges - Stacked Vertically */}
                          <div className="flex flex-col space-y-2">
                            <div className="flex justify-center">
                              <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                                tournament.phase === 'subscribing' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                                tournament.phase === 'playing' ? 'bg-green-100 text-green-700 border border-green-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                                {tournament.phase === 'subscribing' ? '📝 Registration Open' : 
                                 tournament.phase === 'playing' ? '⚔️ Tournament Live' : '✅ Completed'}
                              </span>
                            </div>
                            
                            <div className="flex justify-center">
                              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                tournament.type === 'elimination' 
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                  : 'bg-orange-100 text-orange-700 border border-orange-200'
                              }`}>
                                🏆 {tournament.type === 'elimination' ? 'Knockout Format' : 'Round Robin Format'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Stats Row */}
                          <div className="flex items-center justify-center space-x-6 text-xs text-gray-500 pt-1">
                            <div className="flex items-center space-x-1">
                              <span>👥</span>
                              <span className="font-medium">{tournament.playersCount}</span>
                              <span>Players</span>
                            </div>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="flex items-center space-x-1">
                              <span>⚔️</span>
                              <span className="font-medium">{tournament.matchesCount}</span>
                              <span>Matches</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Menu Items */}
                  <div className="p-2">
                    {/* Account Info */}
                    <div className="px-4 py-3 border-b border-green-100 mb-2">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Account</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Email:</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">{userData?.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Role:</span>
                          <span className="text-sm font-bold text-green-600">Administrator</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          // Add settings action here
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-green-50 rounded-xl transition-all duration-200 group"
                      >
                        <div className="w-8 h-8 bg-gray-100 group-hover:bg-green-100 rounded-lg flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-gray-600 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700">Settings</p>
                          <p className="text-xs text-gray-500">Account preferences</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          setShowLogoutModal(true);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-red-50 rounded-xl transition-all duration-200 group"
                      >
                        <div className="w-8 h-8 bg-gray-100 group-hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-gray-600 group-hover:text-red-600 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-red-700">Logout</p>
                          <p className="text-xs text-gray-500">Sign out of account</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 bg-gray-50/50 border-t border-green-100">
                    <p className="text-xs text-gray-400 text-center">TNTour Admin Panel v1.0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Backdrop - Enhanced Click Outside */}
          {showMobileMenu && (
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 sm:hidden transition-all duration-300"
              onClick={() => setShowMobileMenu(false)}
            />
          )}
        </nav>

        {/* Main Content */}
        <div className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {!tournament ? (
            /* No Tournament - Create Tournament Section */
            <div className="text-center">
              <div className="mb-8">
                <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Welcome to TNTour Admin! 🎾
                </h2>
                <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                  No tournament has been created yet. Start by creating your first tennis tournament to manage players and matches.
                </p>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl text-lg font-bold hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
                >
                  🏆 Create Tournament
                </button>
              </div>

              {/* Features Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-5xl mx-auto">
                <div className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-green-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Player Management</h3>
                  <p className="text-gray-600">Manage player registrations and tournament subscriptions</p>
                </div>

                <div className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-green-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚔️</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Match Generation</h3>
                  <p className="text-gray-600">Automatic match creation based on tournament type</p>
                </div>

                <div className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-green-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Tournament Phases</h3>
                  <p className="text-gray-600">Control subscription and playing phases</p>
                </div>
              </div>
            </div>
          ) : (
            /* Tournament Exists - Tournament Management */
            <div>
              {/* Tournament Header Card */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 mb-8 border border-green-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4 lg:mb-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto sm:mx-0">
                      <span className="text-2xl">🏆</span>
                    </div>
                    <div className="text-center sm:text-left">
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{tournament.name}</h2>
                      {/* Mobile: Stack badges vertically, Desktop: Keep horizontal */}
                      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4 mt-3">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                          tournament.phase === 'subscribing' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                          tournament.phase === 'playing' ? 'bg-green-100 text-green-800 border border-green-200' :
                          'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {tournament.phase === 'subscribing' ? '📝 Registration Open' : 
                           tournament.phase === 'playing' ? '⚔️ Tournament Live' : 
                           '✅ Completed'}
                        </span>
                        <span className="px-3 py-1.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-sm font-semibold whitespace-nowrap">
                          {tournament.type === 'elimination' ? '🎯 Knockout Format' : '🔄 Round Robin Format'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {tournament.phase === 'subscribing' && (
                      <>
                        <button
                          onClick={() => setShowStartTournamentModal(true)}
                          className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          🚀 Start Tournament
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      ⚙️ Settings
                    </button>
                  </div>
                </div>

                {/* Tournament Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">{tournament.playersCount}</div>
                    <div className="text-sm text-blue-800">Players Registered</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">{tournament.matchesCount}</div>
                    <div className="text-sm text-green-800">Matches Created</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">
                      {tournament.phase === 'subscribing' ? 'Open' : tournament.phase === 'playing' ? 'Active' : 'Done'}
                    </div>
                    <div className="text-sm text-purple-800">Status</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-xl">
                    <div className="text-2xl font-bold text-yellow-600">
                      {new Date(tournament.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-yellow-800">Created</div>
                  </div>
                </div>
              </div>

              {/* Tournament Management Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Real-time Players Section */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-green-200 relative overflow-hidden h-[32rem] flex flex-col">
                  {/* Real-time indicator */}
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-green-600">LIVE</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-6 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-gray-900">👥 Players</h3>
                    <div className="flex items-center space-x-3">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {registeredPlayers.length} registered
                      </span>
                    </div>
                  </div>
                  
                  {registeredPlayers.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-4 animate-bounce">🎾</div>
                        <p className="text-gray-500 font-medium">No players registered yet</p>
                        <p className="text-sm text-gray-400 mt-2">Players will appear here in real-time once they register</p>
                        <div className="mt-4">
                          <div className="inline-flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-green-600">Listening for registrations...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                      <div className="space-y-2 sm:space-y-3 pr-1">
                        {registeredPlayers.map((player, index) => (
                        <div 
                          key={player.id}
                          className="flex items-center justify-between p-2 sm:p-3 md:p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg sm:rounded-xl border border-blue-200/50 hover:shadow-md transition-all duration-200 animate-in slide-in-from-left"
                          style={{animationDelay: `${index * 100}ms`}}
                        >
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                              <span className="text-white font-bold text-xs sm:text-sm">
                                {player.firstName?.[0] || '?'}{player.lastName?.[0] || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                {player.firstName || 'Unknown'} {player.lastName || 'Player'}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">{player.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-gray-500">Registered</p>
                              <p className="text-xs font-medium text-gray-700">
                                {player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'Recent'}
                              </p>
                            </div>
                            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 text-xs sm:text-sm">✓</span>
                            </div>
                          </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Matches Section */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-green-200 relative overflow-hidden h-[32rem] flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0 flex-shrink-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                      {tournament.type === 'round-robin' ? '🏆 League Table' : '⚔️ Tournament Bracket'}
                    </h3>
                    <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
                      <span className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                        {tournamentMatches.length} matches
                      </span>
                      {tournament.type === 'elimination' && tournamentMatches.length > 0 && (
                        <span className="bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                          Knockout
                        </span>
                      )}
                      {tournament.type === 'round-robin' && tournamentMatches.length > 0 && (
                        <span className="bg-purple-100 text-purple-800 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                          Group Stage
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {tournament.phase === 'subscribing' ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">⏳</div>
                      <p className="text-gray-500 font-medium">Bracket will be generated</p>
                      <p className="text-sm text-gray-400 mt-2">Start the tournament to create the elimination bracket</p>
                    </div>
                  ) : tournamentMatches.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">🔄</div>
                      <p className="text-gray-500 font-medium">Generating matches...</p>
                      <p className="text-sm text-gray-400 mt-2">Please wait while we create the tournament bracket</p>
                    </div>
                  ) : tournament.type === 'round-robin' ? (
                    /* Round-Robin rakning table and match section */
                    <div className="flex-1 overflow-y-auto space-y-6">
                      {/* Round-Robin ranking table */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200 h-full flex flex-col">
                        <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                            <table className="w-full min-w-[600px]">
                              <thead className="sticky top-0 bg-white z-10">
                                <tr className="border-b-2 border-purple-200">
                                  <th className="text-left py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">Pos</th>
                                  <th className="text-left py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold text-purple-700 min-w-[120px] bg-white">Player</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">PTS</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">P</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">W</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">L</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">Sets</th>
                                  <th className="text-center py-3 px-2 sm:px-3 text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap bg-white">Win%</th>
                                </tr>
                              </thead>
                              <tbody>
                              {calculateRoundRobinStandings().map((player, index) => (
                                <tr key={player.id} className={`border-b border-purple-100 hover:bg-purple-50 transition-colors duration-200 h-16 sm:h-18 ${
                                  index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' :
                                  index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100' :
                                  index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100' : ''
                                }`}>
                                  <td className="py-4 px-2 sm:px-3">
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
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
                                      <p className="font-semibold text-gray-800 text-sm sm:text-base whitespace-nowrap truncate">
                                        {player.firstName?.charAt(0)}. {player.lastName?.toUpperCase()}
                                      </p>
                                      <p className="text-xs text-gray-500 whitespace-nowrap">Seed #{player.finalSeed || index + 1}</p>
                                    </div>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-bold text-base sm:text-lg text-green-600 whitespace-nowrap">
                                      {player.roundRobinStats.points}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-semibold text-sm sm:text-base text-gray-700 whitespace-nowrap">
                                      {player.roundRobinStats.matches}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-semibold text-sm sm:text-base text-green-600 whitespace-nowrap">
                                      {player.roundRobinStats.wins}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-semibold text-sm sm:text-base text-red-600 whitespace-nowrap">
                                      {player.roundRobinStats.losses}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-semibold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
                                      {player.roundRobinStats.setsWon}-{player.roundRobinStats.setsLost}
                                    </span>
                                  </td>
                                  <td className="py-4 px-2 sm:px-3 text-center">
                                    <span className="font-semibold text-purple-600 text-xs sm:text-sm whitespace-nowrap">
                                      {player.roundRobinStats.matches > 0 ? 
                                       Math.round((player.roundRobinStats.wins / player.roundRobinStats.matches) * 100) : 0}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      {/* Round-Robin ranking table */}
                    </div>
                  ) : (
                    /* Elimination Bracket */
                    <div className="flashscore-bracket-container">
                      <div className="flashscore-bracket">
                        {Array.from(new Set(tournamentMatches.map(m => m.round))).map(roundNum => {
                          const roundMatches = tournamentMatches.filter(m => m.round === roundNum);
                          const totalRounds = Math.max(...tournamentMatches.map(m => m.round));
                          
                          return (
                            <div key={roundNum} className="flashscore-round">
                              <div className="round-title">
                                {getRoundName(roundNum, totalRounds)}
                              </div>
                              <div className="round-matches-container">
                                {roundMatches.map((match) => (
                                  <div key={match.id} className="flashscore-match-wrapper">
                                    <div className="draw__bracket draw__bracket--odd">
                                      <div className="bracket">
                                        {/* Player 1 (Home) Row */}
                                        <div className="bracket__participantRow bracket__participantRow--home">
                                          <span className="bracket__image bracket__image--1">🎾</span>
                                          <div className="bracket__participant">
                                            <span className={`bracket__name ${match.winner === (match.player1.firstName + ' ' + match.player1.lastName) ? 'bracket__name--advancing' : ''}`}>
                                              {match.player1.isPlaceholder ? 'TBD' : 
                                               match.player1.isBye ? 'BYE' :
                                               match.player1.firstName && match.player1.lastName ? 
                                               `${match.player1.firstName.charAt(0)}. ${match.player1.lastName.toUpperCase()}` : 
                                               'Unknown Player'}
                                            </span>
                                          </div>
                                          <span className="bracket__info">
                                            {match.round === 1 && match.player1.finalSeed ? `(${match.player1.finalSeed})` : ''}
                                          </span>
                                        </div>
                                        
                                        {/* Player 1 Result */}
                                        <div className="bracket__result bracket__result--home">
                                          <div className="result-column">
                                            <div className="result-set">
                                              {match.player1SetsWon !== undefined ? match.player1SetsWon : 
                                               match.score ? match.score.split('-')[0] || '-' :
                                               match.winner === (match.player1.firstName + ' ' + match.player1.lastName) ? 'W' : 
                                               match.winner ? 'L' : '-'}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Player 2 (Away) Row */}
                                        <div className="bracket__participantRow bracket__participantRow--away">
                                          <span className="bracket__image bracket__image--1">🎾</span>
                                          <div className="bracket__participant">
                                            <span className={`bracket__name ${match.winner === (match.player2.firstName + ' ' + match.player2.lastName) ? 'bracket__name--advancing' : ''}`}>
                                              {match.player2.isPlaceholder ? 'TBD' : 
                                               match.player2.isBye ? 'BYE' :
                                               match.player2.firstName && match.player2.lastName ? 
                                               `${match.player2.firstName.charAt(0)}. ${match.player2.lastName.toUpperCase()}` : 
                                               'Unknown Player'}
                                            </span>
                                          </div>
                                          <span className="bracket__info">
                                            {match.round === 1 && match.player2.finalSeed ? `(${match.player2.finalSeed})` : ''}
                                          </span>
                                        </div>
                                        
                                        {/* Player 2 Result */}
                                        <div className="bracket__result bracket__result--away">
                                          <div className="result-column">
                                            <div className="result-set">
                                              {match.player2SetsWon !== undefined ? match.player2SetsWon : 
                                               match.score ? match.score.split('-')[1] || '-' :
                                               match.winner === (match.player2.firstName + ' ' + match.player2.lastName) ? 'W' : 
                                               match.winner ? 'L' : '-'}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Edit Pen at the End */}
                                        <button
                                          onClick={() => openScoreModal(match)}
                                          className="bracket__edit-btn"
                                          title="Edit Score"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Connector Line */}
                                    {roundNum < totalRounds && (
                                      <div className="match-connector">
                                        <div className="connector-line"></div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Ultra Professional Matches Section */}
              {tournament.type === 'round-robin' && tournamentMatches.length > 0 && (
                <div className="mt-8">
                  <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200/50 overflow-visible">
                    {/* Modern Header */}
                    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-xl sm:text-2xl font-bold text-white">🎾 Tournament Matches</h4>
                            <p className="text-blue-100 text-sm">
                              {tournamentMatches.filter(m => m.status === 'completed').length} of {tournamentMatches.length} matches completed
                            </p>
                          </div>
                        </div>
                        
                        {/* Enhanced Stats */}
                        <div className="flex items-center gap-3">
                          <div className="bg-green-500/20 backdrop-blur-sm border border-green-300/30 text-green-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            <span>✅ {tournamentMatches.filter(m => m.status === 'completed').length}</span>
                          </div>
                          <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 text-blue-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                            <span>⏳ {tournamentMatches.filter(m => m.status === 'ready').length}</span>
                          </div>
                          <div className="bg-gray-500/20 backdrop-blur-sm border border-gray-300/30 text-gray-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span>⏸️ {tournamentMatches.filter(m => m.status === 'waiting').length}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Revolutionary Filter System */}
                    <div className="p-6 bg-gradient-to-br from-gray-50/80 to-blue-50/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        
                        {/* Custom Player Dropdown */}
                        <div className="relative z-[60]">
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Filter by Player</label>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Player dropdown clicked, current state:', showPlayerDropdown);
                              setShowPlayerDropdown(!showPlayerDropdown);
                              setShowStatusDropdown(false);
                            }}
                            className="w-full bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-400 rounded-2xl px-4 py-3.5 text-left text-sm font-medium text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-200/50 transition-all duration-300 shadow-lg hover:shadow-xl group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                                <span className="truncate font-semibold">
                                  {selectedPlayer || "All Players"}
                                </span>
                              </div>
                              <svg className={`w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-all duration-300 ${showPlayerDropdown ? 'rotate-180 text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          
                          {/* Ultra Modern Player Dropdown */}
                          {showPlayerDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border-2 border-gray-200 rounded-2xl shadow-2xl z-[99999] overflow-hidden animate-in slide-in-from-top-5 duration-300">
                              <div className="p-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPlayer('');
                                    setShowPlayerDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 font-semibold text-gray-700 hover:text-blue-700 flex items-center space-x-3 group">
                                  <div className="w-3 h-3 bg-gray-300 rounded-full group-hover:bg-blue-500 transition-colors"></div>
                                  <span>All Players</span>
                                </button>
                                {Array.from(new Set(tournamentMatches.flatMap(m => [
                                  `${m.player1.firstName} ${m.player1.lastName}`,
                                  `${m.player2.firstName} ${m.player2.lastName}`
                                ]))).sort().map((player, index) => (
                                  <button
                                    key={player}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPlayer(player);
                                      setShowPlayerDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 font-medium text-gray-700 hover:text-blue-700 flex items-center space-x-3 group">
                                    <div className={`w-3 h-3 rounded-full transition-colors ${
                                      ['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-yellow-400', 'bg-pink-400'][index % 6]
                                    } group-hover:bg-blue-500`}></div>
                                    <span>{player}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Custom Status Dropdown */}
                        <div className="relative z-[50]">
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Match Status</label>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Status dropdown clicked, current state:', showStatusDropdown);
                              setShowStatusDropdown(!showStatusDropdown);
                              setShowPlayerDropdown(false);
                            }}
                            className="w-full bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-400 rounded-2xl px-4 py-3.5 text-left text-sm font-medium text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-200/50 transition-all duration-300 shadow-lg hover:shadow-xl group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {selectedStatus === 'completed' && <span className="text-lg">✅</span>}
                                {selectedStatus === 'ready' && <span className="text-lg">⏳</span>}
                                {selectedStatus === 'waiting' && <span className="text-lg">⏸️</span>}
                                {!selectedStatus && <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full"></div>}
                                <span className="truncate font-semibold">
                                  {selectedStatus === 'completed' ? 'Completed Matches' :
                                   selectedStatus === 'ready' ? 'Ready Matches' :
                                   selectedStatus === 'waiting' ? 'Waiting Matches' : 'All Statuses'}
                                </span>
                              </div>
                              <svg className={`w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-all duration-300 ${showStatusDropdown ? 'rotate-180 text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          
                          {/* Ultra Modern Status Dropdown */}
                          {showStatusDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border-2 border-gray-200 rounded-2xl shadow-2xl z-[90000] overflow-hidden animate-in slide-in-from-top-5 duration-300">
                              <div className="p-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStatus('');
                                    setShowStatusDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-200 font-semibold text-gray-700 hover:text-blue-700 flex items-center space-x-3">
                                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                  <span>All Statuses</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStatus('completed');
                                    setShowStatusDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-200 font-medium text-gray-700 hover:text-green-700 flex items-center space-x-3">
                                  <span className="text-lg">✅</span>
                                  <span>Completed Matches</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStatus('ready');
                                    setShowStatusDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all duration-200 font-medium text-gray-700 hover:text-blue-700 flex items-center space-x-3">
                                  <span className="text-lg">⏳</span>
                                  <span>Ready Matches</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStatus('waiting');
                                    setShowStatusDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 transition-all duration-200 font-medium text-gray-700 hover:text-gray-600 flex items-center space-x-3">
                                  <span className="text-lg">⏸️</span>
                                  <span>Waiting Matches</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Advanced Clear Button */}
                        <div className="flex items-end">
                          <button
                            onClick={() => {
                              setSelectedPlayer('');
                              setSelectedStatus('');
                              setShowPlayerDropdown(false);
                              setShowStatusDropdown(false);
                            }}
                            className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-6 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 group">
                            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Clear Filters</span>
                          </button>
                        </div>
                      </div>

                      {/* Filter Results Info */}
                      {(selectedPlayer || selectedStatus) && (
                        <div className="mt-4 p-3 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl">
                          <p className="text-sm text-blue-700 font-medium flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <span>Showing {filteredMatches.length} of {tournamentMatches.length} matches</span>
                            {selectedPlayer && <span className="font-semibold">• Player: {selectedPlayer}</span>}
                            {selectedStatus && <span className="font-semibold">• Status: {selectedStatus}</span>}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Revolutionary Matches Display with Scrolling */}
                    <div className="flex flex-col h-96 sm:h-[32rem]">
                      {/* Scrollable Content Area */}
                      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                        {filteredMatches.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Matches Found</h3>
                            <p className="text-gray-500">Try adjusting your filters to see more matches.</p>
                            <button
                              onClick={() => {
                                setSelectedPlayer('');
                                setSelectedStatus('');
                              }}
                              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                              Clear All Filters
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                            {filteredMatches.map((match, index) => (
                              <div 
                                key={match.id || index} 
                                onClick={() => openScoreModal(match)}
                                className={`group relative bg-gradient-to-br ${
                                  match.status === 'completed' 
                                    ? 'from-emerald-50 via-green-50 to-emerald-100 border-emerald-300 hover:from-emerald-100 hover:to-green-100' 
                                    : match.status === 'ready' 
                                    ? 'from-blue-50 via-sky-50 to-blue-100 border-blue-300 hover:from-blue-100 hover:to-sky-100' 
                                    : 'from-gray-50 via-slate-50 to-gray-100 border-gray-300 hover:from-gray-100 hover:to-slate-100'
                                } border-2 rounded-xl p-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
                                
                                {/* Compact Match Header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm ${
                                      match.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                                      match.status === 'ready' ? 'bg-gradient-to-r from-blue-500 to-sky-600' :
                                      'bg-gradient-to-r from-gray-500 to-slate-600'
                                    }`}>
                                      {match.matchNumber}
                                    </div>
                                    {match.round && (
                                      <span className="bg-white/60 text-gray-700 text-xs font-medium px-1.5 py-0.5 rounded">
                                        R{match.round}
                                      </span>
                                    )}
                                  </div>
                                  <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                    match.status === 'completed' ? 'bg-emerald-500 text-white' :
                                    match.status === 'ready' ? 'bg-blue-500 text-white' :
                                    'bg-gray-500 text-white'
                                  }`}>
                                    {match.status === 'completed' ? '✓' :
                                     match.status === 'ready' ? '⏳' : '⏸'}
                                  </div>
                                </div>

                                {/* Compact Players Section */}
                                <div className="space-y-1.5">
                                  {/* Player 1 */}
                                  <div className={`rounded-lg p-2 transition-all duration-300 ${
                                    match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md ring-2 ring-yellow-300/50' 
                                      : 'bg-white/70 backdrop-blur-sm text-gray-800'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                          match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                                            ? 'bg-white/30 text-white' 
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {match.player1.finalSeed || '?'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-xs truncate">
                                            {match.player1.firstName?.charAt(0)}. {match.player1.lastName?.toUpperCase()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className={`text-lg font-black ${
                                        match.winner === `${match.player1.firstName} ${match.player1.lastName}` 
                                          ? 'text-white drop-shadow-sm' 
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
                                      : 'bg-white/70 backdrop-blur-sm text-gray-800'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                          match.winner === `${match.player2.firstName} ${match.player2.lastName}` 
                                            ? 'bg-white/30 text-white' 
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {match.player2.finalSeed || '?'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-xs truncate">
                                            {match.player2.firstName?.charAt(0)}. {match.player2.lastName?.toUpperCase()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className={`text-lg font-black ${
                                        match.winner === `${match.player2.firstName} ${match.player2.lastName}` 
                                          ? 'text-white drop-shadow-sm' 
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
                                      <Edit3 className="w-2.5 h-2.5" />
                                      <span>{match.status === 'completed' ? 'Edit' : 'Enter'}</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Hover Effect Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Score Editing Modal */}
        {editingMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">📝</span>
                    <div>
                      <h3 className="text-lg font-bold">Edit Match Score</h3>
                      <p className="text-sm opacity-90">Match #{editingMatch.matchNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMatch(null);
                      setEditScores({
                        set1: { player1: '', player2: '' },
                        set2: { player1: '', player2: '' },
                        set3: { player1: '', player2: '' }
                      });
                    }}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Players Info */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {editingMatch.player1.firstName} {editingMatch.player1.lastName}
                    </div>
                    {editingMatch.round === 1 && editingMatch.player1.finalSeed && (
                      <div className="text-xs text-gray-500">Seed: {editingMatch.player1.finalSeed}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-400">VS</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {editingMatch.player2.firstName} {editingMatch.player2.lastName}
                    </div>
                    {editingMatch.round === 1 && editingMatch.player2.finalSeed && (
                      <div className="text-xs text-gray-500">Seed: {editingMatch.player2.finalSeed}</div>
                    )}
                  </div>
                </div>

                {/* Sets Score Input */}
                <div className="space-y-4">
                  {['set1', 'set2', 'set3'].map((setKey, index) => (
                    <div key={setKey} className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Set {index + 1}
                      </label>
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={editScores[setKey as keyof typeof editScores].player1}
                          onChange={(e) => setEditScores(prev => ({
                            ...prev,
                            [setKey]: {
                              ...prev[setKey as keyof typeof prev],
                              player1: e.target.value
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="0"
                        />
                        <div className="text-center font-bold text-gray-400">-</div>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={editScores[setKey as keyof typeof editScores].player2}
                          onChange={(e) => setEditScores(prev => ({
                            ...prev,
                            [setKey]: {
                              ...prev[setKey as keyof typeof prev],
                              player2: e.target.value
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setEditingMatch(null);
                      setEditScores({
                        set1: { player1: '', player2: '' },
                        set2: { player1: '', player2: '' },
                        set3: { player1: '', player2: '' }
                      });
                    }}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveMatchScore}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Score</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Tournament Modal - Mobile Optimized */}
        {showCreateModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateModal(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-lg w-full mx-2 sm:mx-4 overflow-hidden transform transition-all duration-300 scale-100 animate-in slide-in-from-bottom-4 fade-in">
              {/* Modal Header - Compact */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 px-4 sm:px-6 py-4 sm:py-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-yellow-300/20 rounded-full -mr-10 sm:-mr-16 -mt-10 sm:-mt-16"></div>
                <div className="absolute bottom-0 left-0 w-16 sm:w-20 h-16 sm:h-20 bg-white/10 rounded-full -ml-8 sm:-ml-10 -mb-8 sm:-mb-10"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center">
                      <span className="text-lg sm:text-2xl">🏆</span>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-2xl font-bold">Create Tournament</h3>
                      <p className="text-green-100 text-xs sm:text-sm">Set up your championship</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body - Mobile Optimized */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Tournament Name */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="flex items-center text-sm font-bold text-gray-800">
                    <span className="text-base sm:text-lg mr-2">🎾</span>
                    Tournament Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tournamentName}
                      onChange={(e) => setTournamentName(e.target.value)}
                      placeholder="e.g., Spring Championship 2025"
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition-all duration-200 text-base sm:text-lg font-medium placeholder-gray-400"
                      maxLength={50}
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-xs sm:text-sm text-gray-400">
                      {tournamentName.length}/50
                    </div>
                  </div>
                </div>

                {/* Tournament Type Selection - Mobile Optimized */}
                <div className="space-y-3 sm:space-y-4">
                  <label className="flex items-center text-sm font-bold text-gray-800">
                    <span className="text-base sm:text-lg mr-2">⚔️</span>
                    Tournament Format
                  </label>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {/* Elimination Type */}
                    <div 
                      className={`group relative p-4 sm:p-6 border-2 sm:border-3 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 ${
                        tournamentType === 'elimination' 
                          ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-lg transform scale-[1.02]' 
                          : 'border-gray-200 hover:border-green-300 hover:shadow-md hover:bg-gray-50'
                      }`}
                      onClick={() => setTournamentType('elimination')}
                    >
                      <div className="text-center">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          tournamentType === 'elimination' 
                            ? 'bg-green-500 text-white shadow-lg' 
                            : 'bg-gray-100 text-gray-600 group-hover:bg-green-100'
                        }`}>
                          <span className="text-xl sm:text-2xl">🎯</span>
                        </div>
                        <div className={`font-bold text-base sm:text-lg mb-1 ${
                          tournamentType === 'elimination' ? 'text-green-800' : 'text-gray-900'
                        }`}>
                          Elimination
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                          Knockout style<br className="hidden sm:block"/>
                          <span className="sm:hidden">Knockout - </span>Win or go home!
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {tournamentType === 'elimination' && (
                        <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Round Robin Type */}
                    <div 
                      className={`group relative p-4 sm:p-6 border-2 sm:border-3 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 ${
                        tournamentType === 'round-robin' 
                          ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg transform scale-[1.02]' 
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-md hover:bg-gray-50'
                      }`}
                      onClick={() => setTournamentType('round-robin')}
                    >
                      <div className="text-center">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          tournamentType === 'round-robin' 
                            ? 'bg-purple-500 text-white shadow-lg' 
                            : 'bg-gray-100 text-gray-600 group-hover:bg-purple-100'
                        }`}>
                          <span className="text-xl sm:text-2xl">🔄</span>
                        </div>
                        <div className={`font-bold text-base sm:text-lg mb-1 ${
                          tournamentType === 'round-robin' ? 'text-purple-800' : 'text-gray-900'
                        }`}>
                          Round Robin
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                          Everyone plays<br className="hidden sm:block"/>
                          <span className="sm:hidden">All vs all - </span>everyone else
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {tournamentType === 'round-robin' && (
                        <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Format Description - Mobile Optimized */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-200">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs sm:text-sm text-blue-800">
                      {tournamentType === 'elimination' ? (
                        <p><strong>Elimination:</strong> Players compete in knockout matches. <span className="hidden sm:inline">Lose once and you're out! Perfect for creating exciting, high-stakes matches with clear winners advancing through rounds.</span></p>
                      ) : (
                        <p><strong>Round Robin:</strong> Every player plays against every other player. <span className="hidden sm:inline">The player with the most wins is crowned champion! Great for ensuring everyone gets multiple games.</span></p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Mobile Optimized */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="flex gap-3 sm:gap-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 sm:px-5 py-3 sm:py-3 border-2 border-gray-200 text-gray-700 rounded-xl sm:rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTournament}
                    disabled={!tournamentName.trim() || isCreating}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 sm:px-5 py-3 sm:py-3 rounded-xl sm:rounded-2xl hover:from-green-700 hover:to-green-800 transition-all duration-200 font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95"
                  >
                    {isCreating ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent mr-2"></div>
                        <span className="hidden sm:inline">Creating...</span>
                        <span className="sm:hidden">...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-lg mr-1 sm:mr-2">🚀</span>
                        <span className="hidden sm:inline">Create Tournament</span>
                        <span className="sm:hidden">Create</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Start Tournament Confirmation Modal - Mobile Optimized */}
        {showStartTournamentModal && tournament && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-lg"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowStartTournamentModal(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xs sm:max-w-lg w-full mx-1 sm:mx-4 overflow-hidden transform transition-all duration-500 scale-100 animate-in slide-in-from-bottom-6 fade-in max-h-[90vh] overflow-y-auto">
              {/* Compact Animated Header */}
              <div className="bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 px-3 sm:px-6 py-3 sm:py-6 text-white relative overflow-hidden">
                {/* Background Animation Elements - Smaller on Mobile */}
                <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-yellow-300/20 rounded-full -mr-10 sm:-mr-16 -mt-10 sm:-mt-16 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-12 sm:w-20 h-12 sm:h-20 bg-white/10 rounded-full -ml-6 sm:-ml-10 -mb-6 sm:-mb-10 animate-bounce" style={{animationDelay: '0.5s'}}></div>
                
                <div className="relative z-10 text-center">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4 animate-bounce">
                    <span className="text-2xl sm:text-4xl animate-pulse">🚀</span>
                  </div>
                  <h3 className="text-lg sm:text-3xl font-black mb-1 sm:mb-2">Ready to Start?</h3>
                  <p className="text-green-100 text-xs sm:text-base font-medium opacity-90">Let the competition begin!</p>
                </div>
              </div>

              {/* Tournament Preview Card - Mobile Compact */}
              <div className="p-3 sm:p-6">
                <div className="bg-gradient-to-r from-blue-50 via-green-50 to-yellow-50 p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-green-200/50 mb-3 sm:mb-6 relative overflow-hidden">
                  {/* Smaller Decorative Elements */}
                  <div className="absolute top-1 right-1 w-4 sm:w-8 h-4 sm:h-8 bg-green-200/30 rounded-full animate-pulse"></div>
                  
                  <div className="relative z-10 text-center space-y-2 sm:space-y-4">
                    {/* Tournament Icon & Name - Compact */}
                    <div>
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                        <span className="text-lg sm:text-2xl">🏆</span>
                      </div>
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2 leading-tight">{tournament.name}</h4>
                    </div>

                    {/* Tournament Details Grid - Compact */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="bg-white/70 backdrop-blur-sm p-2 sm:p-3 rounded-lg sm:rounded-xl border border-green-200/50 shadow-sm">
                        <div className="text-center">
                          <div className="text-base sm:text-xl font-bold text-green-600">{tournament.playersCount}</div>
                          <div className="text-xs text-gray-600 font-medium">👥 Players</div>
                        </div>
                      </div>
                      <div className="bg-white/70 backdrop-blur-sm p-2 sm:p-3 rounded-lg sm:rounded-xl border border-purple-200/50 shadow-sm">
                        <div className="text-center">
                          <div className="text-base sm:text-xl font-bold text-purple-600 capitalize">{tournament.type}</div>
                          <div className="text-xs text-gray-600 font-medium">⚔️ Format</div>
                        </div>
                      </div>
                    </div>

                    {/* Status Transition - Mobile Responsive */}
                    <div className="bg-white/60 p-2 sm:p-4 rounded-lg sm:rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between text-xs sm:text-base">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full"></span>
                          <span className="font-semibold text-blue-700 text-xs sm:text-sm">Registration</span>
                        </div>
                        <div className="flex items-center space-x-0.5 sm:space-x-1">
                          <div className="w-2 sm:w-4 h-0.5 bg-gray-300 rounded"></div>
                          <div className="w-2 sm:w-4 h-0.5 bg-gray-300 rounded animate-pulse"></div>
                          <div className="w-2 sm:w-4 h-0.5 bg-gray-300 rounded"></div>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse"></span>
                          <span className="font-bold text-green-700 text-xs sm:text-sm">Playing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Information - Compact */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-3 sm:mb-6">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs sm:text-base">
                      <p className="font-bold text-amber-800 mb-1 sm:mb-2">⚡ What happens next?</p>
                      <ul className="text-amber-700 space-y-0.5 sm:space-y-1 text-xs">
                        <li className="flex items-start space-x-1 sm:space-x-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>Registration <strong>closes immediately</strong></span>
                        </li>
                        <li className="flex items-start space-x-1 sm:space-x-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>Matches <strong>generated automatically</strong></span>
                        </li>
                        <li className="flex items-start space-x-1 sm:space-x-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>Status → <strong>"Playing Phase"</strong></span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Mobile Optimized */}
                <div className="flex gap-2 sm:gap-4">
                  <button
                    onClick={() => setShowStartTournamentModal(false)}
                    className="flex-1 px-3 py-2.5 sm:px-5 sm:py-4 border border-gray-200 text-gray-700 rounded-lg sm:rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold text-xs sm:text-base group"
                  >
                    <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel</span>
                    </div>
                  </button>
                  <button
                    onClick={handleStartTournament}
                    disabled={isStartingTournament}
                    className="flex-1 bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 text-white px-3 py-2.5 sm:px-5 sm:py-4 rounded-lg sm:rounded-2xl hover:from-green-700 hover:via-green-800 hover:to-emerald-800 transition-all duration-300 font-bold text-xs sm:text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 group relative overflow-hidden"
                  >
                    {/* Button Background Animation */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    
                    <div className="relative z-10 flex items-center justify-center">
                      {isStartingTournament ? (
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <div className="animate-spin rounded-full h-3 w-3 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
                          <span className="hidden sm:inline">Starting Tournament...</span>
                          <span className="sm:hidden">Starting...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="text-sm sm:text-xl animate-bounce">🚀</span>
                          <span className="hidden sm:inline">Yes, Start Tournament!</span>
                          <span className="sm:hidden">Start Now!</span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal - Emotional & Impressive */}
        {showLogoutModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowLogoutModal(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xs sm:max-w-md w-full mx-1 sm:mx-4 overflow-hidden transform transition-all duration-700 scale-100 animate-in slide-in-from-top-8 fade-in">
              {/* Emotional Header with Sunset Gradient */}
              <div className="bg-gradient-to-br from-orange-400 via-red-500 to-purple-600 px-3 sm:px-6 py-4 sm:py-6 text-white relative overflow-hidden">
                {/* Floating Goodbye Elements */}
                <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-yellow-300/20 rounded-full -mr-10 sm:-mr-16 -mt-10 sm:-mt-16 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-16 sm:w-24 h-16 sm:h-24 bg-pink-300/20 rounded-full -ml-8 sm:-ml-12 -mb-8 sm:-mb-12 animate-bounce" style={{animationDelay: '0.3s'}}></div>
                <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-yellow-400/60 rounded-full animate-ping" style={{animationDelay: '1.2s'}}></div>
                <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-pink-400/60 rounded-full animate-pulse" style={{animationDelay: '0.8s'}}></div>
                
                <div className="relative z-10 text-center">
                  <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-pulse">
                    <span className="text-2xl sm:text-3xl">👋</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-1 sm:mb-2">Goodbye, Admin! 🌅</h3>
                  <p className="text-orange-100 text-xs sm:text-sm font-medium opacity-90">See you soon, champion!</p>
                </div>
              </div>

              {/* Farewell Content */}
              <div className="p-3 sm:p-6">
                {/* Admin Summary Card */}
                <div className="bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-orange-200/50 mb-3 sm:mb-5 relative overflow-hidden">
                  <div className="absolute top-1 right-1 w-4 sm:w-6 h-4 sm:h-6 bg-orange-200/40 rounded-full animate-pulse"></div>
                  
                  <div className="relative z-10 text-center space-y-2 sm:space-y-3">
                    {/* Admin Avatar */}
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <span className="text-lg sm:text-2xl font-bold text-white">
                        {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-sm sm:text-lg font-bold text-gray-900">
                        {userData?.firstName} {userData?.lastName}
                      </h4>
                      <p className="text-xs sm:text-sm text-orange-600 font-semibold">Tournament Administrator</p>
                    </div>

                    {/* Session Summary */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
                      <div className="bg-white/60 backdrop-blur-sm p-2 rounded-lg border border-orange-200/50">
                        <div className="text-center">
                          <div className="text-sm sm:text-base font-bold text-orange-600">{tournament ? '1' : '0'}</div>
                          <div className="text-xs text-gray-600">🏆 Tournament</div>
                        </div>
                      </div>
                      <div className="bg-white/60 backdrop-blur-sm p-2 rounded-lg border border-red-200/50">
                        <div className="text-center">
                          <div className="text-sm sm:text-base font-bold text-red-600">{tournament?.playersCount || 0}</div>
                          <div className="text-xs text-gray-600">👥 Players</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emotional Message */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-3 sm:mb-5">
                  <div className="text-center space-y-1 sm:space-y-2">
                    <div className="flex justify-center space-x-1 mb-2">
                      <span className="text-lg sm:text-2xl animate-bounce">✨</span>
                      <span className="text-lg sm:text-2xl animate-bounce" style={{animationDelay: '0.2s'}}>💜</span>
                      <span className="text-lg sm:text-2xl animate-bounce" style={{animationDelay: '0.4s'}}>✨</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-purple-800 mb-1 sm:mb-2">
                      Thank you for managing TNTour!
                    </p>
                    <p className="text-xs text-purple-600 leading-relaxed">
                      Your leadership made the tournaments amazing. 
                      <span className="hidden sm:inline">We'll miss your administrative magic! </span>
                      Come back soon! 🎆
                    </p>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 p-2 sm:p-3 rounded-lg sm:rounded-xl mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="text-xs sm:text-sm text-blue-800">
                      <p className="font-semibold mb-0.5">🔒 Secure Logout</p>
                      <p className="text-xs text-blue-600">Your session will be safely terminated</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons with Emotional Touch */}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200 text-gray-700 rounded-lg sm:rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold text-xs sm:text-sm group"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm sm:text-base group-hover:animate-bounce">😊</span>
                      <span>Stay Here</span>
                    </div>
                  </button>
                  <button
                    onClick={handleLogoutConfirm}
                    disabled={isLoggingOut}
                    className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl hover:from-orange-600 hover:via-red-600 hover:to-pink-600 transition-all duration-300 font-bold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 group relative overflow-hidden"
                  >
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    
                    <div className="relative z-10 flex items-center justify-center">
                      {isLoggingOut ? (
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent"></div>
                          <span className="hidden sm:inline">Saying Goodbye...</span>
                          <span className="sm:hidden">Goodbye...</span>
                          <span className="animate-pulse">👋</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <span className="text-sm sm:text-base animate-pulse">🌅</span>
                          <span className="hidden sm:inline">Yes, Logout</span>
                          <span className="sm:hidden">Logout</span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Tournament Confirmation Modal - Mobile Responsive */}
        {showDeleteModal && tournament && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDeleteModal(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-md w-full mx-2 sm:mx-4 overflow-hidden transform transition-all duration-300 scale-100 animate-in slide-in-from-bottom-4 fade-in">
              {/* Modal Header - Compact */}
              <div className="bg-gradient-to-br from-red-500 to-red-600 px-4 sm:px-6 py-4 sm:py-5 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-red-300/20 rounded-full -mr-10 sm:-mr-16 -mt-10 sm:-mt-16"></div>
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <span className="text-lg sm:text-xl">⚠️</span>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold">Delete Tournament</h3>
                      <p className="text-red-100 text-xs sm:text-sm">Cannot be undone</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body - Compact */}
              <div className="p-4 sm:p-6">
                <div className="text-center mb-4 sm:mb-5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl sm:text-3xl">🏆</span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    Delete "{tournament.name}"?
                  </h4>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    This will permanently delete the tournament and all player registrations.
                  </p>
                </div>

                {/* Tournament Info - Compact */}
                <div className="bg-gray-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-4 sm:mb-5">
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-500">Tournament:</span>
                      <p className="font-semibold text-gray-900 truncate">{tournament.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <p className="font-semibold text-gray-900 capitalize">{tournament.type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Players:</span>
                      <p className="font-semibold text-gray-900">{tournament.playersCount}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className="font-semibold text-gray-900 capitalize">{tournament.phase}</p>
                    </div>
                  </div>
                </div>

                {/* Warning Box - Compact */}
                <div className="bg-red-50 border-2 border-red-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-4 sm:mb-5">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-xs sm:text-sm text-red-800">
                      <p className="font-semibold mb-1">⚠️ Warning</p>
                      <p>This action is permanent and cannot be recovered.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer - Horizontal Buttons */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-3 sm:px-5 sm:py-3 border-2 border-gray-200 text-gray-700 rounded-xl sm:rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteTournament}
                    disabled={isDeleting}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95"
                  >
                    {isDeleting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent mr-2"></div>
                        <span className="hidden sm:inline">Deleting...</span>
                        <span className="sm:hidden">...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-lg mr-1 sm:mr-2">🗑️</span>
                        <span className="hidden sm:inline">Delete</span>
                        <span className="sm:hidden">Delete</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simple Score Modal */}
        {showScoreModal && editingMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl">
                <h2 className="text-xl font-bold">🎾 Match Result</h2>
                <p className="text-blue-100 text-sm mt-1">Enter final set wins</p>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Player 1 */}
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">
                      {editingMatch.player1.firstName} {editingMatch.player1.lastName}
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

                {/* Detailed Score */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📝 Detailed Score (e.g., "6-4, 6-3, 7-5")
                  </label>
                  <input
                    type="text"
                    placeholder="6-4, 6-3, 7-5"
                    value={scoreForm.detailedScore}
                    onChange={(e) => setScoreForm({
                      ...scoreForm,
                      detailedScore: e.target.value
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 pb-6">
                <div className="flex gap-3">
                  <button
                    onClick={closeScoreModal}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSimpleScore}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95"
                  >
                    💾 Save Score
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