import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getUserReport,
  getEnrollmentReport,
  getModuleReport,
  getReportFilterOptions,
} from "@/lib/reports.functions";
import { csvRows, downloadCsv } from "@/lib/csv";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Users, CalendarCheck, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReports,
  head: () => ({
    meta: [
      { title: "Reports — EduMind AI" },
      { name: "description", content: "Download filtered user, enrollment and module reports from EduMind AI." },
      { property: "og:title", content: "Reports — EduMind AI" },
      { property: "og:description", content: "Download filtered user, enrollment and module reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

function AdminReports() {
  const options = useServerFn(getReportFilterOptions);
  const { data: filters } = useQuery({ queryKey: ["report-filters"], queryFn: () => options() });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary"><FileSpreadsheet className="h-6 w-6" /></div>
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and download filtered CSV reports.</p>
        </div>
      </div>

      <UserReportCard />
      <EnrollmentReportCard qualifications={filters?.qualifications ?? []} />
      <ModuleReportCard qualifications={filters?.qualifications ?? []} lecturers={filters?.lecturers ?? []} />
    </div>
  );
}

function useDownloader<T>(fn: (args: { data: T }) => Promise<any>) {
  const [busy, setBusy] = useState(false);
  const run = async (input: T, build: (d: any) => { name: string; csv: string }) => {
    setBusy(true);
    try {
      const data = await fn({ data: input });
      const { name, csv } = build(data);
      if (!csv) { toast.error("No records matched those filters"); return; }
      downloadCsv(name, csv);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function UserReportCard() {
  const fn = useServerFn(getUserReport);
  const { busy, run } = useDownloader(fn);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "lecturer" | "student" | "none">("all");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User report</CardTitle>
        <CardDescription>Filter accounts by sign-up date range and role.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <div><Label htmlFor="uf">From</Label><Input id="uf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="ut">To</Label><Input id="ut" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="lecturer">Lecturers</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="none">No role</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="gap-2"
          disabled={busy}
          onClick={() =>
            run({ from: from || null, to: to || null, role }, (d) => ({
              name: `edumind-users-${today()}.csv`,
              csv: d.rows.length
                ? csvRows([
                    ["EduMind AI — User report"],
                    ["Generated at", d.generated_at],
                    ["Date from", from || "any", "Date to", to || "any", "Role", role],
                    [],
                    ["Full name", "Email", "Student number", "Roles", "Registered"],
                    ...d.rows.map((r: any) => [r.full_name, r.email, r.student_number, r.roles.join(" / "), new Date(r.created_at).toLocaleString()]),
                  ])
                : "",
            }))
          }
        >
          <Download className="h-4 w-4" /> Download
        </Button>
      </CardContent>
    </Card>
  );
}

function EnrollmentReportCard({ qualifications }: { qualifications: { id: string; code: string; title: string }[] }) {
  const fn = useServerFn(getEnrollmentReport);
  const { busy, run } = useDownloader(fn);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qual, setQual] = useState("all");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Enrollment records</CardTitle>
        <CardDescription>All student enrollments, optionally filtered by date and qualification.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <div><Label htmlFor="ef">From</Label><Input id="ef" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="et">To</Label><Input id="et" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Qualification</Label>
          <Select value={qual} onValueChange={setQual}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All qualifications</SelectItem>
              {qualifications.map((q) => <SelectItem key={q.id} value={q.id}>{q.code} — {q.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="gap-2"
          disabled={busy}
          onClick={() =>
            run({ from: from || null, to: to || null, qualificationId: qual === "all" ? null : qual }, (d) => ({
              name: `edumind-enrollments-${today()}.csv`,
              csv: d.rows.length
                ? csvRows([
                    ["EduMind AI — Enrollment records"],
                    ["Generated at", d.generated_at],
                    [],
                    ["Student number", "Full name", "Email", "Qualification code", "Qualification", "Enrolled at"],
                    ...d.rows.map((r: any) => [r.student_number, r.full_name, r.email, r.qualification_code, r.qualification_title, new Date(r.enrolled_at).toLocaleString()]),
                  ])
                : "",
            }))
          }
        >
          <Download className="h-4 w-4" /> Download
        </Button>
      </CardContent>
    </Card>
  );
}

function ModuleReportCard({
  qualifications,
  lecturers,
}: {
  qualifications: { id: string; code: string; title: string }[];
  lecturers: { id: string; name: string }[];
}) {
  const fn = useServerFn(getModuleReport);
  const { busy, run } = useDownloader(fn);
  const [qual, setQual] = useState("all");
  const [lec, setLec] = useState("all");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Module report</CardTitle>
        <CardDescription>Filter modules by qualification and lecturer.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div>
          <Label>Qualification</Label>
          <Select value={qual} onValueChange={setQual}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All qualifications</SelectItem>
              {qualifications.map((q) => <SelectItem key={q.id} value={q.id}>{q.code} — {q.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Lecturer</Label>
          <Select value={lec} onValueChange={setLec}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lecturers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {lecturers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="gap-2"
          disabled={busy}
          onClick={() =>
            run({ qualificationId: qual === "all" ? null : qual, lecturerId: lec === "all" ? null : lec }, (d) => ({
              name: `edumind-modules-${today()}.csv`,
              csv: d.rows.length
                ? csvRows([
                    ["EduMind AI — Module report"],
                    ["Generated at", d.generated_at],
                    [],
                    ["Code", "Title", "Qualification", "Lecturer", "Lecturer email", "Assessments", "Assignments", "Quizzes/Tests", "Materials"],
                    ...d.rows.map((r: any) => [r.code, r.title, r.qualification, r.lecturer, r.lecturer_email, r.assessments, r.assignments, r.quizzes, r.materials]),
                  ])
                : "",
            }))
          }
        >
          <Download className="h-4 w-4" /> Download
        </Button>
      </CardContent>
    </Card>
  );
}
