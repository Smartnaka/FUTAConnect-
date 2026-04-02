-- FUTAConnect Supabase schema (run in Supabase SQL editor)
-- Safe to run on a new project. Uses IF NOT EXISTS where possible.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  email TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  profile_picture TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id BIGSERIAL PRIMARY KEY,
  from_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_uid, to_uid),
  CHECK (from_uid <> to_uid)
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message TEXT,
  last_message_at TIMESTAMPTZ
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(trim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_likes_to_uid ON public.likes(to_uid);
CREATE INDEX IF NOT EXISTS idx_likes_from_uid ON public.likes(from_uid);
CREATE INDEX IF NOT EXISTS idx_messages_match_id_created_at ON public.messages(match_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = uid);

-- Likes policies
DROP POLICY IF EXISTS "Users can see likes they sent or received." ON public.likes;
CREATE POLICY "Users can see likes they sent or received."
ON public.likes FOR SELECT
USING (auth.uid() = from_uid OR auth.uid() = to_uid);

DROP POLICY IF EXISTS "Users can insert their own likes." ON public.likes;
CREATE POLICY "Users can insert their own likes."
ON public.likes FOR INSERT
WITH CHECK (auth.uid() = from_uid);

-- Matches policies
DROP POLICY IF EXISTS "Users can see their matches." ON public.matches;
CREATE POLICY "Users can see their matches."
ON public.matches FOR SELECT
USING (auth.uid() = ANY(user_ids));

DROP POLICY IF EXISTS "Users can update their matches." ON public.matches;
CREATE POLICY "Users can update their matches."
ON public.matches FOR UPDATE
USING (auth.uid() = ANY(user_ids));

-- Messages policies
DROP POLICY IF EXISTS "Users can see messages in their matches." ON public.messages;
CREATE POLICY "Users can see messages in their matches."
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = match_id AND auth.uid() = ANY(user_ids)
  )
);

DROP POLICY IF EXISTS "Users can insert messages in their matches." ON public.messages;
CREATE POLICY "Users can insert messages in their matches."
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_uid
  AND EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = match_id AND auth.uid() = ANY(user_ids)
  )
);

-- Function: create match only when likes are mutual
CREATE OR REPLACE FUNCTION public.create_match_if_mutual(other_uid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  mutual_exists BOOLEAN;
  existing_match_id UUID;
  new_match_id UUID;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF current_uid = other_uid THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.likes
    WHERE from_uid = current_uid AND to_uid = other_uid
  ) THEN
    RAISE EXCEPTION 'Like from current user to other user does not exist';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.likes
    WHERE from_uid = other_uid AND to_uid = current_uid
  ) INTO mutual_exists;

  IF NOT mutual_exists THEN
    RETURN NULL;
  END IF;

  SELECT id INTO existing_match_id
  FROM public.matches
  WHERE user_ids @> ARRAY[current_uid, other_uid]
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  INSERT INTO public.matches (user_ids, created_at)
  VALUES (ARRAY[current_uid, other_uid], NOW())
  RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_match_if_mutual(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_if_mutual(UUID) TO authenticated;

-- Storage setup for avatar uploads (fixes "image not uploading" when bucket/policies are missing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies for avatars bucket
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
