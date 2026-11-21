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
 * POST /api/chat-lead saves a quote / consultation / callback from that chat.
 * The widget does not post it directly: the model calls submit_lead only after
 * the visitor confirms, and this worker runs the same accept path. Delivery
 * is Slack, email to info@eaglebuilt.ai, and a KV copy, each independent.
 *
 * HOST: www.eaglebuilt.ai 301s to the apex. Static _redirects cannot do a
 * domain redirect, so wrangler sets assets.run_worker_first and this script
 * sees every request. The host check is the first line of fetch(). Anything
 * that is not www falls through to the path checks, the API routes below, or
 * env.ASSETS, which is what serves the files. API paths, the chat, and the
 * ads tags are unchanged.
 *
 * PATH: /blog and /blog/ 301 to https://blog.eaglebuilt.ai/ (WordPress on the
 * blog subdomain). Exact paths only, and only after the www check, so a
 * www request still lands on the apex first.
 * =============================================================================
 */

import { acceptLead, clientIp, commitLead, looksConfirmed, validateLead } from "./chat-lead.js";
import { CHAT_SYSTEM, CHAT_TOOLS } from "./chat-prompt.js";
import { FAILED_REPLY, SAVED_REPLY, visitorReply } from "./chat-honesty.js";
import {
  CONFIG as EAGLE,
  MODEL_SYSTEM,
  applyModelSpec,
  compileSpec,
  interpret,
  layoutSummary,
  publicConfig,
  saveReply,
  validateContact,
  claimsSent
} from "../site/assets/eagle-engine.js";
import {
  guardSpoken,
  mintVoiceToken,
  newVoiceSession,
  readVoiceToken,
  spendVoiceSession
} from "../site/assets/eagle-voice.js";

const FROM = "EagleBuilt AI <info@eaglebuilt.ai>";
const ALLOWED = ["https://eaglebuilt.ai", "https://www.eaglebuilt.ai"];

/* grok-4.7 reasons before it answers and was timing out past this Worker's 25s
   limit (the widget got 502s). The non-reasoning model answers in a few seconds,
   which is what a chat bubble needs. */
const CHAT_MODEL = "grok-4.20-0309-non-reasoning";
const CHAT_MAX_MESSAGES = 10;
const CHAT_MAX_CHARS = 2000;
/* Per-IP request ceilings. CORS only governs browsers - a direct POST from
   curl ignores it - so every endpoint that spends money or writes somewhere
   needs its own cap. /api/confirm mails through Resend and /api/leads writes
   to the CRM, so both are capped alongside chat. Buckets are separate on
   purpose: someone who sends two designs must not lose the chat widget.
   The shared count lives on EAGLE_LIMITS (one Durable Object per address).
   The Map below is only the fallback when that binding is missing. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMITS = {
  chat:    20,   // widget messages
  confirm: 6,    // design copies mailed to the customer
  leads:   12,   // gate signups forwarded to the CRM
  designs: 60,   // saving and reopening designs, which John does in bursts
  eagle:   30,   // Design Eagle layout turns
  eagleSave: 8,  // Design Eagle save: visitor email plus the lead
  eagleSpeak: 24, // spoken replies
  eagleHear: 12,  // server transcription when the browser has no speech API
  eagleMiss: 30   // training notes when a turn does not land
};
const hits = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* Apex is the canonical host. request.url carries it in production.
       The Host header is checked too so a local dev server, which often
       builds request.url from 127.0.0.1, still redirects. 301 for
       navigations, 308 for anything with a body so a POST to www is
       replayed rather than dropped. */
    const hostHeader = (request.headers.get("Host") || "").split(":")[0].toLowerCase();
    if (url.hostname === "www.eaglebuilt.ai" || hostHeader === "www.eaglebuilt.ai") {
      const dest = new URL(url.pathname + url.search, "https://eaglebuilt.ai");
      const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
      return new Response(null, {
        status,
        headers: {
          Location: dest.toString(),
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    /* The blog lives on its own subdomain. Same early return as the host
       redirect above: 301 for navigations, 308 when a body must be replayed.
       Only these two paths, so /api/chat, city pages, and the sitemap fall
       through exactly as before. */
    if (url.pathname === "/blog" || url.pathname === "/blog/") {
      const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
      return new Response(null, {
        status,
        headers: {
          Location: "https://blog.eaglebuilt.ai/",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

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

    /* Saved designs, belonging to the client they were drawn for. Unlike
       /api/leads this is not open: a lead id plus a write would otherwise let
       anyone attach anything to a customer record. */
    if (url.pathname === "/api/designs" || url.pathname.startsWith("/api/designs/")) {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request);
      return cors(await designs(request, env, url), request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST")    return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await chat(request, env), request, true);
    }

    /* Same accept path as the chat tool. The widget does not call this; it
       exists so a lead can be submitted and tested without the model, and so
       the spam checks have one endpoint. */
    if (url.pathname === "/api/chat-lead") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST")    return cors(json({ ok: false, error: "POST only" }, 405), request, true);
      return cors(await chatLeadRequest(request, env), request, true);
    }

    /* Design Eagle. The page can also run the layout engine locally. This
       route is the model path and the only path that sends mail or a lead. */
    if (url.pathname === "/api/design-eagle/config") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "GET") return cors(json({ error: "GET only" }, 405), request, true);
      return cors(json(publicConfig(), 200), request, true);
    }
    if (url.pathname === "/api/design-eagle") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await designEagleTurn(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/save") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ ok: false, error: "POST only" }, 405), request, true);
      return cors(await designEagleSave(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/voice/session") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await voiceSession(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/voice/speak") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await voiceSpeak(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/voice/transcribe") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await voiceTranscribe(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/miss") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "POST") return cors(json({ error: "POST only" }, 405), request, true);
      return cors(await recordMiss(request, env), request, true);
    }
    if (url.pathname === "/api/design-eagle/misses") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), request, true);
      if (request.method !== "GET") return cors(json({ error: "GET only" }, 405), request, true);
      return cors(await listMisses(request, env), request, true);
    }

    // Anything else with no matching file. Hand back to assets so 404s still
    // look like the site rather than a bare worker error.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  }
};

const MISS_TTL = 30 * 24 * 60 * 60;

function stripPII(text) {
  return String(text || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/g, "[phone]")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 500);
}

