import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getLecturerPerformance, type ModulePerformance } from "@/lib/performance.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportFormatSelect } from "@/components/ExportFormatSelect";
import { downloadReport, type ExportFormat, type ReportDoc } from "@/lib/report-doc";
import { BarChart3, Users, TrendingUp, CalendarCheck, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lecturer/performance")({
  component: PerformancePage,
});

function tone(pct: number | null): "default" | "secondary" | "destructive" {
  if (pct === null) return "secondary";
  if (pct < 50) return "destructive";
  if (pct < 70) return "secondary";
  return "default";
}

function PerformancePage() {
  const fetchPerf = useServerFn(getLecturerPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-performance"],
    queryFn: () => fetchPerf(),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Learner Performance</h1>
          <p className="text-muted-foreground">
            Attendance and average assessment mark for each learner in the modules you teach.
          </p>
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {!isLoading && !data?.length && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            You have no modules assigned yet.
          </CardContent>
        </Card>
      )}

      {data?.map((mod) => (
        <Card key={mod.module_id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>
                  {mod.module_code} — {mod.module_title}
                </CardTitle>
                <CardDescription>{mod.qualification}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" /> {mod.learners.length} learners
                </Badge>
                <Badge variant={tone(mod.module_avg_mark)} className="gap-1">
                  <TrendingUp className="h-3 w-3" /> Avg mark: {mod.module_avg_mark ?? "—"}%
                </Badge>
                <Badge variant={tone(mod.module_avg_attendance)} className="gap-1">
                  <CalendarCheck className="h-3 w-3" /> Avg attendance: {mod.module_avg_attendance ?? "—"}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!mod.learners.length ? (
              <p className="text-sm text-muted-foreground">No learners enrolled yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Learner</TableHead>
                    <TableHead className="min-w-[200px]">Average mark</TableHead>
                    <TableHead className="min-w-[200px]">Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mod.learners.map((l) => (
                    <TableRow key={l.student_id}>
                      <TableCell>
                        <div className="font-medium">{l.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.student_number ? `${l.student_number} · ` : ""}
                          {l.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={tone(l.avg_mark_pct)}>{l.avg_mark_pct ?? "—"}%</Badge>
                          <span className="text-xs text-muted-foreground">{l.graded_count} graded</span>
                        </div>
                        <Progress value={l.avg_mark_pct ?? 0} className="mt-1 h-1.5" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={tone(l.attendance_pct)}>{l.attendance_pct ?? "—"}%</Badge>
                          <span className="text-xs text-muted-foreground">{l.attendance_count} classes</span>
                        </div>
                        <Progress value={l.attendance_pct ?? 0} className="mt-1 h-1.5" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
