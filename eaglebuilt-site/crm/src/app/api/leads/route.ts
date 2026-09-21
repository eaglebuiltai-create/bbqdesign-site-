import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiKey, requireSession } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/constants";

const ingestSchema = z.object({
  email: z.string().email(),
  /* The designer email gate labels ZIP "optional", so ingest must accept a
     lead without one. Requiring it here would 400 every visitor who skipped
     the field and lose the lead silently. Stored as "" when absent. */
  zip: z.string().max(20).optional().nullable(),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  designSummary: z.union([z.string(), z.record(z.unknown())]).optional().nullable(),
  source: z.string().max(100).optional(),
});

const createSchema = z.object({
  email: z.string().email(),
  zip: z.string().min(3).max(20),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  designSummary: z.string().optional().nullable(),
  source: z.string().max(100).optional(),
  status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
  nextFollowUp: z.string().datetime().optional().nullable(),
});

function normalizeDesignSummary(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * POST /api/leads
 * - With x-api-key / Bearer: public ingest from designer site
 * - With session cookie: create lead from CRM UI
 */
export async function POST(req: NextRequest) {
  const apiKeyError = requireApiKey(req);
  const isIngest = apiKeyError === null;

  if (!isIngest) {
    const { error } = await requireSession();
    if (error) {
      const triedKey = req.headers.get("x-api-key") || req.headers.get("authorization");
      if (triedKey) return apiKeyError!;
      return error;
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = isIngest ? ingestSchema.safeParse(body) : createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const designSummary = normalizeDesignSummary(
    "designSummary" in data ? data.designSummary : null
  );

  const lead = await prisma.lead.create({
    data: {
      email: data.email.toLowerCase().trim(),
      zip: (data.zip || "").trim(),
      name: data.name?.trim() || null,
      phone: data.phone?.trim() || null,
      designSummary,
      source: data.source?.trim() || "designer",
      status:
        !isIngest && "status" in data && data.status
          ? (data.status as (typeof LEAD_STATUSES)[number])
          : "new",
      nextFollowUp:
        !isIngest && "nextFollowUp" in data && data.nextFollowUp
          ? new Date(data.nextFollowUp as string)
          : null,
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}

/** GET /api/leads — session only, list leads */
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const q = searchParams.get("q") || undefined;

  const where: Record<string, unknown> = {};
  if (status && LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    where.status = status;
  }
  if (q) {
    /* Case-insensitive explicitly: Postgres LIKE is case-sensitive where
       SQLite's was not. See the same note in lib/leads.ts. */
    const like = { contains: q, mode: "insensitive" as const };
    where.OR = [{ email: like }, { name: like }, { zip: like }, { phone: like }];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { notes: true } } },
  });

  return NextResponse.json({ leads });
}