function contactCard(text) {
  const s = String(text || "");
  return [/\bname\s*:/i, /\bemail\s*:/i, /\bphone\s*:/i].filter(re => re.test(s)).length >= 2;
}

function cleanSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  try {
    const copy = JSON.parse(stripPII(JSON.stringify(spec)));
    delete copy.name;
    delete copy.email;
    delete copy.phone;
    return copy;
  } catch (e) {
    return null;
  }
}

async function recordMiss(request, env) {
  const kv = env && env.EAGLE_MISSES;
  if (!kv || typeof kv.put !== "function") return new Response(null, { status: 204 });
  if (await limited(request, env, "eagleMiss")) {
    return json({ error: "Too many notes." }, 429);
  }
  let body;
  try { body = await request.json(); } catch { return new Response(null, { status: 204 }); }
  if (!body || typeof body !== "object") return new Response(null, { status: 204 });
  if (body.name || body.email || body.phone) return new Response(null, { status: 204 });
  const text = stripPII(body.text);
  const reply = stripPII(body.reply);
  if (!text || contactCard(text) || contactCard(reply)) return new Response(null, { status: 204 });
  const ts = Number(body.ts) || Date.now();
  const kind = String(body.kind || "miss").slice(0, 20);
  const source = body.source === "voice" ? "voice" : "typed";
  const entry = {
    text,
    reply,
    kind,
    specBefore: cleanSpec(body.specBefore),
    specAfter: cleanSpec(body.specAfter),
    source,
    ts
  };
  const key = "miss:" + String(ts).padStart(13, "0") + ":" + Math.random().toString(36).slice(2, 8);
  await kv.put(key, JSON.stringify(entry), { expirationTtl: MISS_TTL });
  let index = [];
  try {
    const raw = await kv.get("miss-index");
    if (raw) index = JSON.parse(raw);
  } catch (e) { index = []; }
  if (!Array.isArray(index)) index = [];
  index.unshift(key);
  await kv.put("miss-index", JSON.stringify(index.slice(0, 500)));
  return new Response(null, { status: 204 });
}

async function listMisses(request, env) {
  const token = String(env && env.MISS_LOG_TOKEN || "");
  const sent = request.headers.get("X-Miss-Token") || "";
  if (!token || sent !== token) return json({ error: "Forbidden." }, 403);
  const kv = env && env.EAGLE_MISSES;
  if (!kv || typeof kv.get !== "function") return json({ misses: [] }, 200);
  const limit = Math.max(1, Math.min(200, Number(new URL(request.url).searchParams.get("limit")) || 200));
  let keys = [];
  try {
    const raw = await kv.get("miss-index");
    if (raw) keys = JSON.parse(raw);
  } catch (e) { keys = []; }
  if (!Array.isArray(keys)) keys = [];
  const misses = [];
  for (const key of keys) {
    if (misses.length >= limit) break;
    if (!String(key).startsWith("miss:")) continue;
    const raw = await kv.get(key);
    if (!raw) continue;
    try { misses.push(JSON.parse(raw)); } catch (e) {}
  }
  return json({ misses }, 200);
}

