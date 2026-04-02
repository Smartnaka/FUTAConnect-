import React, { useRef, useState } from 'react';
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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState(user.user_metadata?.full_name || '');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [profile_picture, setProfilePicture] = useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`);
  const [loading, setLoading] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPictureError('');

    if (!file.type.startsWith('image/')) {
      setPictureError('Please select a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPictureError('Image must be 5MB or smaller.');
      return;
    }

    setUploadingPicture(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setProfilePicture(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.message?.includes('row-level security')
          ? 'Upload blocked by Supabase policy. Run the updated supabase_schema.sql in your project.'
          : 'Failed to upload image. Please try again.';
      setPictureError(message);
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < 10) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedDepartment = department === '__other__' ? customDepartment.trim() : department;
    if (!resolvedDepartment || !level || selectedInterests.length === 0) return;
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    setFormError('');
    setNameError('');

    setLoading(true);
    const profileData: UserProfile = {
      uid: user.id,
      name,
      email: user.email || '',
      department: resolvedDepartment,
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
        .upsert([profileData], { onConflict: 'uid' });
      
      if (error) throw error;
      onComplete(profileData);
    } catch (err) {
      console.error(err);
      setFormError('Could not save your profile. Please try again.');
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
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPicture}
                className="absolute bottom-0 right-0 p-2 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all disabled:opacity-50"
              >
                <Camera size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
                onChange={handlePictureChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-slate-400">
              {uploadingPicture ? 'Uploading...' : 'Click to upload profile picture'}
            </p>
            {pictureError && <p className="text-xs text-red-500">{pictureError}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); }}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="John Doe"
              />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
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
                <option value="__other__">Other (Type your course)</option>
              </select>
              {department === '__other__' && (
                <input
                  type="text"
                  required
                  value={customDepartment}
                  onChange={(e) => setCustomDepartment(e.target.value)}
                  className="w-full mt-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Enter your course / department"
                />
              )}
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
            disabled={loading || !(department === '__other__' ? customDepartment.trim() : department) || !level || selectedInterests.length === 0}
            className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-orange-100"
          >
            {loading ? 'Saving Profile...' : 'Complete Setup'}
          </button>
          {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}
        </form>
      </motion.div>
    </div>
  );
}
