"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatusValue } from "@/lib/constants";

export default function NewLeadPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    zip: "",
    name: "",
    phone: "",
    designSummary: "",
    source: "designer",
    status: "new" as LeadStatusValue,
    nextFollowUp: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        email: form.email,
        zip: form.zip,
        name: form.name || null,
        phone: form.phone || null,
        designSummary: form.designSummary || null,
        source: form.source || "designer",
        status: form.status,
      };
      if (form.nextFollowUp) {
        payload.nextFollowUp = new Date(form.nextFollowUp + "T12:00:00").toISOString();
      }
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create lead");
        setPending(false);
        return;
      }
      router.push(`/leads/${data.lead.id}`);
      router.refresh();
    } catch {
      setError("Failed to create lead");
      setPending(false);
    }
  }

  const field =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/leads" className="text-sm font-medium text-blue-800 hover:underline">
          ← Back to leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New lead</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Email *</span>
            <input className={field} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">ZIP *</span>
            <input className={field} required value={form.zip} onChange={(e) => set("zip", e.target.value)} />
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
            <span className="mb-1 block font-medium text-slate-700">Name</span>
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Phone</span>
            <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Source</span>
            <input className={field} value={form.source} onChange={(e) => set("source", e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Next follow-up</span>
            <input className={field} type="date" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Design summary</span>
            <textarea className={field} rows={4} value={form.designSummary} onChange={(e) => set("designSummary", e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create lead"}
        </button>
      </form>
    </div>
  );
}