async function confirm(request, env) {
  /* Trim defensively. Piping the key in from a shell can append CR/LF, which
     silently corrupts the Authorization header and reads as "API key is
     invalid" at Resend's end — a confusing way to lose an hour. */
  const KEY = String(env.RESEND_API_KEY || "").trim();
  if (!KEY) return json({ ok: false, error: "not configured" }, 200);

  /* The design shot is capped at 3MB of base64 below, so a real body cannot
     approach 5MB. Reject the oversized ones before parsing them. */
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 5_000_000) return json({ ok: false, error: "too large" }, 413);

  /* 429 rather than the usual soft 200. The lead itself already went out via
     Web3Forms before this runs, so refusing a customer copy loses nothing -
     and only an abuser ever gets here. */
  if (await limited(request, env, "confirm")) {
    return json({ ok: false, error: "rate limited" }, 429);
  }

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

  /* "continue": a visitor on a phone sending the island to themselves to finish
     on a computer or iPad. They have not asked for a quote yet, so this one
     says how to pick it up rather than what happens next with a quote. */
  const resume = d.kind === "continue";
  const resumeText = [
    `Hi there,`,
    ``,
    `Here is the outdoor kitchen you started on your phone. Open this link on your`,
    `computer or iPad and it picks up exactly where you left off, every piece,`,
    `size and price:`,
    ``,
    linkOk ? link : `https://eaglebuilt.ai/design/`,
    ``,
    estimate ? `Estimate so far: ${estimate}` : ``,
    ``,
    `On a bigger screen you can drag pieces into place, turn it around in 3D, and`,
    `set the finishes and the raised bar. When it looks right, send it to us from`,
    `the designer and we will come back with an itemized budget, usually within`,
    `one business day.`,
    ``,
    `John Simpson`,
    `EagleBuilt AI`,
    `CSLB #992251 — General Contractor & C-29 Masonry`,
    `(916) 359-9692`,
    `info@eaglebuilt.ai`
  ].join("\n");

  const text = resume ? resumeText : [
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
    `(916) 359-9692`,
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
        subject: resume ? "Your outdoor kitchen, ready to finish on a bigger screen"
                        : "Your EagleBuilt outdoor kitchen design",
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
/* ── Saved designs ─────────────────────────────────────────────────────────
   A thin, deliberately boring proxy. It checks the designer key, forwards to
   the CRM with the ingest key, and passes the answer back.

   The key is NOT the CRM's. DESIGNER_KEY is a separate secret John unlocks
   once per device, so that if it ever leaks the blast radius is designs on
   leads somebody already knows the id of — not the CRM itself. The customer
   list is never reachable through here; the designer is opened FROM a client
   in the CRM, so it never needs to ask who the clients are.

     npx wrangler secret put DESIGNER_KEY
*/
async function designs(request, env, url) {
  const ENDPOINT = String(env.CRM_INGEST_URL || "").trim();
  const KEY      = String(env.CRM_LEADS_API_KEY || "").trim();
  const GATE     = String(env.DESIGNER_KEY || "").trim();
  if (!ENDPOINT || !KEY) return json({ ok: false, error: "not configured" }, 503);
  if (!GATE)             return json({ ok: false, error: "designer key not configured" }, 503);

  const given = String(request.headers.get("x-designer-key") || "").trim();
  /* Length-first, then a plain compare. Timing is not a real threat here, but
     a wrong-length key should not read past the end of the short one. */
  if (given.length !== GATE.length || given !== GATE) {
    return json({ ok: false, error: "bad designer key" }, 401);
  }

  if (await limited(request, env, "designs")) return json({ ok: false, error: "rate limited" }, 429);

  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 96_000) return json({ ok: false, error: "too large" }, 413);

  /* CRM_INGEST_URL points at .../api/leads, so swap the tail rather than
     introducing a second secret that could drift out of step with it. */
  const base = ENDPOINT.replace(/\/api\/leads\/?$/, "");
  const target = base + url.pathname + (url.search || "");

  const init = {
    method: request.method,
    headers: { "Content-Type": "application/json", "x-api-key": KEY },
    signal: AbortSignal.timeout(10000)
  };
  if (request.method === "POST" || request.method === "PATCH") init.body = await request.text();

  try {
    const r = await fetch(target, init);
    const text = await r.text();
    /* Pass the CRM's own status through: the designer shows "Lead not found"
       or "too large" verbatim, which is more use than a generic failure. */
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return json({ ok: false, error: "crm unreachable" }, 502);
  }
}

async function leads(request, env) {
  /* Trimmed for the same reason as the Resend key — a shell-piped secret can
     carry a trailing newline, which would corrupt the header and read as a
     rejected key. */
  const ENDPOINT = String(env.CRM_INGEST_URL || "").trim();
  const KEY      = String(env.CRM_LEADS_API_KEY || "").trim();
  if (!ENDPOINT || !KEY) return json({ ok: false, error: "not configured" }, 200);

  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 32_000) return json({ ok: false, error: "too large" }, 413);

  /* Keeps junk out of the CRM. This is a background capture, so a throttled
     caller loses nothing a real visitor would notice. */
  if (await limited(request, env, "leads")) {
    return json({ ok: false, error: "rate limited" }, 429);
  }

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
async function chatLeadRequest(request, env) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 16_000) return json({ ok: false, error: "too large" }, 413);
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const result = await acceptLead(env, d, {
    ip: clientIp(request),
    honeypot: d && d.hp,
    openedAt: d && d.t,
    page: d && d.page
  });
  return json(publicLead(result), result.status);
}

function publicLead(result) {
  if (result.status === 400) {
    return { ok: false, field: result.field || "", message: result.message || "Check the details and try again." };
  }
  if (result.status === 429) {
    return { ok: false, message: result.message || "Too many submissions. Call (916) 359-9692." };
  }
  return { ok: true, leadSubmitted: !!result.leadSubmitted, duplicate: !!result.duplicate };
}

