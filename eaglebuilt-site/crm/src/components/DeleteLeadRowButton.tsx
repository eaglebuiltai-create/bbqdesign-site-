"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Per-row delete for the lead inbox.
 *
 * The inbox is where junk actually gets noticed — smoke tests, a lead you sent
 * yourself, spam — so clearing it should not need a trip into the detail page.
 * Two clicks, because it is permanent and there is no undo: the trash turns
 * into an explicit "Delete?" the second click confirms.
 */
export function DeleteLeadRowButton({ leadId, label }: { leadId: string; label: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }
    } catch {
      /* fall through to re-enable */
    }
    setPending(false);
    setArming(false);
  }

  if (arming) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
        >
          {pending ? "…" : "Delete?"}
        </button>
        <button
          type="button"
          onClick={() => setArming(false)}
          disabled={pending}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArming(true)}
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
    >
      {/* Inline so the icon needs no network request and no library. */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 4h11M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4M12.5 4l-.5 8.5a1.5 1.5 0 0 1-1.5 1.4h-5a1.5 1.5 0 0 1-1.5-1.4L3.5 4M6.5 7v4M9.5 7v4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
