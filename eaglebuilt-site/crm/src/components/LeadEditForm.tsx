"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatusValue } from "@/lib/constants";

type LeadFields = {
  id: string;
  email: string;
  zip: string;
  name: string | null;
  phone: string | null;
  designSummary: string | null;
  source: string;
  status: LeadStatusValue;
  nextFollowUp: string | null; // ISO or null
};

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function LeadEditForm({ lead }: { lead: LeadFields }) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: lead.email,
    zip: lead.zip,
    name: lead.name ?? "",
    phone: lead.phone ?? "",
    designSummary: lead.designSummary ?? "",
    source: lead.source,
    status: lead.status,
    nextFollowUp: toDateInput(lead.nextFollowUp),
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      let nextFollowUp: string | null = null;
      if (form.nextFollowUp) {
        const d = new Date(form.nextFollowUp + "T12:00:00");
        nextFollowUp = d.toISOString();
      }
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          zip: form.zip,
          name: form.name || null,
          phone: form.phone || null,
          designSummary: form.designSummary || null,
          source: form.source,
          status: form.status,
          nextFollowUp,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Update failed");
      } else {
        setMessage("Saved");
        router.refresh();
      }
    } catch {
      setError("Update failed");
    } finally {
      setPending(false);
    }
  }

  const field =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input className={field} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">ZIP / postal</span>
          <input className={field} required value={form.zip} onChange={(e) => set("zip", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Name</span>
          <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Phone</span>
          <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Status</span>
          <select className={field} value={form.status} onChange={(e) => set("status", e.target.value as LeadStatusValue)}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Next follow-up</span>
          <input className={field} type="date" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Source</span>
          <input className={field} value={form.source} onChange={(e) => set("source", e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Design summary</span>
          <textarea className={field} rows={5} value={form.designSummary} onChange={(e) => set("designSummary", e.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
