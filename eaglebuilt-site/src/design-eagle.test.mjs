import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { commitLead } from "./chat-lead.js";
import worker, { EagleRateLimit } from "./worker.js";
import {
  CATALOG,
  CONFIG,
  applyModelSpec,
  claimsSent,
  classifyTurn,
  decodeDesign,
  legChip,
  holdLongEnough,
  prefersScribe,
  usableTranscript,
  interpret,
  saveReply,
  summaryReply,
  validateContact
} from "../site/assets/eagle-engine.js";
import { guardSpoken, mintVoiceToken, newVoiceSession, readVoiceToken, spendVoiceSession, spokenSummary, wantsSave } from "../site/assets/eagle-voice.js";

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
    legs: [{ role: "main", lengthIn: 75, items: ["sink", "grill"] }]
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
    assert.equal(result.kind, "refine");
    assert.match(result.reply, /^Done, the bar is now 7 ft, room for 3 stools\./);
    assert.doesNotMatch(result.reply, /Here's an L-shape/);
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

  test("voice equipment adds stay on the island", () => {
    const john = "a Blaze grill and a Blaze combo unit, and a Blaze refrigerator on the right side";
    const variants = [
      john,
      "blaze grill and a blaze combo unit and a blaze refrigerator on the right side",
      "uh a blaze grill and um a combo unit and a fridge on the right",
      "blaze 32 grill",
      "a forty inch grill and a double side burner",
      "side burner combo on the right",
      "put a refrigerator on the right side",
      "add a trash pull-out next to the grill",
      "doors and drawers under the bar",
      "ice maker on the left",
      "can I get a sink and a blaze grill",
      "I want a blaze grill and a combo and a refrigerator",
      "thirty two inch grill and a combo unit and a fridge"
    ];
    assert.ok(variants.length >= 11);
    for (const line of variants) {
      const result = drawn(line);
      const gear = result.spec.legs.flatMap(l => l.items);
      assert.ok(gear.length > 0, line);
      const keys = decodeDesign(result.code).m.map(row => row[0]);
      assert.ok(keys.some(k => !String(k).startsWith("fill")), line);
      assert.doesNotMatch(result.reply, /How long should it be/);
    }

    const full = drawn(john);
    assert.equal(full.spec.shape, "straight");
    assert.deepEqual(full.spec.legs[0].items, ["grill", "combo", "fridge"]);
    const rows = decodeDesign(full.code).m;
    const gearKeys = rows.map(row => row[0]).filter(k => !String(k).startsWith("fill"));
    assert.deepEqual(gearKeys, ["BLZ-4LTE3", "BLZ-DDC-R-LTSC", "BLZ-SSRF20-4.3"]);
    assert.equal(rows.find(row => row[0] === "BLZ-4LTE3")[5], "");

    let step = drawn("Blaze grill");
    assert.deepEqual(step.spec.legs[0].items, ["grill"]);
    step = drawn("add a Blaze combo unit", step.spec);
    assert.deepEqual(step.spec.legs[0].items, ["grill", "combo"]);
    step = drawn("put a Blaze fridge on the right side", step.spec);
    assert.deepEqual(step.spec.legs[0].items, ["grill", "combo", "fridge"]);
    const placed = decodeDesign(step.code).m.map(row => row[0]).filter(k => !String(k).startsWith("fill"));
    assert.equal(placed[placed.length - 1], "BLZ-SSRF20-4.3");

    const kept = interpret("hmm I don't know", step.spec);
    assert.deepEqual(kept.spec.legs[0].items, ["grill", "combo", "fridge"]);
    assert.equal(kept.code, step.code);
    assert.match(kept.reply, /kept this layout/i);

    const burner = drawn("side burner combo on the right");
    assert.deepEqual(burner.spec.legs[0].items, ["side-burner"]);
    assert.ok(decodeDesign(burner.code).m.some(row => row[0] === "BLZ-SB2-LTEPLUS"));

    const sized = drawn("a forty inch grill and a double side burner");
    assert.deepEqual(sized.spec.legs[0].items, ["grill-40", "side-burner"]);
    const ice = drawn("ice maker on the left");
    assert.deepEqual(ice.spec.legs[0].items, ["ice"]);
    assert.ok(decodeDesign(ice.code).m.some(row => row[0] === "BLZ-ICEMKR-50GR"));
    const trash = drawn("add a trash pull-out next to the grill");
    assert.ok(trash.spec.legs[0].items.includes("trash"));
    assert.ok(decodeDesign(trash.code).m.some(row => row[0] === "BLZ-TRLP-DRW-H"));

    let island = drawn("L-shape, 10 ft grill leg with a grill, 5 ft bar");
    island = drawn("doors and drawers under the bar", island.spec);
    assert.ok(island.spec.legs[0].items.includes("grill"));
    assert.ok(island.spec.legs[1].items.includes("combo"));
    assert.equal(decodeDesign(island.code).m.find(row => row[0] === "BLZ-DDC-R-LTSC") != null, true);
  });

  test("barbecue is a grill and stays left of a fridge", () => {
    const opened = {
      shape: "straight",
      finish: "stucco",
      counter: "concrete",
      frame: "cmu",
      depth: 32,
      barOn: true,
      legs: [{ role: "main", lengthIn: 120, items: ["fridge"], stools: 0, pinEnd: true }]
    };
    const sentence = "okay we have the 10-ft raised bar now I want to add a blaze Barbecue on the left side with a blaze combo unit under it and a blaze refrigerator on the right side";
    const result = drawn(sentence, opened);
    assert.equal(result.spec.shape, "straight");
    assert.equal(result.spec.barOn, true);
    assert.deepEqual(result.spec.legs[0].items, ["grill", "fridge"]);
    assert.equal(result.spec.legs[0].bases.grill, "combo");
    assert.equal(result.spec.legs[0].lengthIn, 120);
    const gear = decodeDesign(result.code).m.filter(row => !String(row[0]).startsWith("fill"));
    assert.deepEqual(gear.map(row => row[0]), ["BLZ-4LTE3", "BLZ-SSRF20-4.3"]);
    assert.equal(gear[0][5], "BLZ-DDC-R-LTSC");

    const alone = drawn("add a blaze barbecue", opened);
    assert.deepEqual(alone.spec.legs[0].items, ["grill", "fridge"]);
    assert.doesNotMatch(alone.reply, /I can make the bar/);

    for (const line of ["add a bbq", "add a barbeque", "add a BBQ grill"]) {
      const got = drawn(line, opened);
      assert.deepEqual(got.spec.legs[0].items, ["grill", "fridge"], line);
    }

    const under = drawn("add the 32-in blaze Grill and a combo unit under the grill", opened);
    assert.deepEqual(under.spec.legs[0].items, ["grill", "fridge"]);
    assert.equal(under.spec.legs[0].bases.grill, "combo");
    const underGear = decodeDesign(under.code).m.filter(row => !String(row[0]).startsWith("fill"));
    assert.deepEqual(underGear.map(row => row[0]), ["BLZ-4LTE3", "BLZ-SSRF20-4.3"]);
    assert.equal(underGear[0][5], "BLZ-DDC-R-LTSC");

    const below = drawn("add doors below the grill", { ...opened, legs: [{ role: "main", lengthIn: 120, items: ["grill", "fridge"], stools: 0, pinEnd: true }] });
    assert.equal(below.spec.legs[0].bases.grill, "door");
    assert.equal(decodeDesign(below.code).m.find(row => row[0] === "BLZ-4LTE3")[5], "BLZ-AD32-R-SC");
    const beneath = drawn("add drawers beneath the grill", { ...opened, legs: [{ role: "main", lengthIn: 120, items: ["grill", "fridge"], stools: 0, pinEnd: true }] });
    assert.equal(beneath.spec.legs[0].bases.grill, "drawer");

    const sink = drawn("add a sink on the left side", opened);
    assert.deepEqual(sink.spec.legs[0].items, ["sink", "fridge"]);
    const trash = drawn("add a trash pull-out on the right side", opened);
    assert.deepEqual(trash.spec.legs[0].items, ["fridge", "trash"]);
  });

  test("move the combo under the grill and keep the fridge at the right end", () => {
    const opened = {
      shape: "straight",
      finish: "stucco",
      counter: "concrete",
      frame: "cmu",
      depth: 32,
      barOn: true,
      legs: [{ role: "main", lengthIn: 120, items: ["grill", "fridge", "combo"], stools: 0, pinEnd: false }]
    };
    const moved = drawn("I'd like to move the combo unit underneath the grill", opened);
    assert.doesNotMatch(moved.reply, /already on the island/);
    const also = drawn("move the combo under the grill", opened);
    assert.deepEqual(also.spec.legs[0].items, ["grill", "fridge"]);
    assert.equal(also.spec.legs[0].bases.grill, "combo");
    assert.equal(moved.spec.barOn, true);
    assert.equal(moved.spec.legs[0].lengthIn, 120);
    assert.deepEqual(moved.spec.legs[0].items, ["grill", "fridge"]);
    assert.equal(moved.spec.legs[0].bases.grill, "combo");
    const gear = decodeDesign(moved.code).m.filter(row => !String(row[0]).startsWith("fill"));
    assert.deepEqual(gear.map(row => row[0]), ["BLZ-4LTE3", "BLZ-SSRF20-4.3"]);
    assert.equal(gear[0][5], "BLZ-DDC-R-LTSC");
    assert.equal(gear[gear.length - 1][0], "BLZ-SSRF20-4.3");

    const again = interpret("move the combo under the grill", moved.spec);
    assert.equal(again.code, moved.code);
    assert.match(again.reply, /already in the base under the grill/i);
    assert.doesNotMatch(again.reply, /That's already on the island/);

    const end = drawn("move the fridge to the right end", {
      ...opened,
      legs: [{ role: "main", lengthIn: 120, items: ["fridge", "grill", "combo"], stools: 0, pinEnd: false }]
    });
    assert.equal(end.spec.legs[0].items[end.spec.legs[0].items.length - 1], "fridge");

    const swapped = drawn("swap fridge and combo", opened);
    assert.deepEqual(swapped.spec.legs[0].items, ["grill", "combo", "fridge"]);

    const parked = interpret("move the fridge to the right end", moved.spec);
    assert.match(parked.reply, /already at the right end/i);
    assert.equal(parked.code, moved.code);
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
    const kept = applyModelSpec({
      action: "spec",
      spec: { shape: "straight", legs: [{ role: "main", lengthIn: 96, items: [] }] }
    }, result.spec);
    assert.deepEqual(kept.spec.legs[0].items, ["grill"]);
    assert.match(kept.reply, /kept this layout/i);
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

describe("design eagle voice", () => {
  test("name, email, and phone stay on the form", () => {
    assert.equal(wantsSave("email me this design"), true);
    assert.equal(wantsSave("I'm done"), true);
    assert.equal(wantsSave("make the bar longer"), false);
    assert.equal(wantsSave("add a fridge"), false);
  });

  test("a spoken line cannot claim a send, and a session cannot be stretched", async () => {
    const secret = "eleven-test-key";
    assert.match(guardSpoken("I just emailed you the design"), /359-9692/);
    assert.equal(claimsSent(guardSpoken("I just emailed you the design")), false);
    assert.equal(guardSpoken("Done, the bar is now 7 ft."), "Done, the bar is now 7 ft.");
    const session = newVoiceSession();
    const token = await mintVoiceToken(secret, session);
    const read = await readVoiceToken(secret, token);
    assert.equal(read.left, session.left);
    assert.equal(await readVoiceToken(secret, token + "x"), null);
    assert.equal(spendVoiceSession(read, CONFIG.voiceLimits.maxChars + 1), null);
    const spent = spendVoiceSession(read, 20);
    assert.equal(spent.left, session.left - 20);
  });

  test("speak uses the Adam voice on the server and refuses an unconfirmed send", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    let posted = null;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      posted = { url: String(url), init };
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    };
    try {
      const session = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.81");
      assert.equal(session.data.speak, true);
      assert.equal(session.data.voice, "Adam");
      assert.equal("token" in session.data, true);
      assert.equal(JSON.stringify(session.data).includes("xi-test-key"), false);
      const saidRes = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://eaglebuilt.ai",
          "CF-Connecting-IP": "203.0.113.81"
        },
        body: JSON.stringify({ token: session.data.token, text: "I just emailed you the design." })
      }), env);
      assert.equal(saidRes.status, 200);
      assert.match(saidRes.headers.get("Content-Type"), /audio\/mpeg/);
      const bytes = new Uint8Array(await saidRes.arrayBuffer());
      assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
      const body = JSON.parse(posted.init.body);
      assert.equal(claimsSent(body.text), false);
      assert.match(body.text, /359-9692/);
      assert.equal(posted.init.headers["xi-api-key"], "xi-test-key");
      assert.match(posted.url, /pNInz6obpgDQGcFmaJgB/);
      assert.equal(body.model_id, "eleven_flash_v2_5");
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("a voice token still speaks after the caller address changes", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    let calls = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(new Uint8Array([9, 9]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    };
    try {
      const session = await post("/api/design-eagle/voice/session", {}, env, "198.51.100.10");
      assert.equal(session.status, 200);
      assert.equal(session.data.speak, true);
      const said = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://eaglebuilt.ai",
          "CF-Connecting-IP": "2001:db8::1"
        },
        body: JSON.stringify({ token: session.data.token, text: "Done, the bar is now 7 ft." })
      }), env);
      assert.equal(said.status, 200);
      assert.match(said.headers.get("Content-Type"), /audio\/mpeg/);
      assert.equal(calls, 1);
      const again = said.headers.get("X-Voice-Token");
      assert.ok(again);
      const third = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://eaglebuilt.ai",
          "CF-Connecting-IP": "203.0.113.250"
        },
        body: JSON.stringify({ token: again, text: "Room for 3 stools." })
      }), env);
      assert.equal(third.status, 200);
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("spoken summary stays short and drops price and filler boilerplate", () => {
    const long = "Done. Added a grill and a fridge. The countertop wok sits on the counter and has no equipment price in the catalog. I added 6 inch filler panels between appliances. Filler panels have no equipment price of their own. The build rate covers the extra length. The price on the design comes from the catalog and the build rates. He said \"about $26,976\" for the island.";
    const said = spokenSummary(long);
    assert.ok(said.length <= 250, said);
    assert.match(said, /^Done\. Added a grill and a fridge\./);
    assert.doesNotMatch(said, /filler panel|build rate|price on the design|\$|"/i);
  });

  test("a spent voice budget renews once, then stops", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    const orig = globalThis.fetch;
    let posted = "";
    globalThis.fetch = async (url, init) => {
      posted = JSON.parse(init.body).text;
      return new Response(new Uint8Array([7]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    };
    try {
      const session = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.90");
      const read = await readVoiceToken(env.ELEVENLABS_API_KEY, session.data.token);
      read.left = 12;
      const low = await mintVoiceToken(env.ELEVENLABS_API_KEY, read);
      const line = "Done. The grill is in, and he said \"about $2,400\".";
      const said = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://eaglebuilt.ai", "CF-Connecting-IP": "203.0.113.90" },
        body: JSON.stringify({ token: low, text: line })
      }), env);
      assert.equal(said.status, 200);
      assert.match(posted, /\$2,400/);
      assert.match(posted, /"/);
      const renewed = await readVoiceToken(env.ELEVENLABS_API_KEY, said.headers.get("X-Voice-Token"));
      assert.equal(renewed.gen, 1);
      assert.ok(renewed.left < CONFIG.voiceLimits.sessionChars);
      renewed.left = 8;
      const spent = await mintVoiceToken(env.ELEVENLABS_API_KEY, renewed);
      const blocked = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://eaglebuilt.ai", "CF-Connecting-IP": "203.0.113.90" },
        body: JSON.stringify({ token: spent, text: "Done. This reply is longer than eight characters." })
      }), env);
      assert.equal(blocked.status, 429);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("the page says when voice is paused", () => {
    const page = readFileSync(new URL("../site/assets/design-eagle.js", import.meta.url), "utf8");
    assert.match(page, /Voice is paused, reply is on screen/);
    assert.match(page, /console\.log\("design-eagle voice:/);
    assert.match(page, /spokenSummary\(text\)/);
    assert.match(page, /play\(\)\.catch/);
  });

  test("a missing ElevenLabs key leaves typing in place and does not pretend to speak", async () => {
    let called = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async () => { called += 1; return new Response("no"); };
    try {
      const session = await post("/api/design-eagle/voice/session", {}, {}, "203.0.113.82");
      assert.equal(session.data.speak, false);
      const said = await post("/api/design-eagle/voice/speak", { text: "Done." }, {}, "203.0.113.82");
      assert.equal(said.status, 503);
      assert.equal(said.data.speak, false);
      assert.equal(called, 0);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("scribe sends scribe_v2 and keeps the recording's filename", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    const seen = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const form = await new Request(url, init).formData();
      const file = form.get("file");
      seen.push({
        url: String(url),
        model: form.get("model_id"),
        name: file && file.name,
        type: file && file.type,
        key: init.headers["xi-api-key"]
      });
      return Response.json({ text: "blaze grill on the right" });
    };
    try {
      const mp3 = new FormData();
      mp3.set("audio", new File([Uint8Array.from([1, 2, 3, 4])], "clip.mp3", { type: "audio/mpeg" }));
      const named = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/transcribe", {
        method: "POST",
        headers: { Origin: "https://eaglebuilt.ai", "CF-Connecting-IP": "203.0.113.90" },
        body: mp3
      }), env);
      const namedData = await named.json();
      assert.equal(named.status, 200);
      assert.equal(namedData.text, "blaze grill on the right");
      const raw = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/transcribe", {
        method: "POST",
        headers: {
          Origin: "https://eaglebuilt.ai",
          "Content-Type": "audio/webm;codecs=opus",
          "CF-Connecting-IP": "203.0.113.90"
        },
        body: Uint8Array.from([5, 6, 7, 8])
      }), env);
      assert.equal((await raw.json()).text, "blaze grill on the right");
      assert.equal(seen[0].model, "scribe_v2");
      assert.equal(seen[0].name, "clip.mp3");
      assert.match(seen[0].type, /mpeg/);
      assert.equal(seen[1].model, "scribe_v2");
      assert.equal(seen[1].name, "speech.webm");
      assert.match(seen[0].url, /\/v1\/speech-to-text$/);
      assert.equal(seen[0].key, "xi-test-key");
      assert.equal(JSON.stringify(namedData).includes("xi-test-key"), false);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("a scribe rejection is logged and told back without the key", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(" ")); };
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      detail: { status: "invalid_model", message: "invalid model id, key xi-test-key" }
    }), { status: 422, headers: { "Content-Type": "application/json" } });
    try {
      const body = new FormData();
      body.set("audio", new File([Uint8Array.from([1, 2, 3])], "clip.mp3", { type: "audio/mpeg" }));
      const res = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/transcribe", {
        method: "POST",
        headers: { Origin: "https://eaglebuilt.ai", "CF-Connecting-IP": "203.0.113.91" },
        body
      }), env);
      const data = await res.json();
      assert.equal(res.status, 502);
      assert.match(data.error, /Transcription was rejected \(422 invalid_model\): invalid model id/);
      assert.match(data.error, /You can type it/);
      assert.equal(data.error.includes("xi-test-key"), false);
      const line = logs.join("\n");
      assert.match(line, /scribe 422/);
      assert.match(line, /code=invalid_model/);
      assert.match(line, /model=scribe_v2/);
      assert.equal(line.includes("xi-test-key"), false);
    } finally {
      console.log = origLog;
      globalThis.fetch = orig;
    }
  });

  test("a tts rejection logs the upstream code and not the key", async () => {
    const env = { ELEVENLABS_API_KEY: "xi-test-key" };
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(" ")); };
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      detail: { status: "missing_permissions", message: "missing text_to_speech for xi-test-key" }
    }), { status: 401, headers: { "Content-Type": "application/json" } });
    try {
      const session = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.93");
      assert.equal(session.status, 200);
      const said = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/voice/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://eaglebuilt.ai",
          "CF-Connecting-IP": "203.0.113.93"
        },
        body: JSON.stringify({ token: session.data.token, text: "Done, the bar is now 7 ft." })
      }), env);
      const data = await said.json();
      assert.equal(said.status, 502);
      assert.match(data.error, /401 missing_permissions/);
      assert.equal(data.error.includes("xi-test-key"), false);
      const line = logs.join("\n");
      assert.match(line, /tts 401/);
      assert.match(line, /code=missing_permissions/);
      assert.match(line, /voice=pNInz6obpgDQGcFmaJgB/);
      assert.equal(line.includes("xi-test-key"), false);
    } finally {
      console.log = origLog;
      globalThis.fetch = orig;
    }
  });

  test("session mints share one counter, so a full window is refused", async () => {
    const objects = new Map();
    function namespace(seed) {
      return {
        getByName(name) {
          if (!objects.has(name)) {
            const data = new Map(seed || []);
            const storage = {
              async get(k) { return data.has(k) ? data.get(k) : undefined; },
              async put(k, v) { data.set(k, v); }
            };
            objects.set(name, new EagleRateLimit({ storage }));
          }
          const obj = objects.get(name);
          return { fetch: (input) => obj.fetch(new Request(String(input))) };
        }
      };
    }
    const env = { ELEVENLABS_API_KEY: "xi-test-key", EAGLE_LIMITS: namespace() };
    let last = null;
    for (let i = 0; i < 24; i++) {
      last = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.78");
      assert.equal(last.status, 200, "mint " + (i + 1));
      assert.equal(last.data.speak, true);
    }
    const capped = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.78");
    assert.equal(capped.status, 429);
    assert.equal(capped.data.capped, true);
    const other = await post("/api/design-eagle/voice/session", {}, env, "203.0.113.79");
    assert.equal(other.status, 200);

    objects.clear();
    const primed = {
      ELEVENLABS_API_KEY: "xi-test-key",
      EAGLE_LIMITS: namespace([["b:eagleSpeak", { start: Date.now(), n: 24 }]])
    };
    const fromElsewhere = await post("/api/design-eagle/voice/session", {}, primed, "203.0.113.80");
    assert.equal(fromElsewhere.status, 429);
  });

  test("the first draw still gives the full layout", () => {
    const first = interpret("L-shape, 10 ft grill leg with side burner and fridge, 5 ft bar with 3 stools", null);
    assert.match(first.reply, /Here's an L-shape/);
    assert.match(summaryReply(first.spec), /Here's an L-shape/);
    assert.match(summaryReply(first.spec), /10 ft/);
  });
});

function missKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key).value : null; },
    async put(key, value, opts) { store.set(key, { value: String(value), opts: opts || null }); }
  };
}

async function missPost(body, env, ip) {
  return worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/miss", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://eaglebuilt.ai",
      "CF-Connecting-IP": ip || "203.0.113.240"
    },
    body: JSON.stringify(body)
  }), env || {});
}

describe("design eagle miss log", () => {
  test("a miss, a partial, a no-op, a help line, and a rephrase are worth logging", () => {
    const before = { shape: "straight", legs: [{ items: ["grill"] }] };
    const after = { shape: "straight", legs: [{ items: ["grill", "sink"] }] };
    assert.equal(classifyTurn("add a tv", "A TV isn't in the catalog, so I left it off. The layout is unchanged.", before, before, ""), "unchanged");
    assert.equal(classifyTurn("um add a tv and a sink on the left", "Done. Added a 30 inch sink on the left. A TV isn't in the catalog, so I left it off.", before, after, ""), "partial");
    assert.equal(classifyTurn("move it", "The combo is already in the base under the grill.", before, before, ""), "unchanged");
    assert.equal(classifyTurn("make it fancy", "I can make the bar or the grill leg longer or shorter, add or remove a sink.", before, before, ""), "help");
    assert.equal(classifyTurn("add a grill on the left", "Done. Added a 32 inch Blaze grill on the left.", before, after, "um add a grill on the left side"), "repeat");
    assert.equal(classifyTurn("name: Ada email: ada@example.com", "Thanks.", before, before, ""), null);
    assert.equal(classifyTurn("add a grill", "Done. Added a 32 inch Blaze grill.", null, after, ""), null);
  });

  test("an unbound miss log is a silent no-op", async () => {
    const res = await missPost({ text: "add a tv", reply: "I kept this layout.", kind: "miss", source: "typed", ts: 1 });
    assert.equal(res.status, 204);
  });

  test("stored misses drop contact details and read newest first", async () => {
    const kv = missKv();
    const env = { EAGLE_MISSES: kv, MISS_LOG_TOKEN: "train-token" };
    const spec = { shape: "straight", legs: [{ items: ["grill"] }] };
    const first = await missPost({
      text: "add a grill email me at ada@example.com or 916-555-0100",
      reply: "I kept this layout. Call (916) 359-9692.",
      kind: "miss",
      specBefore: spec,
      specAfter: spec,
      source: "voice",
      ts: 1000
    }, env, "203.0.113.241");
    assert.equal(first.status, 204);
    const saved = await missPost({
      text: "move the grill",
      reply: "Done.",
      kind: "miss",
      name: "Ada",
      email: "ada@example.com",
      phone: "9165550100",
      source: "typed",
      ts: 2000
    }, env, "203.0.113.241");
    assert.equal(saved.status, 204);
    const card = await missPost({
      text: "name: Ada\nemail: ada@example.com\nphone: 916-555-0199",
      reply: "I kept this layout.",
      kind: "miss",
      source: "typed",
      ts: 3000
    }, env, "203.0.113.241");
    assert.equal(card.status, 204);
    const later = await missPost({
      text: "x".repeat(800),
      reply: "I kept this layout.",
      kind: "miss",
      source: "typed",
      ts: 4000
    }, env, "203.0.113.241");
    assert.equal(later.status, 204);

    const locked = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/misses?limit=200"), env);
    assert.equal(locked.status, 403);
    const wrong = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/misses", {
      headers: { "X-Miss-Token": "nope" }
    }), env);
    assert.equal(wrong.status, 403);
    const open = await worker.fetch(new Request("https://eaglebuilt.ai/api/design-eagle/misses?limit=200", {
      headers: { "X-Miss-Token": "train-token" }
    }), env);
    const data = await open.json();
    assert.equal(open.status, 200);
    assert.equal(data.misses.length, 2);
    assert.equal(data.misses[0].ts, 4000);
    assert.equal(data.misses[0].text.length, 500);
    assert.equal(data.misses[1].text.includes("ada@example.com"), false);
    assert.match(data.misses[1].text, /\[email\]/);
    assert.match(data.misses[1].text, /\[phone\]/);
    assert.equal(data.misses[1].reply.includes("359-9692"), false);
    assert.equal(data.misses[1].source, "voice");
    assert.equal(JSON.stringify(data).includes("Ada"), false);
    const stored = [...kv.store.values()].find(row => String(row.value).includes("miss") || String(row.value).startsWith("{"));
    const entry = [...kv.store.entries()].find(([key]) => key.startsWith("miss:"));
    assert.ok(entry);
    assert.equal(entry[1].opts.expirationTtl, 30 * 24 * 60 * 60);
  });
});

