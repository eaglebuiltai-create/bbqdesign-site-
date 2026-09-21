import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadEditForm } from "@/components/LeadEditForm";
import { AddNoteForm } from "@/components/AddNoteForm";
import type { LeadStatusValue } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm font-medium text-blue-800 hover:underline">
          ← Back to leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {lead.name || lead.email}
          </h1>
          <StatusBadge status={lead.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Created {format(lead.createdAt, "MMM d, yyyy h:mm a")} · Updated{" "}
          {format(lead.updatedAt, "MMM d, yyyy h:mm a")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-900">Lead details</h2>
          <LeadEditForm
            lead={{
              id: lead.id,
              email: lead.email,
              zip: lead.zip,
              name: lead.name,
              phone: lead.phone,
              designSummary: lead.designSummary,
              source: lead.source,
              status: lead.status as LeadStatusValue,
              nextFollowUp: lead.nextFollowUp?.toISOString() ?? null,
            }}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Notes</h2>
          <AddNoteForm leadId={lead.id} />
          <ul className="mt-6 space-y-4">
            {lead.notes.length === 0 ? (
              <li className="text-sm text-slate-500">No notes yet.</li>
            ) : (
              lead.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {format(note.createdAt, "MMM d, yyyy h:mm a")}
                    {note.author
                      ? ` · ${note.author.name || note.author.email}`
                      : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
