-- Profiles table
CREATE TABLE profiles (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  bio TEXT,
  profile_picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  id BIGSERIAL PRIMARY KEY,
  from_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_uid, to_uid)
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message TEXT,
  last_message_at TIMESTAMPTZ
);

-- Messages table
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = uid);

-- Likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see likes they sent or received." ON likes FOR SELECT USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "Users can insert their own likes." ON likes FOR INSERT WITH CHECK (auth.uid() = from_uid);

-- Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their matches." ON matches FOR SELECT USING (auth.uid() = ANY(user_ids));
-- Insert is restricted to the create_match_if_mutual() function (SECURITY DEFINER).
-- Direct client inserts are intentionally disallowed to prevent bypassing the mutual-like check.
CREATE POLICY "Users can update their matches." ON matches FOR UPDATE USING (auth.uid() = ANY(user_ids));

-- Secure server-side function to create a match only when both users have liked each other.
-- Using SECURITY DEFINER so the function runs as the DB owner and can bypass the restricted
-- INSERT policy on matches, while still validating the mutual like atomically.
CREATE OR REPLACE FUNCTION create_match_if_mutual(other_uid UUID)
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

  -- Verify the current user has already liked other_uid
  IF NOT EXISTS (
    SELECT 1 FROM likes WHERE from_uid = current_uid AND to_uid = other_uid
  ) THEN
    RAISE EXCEPTION 'Like from current user to other user does not exist';
  END IF;

  -- Check for a mutual like
  SELECT EXISTS(
    SELECT 1 FROM likes WHERE from_uid = other_uid AND to_uid = current_uid
  ) INTO mutual_exists;

  IF NOT mutual_exists THEN
    RETURN NULL;
  END IF;

  -- Return existing match if one already exists (idempotent)
  SELECT id INTO existing_match_id
  FROM matches
  WHERE user_ids @> ARRAY[current_uid, other_uid]
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  -- Atomically create the match
  INSERT INTO matches (user_ids, created_at)
  VALUES (ARRAY[current_uid, other_uid], NOW())
  RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$;

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see messages in their matches." ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches WHERE id = match_id AND auth.uid() = ANY(user_ids)
  )
);
CREATE POLICY "Users can insert messages in their matches." ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_uid AND
  EXISTS (
    SELECT 1 FROM matches WHERE id = match_id AND auth.uid() = ANY(user_ids)
  )
);
