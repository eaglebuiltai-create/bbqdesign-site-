import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiKey, requireSession } from "@/lib/api-auth";

/**
 * Saved outdoor-kitchen designs, belonging to the client they were drawn for.
 *
 * Two callers, the same pair the lead routes already serve:
 *   x-api-key      the Worker, proxying the public designer
 *   session cookie the CRM UI
 *
 * `code` is the payload a #d= share link carries. It is stored opaque on
 * purpose — the designer owns that format, and a design saved today has to
 * reopen in a later build. A ceiling is set anyway, because an unbounded
 * string from a public page is somebody else's bad afternoon.
 */
const MAX_CODE = 64_000;

const createSchema = z.object({
  leadId: z.string().min(1),
  name: z.string().min(1, "Give the design a name").max(120),
  code: z.string().min(1).max(MAX_CODE, "That design is too large to save"),
  summary: z.string().max(400).optional().nullable(),
});

/** Either credential is enough; the session one also tells us who saved it. */
async function authorize(req: NextRequest) {
  const keyError = requireApiKey(req);
  if (!keyError) return { ok: true as const, authorId: null as string | null };

  const { session, error } = await requireSession();
  if (error) return { ok: false as const, error };
  return { ok: true as const, authorId: (session!.user as { id?: string }).id ?? null };
}

/** GET /api/designs?leadId=... — newest first, without the payloads. */
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.error;

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });

  /* The list is for choosing between designs, so it leaves `code` out: a
     dozen encoded islands is a lot of bytes to send to draw a list of names. */
  const designs = await prisma.design.findMany({
    where: { leadId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, summary: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ designs });
}

/** POST /api/designs — save a design against a client. */
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { leadId, name, code, summary } = parsed.data;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  /* Saving the same name twice is a new version of that design, not a second
     row — somebody tweaking an island all afternoon would otherwise leave
     fifteen identically named rows and no way to tell them apart. */
  const existing = await prisma.design.findFirst({
    where: { leadId, name: name.trim() },
    select: { id: true },
  });

  const design = existing
    ? await prisma.design.update({
        where: { id: existing.id },
        data: { code, summary: summary ?? null, authorId: auth.authorId ?? undefined },
        select: { id: true, name: true, summary: true, createdAt: true, updatedAt: true },
      })
    : await prisma.design.create({
        data: { leadId, name: name.trim(), code, summary: summary ?? null, authorId: auth.authorId },
        select: { id: true, name: true, summary: true, createdAt: true, updatedAt: true },
      });

  /* Surfaces the lead in the CRM's recently-touched ordering, the same way a
     note or a credit does. */
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ design, replaced: !!existing }, { status: existing ? 200 : 201 });
}
