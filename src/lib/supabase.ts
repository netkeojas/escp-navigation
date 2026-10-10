import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null when the project is not configured. Every caller must handle that: the
 * app is designed to be fully usable from its bundled snapshot alone, so a
 * missing Supabase project degrades to "no live edits", not to a broken app.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const supabaseConfigured = supabase !== null;
