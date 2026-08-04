import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { ensureStudentNumber } from "@/lib/onboarding.functions";
import { joinName } from "@/lib/name";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: z.object({ mode: z.enum(["login", "signup"]).optional() }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(mode ?? "login");
  useEffect(() => { if (mode) setTab(mode); }, [mode]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-sidebar-primary p-2 text-sidebar-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">EduMind AI</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Learn smarter,<br />teach better.</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">An AI-powered LMS for students, lecturers and administrators.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© EduMind AI</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to EduMind AI</CardTitle>
            <CardDescription>Sign in or create your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm onDone={() => nav({ to: "/dashboard" })} /></TabsContent>
              <TabsContent value="signup"><SignupForm onDone={() => nav({ to: "/dashboard" })} /></TabsContent>
            </Tabs>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">← Back to home</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-3 pt-3" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setLoading(false);
      if (error) toast.error(error.message); else { toast.success("Welcome back"); onDone(); }
    }}>
      <div><Label htmlFor="le">Email</Label><Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="lp">Password</Label><Input id="lp" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-3 pt-3" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password: pw,
        options: { data: { full_name: name } },
      });
      if (error) { setLoading(false); toast.error(error.message); return; }
      if (!data.session) {
        // No session means confirmation is still on in the project settings — sign in directly.
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (signInError) {
          setLoading(false);
          toast.error("Email confirmation is still enabled in your Supabase project. Turn off “Confirm email” under Authentication → Sign In / Providers → Email.");
          return;
        }
      }
      try {
        const res = await ensureStudentNumber({ data: {} as never });
        if (res?.studentNumber) toast.success(`Your student number is ${res.studentNumber}`);
      } catch {
        // Number will be allocated on next load if this call fails.
      }
      setLoading(false);
      toast.success("Account created — you're signed in"); onDone();
    }}>

      <div><Label htmlFor="sn">Full name</Label><Input id="sn" required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label htmlFor="se">Email</Label><Input id="se" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="sp">Password</Label><Input id="sp" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating…" : "Create account"}</Button>
    </form>
  );
}
