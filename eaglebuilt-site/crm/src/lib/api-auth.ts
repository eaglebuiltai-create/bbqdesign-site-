import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/** Require logged-in session for CRM UI API routes. */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

/** Validate ingest API key from x-api-key or Authorization: Bearer. */
export function requireApiKey(req: Request) {
  const expected = process.env.LEADS_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "LEADS_API_KEY not configured" }, { status: 500 });
  }
  const headerKey = req.headers.get("x-api-key");
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const provided = headerKey || bearer;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return null;
}
