import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { looksConfirmed, validateLead } from "./chat-lead.js";
import { SERVICE_ZIPS, areaFromZip } from "./service-area.js";
import { CHAT_SYSTEM } from "./chat-prompt.js";
import { claimsUnperformedWork, DESIGNER_URL, FAILED_REPLY, SAVED_REPLY } from "./chat-honesty.js";
import worker from "./worker.js";

let phones = 2000;
function phone() {
  phones += 1;
  return "(916) 555-" + String(phones).padStart(4, "0");
}

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, String(value)); }
  };
}

function savedLeads(kv) {
  return [...kv.store.entries()]
    .filter(([key]) => key.startsWith("lead:"))
    .map(([, value]) => JSON.parse(value));
}

function leadBody(over = {}) {
  return {
    name: "Jane Doe",
    phone: phone(),
    email: "jane@example.com",
    city: "Folsom",
    project: "Outdoor kitchen",
    page: "/",
    t: Date.now() - 20000,
    hp: "",
    ...over
  };
}

async function post(path, body, env, ip) {
  const res = await worker.fetch(new Request("https://eaglebuilt.ai" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://eaglebuilt.ai",
      "CF-Connecting-IP": ip || "198.51.100.10"
    },
    body: JSON.stringify(body)
  }), env || {});
  const data = await res.json();
  return { status: res.status, data };
}

describe("chat leads", { concurrency: 1 }, () => {

test("prompt gives the current phone, the design site, and the blog", () => {
  assert.match(CHAT_SYSTEM, /\(916\) 359-9692/);
  assert.match(CHAT_SYSTEM, /https:\/\/eaglebuilt\.ai\/design\//);
  assert.match(CHAT_SYSTEM, /https:\/\/blog\.eaglebuilt\.ai/);
  assert.match(CHAT_SYSTEM, /Never say you sent, emailed/);
  assert.match(CHAT_SYSTEM, /submit_lead/);
  assert.match(CHAT_SYSTEM, /confirm/i);
  assert.doesNotMatch(CHAT_SYSTEM, /949|751|564-1948|\$\d/);
  assert.match(CHAT_SYSTEM, /Never invent prices, reviews/);
});

test("analytics ids stay on the shared tracker", () => {
  const src = readFileSync(new URL("../site/assets/track.js", import.meta.url), "utf8");
  assert.match(src, /G-1P2Q3CD8TZ/);
  assert.match(src, /AW-18410742850/);
  assert.match(src, /chat_lead:\s+"W4LsCKmL35MdEMLI9spE"/);
});

test("confirmation is a short agreement, not the details themselves", () => {
  assert.equal(looksConfirmed([{ role: "user", content: "Yes, that's right." }]), true);
  assert.equal(looksConfirmed([{ role: "user", content: "Jane Doe, 916-555-0100, Folsom, outdoor kitchen" }]), false);
  assert.equal(looksConfirmed([{ role: "user", content: "Yes, except the city is Roseville" }]), false);
  const parsed = validateLead({ name: "Jane\nDoe", phone: "(916) 555-0199", email: "no", city: "Folsom", project: "BBQ island" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.lead.name, "Jane Doe");
  assert.equal(parsed.lead.email, "");
  assert.equal(validateLead({ name: "Jane", phone: "555", city: "Folsom", project: "Patio cover" }).field, "phone");
});

test("lead endpoint stores, slacks, and emails, and one failure does not stop the other", async () => {
  const kv = memoryKv();
  const mailed = [];
  const slacked = [];
  const env = {
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T00/B00/secret",
    EMAIL: { async send(msg) { mailed.push(msg); return { messageId: "m1" }; } }
  };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    slacked.push(String(url));
    return new Response("nope", { status: 500 });
  };
  try {
    const body = leadBody({ phone: "(916) 555-0181", email: "" });
    const { status, data } = await post("/api/chat-lead", body, env, "198.51.100.21");
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.leadSubmitted, true);
    assert.equal(data.duplicate, false);
    assert.equal(slacked.length, 1);
    assert.equal(mailed.length, 1);
    assert.equal(mailed[0].to, "info@eaglebuilt.ai");
    assert.equal(mailed[0].from.email, "info@eaglebuilt.ai");
    assert.equal(mailed[0].replyTo, undefined);
    assert.match(mailed[0].text, /Jane Doe/);
    assert.match(mailed[0].text, /Outdoor kitchen/);
    assert.doesNotMatch(mailed[0].subject, /[\r\n]/);
    const saved = savedLeads(kv);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].delivery.slack, "failed");
    assert.equal(saved[0].delivery.email, "sent");
    assert.equal(saved[0].delivery.kv, "saved");
    assert.equal(saved[0].email, null);
    assert.equal(saved[0].delivery.crm, "skipped");
  } finally {
    globalThis.fetch = orig;
  }
});

