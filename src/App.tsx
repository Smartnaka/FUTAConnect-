/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { UserProfile } from './types';
import { cn } from './lib/utils';
import { 
  Heart, 
  MessageCircle, 
  User as UserIcon, 
  Search, 
  LogOut, 
  Menu, 
  X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';

// Pages
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Discovery from './pages/Discovery';
import Matches from './pages/Matches';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import ProfileSetup from './pages/ProfileSetup';

function Layout({ children, user, profile }: { children: React.ReactNode, user: User | null, profile: UserProfile | null }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Discover', path: '/discover', icon: Search },
    { name: 'Matches', path: '/matches', icon: Heart },
    { name: 'Chat', path: '/chat', icon: MessageCircle },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  if (!user || !profile) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/discover" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <span className="text-xl font-bold text-slate-900 tracking-tight">FUTAConnect</span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.path
                      ? "bg-orange-50 text-orange-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600 hover:text-slate-900 p-2"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium transition-colors",
                      location.pathname === item.path
                        ? "bg-orange-50 text-orange-600"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <item.icon size={20} />
                    {item.name}
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .single();

    if (data) {
      setProfile(data as UserProfile);
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Loading FUTAConnect...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user} profile={profile}>
        <Routes>
          <Route path="/" element={!user ? <Landing /> : <Navigate to="/discover" />} />
          <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/discover" />} />
          
          {/* Protected Routes */}
          <Route path="/setup" element={user ? (profile ? <Navigate to="/discover" /> : <ProfileSetup user={user} onComplete={(p) => setProfile(p)} />) : <Navigate to="/auth" />} />
          <Route path="/discover" element={user ? (profile ? <Discovery user={user} profile={profile} /> : <Navigate to="/setup" />) : <Navigate to="/auth" />} />
          <Route path="/matches" element={user ? (profile ? <Matches user={user} profile={profile} /> : <Navigate to="/setup" />) : <Navigate to="/auth" />} />
          <Route path="/chat" element={user ? (profile ? <Chat user={user} profile={profile} /> : <Navigate to="/setup" />) : <Navigate to="/auth" />} />
          <Route path="/chat/:matchId" element={user ? (profile ? <Chat user={user} profile={profile} /> : <Navigate to="/setup" />) : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? (profile ? <Profile user={user} profile={profile} onUpdate={(p) => setProfile(p)} /> : <Navigate to="/setup" />) : <Navigate to="/auth" />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}
