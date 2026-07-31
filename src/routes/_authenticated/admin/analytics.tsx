import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Download, Layers, BookOpen, Users, GraduationCap, Brain, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AdminAnalytics,
});

type Analytics = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getAdminAnalytics>>>>;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(data: Analytics): string {
  const lines: string[] = [];
  const row = (arr: unknown[]) => lines.push(arr.map(csvEscape).join(","));

  row(["EduHub Analytics Report"]);
  row(["Generated at", data.generated_at]);
  row([]);

  row(["Summary"]);
  row(["Metric", "Count"]);
  row(["Qualifications (courses)", data.totals.qualifications]);
  row(["Modules", data.totals.modules]);
  row(["Lecturers", data.totals.lecturers]);
  row(["Students (accounts)", data.totals.students]);
  row(["Enrolled students", data.totals.enrolled_students]);
  row(["AI sessions", data.totals.ai_sessions]);
  row([]);

  row(["Qualifications / Courses"]);
  row(["Code", "Title", "Modules", "Enrollments"]);
  data.qualifications.forEach((q) => row([q.code, q.title, q.module_count, q.enrollment_count]));
  row([]);

  row(["Modules"]);
  row(["Code", "Title", "Qualification", "Lecturer"]);
  data.modules.forEach((m) => row([m.code, m.title, m.qualification, m.lecturer]));
  row([]);

  row(["Lecturers"]);
  row(["Full name", "Email"]);
  data.lecturers.forEach((l) => row([l.full_name, l.email]));
  row([]);

  row(["Enrolled learners"]);
  row(["Full name", "Email", "Qualification"]);
  data.enrolledStudents.forEach((s) => row([s.full_name, s.email, s.qualification]));

  return lines.join("\n");
}

function download(data: Analytics) {
  const csv = buildCsv(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eduhub-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AdminAnalytics() {
  const fetchFn = useServerFn(getAdminAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fetchFn() });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stats = [
    { label: "Courses", value: data.totals.qualifications, icon: Layers },
    { label: "Modules", value: data.totals.modules, icon: BookOpen },
    { label: "Lecturers", value: data.totals.lecturers, icon: GraduationCap },
    { label: "Enrolled learners", value: data.totals.enrolled_students, icon: Users },
    { label: "AI sessions", value: data.totals.ai_sessions, icon: Brain },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-2 text-primary"><BarChart3 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Platform overview and downloadable report.</p>
          </div>
        </div>
        <Button onClick={() => download(data)} className="gap-2">
          <Download className="h-4 w-4" /> Download CSV report
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><s.icon className="h-5 w-5" /></div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Courses ({data.qualifications.length})</CardTitle>
          <CardDescription>Qualifications offered on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead className="text-right">Modules</TableHead><TableHead className="text-right">Enrollments</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.qualifications.map((q) => (
                <TableRow key={q.id}><TableCell>{q.code}</TableCell><TableCell>{q.title}</TableCell><TableCell className="text-right">{q.module_count}</TableCell><TableCell className="text-right">{q.enrollment_count}</TableCell></TableRow>
              ))}
              {!data.qualifications.length && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No courses yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Modules ({data.modules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Qualification</TableHead><TableHead>Lecturer</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.modules.map((m) => (
                <TableRow key={m.id}><TableCell>{m.code}</TableCell><TableCell>{m.title}</TableCell><TableCell>{m.qualification}</TableCell><TableCell>{m.lecturer}</TableCell></TableRow>
              ))}
              {!data.modules.length && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No modules yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Lecturers ({data.lecturers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Full name</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.lecturers.map((l) => (
                <TableRow key={l.id}><TableCell>{l.full_name}</TableCell><TableCell>{l.email}</TableCell></TableRow>
              ))}
              {!data.lecturers.length && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">No lecturers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Enrolled learners ({data.enrolledStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Full name</TableHead><TableHead>Email</TableHead><TableHead>Qualification</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.enrolledStudents.map((s) => (
                <TableRow key={s.id}><TableCell>{s.full_name}</TableCell><TableCell>{s.email}</TableCell><TableCell>{s.qualification}</TableCell></TableRow>
              ))}
              {!data.enrolledStudents.length && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No enrolled learners yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> AI Sessions</CardTitle>
          <CardDescription>Total AI tutor conversations across all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{data.totals.ai_sessions}</div>
          <p className="mt-1 text-sm text-muted-foreground">sessions recorded</p>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" /> Report generated {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}