test("email failure still sends Slack", async () => {
  const kv = memoryKv();
  let slackBody = "";
  const env = {
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T00/B00/secret",
    EMAIL: { async send() { throw new Error("destination not verified"); } }
  };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/hooks\.slack\.com\/services\//);
    slackBody = init.body;
    return new Response("ok", { status: 200 });
  };
  try {
    const { status, data } = await post("/api/chat-lead", leadBody({
      name: "<!channel> Ann",
      phone: "(916) 555-0182",
      city: "Roseville",
      project: "Patio cover"
    }), env, "198.51.100.22");
    assert.equal(status, 200);
    assert.equal(data.leadSubmitted, true);
    assert.match(slackBody, /&lt;!channel&gt; Ann/);
    assert.doesNotMatch(slackBody, /<!channel>/);
    const saved = savedLeads(kv)[0];
    assert.equal(saved.delivery.email, "failed");
    assert.equal(saved.delivery.slack, "sent");
  } finally {
    globalThis.fetch = orig;
  }
});

test("missing secret and binding still thanks the visitor and logs the lead", async () => {
  const lines = [];
  const origLog = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const { status, data } = await post("/api/chat-lead", leadBody({
      phone: "(916) 555-0183"
    }), {}, "198.51.100.23");
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.leadSubmitted, false);
    assert.equal("error" in data, false);
    assert.ok(lines.some(line => line.includes("no channel stored this lead")));
    assert.ok(lines.some(line => line.includes("LEAD_SLACK_WEBHOOK_URL is not set")));
    assert.ok(lines.some(line => line.includes("EMAIL binding is not set")));
  } finally {
    console.log = origLog;
  }
});

