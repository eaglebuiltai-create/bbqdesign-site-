import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/constants";

const updateSchema = z.object({
  email: z.string().email().optional(),
  zip: z.string().min(3).max(20).optional(),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  designSummary: z.string().optional().nullable(),
  source: z.string().max(100).optional(),
  status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
  nextFollowUp: z.string().datetime().optional().nullable().or(z.literal("")),
});

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession();
  if (error) return error;

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nextFollowUp =
    data.nextFollowUp === undefined
      ? undefined
      : data.nextFollowUp === null || data.nextFollowUp === ""
        ? null
        : new Date(data.nextFollowUp);

  try {
    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: {
        ...(data.email !== undefined ? { email: data.email.toLowerCase().trim() } : {}),
        ...(data.zip !== undefined ? { zip: data.zip.trim() } : {}),
        ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.designSummary !== undefined ? { designSummary: data.designSummary } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.status !== undefined
          ? { status: data.status as (typeof LEAD_STATUSES)[number] }
          : {}),
        ...(nextFollowUp !== undefined ? { nextFollowUp } : {}),
      },
    });
    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