async function designEagleTurn(request, env) {
  if (await limited(request, env, "eagle")) {
    return json({ error: "Too many messages. Call " + EAGLE.phoneDisplay + "." }, 429);
  }
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 32_000) return json({ error: "Message is too long." }, 413);
  let d;
  try { d = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const message = String(d && d.message || "").slice(0, 2000);
  if (!message.trim()) return json({ error: "Send a message." }, 400);
  const current = d && d.spec && typeof d.spec === "object" ? d.spec : null;
  let result = interpret(message, current);
  if (!result.handled) {
    const model = await eagleModel(env, message, current);
    if (model) result = applyModelSpec(model, current);
  }
  let reply = String(result.reply || "");
  if (claimsSent(reply)) {
    reply = "I'll draw the island here. I can't say anything was sent. Call " + EAGLE.phoneDisplay + " if you'd rather talk it through.";
  }
  return json({
    reply,
    kind: result.kind || "draw",
    spec: result.spec || null,
    code: result.code || "",
    link: result.link || "",
    warnings: result.warnings || []
  }, 200);
}

async function eagleModel(env, message, spec) {
  const key = String(env && env.XAI_API_KEY || "").trim();
  if (!key) return null;
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0,
        max_tokens: 700,
        stream: false,
        messages: [
          { role: "system", content: MODEL_SYSTEM },
          { role: "user", content: JSON.stringify({ message, current: spec || null }).slice(0, 6000) }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return null;
    const data = await r.json();
    const messageOut = data && data.choices && data.choices[0] && data.choices[0].message;
    return parseModelJson(chatMessageText(messageOut));
  } catch {
    return null;
  }
}

function parseModelJson(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

async function designEagleSave(request, env) {
  const fail = (extra, status) => json({
    ok: false,
    emailConfirmed: false,
    leadSubmitted: false,
    reply: saveReply({}),
    ...extra
  }, status || 400);

  if (await limited(request, env, "eagleSave")) return fail({}, 429);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 4_000_000) return fail({}, 413);
  let d;
  try { d = await request.json(); } catch { return fail({ message: "bad json" }); }
  if (d && d.hp) {
    return json({ ok: true, emailConfirmed: false, leadSubmitted: false, reply: saveReply({}) }, 200);
  }
  const opened = Number(d && d.t);
  if (Number.isFinite(opened) && opened > 0) {
    const age = Date.now() - opened;
    if (age >= 0 && age < 2000) {
      return json({ ok: true, emailConfirmed: false, leadSubmitted: false, reply: saveReply({}) }, 200);
    }
  }

  const contact = validateContact(d);
  if (!contact.ok) {
    return json({
      ok: false,
      emailConfirmed: false,
      leadSubmitted: false,
      field: contact.field,
      message: contact.message,
      reply: contact.message
    }, 400);
  }

  const built = compileSpec(d.spec);
  if (!built.ok || !built.spec) return fail({ message: built.reply, reply: built.reply });

  const image = jpegPayload(d.image);
  const mailed = await sendVisitorDesign(env, {
    email: contact.contact.email,
    name: contact.contact.name,
    link: built.link,
    image
  });
  const summary = layoutSummary(built.spec);
  const person = contact.contact;
  const stored = await commitLead(env, {
    name: person.name,
    phone: person.phone,
    email: person.email,
    city: person.city,
    zip: person.zip,
    notes: person.notes,
    project: (summary + (person.notes ? ". Notes: " + person.notes : "")).slice(0, 400),
    page: EAGLE.leads.page,
    source: EAGLE.leads.source,
    link: built.link,
    spec: built.spec,
    specSummary: summary,
    subject: "Design Eagle — " + person.name,
    dedupeExtra: built.code.slice(0, 64),
    renderNote: mailed.confirmed && image ? "Picture attached to the visitor email." : "No picture was confirmed.",
    designSummary: [
      "Design Eagle",
      "Link: " + built.link,
      "ZIP: " + (person.zip || ""),
      "City: " + (person.city || ""),
      "Notes: " + (person.notes || ""),
      "Layout: " + summary,
      "Spec: " + JSON.stringify(built.spec)
    ].join("\n").slice(0, 3500)
  });
  const emailConfirmed = !!mailed.confirmed;
  const leadSubmitted = !!(stored && stored.leadSubmitted);
  const teamHasIt = leadSubmitted || !!(stored && stored.duplicate);
  const reply = saveReply({
    emailConfirmed,
    leadSubmitted: teamHasIt,
    email: person.email,
    link: built.link,
    imageAttached: !!(emailConfirmed && image)
  });
  const voiceKey = String(env && env.ELEVENLABS_API_KEY || "").trim();
  const voiceGrant = voiceKey && emailConfirmed ? await mintVoiceToken(voiceKey, {
    exp: Date.now() + 2 * 60 * 1000,
    left: reply.length,
    say: reply
  }) : "";
  return json({
    ok: true,
    emailConfirmed,
    leadSubmitted,
    duplicate: !!(stored && stored.duplicate),
    link: built.link,
    reply,
    voiceGrant
  }, 200);
}

function jpegPayload(image) {
  const m = String(image || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[1].length < 100 || m[1].length >= 3_000_000) return "";
  return m[1];
}

