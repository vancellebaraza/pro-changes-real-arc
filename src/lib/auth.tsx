import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "engineer" | "admin";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, loading };
}

export function useMyRoles() {
  const { user, loading } = useSession();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setRolesLoading(false);
      });
  }, [user, loading]);
  const primaryRole: AppRole =
    roles.includes("admin") ? "admin" : roles.includes("engineer") ? "engineer" : "client";
  return { roles, primaryRole, loading: loading || rolesLoading, user };
}

export async function signOutClean(navigate: (opts: { to: string; replace?: boolean }) => void) {
  await supabase.auth.signOut();
  navigate({ to: "/auth", replace: true });
}

export type AnyUser = User;
