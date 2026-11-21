import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { commitLead } from "./chat-lead.js";
import worker from "./worker.js";
import {
  CONFIG,
  applyModelSpec,
  claimsSent,
  decodeDesign,
  interpret,
  saveReply,
  validateContact
} from "../site/assets/eagle-engine.js";

const PHRASES = [
  ["L-shape, 10 ft grill leg with side burner and fridge, 5 ft bar with 3 stools", {
    shape: "ell",
    legs: [
      { role: "grill", lengthIn: 120, items: ["grill", "side-burner", "fridge"] },
      { role: "bar", lengthIn: 60, stools: 3 }
    ],
    keys: ["BLZ-4LTE3", "BLZ-SB2-LTEPLUS", "BLZ-SSRF20-4.3", "corner24"]
  }],
  ["straight 8 foot island with a grill and a fridge", {
    shape: "straight",
    legs: [{ role: "main", lengthIn: 96, items: ["grill", "fridge"] }],
    keys: ["BLZ-4LTE3", "BLZ-SSRF20-4.3"]
  }],
  ["U shaped kitchen, 12 ft main with grill and sink, 6 ft each side", {
    shape: "yu",
    legs: [
      { role: "grill", lengthIn: 144, items: ["grill", "sink"] },
      { role: "left", lengthIn: 72 },
      { role: "right", lengthIn: 72 }
    ],
    keys: ["BLZ-4LTE3", "BLZ-30CKT-SNK"]
  }],
  ["I want an L, grill side about 9 feet with a fridge, and a 4 foot bar", {
    shape: "ell",
    legs: [
      { role: "grill", lengthIn: 108, items: ["grill", "fridge"] },
      { role: "bar", lengthIn: 48 }
    ]
  }],
  ["Make me a straight run, 10 feet, blaze grill, side burner, refrigerator", {
    shape: "straight",
    legs: [{ role: "main", lengthIn: 120, items: ["grill", "side-burner", "fridge"] }]
  }],
  ["corner kitchen, grill side 10 ft, bar side 5 ft with three stools", {
    shape: "ell",
    legs: [
      { role: "grill", lengthIn: 120, items: ["grill"] },
      { role: "bar", lengthIn: 60, stools: 3 }
    ]
  }],
  ["simple 6 ft island with a sink and a small grill", {
    shape: "straight",
    legs: [{ role: "main", lengthIn: 72, items: ["sink", "grill"] }]
  }],
  ["U-shape, 14 ft back with a grill and a double side burner, 5 ft left with a fridge, 5 ft right with a sink", {
    shape: "yu",
    legs: [
      { role: "grill", lengthIn: 168, items: ["grill", "side-burner"] },
      { role: "left", lengthIn: 60, items: ["fridge"] },
      { role: "right", lengthIn: 60, items: ["sink"] }
    ]
  }],
  ["L shape 8ft by 8ft with a power burner and a cooler", {
    shape: "ell",
    legs: [
      { role: "grill", lengthIn: 96, items: ["power", "fridge"] },
      { role: "bar", lengthIn: 96 }
    ],
    keys: ["BLZ-PBLTE3", "BLZ-SSRF20-4.3", "corner24"]
  }],
  ["straight island 12 feet, 40 inch grill, double side burner, and a fridge", {
    shape: "straight",
    legs: [{ role: "main", lengthIn: 144, items: ["grill-40", "side-burner", "fridge"] }],
    keys: ["BLZ-5LTE3", "BLZ-SB2-LTEPLUS"]
  }]
];

function drawn(text, current) {
  const result = interpret(text, current || null);
  assert.equal(result.spec == null, false, text + " -> " + result.reply);
  assert.equal(claimsSent(result.reply), false, result.reply);
  assert.doesNotMatch(result.reply, /\$\d/);
  return result;
}

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, String(value)); }
  };
}

async function post(path, body, env, ip) {
  const res = await worker.fetch(new Request("https://eaglebuilt.ai" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://eaglebuilt.ai",
      "CF-Connecting-IP": ip || "203.0.113.10"
    },
    body: JSON.stringify(body)
  }), env || {});
  const data = await res.json();
  return { status: res.status, data };
}

