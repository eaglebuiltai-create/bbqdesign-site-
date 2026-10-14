"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";

export type CreditEntry = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  author: { name: string | null; email: string } | null;
};

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString()}`;

export function RewardCredits({
  leadId,
  credits,
}: {
  leadId: string;
  credits: CreditEntry[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"grant" | "redeem">("grant");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = credits.reduce((a, c) => a + c.amount, 0);
  const granted = credits.filter((c) => c.amount > 0).reduce((a, c) => a + c.amount, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(amount));
    if (!n || !reason.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: mode === "redeem" ? -Math.abs(n) : Math.abs(n), reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save that");
      } else {
        setAmount("");
        setReason("");
        router.refresh();
      }
    } catch {
      setError("Could not save that");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <span
          className={`text-2xl font-semibold ${
            balance > 0 ? "text-emerald-700" : "text-slate-400"
          }`}
        >
          {money(balance)}
        </span>
        <span className="text-xs text-slate-500">
          {balance > 0 ? "available" : "nothing banked"}
          {granted > balance ? ` · ${money(granted)} granted to date` : ""}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("grant")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "grant"
                ? "bg-blue-800 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Bank a credit
          </button>
          <button
            type="button"
            onClick={() => setMode("redeem")}
            disabled={balance <= 0}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
              mode === "redeem"
                ? "bg-blue-800 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Redeem
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-28 rounded-md border border-slate-300 py-2 pl-6 pr-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === "grant" ? "Discount not taken on the grill" : "Applied to the fire pit"
            }
            maxLength={200}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || !Number(amount) || !reason.trim()}
          className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "grant" ? "Bank it" : "Redeem it"}
        </button>
      </form>

      <ul className="mt-6 space-y-3">
        {credits.length === 0 ? (
          <li className="text-sm text-slate-500">
            Nothing yet. Bank a discount they did not take and it is here for the next job.
          </li>
        ) : (
          credits.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{c.reason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {format(new Date(c.createdAt), "MMM d, yyyy")}
                  {c.author ? ` · ${c.author.name || c.author.email}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold ${
                  c.amount > 0 ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {c.amount > 0 ? "+" : ""}
                {money(c.amount)}
              </span>
            </li>
          ))
        )}
      </ul>

      {credits.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          A correction is posted as its own entry rather than edited away, so the trail stays
          readable.
        </p>
      )}
    </div>
  );
}
