export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  department: string;
  level: string;
  interests: string[];
  bio: string;
  profile_picture: string;
  created_at: string;
  last_seen: string;
}

export interface Like {
  from_uid: string;
  to_uid: string;
  created_at: string;
}

export interface Match {
  id: string;
  user_ids: string[];
  created_at: string;
  last_message?: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_uid: string;
  text: string;
  created_at: string;
}
