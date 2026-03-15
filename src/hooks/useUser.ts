import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface WIQUser {
  id:    string;
  name:  string;
  email: string;
  photo: string | null;
  role:  "admin" | "customer";
  raw:   User | null;
}

const ADMIN_EMAILS = ["khushchadha", "khushhc", "admin@wateriq"];

function deriveRole(email: string, name: string): "admin" | "customer" {
  const e = email.toLowerCase();
  const n = name.toLowerCase();
  return ADMIN_EMAILS.some(a => e.includes(a) || n.includes(a)) ? "admin" : "customer";
}

function buildUser(supaUser: User): WIQUser {
  const meta  = supaUser.user_metadata ?? {};
  const name  = (meta.full_name ?? meta.name ?? supaUser.email ?? "User") as string;
  const email = (supaUser.email ?? "") as string;
  const photo = (meta.avatar_url ?? meta.picture ?? null) as string | null;
  return {
    id:    supaUser.id,
    name,
    email,
    photo,
    role:  deriveRole(email, name),
    raw:   supaUser,
  };
}

const FALLBACK: WIQUser = {
  id:    "guest",
  name:  "Guest",
  email: "",
  photo: null,
  role:  "customer",
  raw:   null,
};

export function useUser(): { user: WIQUser; loading: boolean; signOut: () => Promise<void> } {
  const [user, setUser]       = useState<WIQUser>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount: check for existing session (incl. hash from OAuth redirect)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(buildUser(data.session.user));
      }
      setLoading(false);
    });

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(buildUser(session.user));
      } else {
        setUser(FALLBACK);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    // Redirect back to landing page after sign out
    window.location.href = "https://water-iq.vercel.app";
  }

  return { user, loading, signOut };
}
