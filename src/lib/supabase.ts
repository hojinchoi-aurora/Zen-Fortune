import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServerClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-zen-fortune': 'server' } },
  });
}

export type Drink = {
  id: number;
  name: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

export type Quote = {
  id: number;
  content: string;
  drink_override_id: number | null;
  is_active: boolean;
  created_at: string;
};

export type QuoteStat = {
  id: number;
  content: string;
  is_active: boolean;
  views_total: number;
  likes_total: number;
  views_7d: number;
  likes_7d: number;
};

export type DrinkUsage = {
  id: number;
  name: string;
  note: string | null;
  is_active: boolean;
  usage_total: number;
  usage_7d: number;
};
