import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile, Match, Message } from '../types';
import { Send, ChevronLeft, Info, MessageCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { getLastRead, markAsRead } from '../lib/unread';
import { User } from '@supabase/supabase-js';

interface MatchWithUser extends Match {
  otherUser: UserProfile;
}

interface ChatProps {
  user: User;
  profile: UserProfile;
}

export default function Chat({ user, profile }: ChatProps) {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<MatchWithUser[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // On mobile, show the sidebar when no match is selected, show the chat otherwise
  const [showSidebar, setShowSidebar] = useState(!matchId);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch all matches for the sidebar
  const fetchMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .contains('user_ids', [user.id]);

    if (error) {
      console.error(error);
      setLoadingMatches(false);
      return;
    }

    const enriched = await Promise.all(
      (data as Match[]).map(async (m) => {
        const otherUid = m.user_ids.find(id => id !== user.id);
        const { data: otherUserData } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', otherUid)
          .single();
        return { ...m, otherUser: otherUserData as UserProfile };
      })
    );

    setMatches(
      enriched.sort((a, b) => {
        const aTime = a.last_message_at || a.created_at || '';
        const bTime = b.last_message_at || b.created_at || '';
        return bTime.toString().localeCompare(aTime.toString());
      })
    );
    setLoadingMatches(false);
  }, [user.id]);

  useEffect(() => {
    fetchMatches();

    const subscription = supabase
      .channel('chat_matches_sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [fetchMatches]);

  // Load conversation when matchId changes
  useEffect(() => {
    if (!matchId) {
      setMessages([]);
      setOtherUser(null);
      setMatch(null);
      setShowSidebar(true);
      return;
    }

    setShowSidebar(false);
    setLoadingMessages(true);
    setMessages([]);
    setOtherUser(null);
    setMatch(null);

    const fetchMatchInfo = async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchData) {
        const data = matchData as Match;
        setMatch(data);
        const otherUid = data.user_ids.find(id => id !== user.id);
        const { data: otherUserData } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', otherUid)
          .single();
        setOtherUser(otherUserData as UserProfile);
      }
    };

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        setMessages(data as Message[]);
      }
    };

    Promise.all([fetchMatchInfo(), fetchMessages()]).finally(() => {
      setLoadingMessages(false);
      markAsRead(matchId);
    });

    const subscription = supabase
      .channel(`chat_${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const incoming = payload.new as unknown as Message;
        setMessages((prev: Message[]) => {
          // If this message is already present (real ID match), ignore
          if (prev.some((m: Message) => m.id === incoming.id)) return prev;
          // Replace optimistic placeholder: remove only the first (oldest) pending entry
          // with matching text from this sender to handle rapid duplicate sends correctly.
          if (incoming.sender_uid === user.id) {
            const pendingIdx = prev.findIndex(
              (m: Message) => String(m.id).startsWith('temp_') && m.text === incoming.text
            );
            if (pendingIdx !== -1) {
              const withoutPending = [...prev.slice(0, pendingIdx), ...prev.slice(pendingIdx + 1)];
              return [...withoutPending, incoming];
            }
          }
          return [...prev, incoming];
        });
        markAsRead(matchId);
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [matchId, user.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !matchId) return;

    const text = inputText.trim();
    const now = new Date().toISOString();
    const tempId = `temp_${Date.now()}`;

    setInputText('');
    setSendError(null);

    // Optimistic update — show the message immediately
    setMessages((prev: Message[]) => [
      ...prev,
      { id: tempId, match_id: matchId, sender_uid: user.id, text, created_at: now } as unknown as Message,
    ]);

    try {
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert([{ match_id: matchId, sender_uid: user.id, text, created_at: now }])
        .select('*')
        .single();

      if (error) throw error;

      if (insertedMessage) {
        setMessages((prev: Message[]) => prev.map((m: Message) => (
          m.id === tempId ? (insertedMessage as Message) : m
        )));
      }

      // Update match's last message preview (best-effort; non-critical)
      supabase
        .from('matches')
        .update({ last_message: text, last_message_at: now })
        .eq('id', matchId)
        .then(({ error: updateError }: { error: { message: string } | null }) => {
          if (updateError) console.error('Failed to update last_message:', updateError);
        });
    } catch (err) {
      console.error(err);
      // Roll back optimistic message and restore input
      setMessages((prev: Message[]) => prev.filter((m: Message) => m.id !== tempId));
      setInputText(text);
      setSendError('Failed to send message. Please try again.');
    }
  };

  const isUnread = (m: MatchWithUser) => {
    if (!m.last_message_at) return false;
    const lastRead = getLastRead(m.id);
    return new Date(m.last_message_at).getTime() > lastRead;
  };

  // ─── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = (
    <div className={cn(
      "flex flex-col bg-white border-r border-slate-100",
      "w-full md:w-80 md:flex-shrink-0",
      matchId ? "hidden md:flex" : "flex",
    )}>
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Messages</h2>
      </div>

      {loadingMatches ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-3">
            <MessageCircle size={24} />
          </div>
          <p className="text-sm font-bold text-slate-700">No matches yet</p>
          <p className="text-xs text-slate-400 mt-1">Start discovering to find connections.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {matches.map((m: MatchWithUser) => {
            const unread = isUnread(m);
            return (
              <button
                key={m.id}
                onClick={() => navigate(`/chat/${m.id}`)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left",
                  matchId === m.id && "bg-orange-50"
                )}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={m.otherUser?.profile_picture}
                    alt={m.otherUser?.name}
                    className="w-11 h-11 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={cn("text-sm truncate", unread ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                      {m.otherUser?.name}
                    </p>
                    {m.last_message_at && (
                      <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">
                        {format(new Date(m.last_message_at), 'HH:mm')}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", unread ? "text-slate-600 font-medium" : "text-slate-400")}>
                    {m.last_message || m.otherUser?.department || ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── Chat panel ─────────────────────────────────────────────────────────────
  const chatPanel = (() => {
    if (!matchId) {
      return (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <MessageCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Select a conversation</h3>
          <p className="text-slate-500 mt-2">Choose a match from the list to start chatting.</p>
        </div>
      );
    }

    if (loadingMessages) {
      return (
        <div className={cn("flex-1 flex items-center justify-center", !showSidebar ? "flex" : "hidden md:flex")}>
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!otherUser) {
      return (
        <div className={cn("flex-1 flex flex-col items-center justify-center text-center p-8", !showSidebar ? "flex" : "hidden md:flex")}>
          <h3 className="text-xl font-bold text-slate-900">Match not found</h3>
          <button onClick={() => navigate('/matches')} className="mt-4 text-orange-600 font-bold">Back to Matches</button>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        matchId ? "flex" : "hidden md:flex"
      )}>
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile: back to sidebar */}
            <button
              onClick={() => { setShowSidebar(true); navigate('/chat'); }}
              className="md:hidden p-2 hover:bg-slate-50 rounded-full text-slate-500"
            >
              <ArrowLeft size={20} />
            </button>
            <img
              src={otherUser.profile_picture}
              alt={otherUser.name}
              className="w-10 h-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{otherUser.name}</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{otherUser.department}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
            <Info size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg: Message) => {
            const isMe = msg.sender_uid === user.id;
            const isPending = String(msg.id).startsWith('temp_');
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "px-4 py-2 rounded-2xl text-sm shadow-sm",
                    isMe
                      ? "bg-orange-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-100",
                    isPending && "opacity-70"
                  )}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {isPending ? 'Sending…' : msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : '...'}
                </span>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
          {sendError && <p className="text-xs text-red-500 mb-2 px-1">{sendError}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-10 h-10 bg-orange-600 text-white rounded-full flex items-center justify-center hover:bg-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-orange-100"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    );
  })();

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex rounded-3xl shadow-xl border border-slate-100 overflow-hidden bg-white">
      {sidebar}
      {chatPanel}
    </div>
  );
}
