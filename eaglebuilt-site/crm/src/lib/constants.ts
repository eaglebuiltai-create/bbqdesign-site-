export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "sold",
  "building",
  "done",
  "lost",
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatusValue, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  sold: "Sold",
  building: "Building",
  done: "Done",
  lost: "Lost",
};

export const STATUS_COLORS: Record<LeadStatusValue, string> = {
  new: "bg-sky-100 text-sky-800 border-sky-200",
  contacted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  quoted: "bg-amber-100 text-amber-800 border-amber-200",
  sold: "bg-emerald-100 text-emerald-800 border-emerald-200",
  building: "bg-orange-100 text-orange-800 border-orange-200",
  done: "bg-slate-100 text-slate-700 border-slate-200",
  lost: "bg-rose-100 text-rose-800 border-rose-200",
};

export const PIPELINE_ORDER: LeadStatusValue[] = [
  "new",
  "contacted",
  "quoted",
  "sold",
  "building",
  "done",
];
