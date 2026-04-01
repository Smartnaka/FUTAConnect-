import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { DEPARTMENTS, LEVELS, INTERESTS } from '../constants';
import { cn } from '../lib/utils';
import { Camera, LogOut, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface ProfileProps {
  user: User;
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

export default function Profile({ user, profile, onUpdate }: ProfileProps) {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department);
  const [level, setLevel] = useState(profile.level);
  const [bio, setBio] = useState(profile.bio || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile.interests);
  const [profile_picture, setProfilePicture] = useState(profile.profile_picture);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 10) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const updatedProfile: UserProfile = {
      ...profile,
      name,
      department,
      level,
      interests: selectedInterests,
      bio,
      profile_picture,
      last_seen: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedProfile)
        .eq('uid', user.id);
      
      if (error) throw error;
      onUpdate(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        {/* Profile Header */}
        <div className="bg-orange-600 h-32 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="relative group">
              <img
                src={profile_picture}
                alt={name}
                className="w-32 h-32 rounded-full border-4 border-white object-cover bg-white"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setProfilePicture(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`)}
                className="absolute bottom-0 right-0 p-2 bg-white text-orange-600 rounded-full shadow-lg hover:bg-slate-50 transition-all border border-slate-100"
              >
                <Camera size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-20 px-8 pb-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{profile.name}</h2>
              <p className="text-slate-500">{profile.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                <select
                  required
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {LEVELS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Interests (Select up to 10)
              </label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                      selectedInterests.includes(interest)
                        ? "bg-orange-600 border-orange-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-orange-300"
                    )}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-orange-100"
              >
                <Save size={20} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              {success && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-green-600 font-bold text-sm"
                >
                  Profile updated!
                </motion.span>
              )}
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
