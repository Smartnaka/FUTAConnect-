import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { DEPARTMENTS, LEVELS } from '../constants';
import { cn } from '../lib/utils';
import { Heart, X, Filter, GraduationCap, Search, MessageCircle, LayoutGrid, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface DiscoveryProps {
  user: User;
  profile: UserProfile;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const skippedKey = (uid: string) => `futaconnect_skipped_${uid}`;

function getSkipped(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(skippedKey(uid));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveSkipped(uid: string, skipped: Set<string>) {
  try {
    // Cap at 500 so localStorage doesn't grow forever
    const arr = [...skipped].slice(-500);
    localStorage.setItem(skippedKey(uid), JSON.stringify(arr));
  } catch { /* ignore */ }
}

export default function Discovery({ user, profile }: DiscoveryProps) {
  const navigate = useNavigate();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'feed' | 'swipe'>('feed');
  const [likedUids, setLikedUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department: '', level: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [matchModal, setMatchModal] = useState<{ profile: UserProfile; matchId: string } | null>(null);
  const [recyclingFeed, setRecyclingFeed] = useState(false);

  useEffect(() => { fetchStudents(); }, [filters]); // eslint-disable-line

  const fetchStudents = useCallback(async (includeSeen = false) => {
    setLoading(true);
    try {
      // Pull likes already sent so we can pre-mark and exclude
      const { data: likedData } = await supabase
        .from('likes').select('to_uid').eq('from_uid', user.id);

      const alreadyLiked = new Set((likedData ?? []).map((l: { to_uid: string }) => l.to_uid));
      setLikedUids(alreadyLiked);

      const skipped = getSkipped(user.id);
      const exclude = includeSeen
        ? new Set([user.id])
        : new Set([user.id, ...alreadyLiked, ...skipped]);

      let query = supabase.from('profiles').select('*').neq('uid', user.id).limit(100);
      if (filters.department) query = query.eq('department', filters.department);
      if (filters.level) query = query.eq('level', filters.level);

      const { data, error } = await query;
      if (error) throw error;

      let pool = ((data as UserProfile[]) || []).filter(s => !exclude.has(s.uid));

      // Try recommendations API, fall back to random shuffle
      if (!filters.department && !filters.level && pool.length > 0) {
        try {
          const res = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userProfile: profile, allStudents: pool }),
          });
          if (res.ok) pool = await res.json();
          else pool = pool.sort(() => Math.random() - 0.5);
        } catch { pool = pool.sort(() => Math.random() - 0.5); }
      } else {
        pool = pool.sort(() => Math.random() - 0.5);
      }

      setStudents(pool);
      setCurrentIndex(0);
      setRecyclingFeed(includeSeen);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.id, filters, profile]);

  // Auto-recycle swipe deck when exhausted
  useEffect(() => {
    if (!loading && students.length > 0 && currentIndex >= students.length) {
      fetchStudents(true);
    }
  }, [currentIndex, students.length, loading, fetchStudents]);

  const handleLike = async (targetUser: UserProfile) => {
    if (likedUids.has(targetUser.uid)) {
      if (viewMode === 'swipe') setCurrentIndex(i => i + 1);
      return;
    }
    // Optimistic — mark instantly so double-taps are ignored
    setLikedUids(prev => new Set([...prev, targetUser.uid]));

    try {
      const { error: likeError } = await supabase.from('likes').insert([{
        from_uid: user.id, to_uid: targetUser.uid, created_at: new Date().toISOString(),
      }]);
      if (likeError) throw likeError;

      const { data: matchId, error: matchError } = await supabase
        .rpc('create_match_if_mutual', { other_uid: targetUser.uid });
      if (!matchError && matchId) {
        setMatchModal({ profile: targetUser, matchId: matchId as string });
      }
    } catch (err) {
      console.error(err);
      setLikedUids(prev => { const n = new Set(prev); n.delete(targetUser.uid); return n; });
    }

    if (viewMode === 'swipe') setCurrentIndex(i => i + 1);
  };

  const handleSkip = (targetUser: UserProfile) => {
    const skipped = getSkipped(user.id);
    skipped.add(targetUser.uid);
    saveSkipped(user.id, skipped);
    if (viewMode === 'swipe') {
      setCurrentIndex(i => i + 1);
    } else {
      setStudents(prev => prev.filter(s => s.uid !== targetUser.uid));
    }
  };

  const currentStudent = students[currentIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Discover</h2>
          {recyclingFeed && (
            <p className="text-[11px] text-slate-400 mt-0.5">Showing all profiles — you've seen everyone fresh</p>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn('p-2 rounded-lg transition-all', showFilters ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}
        >
          <Filter size={20} />
        </button>
      </div>

      {/* ── View mode toggle ── */}
      <div className="mb-4 inline-flex rounded-full border border-slate-200 bg-white p-1 gap-0.5">
        {(['feed', 'swipe'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-full transition-all flex items-center gap-1.5 capitalize',
              viewMode === mode ? 'bg-orange-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            {mode === 'feed' ? <LayoutGrid size={13} /> : <Layers size={13} />}
            {mode}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={e => setFilters({ ...filters, department: e.target.value })}
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
                onChange={e => setFilters({ ...filters, level: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
              >
                <option value="">All Levels</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ FEED VIEW — compact 2-column grid ══ */}
      {viewMode === 'feed' ? (
        students.length === 0 ? (
          <EmptyState onRefresh={() => { setFilters({ department: '', level: '' }); fetchStudents(true); }} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {students.map(student => {
              const liked = likedUids.has(student.uid);
              return (
                <div
                  key={student.uid}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                >
                  {/* Square-ish photo so faces are fully visible */}
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    <img
                      src={student.profile_picture}
                      alt={student.name}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="font-bold text-slate-900 text-sm leading-tight truncate">{student.name}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{student.department}</p>
                    <p className="text-[11px] text-slate-400">{student.level}L</p>

                    {/* Up to 2 interest chips */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {student.interests.slice(0, 2).map(i => (
                        <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded uppercase tracking-wide">
                          {i}
                        </span>
                      ))}
                      {student.interests.length > 2 && (
                        <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[10px] rounded">
                          +{student.interests.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 mt-2.5">
                      <button
                        onClick={() => handleSkip(student)}
                        className="flex-1 py-1.5 rounded-full border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-all"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => handleLike(student)}
                        disabled={liked}
                        className={cn(
                          'flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1',
                          liked
                            ? 'bg-orange-100 text-orange-500 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        )}
                      >
                        <Heart size={11} fill={liked ? 'currentColor' : 'none'} />
                        {liked ? 'Liked' : 'Like'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ══ SWIPE VIEW — tinder-style single card with drag ══ */
        <div className="relative h-[520px] w-full">
          <AnimatePresence mode="wait">
            {currentStudent ? (
              <motion.div
                key={currentStudent.uid}
                initial={{ opacity: 0, scale: 0.93, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.93, x: -30 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) handleLike(currentStudent);
                  else if (info.offset.x < -100) handleSkip(currentStudent);
                }}
                className="absolute inset-0 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col cursor-grab active:cursor-grabbing select-none"
              >
                {/* Photo — object-top so face is always in frame */}
                <div className="relative h-[58%]">
                  <img
                    src={currentStudent.profile_picture}
                    alt={currentStudent.name}
                    className="w-full h-full object-cover object-top pointer-events-none"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-2xl font-bold leading-tight">{currentStudent.name}</h3>
                    <p className="text-sm opacity-90 flex items-center gap-1.5 mt-0.5">
                      <GraduationCap size={13} />
                      {currentStudent.department} · {currentStudent.level}L
                    </p>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div>
                    <p className="text-slate-600 text-sm italic line-clamp-2">
                      "{currentStudent.bio || 'No bio yet.'}"
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {currentStudent.interests.slice(0, 4).map(i => (
                        <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[11px] font-bold rounded-md uppercase tracking-wide">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-center gap-6 mt-2">
                      <button
                        onClick={() => handleSkip(currentStudent)}
                        className="w-14 h-14 rounded-full bg-white border-2 border-slate-100 text-slate-400 flex items-center justify-center hover:border-slate-300 hover:text-slate-600 transition-all shadow-md"
                        aria-label="Skip"
                      >
                        <X size={26} />
                      </button>
                      <button
                        onClick={() => handleLike(currentStudent)}
                        className="w-14 h-14 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                        aria-label="Like"
                      >
                        <Heart size={26} fill="currentColor" />
                      </button>
                    </div>
                    <p className="text-center text-[10px] text-slate-300 mt-2 select-none">
                      Swipe right to like · left to skip
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <EmptyState onRefresh={() => { setFilters({ department: '', level: '' }); fetchStudents(true); }} />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Match Modal ── */}
      <AnimatePresence>
        {matchModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.82, y: 24 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center"
            >
              <div className="flex items-center justify-center mb-6">
                <img src={profile.profile_picture} className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover object-top relative z-10" draggable={false} />
                <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center -mx-2 z-20 shadow-lg">
                  <Heart size={16} className="text-white" fill="white" />
                </div>
                <img src={matchModal.profile.profile_picture} className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover object-top relative z-10" draggable={false} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-1">It's a Match!</h2>
              <p className="text-slate-500 text-sm mb-6">You and {matchModal.profile.name} liked each other.</p>
              <button
                onClick={() => { const id = matchModal.matchId; setMatchModal(null); navigate(`/chat/${id}`); }}
                className="w-full py-3 bg-orange-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-all"
              >
                <MessageCircle size={18} /> Say Hello
              </button>
              <button onClick={() => setMatchModal(null)} className="mt-3 text-sm text-slate-400 hover:text-slate-600 w-full py-2">
                Keep Browsing
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-dashed border-slate-300 min-h-64">
      <Search size={36} className="text-slate-300 mb-3" />
      <h3 className="text-lg font-bold text-slate-900">You've seen everyone!</h3>
      <p className="text-slate-500 text-sm mt-1">Adjust filters or browse all profiles again.</p>
      <button
        onClick={onRefresh}
        className="mt-4 px-5 py-2 bg-orange-600 text-white rounded-full text-sm font-bold hover:bg-orange-700 transition-all"
      >
        See everyone again
      </button>
    </div>
  );
}
