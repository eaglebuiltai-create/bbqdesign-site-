/**
 * Chat lead capture, shared by POST /api/chat-lead and the chat tool call.
 *
 * Every accepted lead is delivered independently to:
 *   - CHAT_LEADS (KV) — the durable copy
 *   - LEAD_SLACK_WEBHOOK_URL — Slack incoming webhook
 *   - EMAIL — Cloudflare send_email binding, to info@eaglebuilt.ai
 *     (override the recipient with the LEAD_EMAIL_TO secret only if the
 *     binding's destination_address is that same verified address)
 *   - the existing CRM ingest, when the visitor gave an email and the CRM
 *     secrets are already set
 *
 * One channel failing does not stop the others. A missing secret or binding
 * is logged. The caller still thanks the visitor.
 */

export const LEAD_TO_DEFAULT = "info@eaglebuilt.ai";
export const LEAD_FROM = { email: "info@eaglebuilt.ai", name: "EagleBuilt AI" };

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const MIN_AGE_MS = 4000;
const DEDUPE_MS = 30 * 60 * 1000;
const SKIP_EMAIL = new Set(["", "n/a", "na", "none", "skip", "skipped", "no", "nope", "optional"]);

const hits = new Map();
const recent = new Map();

export function clientIp(request) {
  const cf = request && request.headers && request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const fwd = request && request.headers && request.headers.get("X-Forwarded-For");
  if (fwd) return String(fwd).split(",")[0].trim() || "unknown";
  return "unknown";
}

/**
 * The visitor's last message has to be a short agreement. Details, corrections,
 * and "yes, except…" stay in the conversation until they confirm again.
 */
export function looksConfirmed(messages) {
  if (!Array.isArray(messages)) return false;
  let last = "";
  for (const m of messages) {
    if (m && m.role === "user" && typeof m.content === "string") last = m.content;
  }
  const t = last.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || t.length > 48 || t.split(" ").length > 6) return false;
  if (/[0-9@]/.test(t)) return false;
  if (/\b(except|actually|change|wrong|instead|wait|no|nope)\b/.test(t)) return false;
  return /^(yes|yep|yeah|yup|correct|right|that(?:'| i)?s right|that(?:'| i)?s correct|that is right|that is correct|looks good|sounds good|sounds right|go ahead|confirmed|confirm|ok|okay|sure|send it|do it|submit|please do)\b/.test(t);
}

export function validateLead(input) {
  const src = input && typeof input === "object" ? input : {};
  const name = clean(src.name, 80);
  const phone = clean(src.phone, 40);
  const city = clean(src.city, 80);
  const project = clean(src.project, 400);
  let email = clean(src.email, 254).toLowerCase();
  if (SKIP_EMAIL.has(email)) email = "";

  if (name.length < 2 || !/[a-z]/i.test(name) || /https?:|@/i.test(name)) {
    return { ok: false, field: "name", message: "Need a name." };
  }
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10 || /^(\d)\1{9}$/.test(national)) {
    return { ok: false, field: "phone", message: "Need a phone number with at least 10 digits." };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return { ok: false, field: "email", message: "That email doesn't look valid. Correct it, or skip it." };
  }
  if (city.length < 2 || !/[a-z]/i.test(city)) {
    return { ok: false, field: "city", message: "Need the city the project is in." };
  }
  if (project.length < 3 || (project.match(/https?:/gi) || []).length > 2) {
    return { ok: false, field: "project", message: "Need a short project description, such as an outdoor kitchen, BBQ island, or patio cover." };
  }

  return { ok: true, lead: { name, phone, email, city, project } };
}

/**
 * Validate, then store and notify. status 200 means the visitor should be
 * thanked (including a dropped honeypot, which is indistinguishable on purpose).
 * leadSubmitted is true only when a new lead was actually kept somewhere.
 */
export async function acceptLead(env, input, meta) {
  const ctx = meta || {};
  const ip = String(ctx.ip || "unknown");
  const honeypot = clean(ctx.honeypot, 200);
  if (honeypot) {
    count(ip);
    console.log("chat-lead: honeypot dropped");
    return { ok: true, status: 200, leadSubmitted: false, dropped: "honeypot" };
  }

  const opened = Number(ctx.openedAt);
  if (Number.isFinite(opened) && opened > 0) {
    const age = Date.now() - opened;
    if (age >= 0 && age < MIN_AGE_MS) {
      count(ip);
      console.log("chat-lead: too fast, dropped");
      return { ok: true, status: 200, leadSubmitted: false, dropped: "too-fast" };
    }
  }

  if (count(ip)) {
    return {
      ok: false,
      status: 429,
      leadSubmitted: false,
      message: "Too many submissions. Call (916) 359-9692 or email info@eaglebuilt.ai."
    };
  }

  const parsed = validateLead(input);
  if (!parsed.ok) {
    return { ok: false, status: 400, leadSubmitted: false, field: parsed.field, message: parsed.message };
  }

  const page = cleanPage(ctx.page);
  const lead = { ...parsed.lead, page, source: "chat" };
  return commitLead(env, lead);
}

