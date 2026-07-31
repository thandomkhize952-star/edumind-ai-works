import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Users, BookOpen, Brain, ClipboardCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduHub — Modern Learning Management" },
      { name: "description", content: "Manage qualifications, modules, assessments, attendance and AI-assisted study in one place." },
      { property: "og:title", content: "EduHub — Modern Learning Management" },
      { property: "og:description", content: "Manage qualifications, modules, assessments, attendance and AI-assisted study in one place." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-2 text-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
            <span className="text-lg font-semibold tracking-tight">EduHub</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Built for modern campuses</span>
        <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
          One platform for <span className="text-primary">students, lecturers</span> and <span className="text-primary">admins</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Manage qualifications and modules, run tests and quizzes, take attendance, upload materials, and give every student an AI study tutor.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create your account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Sign in</Link></Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: Users, title: "Admins", body: "Manage users, qualifications, modules and lecturer assignments." },
          { icon: BookOpen, title: "Students", body: "Enroll, take tests, track marks, edit your profile, study with AI." },
          { icon: ClipboardCheck, title: "Lecturers", body: "Create assessments, mark submissions, take attendance, upload material." },
          { icon: Brain, title: "AI study tutor", body: "Chat tutor, practice questions, exam prep plans, material summaries." },
          { icon: Upload, title: "Course materials", body: "Lecturers upload slides and notes — students access instantly." },
          { icon: GraduationCap, title: "Auto-graded quizzes", body: "Multiple-choice tests grade instantly so students get fast feedback." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-accent p-2 text-accent-foreground"><f.icon className="h-5 w-5" /></div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
