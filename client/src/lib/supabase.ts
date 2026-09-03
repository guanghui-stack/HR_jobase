import { createClient } from "@supabase/supabase-js";

// Client-side Supabase (anon key) — dung cho Auth + Realtime/presence neu can.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn("[Supabase] Thieu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env");
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder"
);
