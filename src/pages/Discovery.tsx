import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { DEPARTMENTS, LEVELS } from '../constants';
import { cn } from '../lib/utils';
import { Heart, X, Filter, GraduationCap, Search, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface DiscoveryProps {
  user: User;
  profile: UserProfile;
}

const skippedKey = (uid: string) => `futaconnect_skipped_${uid}`;

function getSkipped(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(skippedKey(uid));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveSkipped(uid: string, skipped: Set<string>) {
  try {
    localStorage.setItem(skippedKey(uid), JSON.stringify([...skipped]));
  } catch {
    // localStorage unavailable — skip persistence silently
  }
}

export default function Discovery({ user, profile }: DiscoveryProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    department: '',
    level: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [matchModal, setMatchModal] = useState<{ profile: UserProfile; matchId: string } | null>(null);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch UIDs of profiles the current user already liked
      const { data: likedData } = await supabase
        .from('likes')
        .select('to_uid')
        .eq('from_uid', user.id);

      const likedUids = new Set((likedData ?? []).map((l: { to_uid: string }) => l.to_uid));
      const skippedUids = getSkipped(user.id);
      const excludeUids = new Set([...likedUids, ...skippedUids, user.id]);

      let query = supabase
        .from('profiles')
        .select('*')
        .neq('uid', user.id)
        .limit(50);

      if (filters.department) {
        query = query.eq('department', filters.department);
      }
      if (filters.level) {
        query = query.eq('level', filters.level);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out already-seen profiles
      const fetchedStudents = (data as UserProfile[]).filter(s => !excludeUids.has(s.uid));

      if (!filters.department && !filters.level) {
        try {
          const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userProfile: profile, allStudents: fetchedStudents }),
          });
          if (response.ok) {
            setStudents(await response.json());
          } else {
            setStudents(fetchedStudents.sort(() => Math.random() - 0.5));
          }
        } catch (apiErr) {
          console.error('API Error:', apiErr);
          setStudents(fetchedStudents.sort(() => Math.random() - 0.5));
        }
      } else {
        setStudents(fetchedStudents.sort(() => Math.random() - 0.5));
      }

      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.id, filters, profile]);

  const handleLike = async (targetUser: UserProfile) => {
    try {
      const { error: likeError } = await supabase
        .from('likes')
        .insert([{
          from_uid: user.id,
          to_uid: targetUser.uid,
          created_at: new Date().toISOString(),
        }]);

      if (likeError) throw likeError;

      // Enforce mutual-like check server-side via a SECURITY DEFINER function
      // This prevents bypassing the validation through direct client-side inserts.
      const { data: matchId, error: matchError } = await supabase
        .rpc('create_match_if_mutual', { other_uid: targetUser.uid });

      if (matchError) {
        console.error('Match RPC error:', matchError);
      } else if (matchId) {
        setMatchModal({ profile: targetUser, matchId: matchId as string });
      }

      nextStudent();
    } catch (err) {
      console.error(err);
      nextStudent();
    }
  };

  const handleSkip = (targetUser: UserProfile) => {
    const skipped = getSkipped(user.id);
    skipped.add(targetUser.uid);
    saveSkipped(user.id, skipped);
    nextStudent();
  };

  const nextStudent = () => {
    setCurrentIndex((prev: number) => prev + 1);
  };

  const currentStudent = students[currentIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header & Filters */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Discover</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "p-2 rounded-lg transition-all",
            showFilters ? "bg-orange-600 text-white" : "bg-white text-slate-600 border border-slate-200"
          )}
        >
          <Filter size={20} />
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
              >
                <option value="">All Levels</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discovery Card */}
      <div className="relative h-[600px] w-full">
        <AnimatePresence mode="wait">
          {currentStudent ? (
            <motion.div
              key={currentStudent.uid}
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -20 }}
              className="absolute inset-0 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="relative h-2/3">
                <img
                  src={currentStudent.profile_picture}
                  alt={currentStudent.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 text-white">
                  <h3 className="text-3xl font-bold">{currentStudent.name}</h3>
                  <div className="flex items-center gap-2 text-sm opacity-90 mt-1">
                    <GraduationCap size={16} />
                    <span>{currentStudent.department} • {currentStudent.level}L</span>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-slate-600 line-clamp-2 mb-4 italic">"{currentStudent.bio || 'No bio yet.'}"</p>
                  <div className="flex flex-wrap gap-2">
                    {currentStudent.interests.slice(0, 4).map(i => (
                      <span key={i} className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-md uppercase tracking-wider">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-6 mt-4">
                  <button
                    onClick={() => handleSkip(currentStudent)}
                    className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-slate-600 transition-all shadow-lg"
                  >
                    <X size={32} />
                  </button>
                  <button
                    onClick={() => handleLike(currentStudent)}
                    className="w-16 h-16 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                  >
                    <Heart size={32} fill="currentColor" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <Search size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No more students found</h3>
              <p className="text-slate-500 mt-2">Try adjusting your filters to find more campus connections.</p>
              <button
                onClick={() => {
                  setFilters({ department: '', level: '' });
                  fetchStudents();
                }}
                className="mt-6 text-orange-600 font-bold"
              >
                Reset Filters
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Match Modal */}
      <AnimatePresence>
        {matchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center"
            >
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <img src={profile.profile_picture} className="w-24 h-24 rounded-full border-4 border-white shadow-lg" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-md">
                    <Heart size={24} className="text-orange-600" fill="currentColor" />
                  </div>
                </div>
                <img src={matchModal.profile.profile_picture} className="w-24 h-24 rounded-full border-4 border-white shadow-lg -ml-4" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2 italic">It's a Match!</h2>
              <p className="text-slate-600 mb-8">You and {matchModal.profile.name} have expressed interest in each other.</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const id = matchModal.matchId;
                    setMatchModal(null);
                    navigate(`/chat/${id}`);
                  }}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} />
                  Send Message
                </button>
                <button
                  onClick={() => setMatchModal(null)}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Keep Discovering
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
