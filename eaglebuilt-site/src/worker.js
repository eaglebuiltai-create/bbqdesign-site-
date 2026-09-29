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
 * POST /api/chat answers the site widget. The xAI key is a Cloudflare secret
 * (npx wrangler secret put XAI_API_KEY) and is only used on this server.
 *
 * SAFETY: static files are served by Cloudflare's asset layer BEFORE this
 * script runs, so a bug in here cannot take the website down. Only paths with
 * no matching file reach this code — in practice /api/confirm, /api/leads,
 * and /api/chat.
 * =============================================================================
 */

const FROM = "EagleBuilt AI <info@eaglebuilt.ai>";
const ALLOWED = ["https://eaglebuilt.ai", "https://www.eaglebuilt.ai"];

/* grok-4 is not a current model id (retired; requests were redirected).
   docs.x.ai lists Grok 4.7 as the chat model. */
const CHAT_MODEL = "grok-4.7";
const CHAT_MAX_MESSAGES = 10;
const CHAT_MAX_CHARS = 2000;
const CHAT_WINDOW_MS = 10 * 60 * 1000;
const CHAT_MAX_HITS = 20;
const chatHits = new Map();

const CHAT_SYSTEM = [
  "You are the EagleBuilt AI website chat, speaking as Johnny Rock — founder, former Marine, the person who builds the work. Confident, practical, plain-spoken. No corporate fluff and no emoji.",
  "",
  "Facts you may state:",
  "- EagleBuilt AI is based in Granite Bay and serves Sacramento and the foothills. Design/build general contractor and masonry.",
  "- Free 3D designers live on https://eaglebuilt.ai: outdoor kitchen at /design/, fireplace at /design/fireplace/, fire pit at /design/firepit/, and the yard planner at /design/yard/. They use real grills and real manufacturer cutouts.",
  "- To start a design, open the matching designer on the site. For a quote or a person: email info@eaglebuilt.ai or call 916.751.8607.",
  "- Taglines, when they fit: \"Real Experience. Real Solutions. Real Backyards.\" and \"Built for a Better Tomorrow.\"",
  "",
  "Rules:",
  "- Never invent prices, reviews, star ratings, or timelines. If you are unsure, say so and invite them to start a free design or to email info@eaglebuilt.ai / call 916.751.8607.",
  "- Do not promise a start date, a permit result, or that any number is a firm quote.",
  "- Keep answers to 2–4 sentences unless they ask for more detail.",
  "- Stay on outdoor kitchens, fireplaces, fire pits, yards, the designers, the service area, and how to start. If they wander off, steer back in a sentence.",
  "- You are the site assistant. Do not pretend a person has already reviewed their project."
].join("\n");

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

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST")    return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await chat(request, env), request, true);
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

/**
 * Site chat. The browser posts { messages } or { message }. The xAI key never
 * leaves this worker.
 *
 *   npx wrangler secret put XAI_API_KEY
 *
 * Missing key is a 503, not a silent success — unlike /api/confirm, a chat
 * that cannot answer should say so.
 */
async function chat(request, env) {
  const KEY = String(env.XAI_API_KEY || "").trim();
  if (!KEY) {
    return json({ error: "Chat is not configured. Set the XAI_API_KEY Cloudflare secret, then redeploy." }, 503);
  }
  if (chatLimited(request)) {
    return json({ error: "Too many messages. Try again in a few minutes, or email info@eaglebuilt.ai." }, 429);
  }

  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 32_000) return json({ error: "Message is too long." }, 413);

  let d;
  try { d = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const messages = normalizeChat(d);
  if (!messages.some(m => m.role === "user")) return json({ error: "Send a message." }, 400);

  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.4,
        max_tokens: 800,
        stream: false,
        messages: [{ role: "system", content: CHAT_SYSTEM }, ...messages]
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) {
      return json({ error: "Chat is unavailable right now. Email info@eaglebuilt.ai or call 916.751.8607." }, 502);
    }
    const data = await r.json();
    const reply = chatReplyText(data).slice(0, 4000);
    if (!reply) {
      return json({ error: "Chat is unavailable right now. Email info@eaglebuilt.ai or call 916.751.8607." }, 502);
    }
    return json({ reply }, 200);
  } catch {
    return json({ error: "Chat is unavailable right now. Email info@eaglebuilt.ai or call 916.751.8607." }, 502);
  }
}

function normalizeChat(d) {
  let raw = [];
  if (d && Array.isArray(d.messages)) raw = d.messages;
  else if (d && typeof d.message === "string") raw = [{ role: "user", content: d.message }];

  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : (m.role === "user" ? "user" : "");
    if (!role) continue;
    const content = String(m.content == null ? "" : m.content).replace(/\u0000/g, "").trim().slice(0, CHAT_MAX_CHARS);
    if (!content) continue;
    out.push({ role, content });
  }
  return out.slice(-CHAT_MAX_MESSAGES);
}

function chatReplyText(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  if (!msg) return "";
  const c = msg.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c.map(p => (typeof p === "string" ? p : (p && (p.text || p.content)) || "")).join("").trim();
  }
  return "";
}

/* Best-effort. Worker isolates do not share memory, so this only slows a
   burst against one instance. Enough to stop a stuck tab, not a botnet. */
function chatLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const now = Date.now();
  let rec = chatHits.get(ip);
  if (!rec || now - rec.start > CHAT_WINDOW_MS) rec = { start: now, n: 0 };
  rec.n += 1;
  chatHits.set(ip, rec);
  if (chatHits.size > 5000) {
    const oldest = chatHits.keys().next().value;
    chatHits.delete(oldest);
  }
  return rec.n > CHAT_MAX_HITS;
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, max);
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
function cors(res, request, allowLocal) {
  const origin = request.headers.get("Origin") || "";
  const local = allowLocal && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (ALLOWED.includes(origin) || local) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Vary", "Origin");
  }
  return res;
}
