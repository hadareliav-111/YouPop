import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AUTH_EMAIL_DOMAIN, supabase } from "../lib/supabaseClient";

interface SignInResult {
  error: string | null;
}

// Username-only from the app's perspective — signIn takes a username and
// password, never an email, and only ever surfaces a generic failure
// message. The @watchlist.local construction lives entirely here.
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const normalized = username.trim().toLowerCase();
      if (!normalized || !password) {
        return { error: "Enter your username and password." };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: `${normalized}@${AUTH_EMAIL_DOMAIN}`,
        password,
      });
      return { error: error ? "Incorrect username or password." : null };
    },
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return { user, loading, signIn, signOut };
}
