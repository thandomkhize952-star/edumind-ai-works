import type { ComponentType, ReactNode } from "react";

type Stat = { label: string; value: ReactNode; tone?: "default" | "primary" | "accent" | "warning" | "success" };

const toneClass: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning",
  success: "text-success",
};

export function PageHero({
  icon: Icon,
  title,
  subtitle,
  action,
  stats,
  gradient = "from-primary to-accent",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  stats?: Stat[];
  gradient?: string;
}) {
  return (
    <section className="glass relative overflow-hidden rounded-2xl p-6 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-primary/25`}>
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>

      {stats && stats.length > 0 && (
        <div className="relative mt-6 grid grid-cols-2 divide-x divide-border/60 border-t border-border/60 pt-5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="px-2 text-center">
              <div className={`text-2xl font-bold leading-none ${toneClass[s.tone ?? "default"]}`}>{s.value}</div>
              <div className="mt-1.5 text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
