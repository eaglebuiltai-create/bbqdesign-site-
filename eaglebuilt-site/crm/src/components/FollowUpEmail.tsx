"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { followUps, type FollowUpLead } from "@/lib/follow-up";

/**
 * The reply, sitting next to the lead it is for — so the spec, the ZIP and the
 * name are already in it and nothing has to be retyped or copied across.
 *
 * The body stays editable: the templates leave [town] and [day] for a human,
 * and every lead has something worth saying that a template cannot know.
 */
export function FollowUpEmail({ leadId, lead }: { leadId: string; lead: FollowUpLead }) {
  const router = useRouter();
  const options = useMemo(() => followUps(lead), [lead]);
  const [key, setKey] = useState(options[0].key);
  const active = options.find((o) => o.key === key) ?? options[0];

  const [body, setBody] = useState(active.body);
  const [shownFor, setShownFor] = useState(active.key);
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);

  // Switching template replaces the draft, but only on an actual switch — so
  // edits survive a re-render.
  if (shownFor !== active.key) {
    setShownFor(active.key);
    setBody(active.body);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${active.subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function logSent() {
    setLogging(true);
    try {
      await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `Sent follow-up: ${active.label}.` }),
      });
      router.refresh();
    } catch {
      /* Logging is a convenience; a failure here must not lose the draft. */
    } finally {
      setLogging(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Follow-up</h2>
      <p className="mt-1 text-sm text-slate-500">{active.when}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setKey(o.key)}
            className={
              "rounded-full border px-3 py-1 text-sm font-medium " +
              (o.key === active.key
                ? "border-blue-800 bg-blue-800 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-700">
        <span className="font-medium text-slate-500">Subject:</span> {active.subject}
      </p>

      <textarea
        id="followUpBody"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={16}
        spellCheck
        className="mt-2 w-full rounded-md border border-slate-300 p-3 font-mono text-[13px] leading-relaxed text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
        >
          {copied ? "Copied ✓" : "Copy email"}
        </button>
        <button
          type="button"
          onClick={logSent}
          disabled={logging}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {logging ? "Logging…" : "Log as sent"}
        </button>
        {lead.email ? (
          <a
            href={`mailto:${lead.email}?subject=${encodeURIComponent(active.subject)}`}
            className="text-sm font-medium text-blue-800 hover:underline"
          >
            Open in mail
          </a>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Fill in anything in [brackets] before sending — availability and town are
        the only things these cannot know.
      </p>
    </section>
  );
}
