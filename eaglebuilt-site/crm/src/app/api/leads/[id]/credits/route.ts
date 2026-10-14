import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

/* A grant is positive, a redemption negative. $100,000 is far past any real
   reward and exists only to stop a slipped decimal point becoming a number
   nobody notices. */
const creditSchema = z.object({
  amount: z
    .number()
    .int("Credits are whole dollars")
    .refine((n) => n !== 0, "Amount cannot be zero")
    .refine((n) => Math.abs(n) <= 100_000, "That is larger than any real reward"),
  reason: z.string().min(1, "Say what it is for").max(200),
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

  const parsed = creditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  /* Spending more than is banked would quietly turn a reward into money owed.
     Summed server-side rather than trusted from the client, because the balance
     the page was rendered with may be minutes stale. */
  const { amount, reason } = parsed.data;
  if (amount < 0) {
    const { _sum } = await prisma.credit.aggregate({
      where: { leadId: params.id },
      _sum: { amount: true },
    });
    const balance = _sum.amount ?? 0;
    if (balance + amount < 0) {
      return NextResponse.json(
        { error: `Only $${balance.toLocaleString()} is banked — that would overdraw it` },
        { status: 400 }
      );
    }
  }

  const credit = await prisma.credit.create({
    data: {
      amount,
      reason: reason.trim(),
      leadId: params.id,
      authorId: (session!.user as { id?: string }).id,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await prisma.lead.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ credit }, { status: 201 });
}
