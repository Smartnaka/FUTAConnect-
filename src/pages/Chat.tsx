import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile, Match, Message } from '../types';
import { Send, ChevronLeft, Info, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { User } from '@supabase/supabase-js';

interface ChatProps {
  user: User;
  profile: UserProfile;
}

export default function Chat({ user, profile }: ChatProps) {
  const { matchId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId) return;

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
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    fetchMatchInfo();
    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`chat_${matchId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [matchId, user.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !matchId) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          match_id: matchId,
          sender_uid: user.id,
          text,
          created_at: new Date().toISOString(),
        }]);
      
      if (error) throw error;
    } catch (err) {
      console.error(err);
    }
  };

  if (!matchId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
          <MessageCircle size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Select a match to start chatting</h3>
        <Link to="/matches" className="mt-4 text-orange-600 font-bold">View Matches</Link>
      </div>
    );
  }

  if (!otherUser) return null;

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="p-2 hover:bg-slate-50 rounded-full text-slate-500">
            <ChevronLeft size={20} />
          </Link>
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isMe = msg.sender_uid === user.id;
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
                    : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                )}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : '...'}
              </span>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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
}