test("honeypot and a too-fast submit are dropped", async () => {
  const kv = memoryKv();
  let called = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { called += 1; return new Response("ok"); };
  const env = {
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x",
    EMAIL: { async send() { called += 1; } }
  };
  try {
    const honey = await post("/api/chat-lead", leadBody({ hp: "acme bots", phone: "(916) 555-0184" }), env, "198.51.100.24");
    assert.equal(honey.status, 200);
    assert.equal(honey.data.ok, true);
    assert.equal(honey.data.leadSubmitted, false);
    const fast = await post("/api/chat-lead", leadBody({ t: Date.now(), phone: "(916) 555-0185" }), env, "198.51.100.25");
    assert.equal(fast.data.leadSubmitted, false);
    assert.equal(savedLeads(kv).length, 0);
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test("bad details are rejected and the rate limit trips", async () => {
  const env = { CHAT_LEADS: memoryKv() };
  const bad = await post("/api/chat-lead", leadBody({ phone: "123", email: "not-an-email" }), env, "198.51.100.26");
  assert.equal(bad.status, 400);
  assert.equal(bad.data.field, "phone");
  for (let i = 0; i < 6; i++) {
    const res = await post("/api/chat-lead", { name: "x" }, env, "198.51.100.27");
    assert.equal(res.status, 400);
  }
  const limited = await post("/api/chat-lead", leadBody(), env, "198.51.100.27");
  assert.equal(limited.status, 429);
  assert.match(limited.data.message, /\(916\) 359-9692/);
});

test("CRM failure does not block Slack or email, and no email skips CRM", async () => {
  const kv = memoryKv();
  const crm = [];
  const env = {
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x",
    CRM_INGEST_URL: "https://crm.eaglebuilt.ai/api/leads",
    CRM_LEADS_API_KEY: "test-key",
    LEAD_EMAIL_TO: "info@eaglebuilt.ai",
    EMAIL: { async send() { return { messageId: "m" }; } }
  };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("crm.eaglebuilt.ai")) {
      crm.push({ key: init.headers["x-api-key"], body: JSON.parse(init.body) });
      return new Response("no", { status: 503 });
    }
    return new Response("ok", { status: 200 });
  };
  try {
    const withEmail = await post("/api/chat-lead", leadBody({
      phone: "(916) 555-0186",
      email: "jane@example.com"
    }), env, "198.51.100.28");
    assert.equal(withEmail.data.leadSubmitted, true);
    assert.equal(crm.length, 1);
    assert.equal(crm[0].key, "test-key");
    assert.equal(crm[0].body.source, "chat");
    assert.equal(crm[0].body.email, "jane@example.com");
    const saved = savedLeads(kv).at(-1);
    assert.equal(saved.delivery.crm, "failed");
    assert.equal(saved.delivery.slack, "sent");
    assert.equal(saved.delivery.email, "sent");

    crm.length = 0;
    const noEmail = await post("/api/chat-lead", leadBody({
      phone: "(916) 555-0187",
      email: "skip"
    }), env, "198.51.100.29");
    assert.equal(noEmail.data.leadSubmitted, true);
    assert.equal(crm.length, 0);
    assert.equal(savedLeads(kv).at(-1).delivery.crm, "skipped");
  } finally {
    globalThis.fetch = orig;
  }
});

test("a non-Slack webhook is not called", async () => {
  let called = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { called += 1; return new Response("ok"); };
  try {
    const { data } = await post("/api/chat-lead", leadBody({ phone: "(916) 555-0188" }), {
      CHAT_LEADS: memoryKv(),
      LEAD_SLACK_WEBHOOK_URL: "https://example.com/steal",
      EMAIL: { async send() { return { messageId: "m" }; } }
    }, "198.51.100.30");
    assert.equal(data.leadSubmitted, true);
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test("chat submits a lead only after the visitor confirms", async () => {
  const kv = memoryKv();
  const slacked = [];
  const mailed = [];
  const xai = [];
  const env = {
    XAI_API_KEY: "test-key",
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x",
    EMAIL: { async send(msg) { mailed.push(msg); return { messageId: "m" }; } }
  };
  const lead = {
    name: "Jane Doe",
    phone: "(916) 555-0148",
    email: "jane@example.com",
    city: "Folsom",
    project: "Outdoor kitchen"
  };
  const toolMessage = {
    role: "assistant",
    content: "",
    tool_calls: [{
      id: "call_1",
      type: "function",
      function: { name: "submit_lead", arguments: JSON.stringify(lead) }
    }]
  };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("api.x.ai")) {
      const body = JSON.parse(init.body);
      xai.push(body);
      const last = body.messages[body.messages.length - 1];
      let content = "";
      if (last.role === "tool" && String(last.content).includes("has not confirmed")) {
        content = "I have Jane Doe, (916) 555-0148, jane@example.com, Folsom, outdoor kitchen. Is that correct?";
      } else if (last.role === "tool") {
        content = "Thanks, Jane. John has this and will be in touch.";
      }
      const step = content ? { role: "assistant", content } : toolMessage;
      return Response.json({ choices: [{ message: step }] });
    }
    slacked.push(JSON.parse(init.body).text);
    return new Response("ok", { status: 200 });
  };
  try {
    const early = await post("/api/chat", {
      t: Date.now() - 30000,
      page: "/",
      messages: [
        { role: "user", content: "I want a quote for an outdoor kitchen." },
        { role: "assistant", content: "What is your name, phone, and city? Email is optional." },
        { role: "user", content: "Jane Doe, (916) 555-0148, jane@example.com, Folsom, outdoor kitchen." }
      ]
    }, env, "198.51.100.40");
    assert.equal(early.status, 200);
    assert.equal(early.data.leadSubmitted, false);
    assert.match(early.data.reply, /Is that correct/);
    assert.equal(savedLeads(kv).length, 0);
    assert.equal(slacked.length, 0);

    xai.length = 0;
    const done = await post("/api/chat", {
      t: Date.now() - 30000,
      page: "/design/",
      messages: [
        { role: "user", content: "I want a quote for an outdoor kitchen." },
        { role: "assistant", content: "I have Jane Doe, (916) 555-0148, jane@example.com, Folsom, outdoor kitchen. Is that correct?" },
        { role: "user", content: "Yes, that's right." }
      ]
    }, env, "198.51.100.41");
    assert.equal(done.status, 200);
    assert.equal(done.data.leadSubmitted, true);
    assert.equal(done.data.reply, SAVED_REPLY);
    assert.equal(claimsUnperformedWork(done.data.reply), false);
    assert.equal(mailed.length, 1);
    assert.match(mailed[0].text, /jane@example.com/);
    assert.match(mailed[0].text, /\/design\//);
    assert.match(slacked[0], /Folsom/);
    const saved = savedLeads(kv)[0];
    assert.equal(saved.city, "Folsom");
    assert.equal(saved.page, "/design/");
    assert.equal(saved.delivery.slack, "sent");
    assert.equal(saved.delivery.email, "sent");
    const followUp = xai.at(-1);
    assert.equal(followUp.messages[0].content.includes(DESIGNER_URL), true);
    assert.equal(followUp.messages.some(m => m.role === "tool"), false);
  } finally {
    globalThis.fetch = orig;
  }
});

test("a design question does not submit a lead", async () => {
  let slack = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.x.ai")) {
      return Response.json({
        choices: [{ message: { role: "assistant", content: "You can play with a layout at https://bbqdesign.ai." } }]
      });
    }
    slack += 1;
    return new Response("ok");
  };
  try {
    const { status, data } = await post("/api/chat", {
      messages: [{ role: "user", content: "Can I play with a design?" }]
    }, { XAI_API_KEY: "test-key", CHAT_LEADS: memoryKv(), LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x" }, "198.51.100.42");
    assert.equal(status, 200);
    assert.equal(data.leadSubmitted, false);
    assert.match(data.reply, /bbqdesign\.ai/);
    assert.equal(slack, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test("chat still answers when the model rejects tools", async () => {
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    n += 1;
    const body = JSON.parse(init.body);
    if (n === 1) {
      assert.ok(body.tools);
      return new Response("tools unsupported", { status: 400 });
    }
    assert.equal(body.tools, undefined);
    return Response.json({ choices: [{ message: { role: "assistant", content: "Call (916) 359-9692 and we can talk it through." } }] });
  };
  try {
    const { status, data } = await post("/api/chat", {
      messages: [{ role: "user", content: "Are you around?" }]
    }, { XAI_API_KEY: "test-key" }, "198.51.100.43");
    assert.equal(status, 200);
    assert.match(data.reply, /\(916\) 359-9692/);
    assert.equal(data.leadSubmitted, false);
  } finally {
    globalThis.fetch = orig;
  }
});

test("chat without the xAI secret says so", async () => {
  const { status, data } = await post("/api/chat", { message: "Hello" }, {}, "198.51.100.44");
  assert.equal(status, 503);
  assert.match(data.error, /XAI_API_KEY/);
});

test("a second identical lead is not sent twice", async () => {
  const kv = memoryKv();
  let slack = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { slack += 1; return new Response("ok", { status: 200 }); };
  const env = {
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x",
    EMAIL: { async send() { return { messageId: "m" }; } }
  };
  const body = leadBody({ phone: "(916) 555-0190", email: "" });
  try {
    const first = await post("/api/chat-lead", body, env, "198.51.100.45");
    const second = await post("/api/chat-lead", body, env, "198.51.100.45");
    assert.equal(first.data.leadSubmitted, true);
    assert.equal(second.data.duplicate, true);
    assert.equal(second.data.leadSubmitted, false);
    assert.equal(slack, 1);
    assert.equal(savedLeads(kv).length, 1);
  } finally {
    globalThis.fetch = orig;
  }
});

test("a request for an emailed design is not described as sent unless the lead was saved", async () => {
  const lies = [
    "I'll have one of our designers put together that basic L-shaped island and email it today.",
    "I just sent the basic L-shaped island design. Check your inbox in the next few minutes.",
    "Done. The basic L-shaped island has been sent exactly as-is.",
    "Our designer is putting it together now and it should hit your inbox within the next couple of hours."
  ];
  for (const lie of lies) assert.equal(claimsUnperformedWork(lie), true);
  assert.equal(claimsUnperformedWork(SAVED_REPLY), false);
  assert.equal(claimsUnperformedWork(FAILED_REPLY), false);

  const asked = "Can you email me a basic L-shaped island design?";
  const orig = globalThis.fetch;
  let lieIndex = 0;
  globalThis.fetch = async (url) => {
    if (!String(url).includes("api.x.ai")) throw new Error("lead path should not notify");
    const content = lies[lieIndex++] || lies[0];
    return Response.json({ choices: [{ message: { role: "assistant", content } }] });
  };
  try {
    for (let i = 0; i < lies.length; i++) {
      const { status, data } = await post("/api/chat", {
        messages: [{ role: "user", content: asked }]
      }, { XAI_API_KEY: "test-key" }, "198.51.100." + (60 + i));
      assert.equal(status, 200);
      assert.equal(data.leadSubmitted, false);
      assert.equal(claimsUnperformedWork(data.reply), false);
      assert.doesNotMatch(data.reply, /just sent|has been sent|inbox|putting it together|email it today|as-is|couple of hours|few minutes|our designer/i);
      assert.match(data.reply, /name, phone, email, and city/);
      assert.match(data.reply, /eaglebuilt\.ai\/design\//);
    }
  } finally {
    globalThis.fetch = orig;
  }

  const kv = memoryKv();
  const lead = {
    name: "Jane Doe",
    phone: "(916) 555-0161",
    email: "jane@example.com",
    city: "Folsom",
    project: "basic L-shaped island, email the design"
  };
  const lyingTool = {
    role: "assistant",
    content: "I just sent the basic L-shaped island design. Check your inbox in the next few minutes.",
    tool_calls: [{
      id: "call_lie",
      type: "function",
      function: { name: "submit_lead", arguments: JSON.stringify(lead) }
    }]
  };
  const missedLead = {
    name: "Ken Moss",
    phone: "(916) 555-0162",
    email: "ken@example.com",
    city: "Roseville",
    project: "basic L-shaped island, email the design"
  };
  const missedTool = {
    role: "assistant",
    content: "Done. The basic L-shaped island has been sent exactly as-is.",
    tool_calls: [{
      id: "call_miss",
      type: "function",
      function: { name: "submit_lead", arguments: JSON.stringify(missedLead) }
    }]
  };
  let turn = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.x.ai")) {
      turn += 1;
      return Response.json({ choices: [{ message: turn === 1 ? lyingTool : missedTool }] });
    }
    return new Response("no", { status: 500 });
  };
  const env = {
    XAI_API_KEY: "test-key",
    CHAT_LEADS: kv,
    LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x",
    EMAIL: { async send() { return { messageId: "m" }; } }
  };
  const history = [
    { role: "user", content: asked },
    { role: "assistant", content: "I have Jane Doe, (916) 555-0161, jane@example.com, Folsom, basic L-shaped island. Is that correct?" },
    { role: "user", content: "Yes, that's right." }
  ];
  try {
    const saved = await post("/api/chat", { t: Date.now() - 30000, messages: history }, env, "198.51.100.70");
    assert.equal(saved.data.leadSubmitted, true);
    assert.equal(saved.data.reply, SAVED_REPLY);
    assert.equal(claimsUnperformedWork(saved.data.reply), false);
    assert.match(saved.data.reply, /EagleBuilt team/);
    assert.match(saved.data.reply, /eaglebuilt\.ai\/design\//);
    assert.doesNotMatch(saved.data.reply, /inbox|minutes|sent the/i);
    assert.equal(savedLeads(kv)[0].project, lead.project);

    const missed = await post("/api/chat", {
      t: Date.now() - 30000,
      messages: [
        { role: "user", content: asked },
        { role: "assistant", content: "I have Ken Moss, (916) 555-0162, ken@example.com, Roseville, basic L-shaped island. Is that correct?" },
        { role: "user", content: "Yes." }
      ]
    }, {
      XAI_API_KEY: "test-key",
      LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/x"
    }, "198.51.100.71");
    assert.equal(missed.data.leadSubmitted, false);
    assert.equal(missed.data.reply, FAILED_REPLY);
    assert.match(missed.data.reply, /\(916\) 359-9692/);
    assert.equal(claimsUnperformedWork(missed.data.reply), false);
  } finally {
    globalThis.fetch = orig;
  }
});

});

describe("CRM lead area tagging", { concurrency: 1 }, () => {

/* Over ninety per cent of designer signups are outside the 40-mile circle we
   build in, which buried the handful that were not. The worker tags the source
   with the area so the CRM inbox can be read at a glance - see
   src/service-area.js, generated by tools/build-service-area.mjs. */

let ipN = 0;
async function ingest(body) {
  ipN += 1;
  const seen = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("crm.eaglebuilt.ai")) {
      seen.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    }
    return new Response("ok", { status: 200 });
  };
  try {
    /* A fresh address each time: the leads bucket caps at 12 per IP and these
       cases would otherwise share one and start getting 429s. */
    const res = await post("/api/leads", body, {
      CRM_INGEST_URL: "https://crm.eaglebuilt.ai/api/leads",
      CRM_LEADS_API_KEY: "test-key"
    }, "203.0.113." + ipN);
    assert.equal(res.data.ok, true);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(seen.length, 1);
  return seen[0];
}

test("a ZIP inside the circle marks the lead as the service area", async () => {
  const granite = await ingest({ email: "a@example.com", zip: "95746", source: "design-landing" });
  assert.equal(granite.source, "service area / design-landing");
  /* The raw ZIP still goes through untouched - the tag is advisory. */
  assert.equal(granite.zip, "95746");

  const roseville = await ingest({ email: "b@example.com", zip: "95678", source: "design-landing" });
  assert.equal(roseville.source, "service area / design-landing");
});

test("Northern California outside the circle is design only", async () => {
  /* Vacaville is 50 miles out and San Francisco far further, both too far to
     build. We can still draw it for them, so these are leads, not dead ends. */
  const vacaville = await ingest({ email: "c@example.com", zip: "95687", source: "design-landing" });
  assert.equal(vacaville.source, "design only / design-landing");

  const sf = await ingest({ email: "d@example.com", zip: "94110", source: "design-landing" });
  assert.equal(sf.source, "design only / design-landing");
});

test("Southern California and other states are out of area", async () => {
  const sd = await ingest({ email: "e@example.com", zip: "92120", source: "design-landing" });
  assert.equal(sd.source, "out of area / design-landing");

  const fl = await ingest({ email: "f@example.com", zip: "33414", source: "design-landing" });
  assert.equal(fl.source, "out of area / design-landing");
});

test("a ZIP+4 still reads as its five-digit prefix", async () => {
  const plus4 = await ingest({ email: "g@example.com", zip: "95746-1234", source: "design-landing" });
  assert.equal(plus4.source, "service area / design-landing");
});

test("a ZIP we cannot read leaves the source exactly as it came", async () => {
  /* Nothing at all. The gate treats ZIP as optional. */
  const none = await ingest({ email: "h@example.com", zip: "", source: "design-landing" });
  assert.equal(none.source, "design-landing");

  /* A phone number typed into the ZIP field. Ten digits, and its first three
     are Sacramento's area code - exactly the input that must not read as
     local, because the tag decides whether John rings someone. */
  const phoneInZip = await ingest({ email: "i@example.com", zip: "9167518607", source: "design-landing" });
  assert.equal(phoneInZip.source, "design-landing");

  /* A three-digit partial. */
  const partial = await ingest({ email: "j@example.com", zip: "956", source: "design-landing" });
  assert.equal(partial.source, "design-landing");
});

test("a lead with no source still gets tagged", async () => {
  const bare = await ingest({ email: "k@example.com", zip: "95630" });
  assert.equal(bare.source, "service area / designer");
});

test("the area label survives the length cap, the funnel name is what truncates", async () => {
  const long = await ingest({ email: "l@example.com", zip: "33414", source: "x".repeat(100) });
  assert.equal(long.source.length, 100);
  assert.ok(long.source.startsWith("out of area / "));
});

});

describe("service area", { concurrency: 1 }, () => {

test("the circle covers every city the site advertises", () => {
  /* The areaServed list in the schema markup on /design/. If one of these ever
     falls out of the list, the site is promising work we would then refuse. */
  for (const [zip, town] of [
    ["95814", "Sacramento"], ["95678", "Roseville"], ["95677", "Rocklin"],
    ["95630", "Folsom"], ["95746", "Granite Bay"], ["95762", "El Dorado Hills"],
    ["95672", "Rescue"]
  ]) {
    assert.equal(areaFromZip(zip), "build", town + " (" + zip + ") should be inside the circle");
  }
});

test("the two foothill towns added by hand are in", () => {
  /* Their ZIP areas are huge and rural, so the Census centroid sits past 40
     miles while the towns themselves do not. Grass Valley is in at 32 and
     Nevada City is four miles from it. */
  assert.equal(areaFromZip("95959"), "build", "Nevada City");
  assert.equal(areaFromZip("95726"), "build", "Pollock Pines");
  assert.equal(areaFromZip("95945"), "build", "Grass Valley");
});

test("too far to build, near enough to draw", () => {
  for (const [zip, town] of [
    ["95687", "Vacaville"], ["95928", "Chico"], ["96161", "Truckee"],
    ["96150", "South Lake Tahoe"], ["94110", "San Francisco"], ["95404", "Santa Rosa"]
  ]) {
    assert.equal(areaFromZip(zip), "design", town + " (" + zip + ")");
  }
});

test("outside Northern California is the free tool and nothing more", () => {
  for (const [zip, where] of [
    ["90036", "Los Angeles"], ["92120", "San Diego"], ["93730", "Fresno"],
    ["33414", "Florida"], ["75081", "Texas"], ["99516", "Alaska"],
    /* John: "stockton in south". 952 and 953 are the northern San Joaquin
       valley - Stockton, Lodi, Manteca, Tracy, Modesto - and he counts them
       as south rather than Northern California. */
    ["95207", "Stockton"], ["95240", "Lodi"], ["95336", "Manteca"],
    ["95304", "Tracy"], ["95350", "Modesto"]
  ]) {
    assert.equal(areaFromZip(zip), "tool", where + " (" + zip + ")");
  }
});

test("a San Joaquin ZIP inside the circle is still ours to build", () => {
  /* Four 952 ZIPs sit inside the 40 miles. 952 as a band reads "tool" now,
     so this pins the order: the service list is tested before the band, and
     excluding Stockton must never cut off a neighbour we would drive to. */
  for (const [zip, town] of [
    ["95220", "Acampo"], ["95226", "Campo Seco"],
    ["95227", "Clements"], ["95254", "Wallace"]
  ]) {
    assert.ok(SERVICE_ZIPS.has(zip), town + " (" + zip + ") should be in the list");
    assert.equal(areaFromZip(zip), "build", town + " (" + zip + ")");
  }
});

test("an unreadable ZIP claims nothing", () => {
  for (const bad of ["", "956", "9167518607", "abcde", null, undefined, "0000"]) {
    assert.equal(areaFromZip(bad), "unknown", JSON.stringify(bad));
  }
});

test("the designer copy of the list has not drifted from the worker one", () => {
  /* The designer is one self-contained HTML file and cannot import, so it
     carries its own copy. tools/build-service-area.mjs writes both. If someone
     hand-edits either one, this is where it shows up. */
  const html = readFileSync(new URL("../site/design/app/index.html", import.meta.url), "utf8");
  const m = html.match(/SERVICE-AREA:BEGIN[^\n]*\r?\nconst SERVICE_ZIPS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(m, "the SERVICE-AREA block is missing from the designer");
  const inPage = m[1].match(/"(\d{5})"/g).map((s) => s.slice(1, -1));
  assert.deepEqual(inPage, [...SERVICE_ZIPS],
    "the designer and src/service-area.js disagree - rerun tools/build-service-area.mjs");
  assert.equal(inPage.length, 131);
});

});