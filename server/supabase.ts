import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (service_role) — CHI dung trong API routes,
// KHONG import file nay tu client.
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceKey) {
  console.warn(
    "[Supabase] Thieu VITE_SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY. DB calls se that bai cho den khi cau hinh .env"
  );
}

export const supabaseAdmin = createClient(url || "https://placeholder.supabase.co", serviceKey || "placeholder", {
  auth: { persistSession: false, autoRefreshToken: false },
});
