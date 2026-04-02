import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Match } from '../types';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface MatchesProps {
  user: User;
  profile: UserProfile;
}

function getLastRead(matchId: string): number {
  try {
    return parseInt(localStorage.getItem(`futaconnect_lastread_${matchId}`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export default function Matches({ user, profile }: MatchesProps) {
  const [matches, setMatches] = useState<(Match & { otherUser: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .contains('user_ids', [user.id]);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const matchData = await Promise.all(
        (data as Match[]).map(async (match) => {
          const otherUid = match.user_ids.find(id => id !== user.id);
          const { data: otherUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('uid', otherUid)
            .single();
          
          return {
            ...match,
            otherUser: otherUser as UserProfile
          };
        })
      );

      setMatches(matchData.sort((a, b) => {
        const aTime = a.last_message_at || a.created_at || '';
        const bTime = b.last_message_at || b.created_at || '';
        return bTime.toString().localeCompare(aTime.toString());
      }));
      setLoading(false);
    };

    fetchMatches();

    // Subscribe to new matches
    const subscription = supabase
      .channel('matches_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredMatches = matches.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.otherUser?.name?.toLowerCase().includes(q) ||
      m.otherUser?.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900 flex-shrink-0">Your Matches</h2>
        {matches.length > 0 && (
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search matches…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
          </div>
        )}
      </div>

      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const unread =
              !!match.last_message_at &&
              new Date(match.last_message_at).getTime() > getLastRead(match.id);
            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={match.otherUser.profile_picture}
                    alt={match.otherUser.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-orange-100"
                    referrerPolicy="no-referrer"
                  />
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate ${unread ? 'text-slate-900' : 'text-slate-800'}`}>
                    {match.otherUser.name}
                  </h3>
                  <p className={`text-xs truncate ${unread ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                    {match.last_message || match.otherUser.department}
                  </p>
                </div>
                <Link
                  to={`/chat/${match.id}`}
                  className="relative p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition-colors flex-shrink-0"
                >
                  <MessageCircle size={20} />
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : matches.length > 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-500">No matches found for "{search}".</p>
          <button onClick={() => setSearch('')} className="mt-3 text-orange-600 font-bold text-sm">Clear search</button>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
            <Heart size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No matches yet</h3>
          <p className="text-slate-500 mt-1">Keep swiping to find your campus connections!</p>
          <Link
            to="/discover"
            className="mt-6 inline-block px-6 py-2 bg-orange-600 text-white rounded-full font-bold hover:bg-orange-700 transition-all"
          >
            Start Discovering
          </Link>
        </div>
      )}
    </div>
  );
}
