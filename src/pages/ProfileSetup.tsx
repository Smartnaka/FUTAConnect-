import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { DEPARTMENTS, LEVELS, INTERESTS } from '../constants';
import { cn } from '../lib/utils';
import { Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface ProfileSetupProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState(user.user_metadata?.full_name || '');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [profile_picture, setProfilePicture] = useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 10) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department || !level || selectedInterests.length === 0) return;

    setLoading(true);
    const profileData: UserProfile = {
      uid: user.id,
      name,
      email: user.email || '',
      department,
      level,
      interests: selectedInterests,
      bio,
      profile_picture,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([profileData]);
      
      if (error) throw error;
      onComplete(profileData);
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
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Complete Your Profile</h2>
          <p className="text-slate-500">Let other FUTA students know who you are.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <img
                src={profile_picture}
                alt="Profile"
                className="w-32 h-32 rounded-full border-4 border-orange-100 object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setProfilePicture(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`)}
                className="absolute bottom-0 right-0 p-2 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all"
              >
                <Camera size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400">Click to shuffle avatar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="John Doe"
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
                <option value="">Select Department</option>
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
                <option value="">Select Level</option>
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

          <button
            type="submit"
            disabled={loading || !department || !level || selectedInterests.length === 0}
            className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-orange-100"
          >
            {loading ? 'Saving Profile...' : 'Complete Setup'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
