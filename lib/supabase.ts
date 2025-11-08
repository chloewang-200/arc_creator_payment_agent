import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (will match our schema)
export type Creator = {
  id: string;
  wallet_address: string;
  username: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  cover_image_url?: string;
  ai_tone?: string;
  ai_personality?: string;
  ai_background?: string;
  has_content?: boolean;
  voice_sample_url?: string;
  voice_sample_duration_seconds?: number;
  voice_preview_enabled?: boolean;
  voice_clone_status?: string;
  elevenlabs_voice_id?: string;
  circle_wallet_set_id?: string;
  circle_wallet_id?: string;
  circle_wallet_address?: string;
  circle_wallet_chain?: string;
  circle_wallet_status?: string;
  followers?: number;
  total_earnings?: number;
  created_at: string;
  updated_at: string;
};

export type CreatorPricing = {
  id: string;
  creator_id: string;
  monthly_usd: number;
  tip_presets_usd: number[];
  recurring_tip_usd?: number;
  updated_at: string;
};

export type Post = {
  id: string;
  creator_id: string;
  title: string;
  intro: string;
  content: string;
  price_usd: number;
  content_type: string;
  published: boolean;
  voice_preview_url?: string;
  voice_preview_duration_seconds?: number;
  voice_preview_status?: string;
  voice_preview_text?: string;
  voice_preview_generated_at?: string;
  listen_audio_url?: string; // Cached URL for "Listen to this post" audio
  created_at: string;
  updated_at: string;
};