/**
 * Store a lead that has already been validated and fan it out.
 * Chat leads and Design Eagle leads share this path. Design Eagle passes
 * source, zip, link, spec, and a subject. Missing channels still don't
 * block the others.
 */
export async function commitLead(env, lead) {
  const fp = await fingerprint(lead);
  const now = Date.now();
  const seen = recent.get(fp);
  if (seen && now - seen < DEDUPE_MS) {
    return { ok: true, status: 200, leadSubmitted: false, duplicate: true };
  }

  const kv = env && env.CHAT_LEADS;
  if (kv && typeof kv.get === "function") {
    try {
      const existing = await kv.get("dedupe:" + fp);
      if (existing) {
        recent.set(fp, now);
        return { ok: true, status: 200, leadSubmitted: false, duplicate: true };
      }
    } catch (e) {
      console.log("chat-lead: dedupe read failed " + errText(e));
    }
  }

  recent.set(fp, now);
  prune(recent, now);

  const id = crypto.randomUUID();
  const receivedAt = new Date(now).toISOString();
  const record = {
    id,
    receivedAt,
    name: lead.name,
    phone: lead.phone,
    email: lead.email || null,
    city: lead.city || "",
    project: lead.project || "",
    page: lead.page || null,
    source: lead.source || "chat",
    delivery: { kv: "pending", slack: "pending", email: "pending", crm: "pending" }
  };
  if (lead.zip) record.zip = lead.zip;
  if (lead.notes) record.notes = lead.notes;
  if (lead.link) record.link = lead.link;
  if (lead.spec) record.spec = lead.spec;
  if (lead.specSummary) record.specSummary = lead.specSummary;
  if (lead.renderNote) record.renderNote = lead.renderNote;
  if (lead.subject) record.subject = lead.subject;
  if (lead.designSummary) record.designSummary = lead.designSummary;

  const delivery = { kv: "skipped", slack: "pending", email: "pending", crm: "pending" };
  if (kv && typeof kv.put === "function") {
    try {
      record.delivery = { ...delivery, kv: "saved" };
      await kv.put("lead:" + id, JSON.stringify(record));
      delivery.kv = "saved";
    } catch (e) {
      delivery.kv = "failed";
      console.log("chat-lead: kv put failed " + errText(e));
    }
  } else {
    console.log("chat-lead: CHAT_LEADS binding is not set");
  }

  const [slack, email, crmStatus] = await Promise.all([
    notifySlack(env, record),
    notifyEmail(env, record),
    notifyCrm(env, record)
  ]);
  delivery.slack = slack;
  delivery.email = email;
  delivery.crm = crmStatus;
  record.delivery = delivery;

  if (delivery.kv === "saved") {
    try {
      await kv.put("lead:" + id, JSON.stringify(record));
      await kv.put("dedupe:" + fp, id, { expirationTtl: 86400 });
    } catch (e) {
      console.log("chat-lead: kv update failed " + errText(e));
    }
  }

  const kept = delivery.kv === "saved" || delivery.slack === "sent" || delivery.email === "sent";
  if (!kept) {
    recent.delete(fp);
    console.log("chat-lead: no channel stored this lead " + JSON.stringify(record));
  } else if (delivery.kv !== "saved") {
    console.log("chat-lead: KV copy missing for " + id + " slack=" + slack + " email=" + email);
  } else {
    console.log("chat-lead: saved " + id + " slack=" + slack + " email=" + email + " crm=" + crmStatus);
  }

  return { ok: true, status: 200, leadSubmitted: kept, duplicate: false, delivery, id };
}

export function leadPlain(lead) {
  const intro = lead.source === "design-eagle"
    ? "A visitor saved an island in Design Eagle."
    : "A visitor asked for a quote, consultation, pricing, or a callback in the eaglebuilt.ai chat.";
  const lines = [
    intro,
    "",
    "Name: " + lead.name,
    "Phone: " + lead.phone,
    "Email: " + (lead.email || "(not given)"),
    "City: " + (lead.city || "(not given)"),
    "Project: " + (lead.project || "(not given)"),
    "Page: " + (lead.page || "(not sent)"),
    "Received: " + lead.receivedAt,
    "Lead id: " + lead.id
  ];
  if (lead.zip) lines.push("ZIP: " + lead.zip);
  if (lead.notes) lines.push("Notes: " + lead.notes);
  if (lead.link) lines.push("Design link: " + lead.link);
  if (lead.specSummary) lines.push("Layout: " + lead.specSummary);
  if (lead.renderNote) lines.push("Render: " + lead.renderNote);
  return lines.join("\n");
}