async function sendVisitorDesign(env, payload) {
  const key = String(env && env.RESEND_API_KEY || "").trim();
  if (!key) {
    console.log("design-eagle: RESEND_API_KEY is not set");
    return { confirmed: false };
  }
  const first = String(payload.name || "there").split(" ")[0] || "there";
  const text = [
    "Hi " + first + ",",
    "",
    "Here is the outdoor kitchen you designed with Design Eagle.",
    "This link reopens that same design:",
    "",
    payload.link,
    "",
    "The price on the design comes from the catalog and the island build rates.",
    "It is a budget proposal. Final pricing follows a site visit.",
    "",
    "John Simpson",
    "EagleBuilt AI",
    EAGLE.phoneDisplay,
    "info@eaglebuilt.ai"
  ].join("\n");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: EAGLE.leads.visitorFrom,
        to: [payload.email],
        bcc: [EAGLE.leads.notifyTo],
        reply_to: EAGLE.leads.notifyTo,
        subject: "Your EagleBuilt outdoor kitchen design",
        text,
        ...(payload.image ? { attachments: [{ filename: "your-design.jpg", content: payload.image }] } : {})
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) {
      console.log("design-eagle: resend http " + r.status);
      return { confirmed: false };
    }
    return { confirmed: true };
  } catch (e) {
    console.log("design-eagle: resend threw");
    return { confirmed: false };
  }
}

async function voiceSession(request, env) {
  const key = String(env && env.ELEVENLABS_API_KEY || "").trim();
  if (!key) return json({ speak: false, voice: EAGLE.voice.name }, 200);
  if (await limited(request, env, "eagleSpeak")) {
    return json({ speak: false, capped: true, error: "Voice time is up for this visit. You can keep typing." }, 429);
  }
  const token = await mintVoiceToken(key, newVoiceSession());
  return json({ speak: true, token, voice: EAGLE.voice.name }, 200);
}

async function voiceSpeak(request, env) {
  const key = String(env && env.ELEVENLABS_API_KEY || "").trim();
  if (!key) return json({ speak: false, error: "Voice isn't configured. You can keep typing." }, 503);
  if (await limited(request, env, "eagleSpeak")) {
    return json({ capped: true, error: "Voice time is up for this visit. You can keep typing." }, 429);
  }
  let d;
  try { d = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const session = await readVoiceToken(key, d && d.token);
  /* Address is not part of the check. A phone moves between IPv4 and IPv6
     and between cell and Wi-Fi, and some networks give each connection a
     new egress address. The signature, expiry, and character budget are
     what keep the token honest. limited() above is the shared per-IP cap. */
  if (!session || session.say) {
    return json({ capped: true, error: "Voice session expired. You can keep typing." }, 401);
  }
  const grant = d.grant ? await readVoiceToken(key, d.grant) : null;
  const raw = String(d.text || "");
  const allowedSent = !!(grant && grant.say && grant.say === raw.trim());
  const text = guardSpoken(raw, allowedSent);
  if (!text) return json({ error: "Nothing to say." }, 400);
  let budget = session;
  let next = spendVoiceSession(budget, text.length);
  if (!next && (budget.gen || 0) < EAGLE.voiceLimits.maxRenew) {
    budget = {
      exp: Date.now() + EAGLE.voiceLimits.sessionMs,
      left: EAGLE.voiceLimits.sessionChars,
      gen: (budget.gen || 0) + 1
    };
    next = spendVoiceSession(budget, text.length);
  }
  if (!next) return json({ capped: true, error: "Voice time is up for this visit. You can keep typing." }, 429);
  let audio;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(EAGLE.voice.voiceId), {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({ text, model_id: EAGLE.voice.modelId }),
      signal: AbortSignal.timeout(15000)
    });
    /* A key limited to speech_to_text still returns 200 from transcribe and
       401/403 here. The code is missing_permissions. quota_exceeded and
       voice_not_found fail the same way. The log line is the only place
       that code is kept. */
    if (!r.ok) {
      const upstream = await r.text();
      logEleven("tts", r.status, upstream, key, "model=" + EAGLE.voice.modelId + " voice=" + EAGLE.voice.voiceId);
      return json({ speak: false, error: voiceError("Voice playback", r.status, upstream, key) }, 502);
    }
    audio = await r.arrayBuffer();
  } catch (err) {
    console.log("design-eagle: tts threw " + redact(err && err.message, key));
    return json({ speak: false, error: "Voice playback didn't start. You can keep typing." }, 502);
  }
  const token = await mintVoiceToken(key, next);
  const res = new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voice-Token": token,
      "Access-Control-Expose-Headers": "X-Voice-Token"
    }
  });
  return res;
}