function gapsBetweenGear(code) {
  const keys = decodeDesign(code).m.map(row => row[0]);
  const gaps = [];
  let pending = null;
  let fills = [];
  for (const key of keys) {
    if (String(key).startsWith("fill")) {
      if (pending) fills.push(key);
      continue;
    }
    if (key === "corner24") { pending = null; fills = []; continue; }
    if (pending) gaps.push({ fills });
    pending = key;
    fills = [];
  }
  return gaps;
}

describe("filler panels", () => {
  test("a straight run puts 6 inch fillers between a grill and a fridge", () => {
    const result = drawn("straight 10 ft island with a grill and a fridge");
    const gaps = gapsBetweenGear(result.code);
    assert.deepEqual(gaps.map(gap => gap.fills), [["fill6"]]);
    assert.match(result.reply, /6 inch filler panels/);
    assert.match(result.reply, /no equipment price/i);
    assert.doesNotMatch(result.reply, /\$\d/);
  });

  test("a grill needs 12 inches before a side burner, griddle, or sink", () => {
    for (const [line, fills] of [
      ["straight 10 ft island with a grill and a side burner", ["fill12"]],
      ["straight 10 ft island with a grill and a griddle", ["fill12"]],
      ["straight 10 ft island with a grill and a sink", ["fill12"]],
      ["straight 10 ft island with a grill and a fridge", ["fill6"]]
    ]) {
      const result = drawn(line);
      assert.deepEqual(gapsBetweenGear(result.code).map(gap => gap.fills), [fills], line + " " + result.reply);
    }
  });

  test("an L keeps the 12 inch grill gap on the corner leg", () => {
    const result = drawn("L-shape, 10 ft grill leg with a side burner, 8 ft return");
    assert.equal(result.spec.shape, "ell");
    assert.ok(result.spec.legs[0].items.includes("grill"));
    assert.ok(result.spec.legs[0].items.includes("side-burner"));
    const gaps = gapsBetweenGear(result.code);
    assert.ok(gaps.some(gap => gap.fills.includes("fill12")), result.reply);
    assert.ok(decodeDesign(result.code).m.some(row => row[0] === "corner24"));
  });

  test("a short run says what length fits the fillers", () => {
    const result = drawn("straight 6 ft island with a sink and a grill");
    assert.ok(result.spec.legs[0].lengthIn > 72);
    assert.match(result.reply, /longer than asked/);
    assert.match(result.reply, /fit them/);
  });

  test("3 inch fillers snap to 4, and never close the grill gap below 12", () => {
    const fridge = drawn("straight 10 ft island with a grill and a fridge");
    const narrowed = drawn("3 inch fillers", fridge.spec);
    assert.deepEqual(gapsBetweenGear(narrowed.code).map(gap => gap.fills), [["fill4"]]);
    assert.match(narrowed.reply, /4 inch/);
    assert.match(narrowed.reply, /isn't a panel we build/);
    const burner = drawn("straight 10 ft island with a grill and a side burner");
    const kept = drawn("3 inch fillers", burner.spec);
    assert.ok(gapsBetweenGear(kept.code).some(gap => gap.fills.includes("fill12")), kept.reply);
    assert.match(kept.reply, /12 inches beside the grill/);
  });

  test("no fillers and remove filler panels clear the 6 inch gaps", () => {
    const fridge = drawn("straight 10 ft island with a grill and a fridge");
    const gone = drawn("no fillers", fridge.spec);
    assert.ok(gapsBetweenGear(gone.code).every(gap => gap.fills.length === 0));
    assert.match(gone.reply, /Removed the filler panels/);
    const back = drawn("6 inch filler between grill and fridge", gone.spec);
    assert.deepEqual(gapsBetweenGear(back.code).map(gap => gap.fills), [["fill6"]]);
    const removed = drawn("remove filler panels", back.spec);
    assert.ok(gapsBetweenGear(removed.code).every(gap => gap.fills.length === 0));
  });

  test("removing fillers still leaves 12 inches beside a side burner", () => {
    const burner = drawn("straight 10 ft island with a grill and a side burner");
    const result = drawn("remove filler panels", burner.spec);
    assert.ok(gapsBetweenGear(result.code).some(gap => gap.fills.includes("fill12")));
    assert.match(result.reply, /12 inches beside the grill/);
  });
});

function gearSequence(code) {
  const keys = decodeDesign(code).m.map(row => row[0]);
  const first = keys.findIndex(key => !String(key).startsWith("fill"));
  const last = keys.length - 1 - [...keys].reverse().findIndex(key => !String(key).startsWith("fill") && key !== "corner24");
  return keys.slice(Math.max(0, first), last + 1).filter(key => key !== "corner24");
}

describe("side words on one build", () => {
  test("fridge on the left and side burner on the right sit around the grill", () => {
    const result = drawn("build a straight 12 ft island with a 32 inch blaze grill, a side burner on the right and a fridge on the left");
    assert.deepEqual(result.spec.legs[0].items, ["fridge", "grill", "side-burner"]);
    assert.deepEqual(gearSequence(result.code), ["BLZ-SSRF20-4.3", "fill6", "BLZ-4LTE3", "fill12", "BLZ-SB2-LTEPLUS"]);
  });

  test("left end, far right, and swapped sides stay relative to the grill", () => {
    const cases = [
      ["straight 12 ft island with a fridge on the left end and a 32 inch grill", ["fridge", "grill"], ["BLZ-SSRF20-4.3", "fill6", "BLZ-4LTE3"]],
      ["straight 10 ft island with a grill and a sink on the far right", ["grill", "sink"], ["BLZ-4LTE3", "fill12", "BLZ-30CKT-SNK"]],
      ["straight 12 ft island with a side burner on the left and a fridge on the right and a grill", ["side-burner", "grill", "fridge"], ["BLZ-SB2-LTEPLUS", "fill12", "BLZ-4LTE3", "fill6", "BLZ-SSRF20-4.3"]],
      ["straight 10 ft island with a grill and a fridge on the left", ["fridge", "grill"], ["BLZ-SSRF20-4.3", "fill6", "BLZ-4LTE3"]],
      ["straight 10 ft island with an ice maker on the left and a 32 inch grill", ["ice", "grill"], ["BLZ-ICEMKR-50GR", "fill12", "BLZ-4LTE3"]]
    ];
    for (const [line, items, seq] of cases) {
      const result = drawn(line);
      assert.deepEqual(result.spec.legs[0].items, items, line);
      assert.deepEqual(gearSequence(result.code), seq, line + " " + result.reply);
    }
  });
});

function fillerBefore(code, rot, key) {
  const rows = decodeDesign(code).m.filter(row => row[3] === rot);
  let sum = 0;
  for (const row of rows) {
    if (row[0] === key) return sum;
    const size = String(row[0]).match(/^fill(\d+)$/);
    if (size) sum += Number(size[1]);
  }
  return -1;
}

function assertCleanReply(reply) {
  assert.doesNotMatch(reply, /\.\./, reply);
  assert.doesNotMatch(reply, /[a-z] The /, reply);
  for (const clause of reply.split(/(?<=\.)\s+/)) assert.match(clause, /^[A-Z]/, clause);
}

describe("john's L-shape conversation", () => {
  test("four turns keep both legs and put the bar list on the return", () => {
    let step = drawn("like to build a 10 ft long L shape with a 17 ft return");
    assert.equal(step.spec.barOn, false);
    assert.deepEqual(step.spec.legs.map(l => l.lengthIn), [120, 204]);
    assert.equal(legChip(step.spec), "10' + 17' return");
    step = drawn("got a grill Blaze Grill 32 inch with a combo unit just below the grill a refrigerator a table top walk a side burner a drawer unit three drawers another access door 32 in and a refrigerator", step.spec);
    assert.equal(step.spec.legs[0].lengthIn, 120);
    assert.equal(step.spec.legs[1].lengthIn, 204);
    assert.equal(step.spec.legs[0].bases.grill, "combo");
    assert.deepEqual(step.spec.legs[0].items, ["grill", "fridge", "ctwok", "side-burner"]);
    assert.ok(step.spec.legs[1].items.includes("drawer-3"));
    assert.ok(step.spec.legs[1].items.includes("door"));
    assert.ok(step.spec.legs[1].items.includes("fridge"));
    assert.match(step.reply, /countertop wok/);
    assert.match(step.reply, /no equipment price/);
    assert.match(step.reply, /so I put/);
    assert.match(step.reply, /return/);
    assertCleanReply(step.reply);
    step = drawn("on the long side of the bar I want a beverage center sink with a single access door below it I want a beverage refrigerator I want a two drawer unit and a trash", step.spec);
    assert.ok(step.spec.legs[1].items.includes("bev-sink"));
    assert.ok(step.spec.legs[1].items.includes("bev"));
    assert.ok(step.spec.legs[1].items.includes("drawer"));
    assert.ok(step.spec.legs[1].items.includes("trash"));
    assert.ok(step.spec.legs[1].items.includes("drawer-3"));
    assert.ok(step.spec.legs[1].items.includes("fridge"));
    assert.equal(step.spec.legs[1].bases["bev-sink"], "door-v");
    assert.equal(step.spec.legs[0].lengthIn, 120);
    assert.doesNotMatch(step.reply, /Moved/);
    assertCleanReply(step.reply);
    step = drawn("I need that on the other side of the island on the L shape", step.spec);
    assert.equal(step.spec.legs[0].lengthIn, 120);
    assert.equal(step.spec.legs[1].lengthIn, 204);
    assert.deepEqual(step.spec.legs[0].items, ["grill", "fridge", "ctwok", "side-burner"]);
    assert.equal(step.spec.legs[0].bases.grill, "combo");
    for (const id of ["drawer-3", "door", "fridge", "bev-sink", "bev", "drawer", "trash"]) {
      assert.ok(step.spec.legs[1].items.includes(id), id);
    }
    assert.equal(step.spec.legs[1].bases["bev-sink"], "door-v");
    const fridges = step.spec.legs.reduce((n, l) => n + l.items.filter(id => id === "fridge").length, 0);
    assert.equal(fridges, 2);
    assert.match(step.reply, /already on the other side/);
    assertCleanReply(step.reply);
  });

  test("leg names and a repeated fridge", () => {
    const island = drawn("like to build a 10 ft long L shape with a 17 ft return").spec;
    const short = drawn("add a trash drawer on the short side", island);
    assert.ok(short.spec.legs[0].items.includes("trash"));
    const grillSide = drawn("add a sink on the grill side", island);
    assert.ok(grillSide.spec.legs[0].items.includes("sink"));
    const ret = drawn("add a double drawer on the return", island);
    assert.deepEqual(ret.spec.legs[1].items, ["drawer"]);
    const corner = drawn("add a side burner on the corner", island);
    assert.ok(corner.spec.legs[0].items.includes("side-burner"));
    const again = drawn("add another refrigerator", drawn("straight 10 ft island with a grill and a fridge").spec);
    assert.equal(again.spec.legs[0].items.filter(id => id === "fridge").length, 2);
    const sized = drawn("add an access door 28 in on the grill side", island);
    assert.ok(sized.spec.legs[0].items.includes("door-25"));
    assert.match(sized.reply, /25 inch/);
  });
});

const U_LINE = "build a U-shaped barbecue island with a 32 inch Blaze Grill under the grill a combo unit 12 to 2 ft away I want a side burner with a single door underneath the next to that I want to refrigerator then on the next part of the island I'd like a pizza oven on top then the next side of the island let's put a three drawer unit in and a griddle Blaze griddle";

describe("U shape segments", () => {
  test("a spoken U puts the grill run, pizza, and griddle on three legs", () => {
    const result = drawn(U_LINE);
    assert.equal(result.spec.shape, "yu");
    assert.deepEqual(result.spec.legs.map(l => l.lengthIn), [120, 72, 72]);
    assert.equal(legChip(result.spec), "10' + 6' + 6' returns");
    assert.deepEqual(decodeDesign(result.code).lg, [120, 72, 72]);
    assert.deepEqual(result.spec.legs[0].items, ["grill", "side-burner", "fridge"]);
    assert.equal(result.spec.legs[0].bases.grill, "combo");
    assert.equal(result.spec.legs[0].bases["side-burner"], "door-v");
    assert.deepEqual(result.spec.legs[1].items, ["ctpizza"]);
    assert.deepEqual(result.spec.legs[2].items, ["drawer-3", "griddle"]);
    assert.match(result.reply, /10 ft/);
    assert.match(result.reply, /6 ft/);
    assert.match(result.reply, /2 ft between the grill and the side burner/);
    assert.match(result.reply, /no equipment price/i);
    const rows = decodeDesign(result.code).m;
    const keys = (rot) => rows.filter(row => row[3] === rot).map(row => row[0]);
    const main = keys(0);
    const gear = main.filter(key => !String(key).startsWith("fill"));
    assert.deepEqual(gear, ["BLZ-4LTE3", "BLZ-SB2-LTEPLUS", "BLZ-SSRF20-4.3"]);
    assert.deepEqual(main.slice(main.indexOf("BLZ-4LTE3") + 1, main.indexOf("BLZ-SB2-LTEPLUS")), ["fill24"]);
    assert.equal(rows.find(row => row[0] === "BLZ-4LTE3")[5], "BLZ-DDC-R-LTSC");
    assert.equal(rows.find(row => row[0] === "BLZ-SB2-LTEPLUS")[5], "BLZ-SINGLE-2417-R-SC");
    assert.doesNotMatch(result.reply, /don't stock a single door/i);
    assert.equal(fillerBefore(result.code, 270, "ctpizza"), 36);
    assert.match(result.reply, /corner before the pizza/);
    assert.deepEqual(keys(270).filter(key => !String(key).startsWith("fill")), ["ctpizza"]);
    assert.deepEqual(keys(90).filter(key => !String(key).startsWith("fill")), ["BLZ-DRW3-R-LT", "BLZ-GRIDDLE-LTE3"]);
    assertCleanReply(result.reply);
  });

  test("the pizza oven starts down the return, and a nudge slides it further", () => {
    const built = drawn(U_LINE);
    assert.equal(fillerBefore(built.code, 270, "ctpizza"), 36);
    const john = "Pizza oven should slide to the left a little bit more down that side of the island.";
    const slid = drawn(john, built.spec);
    assert.equal(fillerBefore(slid.code, 270, "ctpizza"), 48);
    assert.match(slid.reply, /12 inches/);
    assert.match(slid.reply, /away from the corner/);
    assert.equal(slid.spec.legs[0].items.includes("grill"), true);
    const six = drawn("slide the pizza oven 6 inches toward the end", built.spec);
    assert.equal(fillerBefore(six.code, 270, "ctpizza"), 40);
    const back = drawn("slide the pizza oven right a foot", slid.spec);
    assert.equal(fillerBefore(back.code, 270, "ctpizza"), 36);
    const corner = drawn("shift the pizza oven toward the corner", built.spec);
    assert.equal(fillerBefore(corner.code, 270, "ctpizza"), 24);
    assert.match(corner.reply, /toward the corner/);
  });

  test("single door means the 17 inch vertical door, and horizontal is the wide one", () => {
    assert.equal(CATALOG["door-v"].k, "BLZ-SINGLE-2417-R-SC");
    assert.equal(CATALOG["door-v"].p, 463);
    assert.equal(CATALOG["door-h"].k, "BLZ-SH-2417-R-SC");
    assert.equal(CATALOG["door-h"].p, 463);
    for (const line of [
      "straight 8 ft island with a single door",
      "straight 8 ft island with a single access door",
      "straight 8 ft island with one door"
    ]) {
      const result = drawn(line);
      assert.ok(result.spec.legs[0].items.includes("door-v"), line + " " + result.reply);
      assert.equal(result.spec.legs[0].items.includes("door"), false, line);
    }
    for (const line of [
      "straight 8 ft island with a horizontal door",
      "straight 10 ft island with a horizontal access door"
    ]) {
      const result = drawn(line);
      assert.ok(result.spec.legs[0].items.includes("door-h"), line + " " + result.reply);
    }
    const island = drawn("straight 10 ft island with a side burner");
    const under = drawn("put a single door underneath the side burner", island.spec);
    assert.equal(under.spec.legs[0].bases["side-burner"], "door-v");
    assert.equal(decodeDesign(under.code).m.find(row => row[0] === "BLZ-SB2-LTEPLUS")[5], "BLZ-SINGLE-2417-R-SC");
    assert.doesNotMatch(under.reply, /don't stock a single door/i);
    const wet = drawn("straight 10 ft island with a sink");
    const sink = drawn("put a single access door below the sink", wet.spec);
    assert.equal(sink.spec.legs[0].bases.sink, "door-v");
  });

  test("the size chip reads the spec lengths, not the drawn modules", () => {
    const page = readFileSync(new URL("../site/design/app/index.html", import.meta.url), "utf8");
    assert.match(page, /S\.legLens/);
    assert.match(page, /wider cabinet face|wide door under a narrow/);
  });

  test("next part, other side, third side, corner, and left or right leg split a U", () => {
    const variants = [
      "build a U shaped island with a grill then on the next part of the island a fridge then on the other side a sink",
      "build a U shaped island with a grill the next part a fridge the third side a sink",
      "build a U shaped island with a grill then the corner a fridge the next side a sink",
      "build a U shaped island with a grill left leg a fridge right leg a sink"
    ];
    for (const line of variants) {
      const result = drawn(line);
      assert.equal(result.spec.shape, "yu", line);
      assert.deepEqual(result.spec.legs.map(l => l.lengthIn), [120, 72, 72], line + " " + result.reply);
      assert.ok(result.spec.legs[0].items.includes("grill"), line);
      assert.ok(result.spec.legs[1].items.includes("fridge"), line);
      assert.ok(result.spec.legs[2].items.includes("sink"), line);
      assert.match(result.reply, /10 ft/, line);
    }
  });
});

describe("moving one piece to another leg", () => {
  const L_LINE = "L shaped island, 12 ft grill side with a 32 inch grill and a countertop pizza oven, 6 ft return";

  function johnsL() {
    const built = drawn(L_LINE);
    assert.equal(built.spec.shape, "ell");
    assert.deepEqual(built.spec.legs.map(l => l.lengthIn), [144, 72]);
    assert.ok(built.spec.legs[0].items.includes("grill"));
    assert.ok(built.spec.legs[0].items.includes("ctpizza"));
    assert.deepEqual(built.spec.legs[1].items, []);
    return built;
  }

  function legOf(spec, id) {
    return spec.legs.findIndex(l => (l.items || []).includes(id));
  }

  test("john's sentences move the pizza oven onto the empty return", () => {
    const lines = [
      "move the pizza oven to the other leg of the L",
      "move the pizza oven to the other side",
      "put the pizza oven on the return",
      "move the pizza oven to the short side",
      "move the pizza oven to the bar side"
    ];
    for (const line of lines) {
      const built = johnsL();
      const moved = drawn(line, built.spec);
      assert.equal(legOf(moved.spec, "ctpizza"), 1, line + " " + moved.reply);
      assert.equal(legOf(moved.spec, "grill"), 0, line);
      assert.deepEqual(moved.spec.legs.map(l => l.lengthIn), [144, 72], line);
      assert.match(moved.reply, /Done\. Moved the countertop pizza oven to the return\./, moved.reply);
      assert.doesNotMatch(moved.reply, /already on the other side/, line);
      assert.equal(fillerBefore(moved.code, 90, "ctpizza"), 36, line + " " + moved.reply);
      assertCleanReply(moved.reply);
    }
  });

  test("already on the other side is only said when it is already there", () => {
    const built = johnsL();
    const stayed = interpret("move the pizza oven to the long side", built.spec);
    assert.equal(legOf(stayed.spec, "ctpizza"), 0);
    assert.match(stayed.reply, /already on the long side/);
    assert.doesNotMatch(stayed.reply, /already on the other side/);
    const moved = drawn("move the pizza oven to the other side", built.spec);
    const again = interpret("move the pizza oven to the other side", moved.spec);
    assert.equal(legOf(again.spec, "ctpizza"), 1);
    assert.match(again.reply, /already on the other side/);
    assert.doesNotMatch(again.reply, /Moved/);
    const back = drawn("move the pizza oven to the other leg", moved.spec);
    assert.equal(legOf(back.spec, "ctpizza"), 0, back.reply);
    assert.match(back.reply, /main leg/);
  });

  test("move it over follows the pizza oven just named, then the last piece added", () => {
    const built = johnsL();
    const named = drawn("put the pizza oven on the return", built.spec);
    const back = drawn("move it over", named.spec);
    assert.equal(legOf(back.spec, "ctpizza"), 0, back.reply);
    assert.match(back.reply, /Moved the countertop pizza oven to the main leg/);
    const over = drawn("move it to the other leg", back.spec);
    assert.equal(legOf(over.spec, "ctpizza"), 1, over.reply);
    const bare = drawn("L shaped island, 10 ft grill side with a grill, 6 ft return");
    const added = drawn("add a countertop pizza oven", bare.spec);
    assert.equal(legOf(added.spec, "ctpizza"), 0, added.reply);
    const shifted = drawn("move it over", added.spec);
    assert.equal(legOf(shifted.spec, "ctpizza"), 1, shifted.reply);
    assert.equal(fillerBefore(shifted.code, 90, "ctpizza"), 36);
  });

  test("the cabinet under the grill moves with it", () => {
    const built = drawn("put a combo under the grill", johnsL().spec);
    assert.equal(built.spec.legs[0].bases.grill, "combo");
    const moved = drawn("move the grill to the other leg of the L", built.spec);
    assert.equal(legOf(moved.spec, "grill"), 1, moved.reply);
    assert.equal(legOf(moved.spec, "ctpizza"), 0);
    assert.equal(moved.spec.legs[1].bases.grill, "combo");
    assert.equal(moved.spec.legs[0].bases && moved.spec.legs[0].bases.grill, undefined);
    const row = decodeDesign(moved.code).m.find(part => part[0] === "BLZ-4LTE3");
    assert.equal(row[5], "BLZ-DDC-R-LTSC");
    assert.equal(row[3], 90);
    assert.deepEqual(moved.spec.legs.map(l => l.lengthIn), [144, 72]);
  });

  test("a return that cannot hold the pizza oven stays as it was", () => {
    const built = drawn("L shaped island, 10 ft grill side with a grill and a countertop pizza oven, 6 ft bar side with a fridge and a griddle");
    assert.equal(legOf(built.spec, "ctpizza"), 0, built.reply);
    assert.ok(built.spec.legs[1].items.includes("fridge"));
    assert.ok(built.spec.legs[1].items.includes("griddle"));
    const stayed = interpret("move the pizza oven to the return", built.spec);
    assert.match(stayed.reply, /left it where it is/);
    assert.equal(legOf(stayed.spec, "ctpizza"), 0);
    assert.equal(stayed.spec.legs[1].items.includes("ctpizza"), false);
    assert.deepEqual(stayed.spec.legs.map(l => l.lengthIn), built.spec.legs.map(l => l.lengthIn));
  });

  test("swap the pizza oven and the fridge across the legs", () => {
    const built = drawn("L shaped island, 12 ft grill side with a countertop pizza oven, 8 ft return with a fridge");
    assert.equal(legOf(built.spec, "ctpizza"), 0, built.reply);
    assert.equal(legOf(built.spec, "fridge"), 1, built.reply);
    const swapped = drawn("swap the pizza oven and the fridge", built.spec);
    assert.equal(legOf(swapped.spec, "fridge"), 0, swapped.reply);
    assert.equal(legOf(swapped.spec, "ctpizza"), 1, swapped.reply);
    assert.match(swapped.reply, /Swapped/);
    assert.equal(swapped.spec.legs[0].lengthIn, 144);
    assert.equal(swapped.spec.legs[1].lengthIn, 96);
    assert.equal(fillerBefore(swapped.code, 90, "ctpizza"), 48);
    const withBase = drawn("put a combo under the grill", drawn("L shaped island, 12 ft grill side with a grill, 8 ft return with a fridge").spec);
    const crossed = drawn("swap the grill and the fridge", withBase.spec);
    assert.equal(legOf(crossed.spec, "grill"), 1, crossed.reply);
    assert.equal(crossed.spec.legs[1].bases.grill, "combo");
  });

  test("the same moves work on a U", () => {
    const roomy = drawn("U shaped kitchen, 12 ft main with a grill, 6 ft left with a countertop pizza oven, 6 ft right");
    assert.equal(roomy.spec.shape, "yu");
    assert.equal(legOf(roomy.spec, "ctpizza"), 1, roomy.reply);
    const toMain = drawn("move the pizza oven to the other leg", roomy.spec);
    assert.equal(legOf(toMain.spec, "ctpizza"), 0, toMain.reply);
    assert.match(toMain.reply, /Moved the countertop pizza oven to the main leg/);
    assert.deepEqual(toMain.spec.legs.map(l => l.lengthIn), [144, 72, 72]);
    const back = drawn("move it over", toMain.spec);
    assert.equal(legOf(back.spec, "ctpizza"), 1, back.reply);
    assert.equal(fillerBefore(back.code, 270, "ctpizza"), 36);
    const toRight = drawn("put the pizza oven on the return", roomy.spec);
    assert.equal(legOf(toRight.spec, "ctpizza"), 2, toRight.reply);
    assert.match(toRight.reply, /right return/);
    assert.equal(fillerBefore(toRight.code, 90, "ctpizza"), 36);
    const long = drawn("move the pizza oven to the long side", roomy.spec);
    assert.equal(legOf(long.spec, "ctpizza"), 0, long.reply);
    const home = drawn("move the pizza oven to the short side", long.spec);
    assert.equal(legOf(home.spec, "ctpizza"), 1, home.reply);
    const crowded = drawn(U_LINE);
    const stayed = interpret("move the pizza oven to the other leg", crowded.spec);
    assert.match(stayed.reply, /left it where it is/);
    assert.equal(legOf(stayed.spec, "ctpizza"), 1);
    assert.deepEqual(stayed.spec.legs.map(l => l.lengthIn), [120, 72, 72]);
    const otherReturn = interpret("put the pizza oven on the return", crowded.spec);
    assert.match(otherReturn.reply, /left it where it is/);
    assert.equal(legOf(otherReturn.spec, "ctpizza"), 1);
  });
});

describe("john's straight run", () => {
  const OPENING = "make me a 10 ft barbecue island with a blaze 32 inch Grill two drawers underneath the grill and a refrigerator";

  test("the first sentence puts the double drawer in the grill base", () => {
    const built = drawn(OPENING);
    assert.deepEqual(built.spec.legs[0].items, ["grill", "fridge"]);
    assert.equal(built.spec.legs[0].bases.grill, "drawer");
    assert.equal(built.spec.legs[0].lengthIn, 120);
    const grill = decodeDesign(built.code).m.find(row => row[0] === "BLZ-4LTE3");
    assert.equal(grill[5], "BLZ-DRW2-R-LT");
    assert.match(built.reply, /under the grill/i);
    assert.doesNotMatch(built.reply, /Where should/);
    assertCleanReply(built.reply);
  });

  test("put the drawer underneath the barbecue grill moves the drawer, not the grill", () => {
    const open = drawn("straight 10 ft island with a grill, two drawers, and a refrigerator");
    assert.ok(open.spec.legs[0].items.includes("drawer"), open.reply);
    const moved = drawn("put the drawer underneath the barbecue grill", open.spec);
    assert.equal(moved.spec.legs[0].bases.grill, "drawer");
    assert.equal(moved.spec.legs[0].items.includes("drawer"), false);
    assert.ok(moved.spec.legs[0].items.includes("grill"));
    assert.doesNotMatch(moved.reply, /Where should the 32 inch/);
    assert.match(moved.reply, /under the grill/i);
    const again = drawn("the two drawer unit should be underneath the grill", {
      ...open.spec,
      legs: [{ ...open.spec.legs[0], items: ["grill", "drawer", "fridge"], bases: {} }]
    });
    assert.equal(again.spec.legs[0].bases.grill, "drawer");
  });

  test("move both items to the left keeps their order and the filler gap", () => {
    const built = drawn(OPENING);
    const left = drawn("now move both items to the left", built.spec);
    const keys = decodeDesign(left.code).m.map(row => row[0]);
    assert.equal(keys[0], "BLZ-4LTE3", left.reply + " " + keys.join(","));
    assert.ok(String(keys[keys.length - 1]).startsWith("fill"), keys.join(","));
    assert.deepEqual(gapsBetweenGear(left.code).map(gap => gap.fills), [["fill6"]]);
    assert.equal(left.spec.legs[0].bases.grill, "drawer");
    assert.equal(left.spec.legs[0].lengthIn, 120);
    assert.match(left.reply, /left end/);
    assert.doesNotMatch(left.reply, /What should I add/);
    const right = drawn("now move both items to the right", left.spec);
    const rightKeys = decodeDesign(right.code).m.map(row => row[0]);
    assert.ok(String(rightKeys[0]).startsWith("fill"), rightKeys.join(","));
    assert.equal(rightKeys[rightKeys.length - 1], "BLZ-SSRF20-4.3");
    assert.match(right.reply, /right end/);
  });

  test("a filler panel on the fridge end lengthens the run and is not a fridge move", () => {
    const built = drawn(OPENING);
    const lines = [
      ["let's put a filler panel on the end where the refrigerator is at", 126, /filler panel/],
      ["add a filler panel on the end by the fridge", 126, /no equipment price/],
      ["put a filler on the left end", 126, /left end/],
      ["put a filler on the right end", 126, /filler panel/],
      ["add a filler at the end", 126, /filler panel/],
      ["add another filler next to the fridge", 126, /filler panel/],
      ["put a three inch filler panel on the end", 124, /4 inch/],
      ["put a 3 inch filler next to the fridge on the end", 124, /4 inch/],
      ["fillers on both ends", 132, /both ends/],
      ["add a fill her panel on the end by the fridge", 126, /filler panel/],
      ["add a filler pannel on the right end", 126, /filler panel/]
    ];
    for (const [line, lengthIn, reply] of lines) {
      const added = drawn(line, built.spec);
      assert.equal(added.spec.legs[0].lengthIn, lengthIn, line + " " + added.reply);
      assert.deepEqual(added.spec.legs[0].items, ["grill", "fridge"], line);
      assert.match(added.reply, reply, line + " " + added.reply);
      assert.doesNotMatch(added.reply, /Where should/, line + " " + added.reply);
      assert.doesNotMatch(added.reply, /\$\d/, line);
      const keys = decodeDesign(added.code).m.map(row => row[0]);
      assert.ok(keys.some(key => String(key).startsWith("fill")), line + " " + keys.join(","));
    }
    const between = drawn("add a 6 inch filler between the grill and the drawer", built.spec);
    assert.equal(between.spec.legs[0].lengthIn, 126, between.reply);
    assert.equal(between.spec.legs[0].bases.grill, "drawer");
    const keys = decodeDesign(between.code).m.map(row => row[0]);
    const grillAt = keys.indexOf("BLZ-4LTE3");
    assert.ok(String(keys[grillAt + 1]).startsWith("fill"), keys.join(","));
    const removed = drawn("remove the filler by the fridge", between.spec);
    assert.equal(removed.spec.legs[0].lengthIn, 120, removed.reply);
    assert.match(removed.reply, /Removed the filler/);
    assert.deepEqual(removed.spec.legs[0].items, ["grill", "fridge"]);
  });

  test("each supported filler size lengthens the run by that exact width", () => {
    const sizes = [4, 6, 8, 12, 16, 24];
    const base = drawn("straight 10 ft island with a grill and a fridge");
    assert.equal(base.spec.legs[0].lengthIn, 120);
    const span = code => decodeDesign(code).m.reduce((sum, row) => {
      const key = String(row[0]);
      if (key.startsWith("fill")) return sum + Number(key.slice(4));
      const item = Object.values(CATALOG).find(entry => entry.k === key);
      return sum + (item ? item.w : 0);
    }, 0);
    const keysOf = code => decodeDesign(code).m.map(row => row[0]);
    const beforeSpan = span(base.code);
    for (const size of sizes) {
      const end = drawn("add a " + size + " inch filler panel on the end", base.spec);
      const left = drawn("add a " + size + " inch filler panel on the left end", base.spec);
      const right = drawn("add a " + size + " inch filler panel on the right end", base.spec);
      const mid = drawn("add a " + size + " inch filler panel between the grill and the fridge", base.spec);
      for (const [placed, where] of [[end, "end"], [left, "start"], [right, "end"], [mid, "after"]]) {
        assert.equal(placed.spec.legs[0].lengthIn, 120 + size, size + " " + where + " " + placed.reply);
        assert.equal(placed.spec.legs[0].items.join(","), "grill,fridge", placed.reply);
        assert.ok(placed.spec.legs[0].panels.some(panel => panel.w === size && panel.at === where), size + " " + where);
        assert.ok(Math.abs(span(placed.code) - beforeSpan - size) < 0.2, size + " " + where);
        assert.match(placed.reply, new RegExp(size + " inch filler panel"));
        assert.match(placed.reply, /no equipment price/i);
        assert.doesNotMatch(placed.reply, /\$\d/);
      }
      const endKeys = keysOf(end.code);
      const rightKeys = keysOf(right.code);
      const leftKeys = keysOf(left.code);
      const midKeys = keysOf(mid.code);
      const lastGear = list => {
        let at = -1;
        list.forEach((key, i) => { if (!String(key).startsWith("fill")) at = i; });
        return at;
      };
      const firstGear = list => list.findIndex(key => !String(key).startsWith("fill"));
      assert.equal(endKeys[lastGear(endKeys) + 1], "fill" + size, endKeys.join(","));
      assert.equal(rightKeys[lastGear(rightKeys) + 1], "fill" + size, rightKeys.join(","));
      assert.equal(leftKeys[firstGear(leftKeys) - 1], "fill" + size, leftKeys.join(","));
      const grillAt = midKeys.indexOf("BLZ-4LTE3");
      const fridgeAt = midKeys.indexOf("BLZ-SSRF20-4.3");
      assert.ok(midKeys.slice(grillAt + 1, fridgeAt).includes("fill" + size), midKeys.join(","));
    }
    const spoken = [
      ["add a four inch filler panel on the end", 4],
      ["add an eight inch filler panel on the right end", 8],
      ["add a foot filler panel on the left end", 12],
      ["add a sixteen inch filler panel between the grill and the fridge", 16],
      ["add a two foot filler panel on the end", 24],
      ["add a 24 inch filler panel on the right end", 24]
    ];
    for (const [line, size] of spoken) {
      const placed = drawn(line, base.spec);
      assert.equal(placed.spec.legs[0].lengthIn, 120 + size, line + " " + placed.reply);
      assert.ok(keysOf(placed.code).includes("fill" + size), line);
      assert.match(placed.reply, /no equipment price/i);
    }
    const odd = drawn("add a 3 inch filler panel on the end", base.spec);
    assert.equal(odd.spec.legs[0].lengthIn, 124, odd.reply);
    assert.match(odd.reply, /3 inches isn't a panel we build, so 4 is the closest/);
    assert.ok(keysOf(odd.code).includes("fill4"));
  });

  test("a size that starts with a vowel sound takes an", () => {
    const base = drawn("straight 10 ft island with a grill and a fridge");
    const eight = drawn("add an 8 inch filler panel on the end", base.spec);
    assert.match(eight.reply, /Added an 8 inch filler panel/);
    assert.doesNotMatch(eight.reply, /\ba 8\b/);
    const six = drawn("add a 6 inch filler panel on the end", base.spec);
    assert.match(six.reply, /Added a 6 inch filler panel/);
    const both = drawn("add an 8 inch filler panel on both ends", base.spec);
    assert.match(both.reply, /Added an 8 inch filler panel on both ends/);
    for (const [ft, art] of [[8, "an"], [11, "an"], [18, "an"], [80, "an"], [6, "a"], [12, "a"], [4, "a"]]) {
      const shaped = drawn("make it an L with a " + ft + " ft return", base.spec);
      assert.match(shaped.reply, new RegExp("with " + art + " " + ft + " ft"), shaped.reply);
      if (art === "an") assert.doesNotMatch(shaped.reply, new RegExp("\\ba " + ft + "\\b"), shaped.reply);
    }
  });
});

describe("adjacent pieces and nudges", () => {
  test("a bartending station is the Blaze beverage center and sits 12 inches from the grill", () => {
    assert.equal(CATALOG["bev-sink"].k, "BLZ-30CKT-SNK");
    assert.equal(CATALOG["bev-sink"].p, 1899);
    const lines = [
      "put a bartending station just left of the grill",
      "add a bartender station just to the left of the grill",
      "put a cocktail station just left of the grill",
      "add a bar center just left of the grill"
    ];
    for (const line of lines) {
      const built = drawn("straight 12 ft island with a grill and a fridge");
      const placed = drawn(line, built.spec);
      assert.deepEqual(placed.spec.legs[0].items, ["bev-sink", "grill", "fridge"], line + " " + placed.reply);
      assert.equal(placed.spec.legs[0].lengthIn, 144, line);
      assert.match(placed.reply, /bartending station/, placed.reply);
      assert.doesNotMatch(placed.reply, /Where should|price to be confirmed|\$\d/, placed.reply);
      const gaps = gapsBetweenGear(placed.code);
      assert.deepEqual(gaps[0].fills, ["fill12"], line + " " + JSON.stringify(gaps));
    }
    const right = drawn("put a bartending station immediately right of the grill", drawn("straight 12 ft island with a grill and a fridge").spec);
    assert.deepEqual(right.spec.legs[0].items, ["grill", "bev-sink", "fridge"], right.reply);
    assert.deepEqual(gapsBetweenGear(right.code)[0].fills, ["fill12"]);
    const beside = drawn("put a trash drawer right next to the grill", drawn("straight 12 ft island with a grill and a fridge").spec);
    assert.deepEqual(beside.spec.legs[0].items, ["grill", "trash", "fridge"], beside.reply);
  });

  test("put a power burner to the left of the griddle adds the burner, not a question about the griddle", () => {
    assert.equal(CATALOG.power.k, "BLZ-PBLTE3");
    assert.equal(CATALOG.power.p, 1499);
    const built = drawn("straight 12 ft island with a griddle and a fridge");
    const first = drawn("put a power burner to the left of the griddle", built.spec);
    assert.deepEqual(first.spec.legs[0].items, ["power", "griddle", "fridge"], first.reply);
    assert.doesNotMatch(first.reply, /Where should the 30 inch griddle/);
    assert.match(first.reply, /power burner/);
    assert.deepEqual(gapsBetweenGear(first.code)[0].fills, ["fill6"], first.reply);
    const again = interpret("put a power burner to the left of the griddle", first.spec);
    assert.doesNotMatch(again.reply, /Where should the 30 inch griddle/);
    assert.deepEqual(again.spec.legs[0].items, ["power", "griddle", "fridge"]);
    const flipped = drawn("move it to the other side of the griddle", first.spec);
    assert.deepEqual(flipped.spec.legs[0].items, ["griddle", "power", "fridge"], flipped.reply);
    assert.match(flipped.reply, /other side|right of the 30 inch griddle/);
    assert.doesNotMatch(flipped.reply, /Where should the 30 inch griddle|on the return/);
    assert.deepEqual(gapsBetweenGear(flipped.code).find(gap => gap.fills.length).fills, ["fill6"]);
    const flipWord = drawn("flip it to the other side of the griddle", flipped.spec);
    assert.deepEqual(flipWord.spec.legs[0].items, ["power", "griddle", "fridge"], flipWord.reply);
    const aroundGrill = drawn("move it to the other side of the grill", drawn("put a power burner just left of the grill", drawn("straight 12 ft island with a grill and a fridge").spec).spec);
    assert.deepEqual(aroundGrill.spec.legs[0].items, ["grill", "power", "fridge"], aroundGrill.reply);
    assert.ok(gapsBetweenGear(aroundGrill.code).some(gap => gap.fills.includes("fill12")), aroundGrill.reply);
    const sink = drawn("put a sink to the right of the fridge", built.spec);
    assert.deepEqual(sink.spec.legs[0].items, ["griddle", "fridge", "sink"], sink.reply);
    assert.doesNotMatch(sink.reply, /Where should the 20 inch fridge/);
    const ice = drawn("put an ice maker to the left of the drawer", drawn("straight 12 ft island with a double drawer and a fridge").spec);
    assert.equal(ice.spec.legs[0].items[0], "ice", ice.reply);
    assert.ok(ice.spec.legs[0].items.indexOf("ice") < ice.spec.legs[0].items.indexOf("drawer"));
    const burner = drawn("put a side burner next to the griddle", built.spec);
    assert.deepEqual(burner.spec.legs[0].items, ["griddle", "side-burner", "fridge"], burner.reply);
    assert.deepEqual(gapsBetweenGear(burner.code)[0].fills, ["fill6"]);
  });

  test("move it over a little bit further slides the last piece along its run", () => {
    let step = drawn("straight 12 ft island with a grill and a fridge");
    step = drawn("put a bartending station just left of the grill", step.spec);
    assert.equal(step.spec.lastMoved, "bev-sink");
    const nudged = drawn("move it over a little bit further", step.spec);
    assert.deepEqual(nudged.spec.legs[0].items, ["bev-sink", "grill", "fridge"], nudged.reply);
    assert.equal(nudged.spec.legs[0].lengthIn, 144);
    assert.match(nudged.reply, /12 inches/);
    assert.match(nudged.reply, /bartending station/);
    assert.doesNotMatch(nudged.reply, /shares its run|Where should|on the return/);
    assert.equal(nudged.spec.lastMoved, "bev-sink");
  });

  test("move it over to feet is a two foot slide, not a leg change", () => {
    const built = drawn("L shaped island, 12 ft grill side with a grill and a fridge, 8 ft return");
    built.spec.lastMoved = "fridge";
    built.spec.lastDir = -1;
    for (const line of ["move it over to feet", "move it over too feet", "move it over two foot"]) {
      const slid = interpret(line, built.spec);
      assert.equal(slid.spec.legs[0].items.includes("fridge"), true, line + " " + slid.reply);
      assert.equal(slid.spec.legs[1].items.includes("fridge"), false, line);
      assert.equal(slid.spec.legs[1].items.includes("grill"), false, line);
      assert.match(slid.reply, /24 inches/, line + " " + slid.reply);
      assert.match(slid.reply, /fridge/, slid.reply);
      assert.doesNotMatch(slid.reply, /needs about|on the return|I left it where it is/, line + " " + slid.reply);
    }
    const six = interpret("move it over six inches", built.spec);
    assert.match(six.reply, /6 inches/, six.reply);
    const foot = interpret("move it over a foot", built.spec);
    assert.match(foot.reply, /12 inches/, foot.reply);
  });

  test("move it back restores the previous side, then the one before that", () => {
    let step = drawn("straight 12 ft island with a griddle and a fridge");
    step = drawn("put a power burner to the left of the griddle", step.spec);
    assert.deepEqual(step.spec.legs[0].items, ["power", "griddle", "fridge"]);
    const fresh = interpret("okay move it back", step.spec);
    assert.match(fresh.reply, /Nothing has moved yet/);
    assert.match(fresh.reply, /unchanged|earlier version/);
    assert.deepEqual(fresh.spec.legs[0].items, ["power", "griddle", "fridge"]);
    step = drawn("move it to the other side of the griddle", step.spec);
    step = drawn("flip it to the other side of the griddle", step.spec);
    assert.deepEqual(step.spec.legs[0].items, ["power", "griddle", "fridge"], step.reply);
    const back = drawn("okay move it back", step.spec);
    assert.deepEqual(back.spec.legs[0].items, ["griddle", "power", "fridge"], back.reply);
    assert.match(back.reply, /Moved the power burner back to the right of the 30 inch griddle/);
    assert.equal(CATALOG.power.k, "BLZ-PBLTE3");
    assert.equal(CATALOG.power.p, 1499);
    assert.doesNotMatch(back.reply, /\$\d/);
    const earlier = drawn("move it back", back.spec);
    assert.deepEqual(earlier.spec.legs[0].items, ["power", "griddle", "fridge"], earlier.reply);
    assert.match(earlier.reply, /back to the left of the 30 inch griddle/);
    for (const line of ["put it back", "undo that", "go back", "never mind, put it where it was", "alright move it back", "now put it back"]) {
      const again = drawn(line, back.spec);
      assert.deepEqual(again.spec.legs[0].items, ["power", "griddle", "fridge"], line + " " + again.reply);
    }
    const leg = drawn("L shaped island, 12 ft grill side with a grill and a fridge, 8 ft return");
    const moved = drawn("move the fridge to the other side", leg.spec);
    assert.deepEqual(moved.spec.legs[1].items, ["fridge"], moved.reply);
    const home = drawn("okay move it back", moved.spec);
    assert.deepEqual(home.spec.legs[0].items, ["grill", "fridge"], home.reply);
    assert.deepEqual(home.spec.legs[1].items, [], home.reply);
  });

  test("countertop color uses a catalog material and does not invent a price", () => {
    const built = drawn("straight 10 ft island with a grill and a fridge");
    const ask = interpret("change the color of the countertop", built.spec);
    assert.equal(ask.spec.counter, "concrete");
    assert.match(ask.reply, /gray color concrete/);
    assert.match(ask.reply, /white concrete/);
    assert.match(ask.reply, /black granite/);
    assert.match(ask.reply, /white quartz/);
    assert.match(ask.reply, /gray quartzite/);
    assert.match(ask.reply, /tan porcelain tile/);
    assert.match(ask.reply, /Which color/);
    assert.match(ask.reply, /quote add/);
    assert.match(ask.reply, /included in the build rate/);
    assert.doesNotMatch(ask.reply, /\$\d/);
    const black = drawn("make the countertop black granite", built.spec);
    assert.equal(black.spec.counter, "granite");
    assert.equal(decodeDesign(black.code).c, "granite");
    assert.match(black.reply, /black granite/);
    assert.match(black.reply, /quote add/);
    const white = drawn("change the counter to white quartz", built.spec);
    assert.equal(white.spec.counter, "quartz");
    assert.equal(decodeDesign(white.code).c, "quartz");
    assert.match(white.reply, /white quartz/);
    const gray = drawn("gray concrete countertop", white.spec);
    assert.equal(gray.spec.counter, "concrete");
    assert.equal(decodeDesign(gray.code).c, "concrete");
    assert.match(gray.reply, /included in the build rate/);
    assert.doesNotMatch(gray.reply, /quote add/);
    const darker = drawn("make the countertop darker", gray.spec);
    assert.equal(darker.spec.counter, "granite", darker.reply);
    const lighter = drawn("lighter countertop", gray.spec);
    assert.equal(lighter.spec.counter, "quartzite", lighter.reply);
    assert.equal(drawn("black", built.spec).spec.counter, "granite");
    assert.equal(drawn("white", built.spec).spec.counter, "concretew");
    assert.equal(drawn("gray", built.spec).spec.counter, "concrete");
    assert.equal(drawn("tan", built.spec).spec.counter, "tilep");
    assert.equal(drawn("brown", built.spec).spec.counter, "tilep");
    const edge = interpret("make the countertop lighter", drawn("make the countertop white quartz", built.spec).spec);
    assert.match(edge.reply, /already the lightest/);
    assert.equal(edge.spec.counter, "quartz");
  });
});

describe("hold to talk", () => {
  test("short holds and junk transcripts are not a design turn", () => {
    assert.equal(holdLongEnough(299), false);
    assert.equal(holdLongEnough(300), true);
    assert.equal(usableTranscript(""), "");
    assert.equal(usableTranscript("[music]"), "");
    assert.equal(usableTranscript("[outro jingle]"), "");
    assert.equal(usableTranscript("grill"), "");
    assert.equal(usableTranscript("um add a grill"), "um add a grill");
  });

  test("iPhone Safari records for Scribe instead of webkit speech", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const android = "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    assert.equal(prefersScribe(iphone), true);
    assert.equal(prefersScribe(android), false);
  });
});
