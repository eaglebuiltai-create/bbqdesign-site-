import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_USER_EMAIL || "john@eaglebuilt.ai").toLowerCase().trim();
  const password = process.env.SEED_USER_PASSWORD || "change-me-on-deploy";
  const name = process.env.SEED_USER_NAME || "John Simpson";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });

  console.log(`Seeded user: ${user.email}`);

  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log(`Leads already present (${existing}); skipping sample leads.`);
    return;
  }

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const samples: Array<{
    email: string;
    zip: string;
    name: string;
    phone?: string;
    designSummary: string;
    status: string;
    nextFollowUp?: Date;
    note?: string;
  }> = [
    {
      email: "sarah.chen@example.com",
      zip: "95746",
      name: "Sarah Chen",
      phone: "(916) 555-0142",
      designSummary: JSON.stringify({
        layout: "L-shaped island",
        appliances: ["grill", "fridge drawer", "sink"],
        finish: "honed granite charcoal",
        approxSqFt: 120,
      }),
      status: "new",
      nextFollowUp: daysFromNow(0),
      note: "Came in via designer email gate. ZIP 95746 (Granite Bay) — local pricing.",
    },
    {
      email: "mike.torres@example.com",
      zip: "95864",
      name: "Mike Torres",
      phone: "(916) 555-0198",
      designSummary:
        "Straight run with pizza oven + outdoor fridge. Prefers natural stone veneer. Budget conversation started.",
      status: "contacted",
      nextFollowUp: daysAgo(2),
      note: "Called; left voicemail. Overdue follow-up — try again mid-morning.",
    },
    {
      email: "jenna.park@example.com",
      zip: "95630",
      name: "Jenna Park",
      phone: "(916) 555-0177",
      designSummary: JSON.stringify({
        layout: "U-shape with bar seating",
        appliances: ["built-in grill", "side burner", "ice maker"],
        finish: "porcelain slab — white marble look",
        notes: "HOA approval pending",
      }),
      status: "quoted",
      nextFollowUp: daysFromNow(3),
      note: "Sent preliminary quote PDF. Waiting on HOA before finalizing.",
    },
  ];

  for (const s of samples) {
    const lead = await prisma.lead.create({
      data: {
        email: s.email,
        zip: s.zip,
        name: s.name,
        phone: s.phone,
        designSummary: s.designSummary,
        source: "designer",
        status: s.status,
        nextFollowUp: s.nextFollowUp,
        notes: s.note
          ? {
              create: {
                body: s.note,
                authorId: user.id,
              },
            }
          : undefined,
      },
    });
    console.log(`Seeded lead: ${lead.email} (${lead.status})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
