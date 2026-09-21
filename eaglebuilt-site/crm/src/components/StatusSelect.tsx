"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatusValue } from "@/lib/constants";

export function StatusSelect({
  leadId,
  value,
}: {
  leadId: string;
  value: LeadStatusValue;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(value);
  const [pending, setPending] = useState(false);

  async function onChange(next: LeadStatusValue) {
    const prev = status;
    setStatus(next);
    setPending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(prev);
        alert("Failed to update status");
      } else {
        router.refresh();
      }
    } catch {
      setStatus(prev);
      alert("Failed to update status");
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as LeadStatusValue)}
      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
