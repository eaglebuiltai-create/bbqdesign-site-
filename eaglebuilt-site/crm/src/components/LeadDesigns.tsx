"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";

export type DesignEntry = {
  id: string;
  name: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Where the public designer lives. Same origin in production. */
const DESIGNER = "https://eaglebuilt.ai/design/app/";

export function LeadDesigns({
  leadId,
  leadName,
  designs,
}: {
  leadId: string;
  leadName: string;
  designs: DesignEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* The designer is told who the client is; it never gets to ask. That is why
     the customer list is not reachable from a public page. */
  const startUrl =
    DESIGNER + "?lead=" + encodeURIComponent(leadId) + "&client=" + encodeURIComponent(leadName);
  const openUrl = (id: string) => DESIGNER + "?design=" + encodeURIComponent(id);

  async function rename(d: DesignEntry) {
    const name = window.prompt("Name for this design", d.name);
    if (!name || name.trim() === d.name) return;
    setBusy(d.id);
    setError(null);
    try {
      const res = await fetch(`/api/designs/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not rename that");
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not rename that");
    } finally {
      setBusy(null);
    }
  }

  async function remove(d: DesignEntry) {
    /* A sold job's drawing. Worth a sentence before it goes. */
    if (!window.confirm(`Delete "${d.name}"? The drawing for this client goes with it.`)) return;
    setBusy(d.id);
    setError(null);
    try {
      const res = await fetch(`/api/designs/${d.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not delete that");
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not delete that");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <a
        href={startUrl}
        target="_blank"
        rel="noopener"
        className="mb-4 inline-flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-900"
      >
        Design for this client
      </a>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {designs.length === 0 ? (
        <p className="text-sm text-slate-500">
          No designs saved yet. Open the designer from here and it will know whose job it is —
          name the design, then save it back.
        </p>
      ) : (
        <ul className="space-y-3">
          {designs.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3"
            >
              <div className="min-w-0">
                <a
                  href={openUrl(d.id)}
                  target="_blank"
                  rel="noopener"
                  className="text-sm font-semibold text-blue-800 hover:underline"
                >
                  {d.name}
                </a>
                {d.summary && <p className="mt-1 text-xs text-slate-600">{d.summary}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  saved {format(new Date(d.updatedAt), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => rename(d)}
                  disabled={busy === d.id}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  disabled={busy === d.id}
                  className="text-xs font-medium text-rose-600 hover:text-rose-800 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Saving under a name that already exists replaces that design rather than adding a second
        one, so an afternoon of changes stays one row.
      </p>
    </div>
  );
}
