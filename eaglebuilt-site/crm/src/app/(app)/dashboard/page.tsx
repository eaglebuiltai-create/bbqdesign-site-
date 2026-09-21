import Link from "next/link";
import { format } from "date-fns";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/leads";
import {
  PIPELINE_ORDER,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const now = new Date();
  const todayStart = startOfDay(now);

  const followUps = await prisma.lead.findMany({
    where: {
      nextFollowUp: { not: null },
      status: { notIn: ["done", "lost"] },
    },
    orderBy: { nextFollowUp: "asc" },
    take: 10,
  });

  const recent = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pipeline overview for EagleBuilt outdoor kitchen leads
          </p>
        </div>
        <Link
          href="/leads/new"
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
        >
          New lead
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats.total} />
        <StatCard label="Due today" value={stats.dueToday} accent="amber" />
        <StatCard label="Overdue follow-ups" value={stats.overdue} accent="rose" />
        <StatCard
          label="Active pipeline"
          value={PIPELINE_ORDER.filter((s) => s !== "done").reduce(
            (n, s) => n + (stats.counts[s] || 0),
            0
          )}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          By status
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_ORDER.map((status) => (
            <Link
              key={status}
              href={`/leads?status=${status}`}
              className={`rounded-lg border bg-white p-4 shadow-sm transition hover:shadow ${STATUS_COLORS[status].split(" ").slice(0, 1).join(" ")} border-slate-200`}
            >
              <div className="text-2xl font-semibold text-slate-900">
                {stats.counts[status] || 0}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-600">
                {STATUS_LABELS[status]}
              </div>
            </Link>
          ))}
        </div>
        {(stats.counts.lost || 0) > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            Lost:{" "}
            <Link href="/leads?status=lost" className="font-medium text-rose-700 underline">
              {stats.counts.lost}
            </Link>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Follow-ups</h2>
          {followUps.length === 0 ? (
            <p className="text-sm text-slate-500">No scheduled follow-ups.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {followUps.map((lead) => {
                const due = lead.nextFollowUp!;
                const overdue = due < todayStart;
                const today =
                  due >= todayStart && due <= endOfDay(now);
                return (
                  <li key={lead.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="truncate font-medium text-slate-900 hover:text-blue-800"
                      >
                        {lead.name || lead.email}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {lead.email} · {lead.zip}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={lead.status} />
                      <span
                        className={`text-xs font-medium ${
                          overdue ? "text-rose-600" : today ? "text-amber-700" : "text-slate-500"
                        }`}
                      >
                        {overdue ? "Overdue · " : today ? "Today · " : ""}
                        {format(due, "MMM d, yyyy")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Recent leads</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No leads yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="truncate font-medium text-slate-900 hover:text-blue-800"
                    >
                      {lead.name || lead.email}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {format(lead.createdAt, "MMM d, yyyy")} · {lead.source}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "rose";
}) {
  const valueColor =
    accent === "amber"
      ? "text-amber-700"
      : accent === "rose"
        ? "text-rose-700"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}
