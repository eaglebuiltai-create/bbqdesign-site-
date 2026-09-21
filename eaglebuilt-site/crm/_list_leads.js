const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 12, select: { email: true, zip: true, source: true, createdAt: true } })
  .then((r) => { console.log(JSON.stringify(r, null, 2)); return p.$disconnect(); });
