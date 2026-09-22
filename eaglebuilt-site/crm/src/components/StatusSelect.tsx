"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  type LeadStatusValue,
} from "@/lib/constants";

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

  /* The select carries the status colour itself, so the leads list stays
     scannable without a separate badge stacked above it doubling row height. */
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as LeadStatusValue)}
      className={`rounded-md border px-2 py-1 text-sm font-medium shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${STATUS_COLORS[status]}`}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
