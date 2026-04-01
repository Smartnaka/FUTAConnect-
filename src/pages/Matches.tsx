import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Match } from '../types';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface MatchesProps {
  user: User;
  profile: UserProfile;
}

export default function Matches({ user, profile }: MatchesProps) {
  const [matches, setMatches] = useState<(Match & { otherUser: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);

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
        const aTime = a.created_at || '';
        const bTime = b.created_at || '';
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

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Matches</h2>

      {matches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matches.map((match) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all"
            >
              <img
                src={match.otherUser.profile_picture}
                alt={match.otherUser.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-orange-100"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{match.otherUser.name}</h3>
                <p className="text-xs text-slate-500 truncate">{match.otherUser.department}</p>
              </div>
              <Link
                to={`/chat/${match.id}`}
                className="p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition-colors"
              >
                <MessageCircle size={20} />
              </Link>
            </motion.div>
          ))}
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
