import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Zap,
  ShieldCheck,
  Bell,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
} from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "Sign In — EduMind AI" },
      { name: "description", content: "Sign in or create your EduMind AI account to access modules, materials, assessments and your AI study tutor." },
      { property: "og:title", content: "Sign In — EduMind AI" },
      { property: "og:description", content: "Access your intelligent learning workspace: modules, materials, assessments and AI tutoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const FEATURES = [
  {
    icon: Zap,
    title: "Fast, Focused Learning",
    body: "Find content instantly with AI-powered search and stay on track with intelligent progress tracking.",
    tint: "from-primary/30 to-primary/10 text-primary",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    body: "Students, lecturers and admins each get tailored tools and permissions.",
    tint: "from-accent/30 to-accent/10 text-accent",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    body: "Never miss deadlines, new materials, quizzes or enrollment updates.",
    tint: "from-primary/30 to-accent/10 text-primary",
  },
];

function AuthPage() {
  const { mode } = Route.useSearch();
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(mode ?? "login");
  useEffect(() => { if (mode) setTab(mode); }, [mode]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -left-40 top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 bottom-[-12rem] h-[32rem] w-[32rem] rounded-full bg-accent/15 blur-[150px]" />

      <div className="relative z-10 p-5">
        <Button asChild variant="secondary" size="sm" className="rounded-full">
          <Link to="/"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link>
        </Button>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 pt-4 lg:grid-cols-2 lg:items-start">
        {/* Brand / marketing panel */}
        <section className="glass rounded-3xl border border-border/60 p-8 sm:p-10">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-3 text-primary-foreground shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">EduMind AI</p>
              <p className="text-sm text-muted-foreground">Intelligent Learning Management</p>
            </div>
          </div>

          <h1 className="mt-10 text-4xl font-bold leading-tight sm:text-5xl">
            Master your learning{" "}
            <span className="text-gradient">journey with AI</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            One intelligent workspace for modules, materials, assessments and exam readiness. Powered by advanced AI.
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${f.tint} grid place-items-center`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Form panel */}
        <section className="glass rounded-3xl border border-border/60 p-6 sm:p-9">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-secondary/50 p-1">
              <TabsTrigger value="login" className="rounded-full">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Header
                title="Welcome back"
                subtitle="Sign in to your account to continue"
              />
              <LoginForm onDone={() => nav({ to: "/dashboard" })} />
            </TabsContent>

            <TabsContent value="signup">
              <Header
                title="Create your account"
                subtitle="Join EduMind AI and start learning smarter"
              />
              <SignupForm onDone={() => nav({ to: "/dashboard" })} />
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex gap-3 rounded-2xl border border-accent/25 bg-accent/10 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Secure &amp; Encrypted</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your session expires automatically for security. Avoid “Remember me” on shared devices.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Use your institutional credentials to log in.
          </p>
        </section>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-8 text-center">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function FieldLabel({ htmlFor, icon: Icon, children }: { htmlFor: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="mb-2 flex items-center gap-2 text-sm font-medium">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {children}
    </Label>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="h-12 rounded-xl bg-secondary/40 pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const submitClass =
  "h-12 w-full rounded-xl bg-gradient-to-r from-primary to-accent text-base font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90";

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  return (
    <form className="space-y-5 pt-8" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setLoading(false);
      if (error) toast.error(error.message); else { toast.success("Welcome back"); onDone(); }
    }}>
      <div>
        <FieldLabel htmlFor="le" icon={Mail}>Email address</FieldLabel>
        <Input id="le" type="email" required placeholder="you@edumind.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-secondary/40" />
      </div>
      <div>
        <FieldLabel htmlFor="lp" icon={Lock}>Password</FieldLabel>
        <PasswordInput id="lp" required placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          Remember me
        </label>
        <span className="text-xs text-muted-foreground">Institutional accounts only</span>
      </div>

      <Button type="submit" disabled={loading} className={submitClass}>
        {loading ? "Signing in…" : <>Sign In <ArrowRight className="ml-1.5 h-4 w-4" /></>}
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-5 pt-8" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email, password: pw,
        options: { data: { full_name: joinName(firstName, lastName) } },
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="sfn" icon={User}>First name</FieldLabel>
          <Input id="sfn" required value={firstName} placeholder="Jane"
            onChange={(e) => setFirstName(e.target.value)} className="h-12 rounded-xl bg-secondary/40" />
        </div>
        <div>
          <FieldLabel htmlFor="sln" icon={User}>Last name</FieldLabel>
          <Input id="sln" required value={lastName} placeholder="Doe"
            onChange={(e) => setLastName(e.target.value)} className="h-12 rounded-xl bg-secondary/40" />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="se" icon={Mail}>Email address</FieldLabel>
        <Input id="se" type="email" required placeholder="you@edumind.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-secondary/40" />
      </div>
      <div>
        <FieldLabel htmlFor="sp" icon={Lock}>Password</FieldLabel>
        <PasswordInput id="sp" required minLength={6} placeholder="At least 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className={submitClass}>
        {loading ? "Creating…" : <>Create account <ArrowRight className="ml-1.5 h-4 w-4" /></>}
      </Button>
    </form>
  );
}