async function voiceTranscribe(request, env) {
  const key = String(env && env.ELEVENLABS_API_KEY || "").trim();
  if (!key) return json({ text: "", error: "Voice isn't configured. You can keep typing." }, 503);
  if (await limited(request, env, "eagleHear")) {
    return json({ text: "", error: "Too many recordings. You can keep typing." }, 429);
  }
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 2_000_000) return json({ text: "", error: "Recording is too long." }, 413);
  let file;
  const type = request.headers.get("Content-Type") || "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("audio");
    } else {
      const buf = await request.arrayBuffer();
      file = new Blob([buf], { type: type || "audio/webm" });
    }
  } catch {
    return json({ text: "", error: "bad audio" }, 400);
  }
  if (!file || typeof file === "string") return json({ text: "", error: "bad audio" }, 400);
  const upload = audioFile(file, type);
  if (!upload.size) return json({ text: "", error: "The recording was empty. You can type it." }, 400);
  /* POST /v1/speech-to-text is multipart. The file field is "file" and the
     current batch model is scribe_v2. scribe_v1 is rejected before any audio
     is read. The part filename has to match the bytes (mp3 stays .mp3). */
  try {
    const body = new FormData();
    body.set("model_id", EAGLE.voice.sttModelId);
    body.set("file", upload, upload.name);
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body,
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) {
      const upstream = await r.text();
      logEleven("scribe", r.status, upstream, key, "model=" + EAGLE.voice.sttModelId + " bytes=" + upload.size + " type=" + upload.type);
      return json({ text: "", error: voiceError("Transcription", r.status, upstream, key) }, 502);
    }
    const data = await r.json();
    return json({ text: String(data.text || "").trim().slice(0, 2000) }, 200);
  } catch (err) {
    console.log("design-eagle: scribe threw " + redact(err && err.message, key));
    return json({ text: "", error: "Transcription didn't start. You can type it." }, 502);
  }
}

async function chat(request, env) {
  const KEY = String(env.XAI_API_KEY || "").trim();
  if (!KEY) {
    return json({ error: "Chat is not configured. Set the XAI_API_KEY Cloudflare secret, then redeploy." }, 503);
  }
  if (await limited(request, env, "chat")) {
    return json({ error: "Too many messages. Try again in a few minutes, or email info@eaglebuilt.ai." }, 429);
  }

  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 32_000) return json({ error: "Message is too long." }, 413);

  let d;
  try { d = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const messages = normalizeChat(d);
  if (!messages.some(m => m.role === "user")) return json({ error: "Send a message." }, 400);

  const meta = {
    ip: clientIp(request),
    honeypot: d && d.hp,
    openedAt: d && d.t,
    page: d && d.page
  };
  const convo = [{ role: "system", content: CHAT_SYSTEM }, ...messages];
  let leadSubmitted = false;
  let duplicate = false;
  let toolsOn = true;

  try {
    let first = await completeChat(KEY, convo, toolsOn);
    if (!first.ok && first.status === 400 && toolsOn) {
      console.log("chat: tools rejected, retrying without tools");
      toolsOn = false;
      first = await completeChat(KEY, convo, false);
    }
    if (!first.ok) return chatDown();

    const calls = toolCalls(first.message);
    const text = visible(chatMessageText(first.message));
    if (!calls.length) {
      if (!text) return chatDown();
      return json({ reply: visitorReply(text, {}), leadSubmitted: false }, 200);
    }

    const outcomes = [];
    for (const call of calls) {
      outcomes.push(await runLeadTool(call, messages, env, meta));
    }
    for (const outcome of outcomes) {
      if (outcome.leadSubmitted) leadSubmitted = true;
      if (outcome.duplicate) duplicate = true;
    }
    const saved = leadSubmitted || duplicate;
    const failed = !saved && outcomes.some(o => o.reason === "failed" || o.reason === "limited" || o.reason === "dropped");
    /* A saved or failed submit is answered here, not by another model call.
       The model has already claimed to have emailed designs it never created. */
    if (saved) return json({ reply: SAVED_REPLY, leadSubmitted, duplicate }, 200);
    if (failed) return json({ reply: FAILED_REPLY, leadSubmitted: false, duplicate: false }, 200);

    convo.push({
      role: "assistant",
      content: text || "",
      tool_calls: calls.map(c => c.raw)
    });
    for (const outcome of outcomes) {
      convo.push({ role: "tool", tool_call_id: outcome.id, content: outcome.toolContent });
    }

    const second = await completeChat(KEY, convo, toolsOn);
    if (second.ok) {
      const again = toolCalls(second.message);
      const reply = visible(chatMessageText(second.message));
      if (again.length && !reply) {
        for (const call of again) {
          const outcome = await runLeadTool(call, messages, env, meta);
          if (outcome.leadSubmitted) leadSubmitted = true;
          if (outcome.duplicate) duplicate = true;
          outcomes.push(outcome);
        }
        const savedAgain = leadSubmitted || duplicate;
        const failedAgain = !savedAgain && outcomes.some(o => o.reason === "failed" || o.reason === "limited" || o.reason === "dropped");
        if (savedAgain) return json({ reply: SAVED_REPLY, leadSubmitted, duplicate }, 200);
        if (failedAgain) return json({ reply: FAILED_REPLY, leadSubmitted: false }, 200);
      } else if (reply) {
        return json({
          reply: visitorReply(reply, { saved: leadSubmitted || duplicate, failed: false }),
          leadSubmitted,
          duplicate
        }, 200);
      }
    } else {
      console.log("chat: follow-up failed " + second.status);
    }

    return json({
      reply: visitorReply(fallbackAfterTool(outcomes), {
        saved: leadSubmitted || duplicate,
        failed: outcomes.some(o => o.reason === "failed" || o.reason === "limited" || o.reason === "dropped")
      }),
      leadSubmitted,
      duplicate
    }, 200);
  } catch {
    return chatDown();
  }
}

