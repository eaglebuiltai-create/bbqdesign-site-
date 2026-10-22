import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiKey, requireSession } from "@/lib/api-auth";

/** One saved design: fetch it to reopen, rename it, or delete it. */

type Ctx = { params: { id: string } };

async function authorize(req: NextRequest) {
  const keyError = requireApiKey(req);
  if (!keyError) return { ok: true as const };
  const { error } = await requireSession();
  if (error) return { ok: false as const, error };
  return { ok: true as const };
}

/** GET — the full record, `code` included, because this is the one that reopens it. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.error;

  const design = await prisma.design.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, code: true, summary: true,
      createdAt: true, updatedAt: true,
      lead: { select: { id: true, name: true, email: true } },
    },
  });
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  return NextResponse.json({ design });
}

const renameSchema = z.object({ name: z.string().min(1, "Give the design a name").max(120) });

/** PATCH — rename. The payload is never edited here; the designer owns that. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const exists = await prisma.design.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Design not found" }, { status: 404 });

  const design = await prisma.design.update({
    where: { id: params.id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, summary: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ design });
}

/** DELETE — a sold job's drawing, so this is deliberately session-only. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession();
  if (error) return error;

  const exists = await prisma.design.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Design not found" }, { status: 404 });

  await prisma.design.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
