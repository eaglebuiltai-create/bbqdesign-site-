"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Deleting a lead is permanent — the row and its notes go, and there is no
 * undo anywhere in this app. So the button asks first, and says what it is
 * about to remove rather than "Are you sure?".
 */
export function DeleteLeadButton({
  leadId,
  label,
  noteCount,
}: {
  leadId: string;
  label: string;
  noteCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete that lead. It may already be gone.");
        setPending(false);
        return;
      }
      router.push("/leads");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-rose-700 hover:underline"
      >
        Delete lead
      </button>
    );
  }

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
      <p className="text-sm text-rose-900">
        Permanently delete <span className="font-semibold">{label}</span>
        {noteCount > 0 && ` and ${noteCount} note${noteCount === 1 ? "" : "s"}`}? This
        cannot be undone.
      </p>
      {error && <p className="mt-2 text-sm font-medium text-rose-800">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