function chatDown() {
  return json({ error: "Chat is unavailable right now. Email info@eaglebuilt.ai or call (916) 359-9692." }, 502);
}

async function completeChat(key, messages, tools) {
  const body = {
    model: CHAT_MODEL,
    temperature: 0.4,
    max_tokens: 800,
    stream: false,
    messages
  };
  if (tools) body.tools = CHAT_TOOLS;
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.text()).replace(/\s+/g, " ").slice(0, 160); } catch {}
    console.log("chat: xai http " + r.status + " " + detail);
    return { ok: false, status: r.status };
  }
  const data = await r.json();
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  if (!message) return { ok: false, status: 502 };
  return { ok: true, status: 200, message };
}

function toolCalls(message) {
  const list = message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const out = [];
  for (const call of list) {
    const name = call && call.function && call.function.name;
    if (name !== "submit_lead") continue;
    let args = {};
    try {
      const raw = call.function.arguments;
      args = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
    } catch { args = {}; }
    if (!args || typeof args !== "object") args = {};
    out.push({ id: String(call.id || "call"), args, raw: call });
  }
  return out;
}

async function runLeadTool(call, messages, env, meta) {
  if (!looksConfirmed(messages)) {
    const parsed = validateLead(call.args);
    return {
      id: call.id,
      leadSubmitted: false,
      duplicate: false,
      field: parsed.ok ? "" : parsed.field,
      reason: "unconfirmed",
      parsed,
      toolContent: JSON.stringify({
        ok: false,
        message: "The visitor has not confirmed yet. Repeat the name, phone, email if any, city, and project, and ask if they are correct. Do not call submit_lead in that message."
      })
    };
  }
  const result = await acceptLead(env, call.args, meta);
  if (result.status === 400) {
    return {
      id: call.id,
      leadSubmitted: false,
      duplicate: false,
      field: result.field,
      reason: "invalid",
      toolContent: JSON.stringify({
        ok: false,
        field: result.field,
        message: result.message + " Ask for it in a normal sentence."
      })
    };
  }
  if (result.status === 429) {
    return {
      id: call.id,
      leadSubmitted: false,
      duplicate: false,
      reason: "limited",
      toolContent: JSON.stringify({
        ok: false,
        saved: false,
        message: "Not saved. Tell them it did not go through and give (916) 359-9692. Do not say anything was sent."
      })
    };
  }
  if (result.dropped || (!result.leadSubmitted && !result.duplicate)) {
    return {
      id: call.id,
      leadSubmitted: false,
      duplicate: false,
      reason: result.dropped ? "dropped" : "failed",
      toolContent: JSON.stringify({
        ok: false,
        saved: false,
        message: "Not saved. Tell them it did not go through and give (916) 359-9692. Do not say anything was sent."
      })
    };
  }
  return {
    id: call.id,
    leadSubmitted: !!result.leadSubmitted,
    duplicate: !!result.duplicate,
    reason: result.duplicate ? "duplicate" : "saved",
    toolContent: JSON.stringify({
      ok: true,
      saved: true,
      message: "Saved. Tell them the request went to the EagleBuilt team, who will follow up. Do not give a time. Do not say a design was emailed or that a person is working on it. Offer https://eaglebuilt.ai/design/."
    })
  };
}

function fallbackAfterTool(outcomes) {
  const unconfirmed = outcomes.find(o => o.reason === "unconfirmed" && o.parsed && o.parsed.ok);
  if (unconfirmed) {
    const lead = unconfirmed.parsed.lead;
    const email = lead.email ? ", " + lead.email : "";
    return "I have " + lead.name + ", " + lead.phone + email + ", " + lead.city + ", " + lead.project + ". Is that correct?";
  }
  if (outcomes.some(o => o.leadSubmitted || o.duplicate)) {
    return SAVED_REPLY;
  }
  if (outcomes.some(o => o.reason === "failed" || o.reason === "limited" || o.reason === "dropped")) {
    return FAILED_REPLY;
  }
  const bad = outcomes.find(o => o.field);
  if (bad && bad.field === "phone") return "What phone number should John call?";
  if (bad && bad.field === "name") return "What name should John ask for?";
  if (bad && bad.field === "city") return "Which city is the project in?";
  if (bad && bad.field === "project") return "What are you hoping to build — an outdoor kitchen, a BBQ island, a patio cover?";
  if (bad && bad.field === "email") return "That email doesn't look right. Want to correct it, or skip it?";
  return "You can also call (916) 359-9692 or email info@eaglebuilt.ai.";
}

function visible(text) {
  return String(text || "").replace(/\s+$/g, "").slice(0, 4000);
}

function chatMessageText(message) {
  if (!message) return "";
  const c = message.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c.map(p => (typeof p === "string" ? p : (p && (p.text || p.content)) || "")).join("").trim();
  }
  return "";
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

