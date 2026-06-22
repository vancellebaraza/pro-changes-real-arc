import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ensureFixedAccounts } from "@/lib/setup.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FusionPro" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const provision = useServerFn(ensureFixedAccounts);

  useEffect(() => {
    // Ensure fixed admin/engineer accounts exist (idempotent)
    provision({ data: undefined }).catch(() => {});
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate, provision]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: String(fd.get("full_name") || ""),
          phone: String(fd.get("phone") || ""),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You're signed in.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* ── Left panel: soft white with red accent ── */}
      <div className="hidden md:flex flex-col justify-between p-10 surface border-r overflow-hidden relative">
        {/* Red vertical accent strip */}
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
        />

        <Link to="/">
          <Logo className="h-10 w-auto" />
        </Link>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight max-w-md leading-tight text-foreground">
            RealArc Estates property operations,{" "}
            <span className="text-primary">unified.</span>
          </h1>
          <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
            Submit requests, run inspections, build quotations, and track every
            project from one place.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} RealArc Estates
        </p>
      </div>

      {/* ── Right panel: dark form ── */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm fade-in">
          {/* Mobile logo */}
          <div className="md:hidden mb-8">
            <Logo className="h-8 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              FusionPro Portal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your operations workspace.
            </p>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger
                value="signin"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 mt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
                New accounts are automatically set up as{" "}
                <strong className="text-foreground/70">client portals</strong>. Engineer and
                admin access is reserved.
              </p>
              <form onSubmit={signUp} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" name="full_name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" name="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create client account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            <Link to="/" className="hover:text-foreground transition">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
