/**
 * Johnny Rock — CRM lead proxy
 * =============================================================================
 * The BBQ island designer posts leads from the browser. The CRM ingest key
 * must not ship in the page, so the gate posts same-origin to /api/leads and
 * this Worker adds the key. Web3Forms is a separate side-channel in the page
 * and does not come through here.
 *
 * Static files are served by Cloudflare's asset layer BEFORE this script
 * runs. Only paths with no matching file reach this code — in practice just
 * /api/leads.
 *
 * Secrets (same pair the EagleBuilt worker uses):
 *   npx wrangler secret put CRM_INGEST_URL
 *   npx wrangler secret put CRM_LEADS_API_KEY
 *
 * Until they are set this returns "not configured" and does nothing else.
 * =============================================================================
 */

const ALLOWED = ["https://johnnyrock.biz", "https://www.johnnyrock.biz"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/leads") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
      if (request.method !== "POST")    return cors(json({ ok: false, error: "POST only" }, 405), request);
      return cors(await leads(request, env), request);
    }

    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  }
};

async function leads(request, env) {
  /* A shell-piped secret can carry a trailing newline, which would corrupt
     the header and read as a rejected key. */
  const ENDPOINT = String(env.CRM_INGEST_URL || "").trim();
  const KEY      = String(env.CRM_LEADS_API_KEY || "").trim();
  if (!ENDPOINT || !KEY) return json({ ok: false, error: "not configured" }, 200);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 200); }

  const email = String(d.email || "").trim().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, error: "bad email" }, 200);

  /* Only these fields are ever forwarded, each capped. Same shape the
     EagleBuilt worker sends on to the CRM. */
  const body = {
    email,
    zip:    clean(d.zip, 20),
    name:   clean(d.name, 200) || null,
    phone:  clean(d.phone, 40) || null,
    source: clean(d.source, 100) || "designer",
    designSummary: (d.designSummary && typeof d.designSummary === "object"
      ? JSON.stringify(d.designSummary)
      : clean(d.designSummary, 2000)) || null
  };

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    /* Always 200 back to the browser. The visitor is already in the designer,
       and the full lead still goes out via Web3Forms. A CRM outage must never
       surface as a broken tool. */
    if (!r.ok) {
      let detail = "";
      try { detail = (await r.text()).slice(0, 300); } catch {}
      return json({ ok: false, error: "crm rejected", status: r.status, detail }, 200);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: "crm unreachable" }, 200);
  }
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, max);
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" }
  });
}
function cors(res, request) {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return res;
}
