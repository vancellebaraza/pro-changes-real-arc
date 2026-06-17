import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FusionPro" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const role = String(fd.get("role") || "client");
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: String(fd.get("full_name") || ""),
          phone: String(fd.get("phone") || ""),
          role,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. You're signed in.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 surface border-r">
        <Link to="/"><Logo className="h-10 w-auto" /></Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight max-w-md leading-tight">RealArc Estates property operations, unified.</h1>
          <p className="mt-3 text-muted-foreground max-w-md">Submit requests, run inspections, build quotations, and track every project from one place.</p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} RealArc Estates</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-6"><Logo className="h-8 w-auto" /></div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 mt-4">
                <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
                <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={6} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Sign in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 mt-4">
                <div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
                <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
                <div><Label htmlFor="email2">Email</Label><Input id="email2" name="email" type="email" required /></div>
                <div><Label htmlFor="password2">Password</Label><Input id="password2" name="password" type="password" required minLength={6} /></div>
                <div>
                  <Label htmlFor="role">Account type</Label>
                  <select id="role" name="role" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="client">Client</option>
                    <option value="engineer">Engineer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
          <p className="mt-6 text-xs text-muted-foreground text-center"><Link to="/" className="hover:underline">← Back to home</Link></p>
        </div>
      </div>
    </div>
  );
}
