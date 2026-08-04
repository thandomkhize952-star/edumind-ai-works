import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpen, Brain, ClipboardCheck, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduMind AI — Smart Learning Management" },
      { name: "description", content: "AI-powered learning platform for students, lecturers and administrators." },
      { property: "og:title", content: "EduMind AI — Smart Learning Management" },
      { property: "og:description", content: "AI-powered learning platform for students, lecturers and administrators." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      {/* ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-accent/15 blur-[100px]" />
      </div>

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-lg shadow-primary/25">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">EduMind AI</span>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="ghost" className="text-foreground/80 hover:bg-white/5 hover:text-foreground">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/90">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AI-Powered Learning Platform
            </span>
            <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Transform Your <br />
              <span className="text-gradient">Learning Journey</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Experience the future of education with our AI-powered Learning Management System. Personalized study plans, intelligent tutoring, and career development tools.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right feature cards */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-3xl" />
            <div className="relative space-y-4">
              {[
                { icon: BookOpen, title: "Course Management", body: "Create, manage, and enroll in diploma programs with structured modules." },
                { icon: Brain, title: "AI Learning Assistant", body: "Get personalized help, study plans, and intelligent tutoring." },
                { icon: ClipboardCheck, title: "Quiz & Assessment", body: "Take quizzes, track progress, and get instant feedback." },
                { icon: Upload, title: "Career Development", body: "CV reviews, job readiness tracking, and career guidance." },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="glass glow-purple flex items-start gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
                  style={{ marginLeft: i % 2 === 1 ? "1.5rem" : "0" }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lower feature grid */}
        <section id="features" className="mt-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Built for every role</h2>
            <p className="mt-3 text-muted-foreground">Admins, lecturers, and students — all in one place.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: BookOpen, title: "Admins", body: "Manage users, qualifications, modules and lecturer assignments." },
              { icon: ClipboardCheck, title: "Students", body: "Enroll, take tests, track marks, edit your profile, study with AI." },
              { icon: Brain, title: "Lecturers", body: "Create assessments, mark submissions, take attendance, upload material." },
            ].map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1">
                <div className="mb-4 inline-flex rounded-xl bg-accent/15 p-2.5 text-accent">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
