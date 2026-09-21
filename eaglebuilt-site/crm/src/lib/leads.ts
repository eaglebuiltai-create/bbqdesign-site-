import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [byStatus, dueToday, overdue, total] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.count({
      where: {
        nextFollowUp: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["done", "lost"] },
      },
    }),
    prisma.lead.count({
      where: {
        nextFollowUp: { lt: todayStart },
        status: { notIn: ["done", "lost"] },
      },
    }),
    prisma.lead.count(),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) {
    counts[row.status] = row._count._all;
  }

  return { counts, dueToday, overdue, total };
}

export async function listLeads(opts?: { status?: string; q?: string }) {
  const where: {
    status?: string;
    OR?: Array<Record<string, { contains: string; mode?: "insensitive" }>>;
  } = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.q) {
    const q = opts.q.trim();
    /* mode:"insensitive" is required on Postgres — its LIKE is case-sensitive,
       unlike SQLite's. Without it, searching "sarah" would miss "Sarah Chen". */
    const like = { contains: q, mode: "insensitive" as const };
    where.OR = [{ email: like }, { name: like }, { zip: like }, { phone: like }];
  }
  return prisma.lead.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { _count: { select: { notes: true } } },
  });
}
