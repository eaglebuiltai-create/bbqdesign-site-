import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const noteSchema = z.object({
  body: z.string().min(1).max(5000),
});

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const note = await prisma.note.create({
    data: {
      body: parsed.data.body.trim(),
      leadId: params.id,
      authorId: (session!.user as { id?: string }).id,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await prisma.lead.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ note }, { status: 201 });
}
