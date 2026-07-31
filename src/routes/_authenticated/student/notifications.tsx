import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyNotifications, markNotificationRead } from "@/lib/at-risk.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const fetchList = useServerFn(getMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => fetchList(),
  });

  const mark = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unread ? `${unread} unread` : "You're all caught up."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Messages from your lecturers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && !data?.length && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
          {data?.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-md border p-4 ${
                n.read_at ? "bg-background" : "bg-accent/30 border-primary/40"
              }`}
            >
              <div
                className={`rounded-md p-2 ${
                  n.kind === "at_risk" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                }`}
              >
                {n.kind === "at_risk" ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {!n.read_at && <Badge variant="secondary">New</Badge>}
                  {n.kind === "at_risk" && <Badge variant="destructive">At risk</Badge>}
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              {!n.read_at && (
                <Button size="sm" variant="ghost" onClick={() => mark.mutate(n.id)}>
                  <Check className="mr-1 h-3 w-3" /> Mark read
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
