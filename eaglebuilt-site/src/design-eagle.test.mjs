import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { commitLead } from "./chat-lead.js";
import worker, { EagleRateLimit } from "./worker.js";
import {
  CONFIG,
  applyModelSpec,
  claimsSent,
  classifyTurn,
  decodeDesign,
  holdLongEnough,
  prefersScribe,
  usableTranscript,
  interpret,
  saveReply,
  summaryReply,
  validateContact
} from "../site/assets/eagle-engine.js";
import { guardSpoken, mintVoiceToken, newVoiceSession, readVoiceToken, spendVoiceSession, wantsSave } from "../site/assets/eagle-voice.js";

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
