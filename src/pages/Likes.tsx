import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { UserProfile, Match } from '../types';
import { User } from '@supabase/supabase-js';

interface LikesProps {
  user: User;
}

interface IncomingLike {
  id: number;
  from_uid: string;
  created_at: string;
  fromUser: UserProfile | null;
  matchId: string | null;
}

export default function Likes({ user }: LikesProps) {
  const navigate = useNavigate();
  const [likes, setLikes] = useState<IncomingLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningUid, setActioningUid] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<{ name: string; profilePicture: string; matchId: string } | null>(null);

  const handleAcceptInterest = async (like: IncomingLike) => {
    if (!like.fromUser) return;
    setActioningUid(like.from_uid);

    try {
      const { error: likeError } = await supabase
        .from('likes')
        .upsert(
          [{
            from_uid: user.id,
            to_uid: like.from_uid,
            created_at: new Date().toISOString(),
          }],
          { onConflict: 'from_uid,to_uid' }
        );

      if (likeError) throw likeError;

      const { data: matchId, error: matchError } = await supabase
        .rpc('create_match_if_mutual', { other_uid: like.from_uid });

      if (matchError) throw matchError;

      if (matchId) {
        setLikes((prev) => prev.map((item) => item.id === like.id ? { ...item, matchId: matchId as string } : item));
        setMatchModal({
          name: like.fromUser.name,
          profilePicture: like.fromUser.profile_picture,
          matchId: matchId as string,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActioningUid(null);
    }
  };

  useEffect(() => {
    const fetchIncomingLikes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('likes')
        .select('*')
        .eq('to_uid', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const enriched = await Promise.all((data ?? []).map(async (like) => {
        const { data: fromUser } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', like.from_uid)
          .single();

        const { data: matchRows } = await supabase
          .from('matches')
          .select('id')
          .contains('user_ids', [user.id, like.from_uid])
          .limit(1);

        return {
          ...like,
          fromUser: (fromUser as UserProfile | null) ?? null,
          matchId: (matchRows as Pick<Match, 'id'>[] | null)?.[0]?.id ?? null,
        } as IncomingLike;
      }));

      setLikes(enriched);
      setLoading(false);
    };

    fetchIncomingLikes();

    const channel = supabase
      .channel('incoming_likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchIncomingLikes)
      .subscribe();

    return () => {
      channel.unsubscribe();
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">People Interested In You</h2>
        <p className="text-slate-500 text-sm">See who liked your profile and jump into chat when it becomes mutual.</p>
      </div>

      {likes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
            <Heart size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No likes yet</h3>
          <p className="text-slate-500 mt-1">When someone likes you, they will appear here.</p>
          <Link to="/discover" className="mt-6 inline-block px-6 py-2 bg-orange-600 text-white rounded-full font-bold hover:bg-orange-700 transition-all">
            Go to Discover
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {likes.map((like) => (
            <motion.div
              key={like.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4"
            >
              <img
                src={like.fromUser?.profile_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${like.from_uid}`}
                alt={like.fromUser?.name || 'Student'}
                className="w-14 h-14 rounded-full object-cover border-2 border-orange-100"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{like.fromUser?.name || 'A student'}</h3>
                <p className="text-xs text-slate-500 truncate">
                  {like.fromUser ? `${like.fromUser.department} • ${like.fromUser.level}L` : 'Profile details unavailable'}
                </p>
              </div>
              {like.matchId ? (
                <Link
                  to={`/chat/${like.matchId}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-full text-sm font-bold hover:bg-orange-700 transition-all"
                >
                  <MessageCircle size={16} />
                  Chat
                </Link>
              ) : (
                <button
                  onClick={() => handleAcceptInterest(like)}
                  disabled={actioningUid === like.from_uid}
                  className="inline-flex items-center px-3 py-2 bg-orange-50 text-orange-700 rounded-full text-xs font-bold hover:bg-orange-100 transition-all disabled:opacity-60"
                >
                  {actioningUid === like.from_uid ? 'Accepting request…' : 'Accept request'}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {matchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center">
            <img
              src={matchModal.profilePicture}
              alt={matchModal.name}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto mb-5"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-3xl font-black text-slate-900 mb-2">It's a Match!</h2>
            <p className="text-slate-500 mb-8">You accepted {matchModal.name}'s request and you're now a match.</p>

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
          </div>
        </div>
      )}
    </div>
  );
}
