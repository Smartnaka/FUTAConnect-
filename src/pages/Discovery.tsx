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

export default function Discovery({ user, profile }: DiscoveryProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [likedUids, setLikedUids] = useState<Set<string>>(new Set());
  const [dismissedUids, setDismissedUids] = useState<Set<string>>(new Set());
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
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('uid', user.id)
        .limit(100);

      if (filters.department) {
        query = query.eq('department', filters.department);
      }
      if (filters.level) {
        query = query.eq('level', filters.level);
      }

      const { data, error } = await query;
      if (error) throw error;

      const fetchedStudents = (data as UserProfile[]) || [];
      setStudents(fetchedStudents.sort(() => Math.random() - 0.5));
      setDismissedUids(new Set());

      const { data: likesData } = await supabase
        .from('likes')
        .select('to_uid')
        .eq('from_uid', user.id);
      setLikedUids(new Set((likesData ?? []).map((l: { to_uid: string }) => l.to_uid)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.id, filters]);

  const handleLike = async (targetUser: UserProfile) => {
    if (likedUids.has(targetUser.uid)) return;

    try {
      const { error: likeError } = await supabase
        .from('likes')
        .insert([{
          from_uid: user.id,
          to_uid: targetUser.uid,
          created_at: new Date().toISOString(),
        }]);

      if (likeError) throw likeError;
      setLikedUids((prev) => new Set([...prev, targetUser.uid]));

      const { data: matchId, error: matchError } = await supabase
        .rpc('create_match_if_mutual', { other_uid: targetUser.uid });

      if (matchError) {
        console.error('Match RPC error:', matchError);
      } else if (matchId) {
        setMatchModal({ profile: targetUser, matchId: matchId as string });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismiss = (targetUser: UserProfile) => {
    setDismissedUids((prev) => new Set([...prev, targetUser.uid]));
  };

  const visibleStudents = students.filter((student) => !dismissedUids.has(student.uid));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header & Filters */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Discover</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-lg transition-all',
            showFilters ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
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

      {visibleStudents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
            <Search size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No students found</h3>
          <p className="text-slate-500 mt-2">Try resetting filters or refreshing people.</p>
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
      ) : (
        <div className="space-y-4">
          {visibleStudents.map((student) => {
            const liked = likedUids.has(student.uid);
            return (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
              >
                <img
                  src={student.profile_picture}
                  alt={student.name}
                  className="w-full h-64 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="p-5">
                  <h3 className="text-xl font-bold text-slate-900">{student.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                    <GraduationCap size={14} /> {student.department} • {student.level}L
                  </p>
                  <p className="text-slate-600 text-sm mt-3 italic">"{student.bio || 'No bio yet.'}"</p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {student.interests.slice(0, 5).map((i) => (
                      <span key={i} className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-md uppercase tracking-wider">
                        {i}
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => handleDismiss(student)}
                      className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 inline-flex items-center gap-2"
                    >
                      <X size={16} /> Hide
                    </button>
                    <button
                      onClick={() => handleLike(student)}
                      disabled={liked}
                      className={cn(
                        'px-4 py-2 rounded-full font-bold transition-all inline-flex items-center gap-2',
                        liked ? 'bg-orange-100 text-orange-600 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'
                      )}
                    >
                      <Heart size={16} fill="currentColor" /> {liked ? 'Liked' : 'Interested'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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

              <h2 className="text-3xl font-black text-slate-900 mb-2">It's a Match!</h2>
              <p className="text-slate-500 mb-8">You and {matchModal.profile.name} liked each other.</p>

              <button
                onClick={() => {
                  const id = matchModal.matchId;
                  setMatchModal(null);
                  navigate(`/chat/${id}`);
                }}
                className="w-full py-3 bg-orange-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-all"
              >
                <MessageCircle size={20} /> Say Hello
              </button>

              <button
                onClick={() => setMatchModal(null)}
                className="mt-4 text-sm text-slate-400 hover:text-slate-600"
              >
                Keep Browsing
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
