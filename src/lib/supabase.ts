import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.error("[WIQ] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, key, {
  auth: {
    // Automatically picks up the session from the URL hash
    // when redirected from the Next.js landing page post-OAuth
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: "wiq_supabase_session",
  },
});
