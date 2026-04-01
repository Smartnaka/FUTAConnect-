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
CREATE POLICY "Users can insert matches." ON matches FOR INSERT WITH CHECK (auth.uid() = ANY(user_ids));
CREATE POLICY "Users can update their matches." ON matches FOR UPDATE USING (auth.uid() = ANY(user_ids));

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