/* One Durable Object per address, so every isolate shares the count.
   KV is the wrong store here: a key accepts one write per second and reads
   are cached, so a burst of session mints would all see a stale zero.
   Without the binding, the Map below only slows the isolate that handled
   the request. */
let warnedLimits = false;

export class EagleRateLimit {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const bucket = String(url.searchParams.get("bucket") || "default").slice(0, 40);
    const limit = Number(url.searchParams.get("limit") || 20);
    const windowMs = Number(url.searchParams.get("window") || RATE_WINDOW_MS);
    const now = Date.now();
    const key = "b:" + bucket;
    let rec = await this.ctx.storage.get(key);
    if (!rec || typeof rec.n !== "number" || now - rec.start > windowMs) rec = { start: now, n: 0 };
    rec.n += 1;
    await this.ctx.storage.put(key, rec);
    return Response.json({ limited: rec.n > limit, n: rec.n });
  }
}

async function limited(request, env, bucket) {
  const ip = clientIp(request) || "unknown";
  const limit = RATE_LIMITS[bucket] || 20;
  const ns = env && env.EAGLE_LIMITS;
  if (ns && typeof ns.getByName === "function") {
    try {
      const stub = ns.getByName(ip.slice(0, 200));
      const url = "https://limits.internal/?bucket=" + encodeURIComponent(bucket) + "&limit=" + limit + "&window=" + RATE_WINDOW_MS;
      const res = await stub.fetch(url);
      const data = await res.json();
      return !!data.limited;
    } catch (err) {
      console.log("design-eagle: EAGLE_LIMITS failed, using isolate memory");
    }
  } else if (!warnedLimits) {
    warnedLimits = true;
    console.log("design-eagle: EAGLE_LIMITS binding is not set, so the rate limit only applies inside this isolate");
  }
  return memoryLimited(ip, bucket);
}

function memoryLimited(ip, bucket) {
  const now = Date.now();
  const key = bucket + "|" + ip;
  let rec = hits.get(key);
  if (!rec || now - rec.start > RATE_WINDOW_MS) rec = { start: now, n: 0 };
  rec.n += 1;
  hits.set(key, rec);
  /* Clear whole expired entries before falling back to evicting by insert
     order, so a trickle of fresh IPs cannot push out a live counter and hand
     an abuser a clean slate. */
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now - v.start > RATE_WINDOW_MS) hits.delete(k);
    while (hits.size > 5000) hits.delete(hits.keys().next().value);
  }
  return rec.n > (RATE_LIMITS[bucket] || 20);
}

function audioName(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("webm")) return "speech.webm";
  if (t.includes("mpeg") || t.includes("mp3")) return "speech.mp3";
  if (t.includes("wav")) return "speech.wav";
  if (t.includes("ogg") || t.includes("opus")) return "speech.ogg";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "speech.m4a";
  return "speech.webm";
}

function audioFile(file, fallbackType) {
  const mime = (file && file.type) || String(fallbackType || "").split(";")[0] || "audio/webm";
  const given = file && file.name;
  const name = given && /\.[a-z0-9]{2,4}$/i.test(given) ? given : audioName(mime);
  return new File([file], name, { type: mime });
}

function redact(text, key) {
  let s = String(text || "");
  if (key) s = s.split(key).join("[redacted]");
  return s.replace(/xi-[A-Za-z0-9_-]{8,}/g, "[redacted]").slice(0, 500);
}

/* ElevenLabs puts the machine code on detail.status (missing_permissions,
   quota_exceeded, voice_not_found) and the sentence on detail.message. */
function elevenFault(body) {
  let code = "";
  let detail = "";
  try {
    const parsed = JSON.parse(body);
    const msg = parsed.detail != null ? parsed.detail : (parsed.message || parsed.error);
    if (typeof msg === "string") detail = msg;
    else if (Array.isArray(msg) && msg[0]) {
      code = String(msg[0].type || msg[0].code || "");
      detail = String(msg[0].msg || msg[0].message || "");
    } else if (msg && typeof msg === "object") {
      code = String(msg.status || msg.code || msg.type || "");
      detail = String(msg.message || "");
    }
  } catch {
    detail = String(body || "");
  }
  return {
    code: code.replace(/[^a-z0-9_]/gi, "").slice(0, 64),
    detail: detail.replace(/\s+/g, " ").trim()
  };
}

function logEleven(kind, status, body, key, extra) {
  const fault = elevenFault(redact(body, key));
  const bits = ["design-eagle:", kind, String(status), "code=" + (fault.code || "none")];
  if (extra) bits.push(extra);
  if (fault.detail) bits.push("detail=" + redact(fault.detail, key).slice(0, 300));
  console.log(bits.join(" "));
}

function voiceError(what, status, body, key) {
  const fault = elevenFault(redact(body, key));
  const code = fault.code ? " " + fault.code : "";
  const detail = redact(fault.detail, key).slice(0, 160);
  const tail = what === "Transcription" ? " You can type it." : " You can keep typing.";
  if (status === 401 && !fault.code) return "The " + what.toLowerCase() + " key was rejected." + tail;
  if (detail) return what + " was rejected (" + status + code + "): " + detail + tail;
  return what + " was rejected (" + status + code + ")." + tail;
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
