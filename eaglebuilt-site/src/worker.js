/**
 * EagleBuilt AI — customer confirmation endpoint
 * =============================================================================
 * One job: when someone sends a design, email THEM a copy with their link.
 * The lead itself still goes to info@eaglebuilt.ai via Web3Forms, exactly as it
 * did before — that path is untouched and does not depend on this code.
 *
 * It also proxies /api/leads into the CRM. That proxy exists for one reason:
 * the designer's email gate runs in the browser, so anything it holds is
 * public. The CRM's ingest key lives here as a Cloudflare secret instead, and
 * the gate posts same-origin — no key in the page source, and no CORS.
 *
 * SAFETY: static files are served by Cloudflare's asset layer BEFORE this
 * script runs, so a bug in here cannot take the website down. Only paths with
 * no matching file reach this code — in practice just /api/confirm and
 * /api/leads.
 * =============================================================================
 */

const FROM = "EagleBuilt AI <info@eaglebuilt.ai>";
const ALLOWED = ["https://eaglebuilt.ai", "https://www.eaglebuilt.ai"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/confirm") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
      if (request.method !== "POST")    return cors(json({ ok: false, error: "POST only" }, 405), request);
      return cors(await confirm(request, env), request);
    }

    if (url.pathname === "/api/leads") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
      if (request.method !== "POST")    return cors(json({ ok: false, error: "POST only" }, 405), request);
      return cors(await leads(request, env), request);
    }

    // Anything else with no matching file. Hand back to assets so 404s still
    // look like the site rather than a bare worker error.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  }
};

async function confirm(request, env) {
  /* Trim defensively. Piping the key in from a shell can append CR/LF, which
     silently corrupts the Authorization header and reads as "API key is
     invalid" at Resend's end — a confusing way to lose an hour. */
  const KEY = String(env.RESEND_API_KEY || "").trim();
  if (!KEY) return json({ ok: false, error: "not configured" }, 200);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 200); }

  /* Only ever mail the address the form collected, and only ever the template
     below — nothing from the request becomes free-form email content. */
  const email = String(d.email || "").trim().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, error: "bad email" }, 200);

  const name     = clean(d.name, 80);
  const first    = (name.split(" ")[0] || "there");
  const estimate = clean(d.estimate, 24);
  /* The design link must be one of ours. Stops the endpoint being used to mail
     strangers a link to somewhere else. */
  const link = String(d.design_link || "");
  const linkOk = /^https:\/\/(www\.)?eaglebuilt\.ai\//.test(link);

  /* A rendered view of the island, so the design can be judged from a phone
     without opening anything. Only a JPEG data URL is accepted, and it is size
     capped — this endpoint must never become a way to mail arbitrary files. */
  let shot = null;
  const img = String(d.image || "");
  const m = img.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (m && m[1].length < 3_000_000) shot = m[1];

  const text = [
    `Hi ${first},`,
    ``,
    `Thanks for designing your outdoor kitchen with us. Here is your design —`,
    `this link reopens it exactly as you left it:`,
    ``,
    linkOk ? link : `https://eaglebuilt.ai/design/`,
    ``,
    estimate ? `Estimate: ${estimate}` : ``,
    `Equipment and island construction are quoted separately, so you can see`,
    `what a change actually costs.`,
    ``,
    `What happens next: we review your layout and send back an itemized budget`,
    `proposal — usually within one business day. Final pricing follows a site visit.`,
    ``,
    `If anything changes, reopen the link, adjust it and send it again.`,
    ``,
    `John Simpson`,
    `EagleBuilt AI`,
    `CSLB #992251 — General Contractor & C-29 Masonry`,
    `(949) 564-1948`,
    `info@eaglebuilt.ai`
  ].filter(l => l !== null).join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        /* John gets a copy: it carries the rendered design so a job can be sized
           up at a glance, and it shows exactly what the customer received. */
        bcc: ["info@eaglebuilt.ai"],
        reply_to: "info@eaglebuilt.ai",
        subject: "Your EagleBuilt outdoor kitchen design",
        text,
        ...(shot ? { attachments: [{ filename: "your-design.jpg", content: shot }] } : {})
      })
    });
    /* Always 200 back to the browser. The customer copy is a nicety; a failure
       here must never look like the lead failed, because the lead already sent. */
    if (!r.ok) {
      let detail = "";
      try { detail = (await r.text()).slice(0, 300); } catch {}
      return json({ ok: false, error: "send failed", status: r.status, detail }, 200);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: "send threw" }, 200);
  }
}

/**
 * Forward a gate signup into the CRM (POST {CRM_INGEST_URL} with x-api-key).
 *
 * Both values are Cloudflare secrets, never source:
 *   npx wrangler secret put CRM_INGEST_URL       e.g. https://crm.eaglebuilt.ai/api/leads
 *   npx wrangler secret put CRM_LEADS_API_KEY    same value as LEADS_API_KEY in the CRM env
 *
 * Until they are set this returns "not configured" and does nothing else, so
 * shipping the route ahead of the CRM is harmless.
 */
async function leads(request, env) {
  /* Trimmed for the same reason as the Resend key — a shell-piped secret can
     carry a trailing newline, which would corrupt the header and read as a
     rejected key. */
  const ENDPOINT = String(env.CRM_INGEST_URL || "").trim();
  const KEY      = String(env.CRM_LEADS_API_KEY || "").trim();
  if (!ENDPOINT || !KEY) return json({ ok: false, error: "not configured" }, 200);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 200); }

  const email = String(d.email || "").trim().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, error: "bad email" }, 200);

  /* Only these fields are ever forwarded, each capped. The browser cannot use
     this route to push arbitrary shapes at the CRM. ZIP is optional on the
     gate, so it may legitimately be empty. */
  const body = {
    email,
    zip:    clean(d.zip, 20),
    name:   clean(d.name, 200) || null,
    phone:  clean(d.phone, 40) || null,
    source: clean(d.source, 100) || "designer",
    /* The CRM accepts free text or an object here. Flatten an object to JSON
       ourselves so String() can never turn one into "[object Object]". */
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
    /* Always 200 back to the browser. This is a background capture — the
       visitor is already in the designer, and the full lead still goes out via
       Web3Forms when they send the design. A CRM outage must never surface as
       a broken tool. */
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