async function notifySlack(env, lead) {
  const url = String(env && env.LEAD_SLACK_WEBHOOK_URL || "").trim();
  if (!url) {
    console.log("chat-lead: LEAD_SLACK_WEBHOOK_URL is not set");
    return "skipped";
  }
  if (!/^https:\/\/hooks\.slack\.com\/(services|triggers)\//.test(url)) {
    console.log("chat-lead: LEAD_SLACK_WEBHOOK_URL is not a Slack incoming webhook");
    return "skipped";
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: slackText(lead) }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) {
      console.log("chat-lead: slack http " + r.status);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.log("chat-lead: slack failed " + errText(e));
    return "failed";
  }
}

async function notifyEmail(env, lead) {
  const binding = env && env.EMAIL;
  if (!binding || typeof binding.send !== "function") {
    console.log("chat-lead: EMAIL binding is not set");
    return "skipped";
  }
  const to = String(env.LEAD_EMAIL_TO || "").trim() || LEAD_TO_DEFAULT;
  const message = {
    to,
    from: LEAD_FROM,
    subject: lead.subject || ("Chat lead — " + lead.name + " (" + lead.city + ")"),
    text: leadPlain(lead)
  };
  if (lead.email) message.replyTo = { email: lead.email, name: lead.name };
  try {
    await binding.send(message);
    return "sent";
  } catch (e) {
    console.log("chat-lead: email failed " + (e && e.code ? e.code + " " : "") + errText(e));
    return "failed";
  }
}

async function notifyCrm(env, lead) {
  if (!lead.email) return "skipped";
  const endpoint = String(env && env.CRM_INGEST_URL || "").trim();
  const key = String(env && env.CRM_LEADS_API_KEY || "").trim();
  if (!endpoint || !key) {
    console.log("chat-lead: CRM ingest is not set, skipped");
    return "skipped";
  }
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        email: lead.email,
        zip: lead.zip || "",
        name: lead.name,
        phone: lead.phone,
        source: lead.source || "chat",
        designSummary: lead.designSummary || ("City: " + lead.city + "\nProject: " + lead.project)
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) {
      console.log("chat-lead: crm http " + r.status);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.log("chat-lead: crm failed " + errText(e));
    return "failed";
  }
}

function slackText(lead) {
  const s = slackSafe;
  return [
    lead.source === "design-eagle" ? "*New Design Eagle lead*" : "*New EagleBuilt chat lead*",
    "Name: " + s(lead.name),
    "Phone: " + s(lead.phone),
    "Email: " + s(lead.email || "(not given)"),
    "City: " + s(lead.city || "(not given)"),
    "Project: " + s(lead.project || "(not given)"),
    "Page: " + s(lead.page || "(not sent)"),
    "Lead id: " + s(lead.id),
    lead.zip ? "ZIP: " + s(lead.zip) : "",
    lead.link ? "Design: " + s(lead.link) : "",
    lead.specSummary ? "Layout: " + s(lead.specSummary) : ""
  ].filter(Boolean).join("\n");
}

function slackSafe(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanPage(value) {
  const s = clean(value, 200);
  if (!s) return "";
  if (!/^\/[A-Za-z0-9/_\-.]*$/.test(s)) return "";
  /* Same two holes the Design Eagle side had: "//evil.example.com" is a
     protocol-relative URL that passes for a path by starting with a slash,
     and ".." walks. Neither is dangerous where this lands today, both are
     wrong the day someone renders it as a link. See originPath. */
  if (s.startsWith("//") || s.includes("..")) return "";
  return s;
}

function count(ip) {
  const now = Date.now();
  let rec = hits.get(ip);
  if (!rec || now - rec.start > RATE_WINDOW_MS) rec = { start: now, n: 0 };
  rec.n += 1;
  hits.set(ip, rec);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now - v.start > RATE_WINDOW_MS) hits.delete(k);
    while (hits.size > 5000) hits.delete(hits.keys().next().value);
  }
  return rec.n > RATE_LIMIT;
}

function prune(map, now) {
  if (map.size <= 2000) return;
  for (const [k, t] of map) if (now - t > DEDUPE_MS) map.delete(k);
  while (map.size > 2000) map.delete(map.keys().next().value);
}

async function fingerprint(lead) {
  const raw = [lead.phone.replace(/\D/g, ""), lead.name.toLowerCase(), String(lead.project || "").toLowerCase(), lead.dedupeExtra || ""].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

function errText(e) {
  return String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 180);
}
