import Link from "next/link";
import { format } from "date-fns";
import { listLeads } from "@/lib/leads";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatusValue } from "@/lib/constants";
import { StatusSelect } from "@/components/StatusSelect";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string; q?: string };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const statusParam = searchParams.status;
  const status =
    statusParam && LEAD_STATUSES.includes(statusParam as LeadStatusValue)
      ? (statusParam as string)
      : undefined;
  const q = searchParams.q?.trim() || undefined;
  const leads = await listLeads({ status: status as string | undefined, q });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lead inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {status ? ` · ${STATUS_LABELS[status as LeadStatusValue]}` : ""}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
        >
          New lead
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Search email, name, ZIP…"
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status || ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">ZIP</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">Follow-up</th>
              <th className="hidden px-4 py-3 lg:table-cell">Source</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No leads match.{" "}
                  <Link href="/leads/new" className="text-blue-800 underline">
                    Create one
                  </Link>
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-blue-800">
                      {lead.name || lead.email}
                    </Link>
                    {lead.name && (
                      <div className="text-xs text-slate-500">{lead.email}</div>
                    )}
                    {lead.phone && (
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{lead.zip}</td>
                  <td className="px-4 py-3">
                    <StatusSelect leadId={lead.id} value={lead.status as LeadStatusValue} />
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {lead.nextFollowUp
                      ? format(lead.nextFollowUp, "MMM d, yyyy")
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{lead.source}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {format(lead.updatedAt, "MMM d")}
                    <div className="text-xs">{lead._count.notes} notes</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