describe("design eagle layout", () => {
  for (const [phrase, expect] of PHRASES) {
    test(phrase, () => {
      const result = drawn(phrase);
      assert.equal(result.spec.shape, expect.shape);
      expect.legs.forEach((leg, i) => {
        const got = result.spec.legs[i];
        assert.equal(got.role, leg.role);
        assert.equal(got.lengthIn, leg.lengthIn);
        if (leg.items) assert.deepEqual(got.items, leg.items);
        if (leg.stools) assert.equal(got.stools, leg.stools);
      });
      if (expect.keys) {
        const keys = decodeDesign(result.code).m.map(row => row[0]);
        for (const key of expect.keys) assert.ok(keys.includes(key), key);
      }
      assert.match(result.link, /^https:\/\/eaglebuilt\.ai\/design-eagle\/#d=/);
    });
  }

  test("an island with no size asks instead of guessing", () => {
    const result = interpret("Give me an outdoor kitchen", null);
    assert.equal(result.spec, null);
    assert.match(result.reply, /straight|L|U/);
    assert.equal(claimsSent(result.reply), false);
  });

  test("an L with one length asks for the other leg", () => {
    const result = interpret("ten foot L with a griddle and a sink on the short leg", null);
    assert.equal(result.spec, null);
    assert.match(result.reply, /other leg/i);
  });

  test("refinements change the same design", () => {
    let result = drawn("L-shape, 10 ft grill leg with side burner and fridge, 5 ft bar with 3 stools");
    result = drawn("make the bar longer", result.spec);
    assert.equal(result.spec.legs[1].lengthIn, 84);
    assert.equal(result.spec.legs[0].items.includes("grill"), true);
    result = drawn("add a sink", result.spec);
    assert.equal(result.spec.legs[1].items.includes("sink"), true);
    result = drawn("swap to stone veneer", result.spec);
    assert.equal(result.spec.finish, "stack");
    assert.equal(decodeDesign(result.code).f, "stack");
    assert.match(result.reply, /ledgestone/i);
  });

  test("lengths clamp and a TV is left off", () => {
    const short = drawn("straight 2 ft island with a grill");
    assert.equal(short.spec.legs[0].lengthIn, 48);
    assert.match(short.reply, /4 ft/);
    const long = drawn("straight 40 foot island with a grill");
    assert.equal(long.spec.legs[0].lengthIn, 240);
    assert.match(long.reply, /20 ft/);
    const tv = drawn("straight 8 ft island with a grill and a television");
    assert.deepEqual(tv.spec.legs[0].items, ["grill"]);
    assert.match(tv.reply, /TV isn't in the catalog/);
  });

  test("a model payload cannot invent a price, a piece, or a send", () => {
    const result = applyModelSpec({
      action: "spec",
      say: "I just emailed you the design for $12,345.",
      spec: {
        shape: "straight",
        price: 12345,
        legs: [{ role: "main", lengthFt: 100, items: ["grill", "gold-plated grill"] }]
      }
    }, null);
    assert.equal(result.spec.legs[0].lengthIn, 240);
    assert.deepEqual(result.spec.legs[0].items, ["grill"]);
    assert.equal(claimsSent(result.reply), false);
    assert.doesNotMatch(result.reply, /\$\d|emailed|12,345/);
    const question = applyModelSpec({ action: "clarify", question: "I emailed you the L-shape." }, null);
    assert.equal(claimsSent(question.reply), false);
    assert.match(question.reply, /\(916\) 359-9692/);
  });
});

describe("design eagle contact and honesty", () => {
  test("name, email, and phone are required; ZIP, city, and notes are not", () => {
    const ok = validateContact({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "(916) 555-0133"
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.contact.zip, "");
    assert.equal(ok.contact.city, "");
    assert.equal(ok.contact.notes, "");
    assert.equal(validateContact({ email: "jane@example.com", phone: "9165550133" }).field, "name");
    assert.equal(validateContact({ name: "Jane", phone: "9165550133" }).field, "email");
    assert.equal(validateContact({ name: "Jane", email: "jane@example.com", phone: "555" }).field, "phone");
    assert.equal(validateContact({ name: "Jane", email: "nope", phone: "9165550133" }).field, "email");
    const extra = validateContact({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "9165550133",
      zip: "95630",
      city: "Folsom",
      notes: "Gate faces the pool"
    });
    assert.equal(extra.ok, true);
    assert.equal(extra.contact.zip, "95630");
    assert.equal(validateContact({
      name: "Jane", email: "jane@example.com", phone: "9165550133", zip: "nope"
    }).field, "zip");
  });

  test("sent is only said after the email provider confirms", () => {
    const failed = saveReply({ emailConfirmed: false, leadSubmitted: false, link: "https://eaglebuilt.ai/design-eagle/#d=abc" });
    const held = saveReply({ emailConfirmed: false, leadSubmitted: true, link: "https://eaglebuilt.ai/design-eagle/#d=abc" });
    const sent = saveReply({
      emailConfirmed: true,
      leadSubmitted: true,
      email: "jane@example.com",
      link: "https://eaglebuilt.ai/design-eagle/#d=abc",
      imageAttached: true
    });
    assert.match(failed, /\(916\) 359-9692/);
    assert.equal(claimsSent(failed), false);
    assert.doesNotMatch(failed, /^Sent\b/);
    assert.match(held, /\(916\) 359-9692/);
    assert.equal(claimsSent(held), false);
    assert.match(held, /did not go through/);
    assert.match(sent, /^Sent\./);
    assert.match(sent, /jane@example.com/);
    assert.match(sent, /picture/i);
  });

  test("the page fires a lead event only after a confirmed save", () => {
    const src = readFileSync(new URL("../site/assets/design-eagle.js", import.meta.url), "utf8");
    assert.match(src, /data\.leadSubmitted && window\.ebTrack/);
    assert.match(src, /design_lead/);
    assert.equal(src.includes("designer_open"), false);
    const track = readFileSync(new URL("../site/assets/track.js", import.meta.url), "utf8");
    assert.match(track, /G-1P2Q3CD8TZ/);
    assert.match(track, /AW-18410742850/);
  });

  test("brand, phone, and colors live in one config", () => {
    assert.equal(CONFIG.product, "Design Eagle");
    assert.equal(CONFIG.phoneDisplay, "(916) 359-9692");
    assert.equal(CONFIG.booking.enabled, false);
    assert.equal(CONFIG.booking.url, "");
    assert.equal(CONFIG.leads.source, "design-eagle");
    const css = readFileSync(new URL("../site/assets/design-eagle.css", import.meta.url), "utf8");
    const page = readFileSync(new URL("../site/design-eagle/index.html", import.meta.url), "utf8");
    assert.match(css, new RegExp(CONFIG.colors.bg));
    assert.match(css, new RegExp(CONFIG.colors.accent));
    assert.match(page, /916\) 359-9692/);
    assert.match(page, /track\.js/);
    assert.match(page, /name="name"/);
    assert.match(page, /name="email"/);
    assert.match(page, /name="phone"/);
  });
});

describe("design eagle save", () => {
  test("missing phone is rejected before any send", async () => {
    let called = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async () => { called += 1; return new Response("ok"); };
    try {
      const { status, data } = await post("/api/design-eagle/save", {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "555",
        t: Date.now() - 20000,
        spec: drawn("straight 8 foot island with a grill and a fridge").spec
      }, { RESEND_API_KEY: "re_test", CHAT_LEADS: memoryKv() }, "203.0.113.21");
      assert.equal(status, 400);
      assert.equal(data.field, "phone");
      assert.equal(data.emailConfirmed, false);
      assert.equal(data.leadSubmitted, false);
      assert.equal(called, 0);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("the visitor email is sent only when Resend confirms, and the lead still saves if it does not", async () => {
    const kv = memoryKv();
    const env = {
      CHAT_LEADS: kv,
      RESEND_API_KEY: "re_test",
      LEAD_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T00/B00/secret",
      EMAIL: { async send() { return { messageId: "lead-mail" }; } }
    };
    const spec = drawn("L-shape, 10 ft grill leg with side burner and fridge, 5 ft bar with 3 stools").spec;
    const body = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "(916) 555-0144",
      zip: "95630",
      notes: "Gate faces the pool",
      t: Date.now() - 20000,
      spec
    };
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("api.resend.com")) return new Response("no", { status: 500 });
      return new Response("ok", { status: 200 });
    };
    try {
      const failed = await post("/api/design-eagle/save", body, env, "203.0.113.22");
      assert.equal(failed.status, 200);
      assert.equal(failed.data.emailConfirmed, false);
      assert.equal(failed.data.leadSubmitted, true);
      assert.equal(claimsSent(failed.data.reply), false);
      assert.match(failed.data.reply, /\(916\) 359-9692/);
      assert.doesNotMatch(failed.data.reply, /^Sent\b/);
      const saved = [...kv.store.entries()]
        .filter(([key]) => key.startsWith("lead:"))
        .map(([, value]) => JSON.parse(value))
        .find(row => row.name === "Jane Doe");
      assert.equal(saved.source, "design-eagle");
      assert.equal(saved.zip, "95630");
      assert.equal(saved.spec.shape, "ell");
      assert.match(saved.link, /design-eagle\/#d=/);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("a confirmed Resend response is the only path that says sent", async () => {
    const kv = memoryKv();
    let resendBody = "";
    const env = {
      CHAT_LEADS: kv,
      RESEND_API_KEY: "re_test",
      EMAIL: { async send() { return { messageId: "m" }; } }
    };
    const spec = drawn("straight 8 foot island with a grill and a fridge").spec;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /api\.resend\.com/);
      resendBody = init.body;
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    };
    try {
      const { status, data } = await post("/api/design-eagle/save", {
        name: "Sam Lee",
        email: "sam@example.com",
        phone: "9165550177",
        t: Date.now() - 20000,
        image: "data:image/jpeg;base64," + "A".repeat(120),
        spec
      }, env, "203.0.113.23");
      assert.equal(status, 200);
      assert.equal(data.emailConfirmed, true);
      assert.equal(data.leadSubmitted, true);
      assert.match(data.reply, /^Sent\./);
      assert.match(data.reply, /sam@example.com/);
      const mailed = JSON.parse(resendBody);
      assert.equal(mailed.to[0], "sam@example.com");
      assert.equal(mailed.bcc[0], "info@eaglebuilt.ai");
      assert.equal(mailed.attachments[0].filename, "your-design.jpg");
      assert.match(mailed.text, /design-eagle\/#d=/);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("nothing stored and no provider confirmation offers the phone", async () => {
    const spec = drawn("straight 8 foot island with a grill").spec;
    const { data } = await post("/api/design-eagle/save", {
      name: "Pat Kim",
      email: "pat@example.com",
      phone: "9165550188",
      t: Date.now() - 20000,
      spec
    }, {}, "203.0.113.24");
    assert.equal(data.emailConfirmed, false);
    assert.equal(data.leadSubmitted, false);
    assert.equal(data.reply, "That didn't go through. Call (916) 359-9692.");
  });

  test("commitLead keeps a design eagle record on the shared path", async () => {
    const kv = memoryKv();
    const result = await commitLead({
      CHAT_LEADS: kv,
      EMAIL: { async send() { return { messageId: "m" }; } }
    }, {
      name: "Ada",
      phone: "9165550199",
      email: "ada@example.com",
      city: "",
      project: "L-shape",
      source: "design-eagle",
      link: "https://eaglebuilt.ai/design-eagle/#d=abc",
      specSummary: "L-shape: 10 ft grill"
    });
    assert.equal(result.leadSubmitted, true);
    const saved = JSON.parse([...kv.store.entries()].find(([key]) => key.startsWith("lead:"))[1]);
    assert.equal(saved.source, "design-eagle");
    assert.match(saved.link, /design-eagle/);
  });
});
