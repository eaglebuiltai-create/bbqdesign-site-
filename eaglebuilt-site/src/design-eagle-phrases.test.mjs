/* Baseline on 692d2ab, before the fixes in this series: 83 of 122 lines
   passed and 39 failed. The misses were bar on/off, length and "bigger",
   depth, finishes and counters said without a verb, L/U/straight changes,
   "between", questions, undo, start over, and a real add mixed with a
   piece that is not in the catalog. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decodeDesign, interpret } from "../site/assets/eagle-engine.js";

function island(over = {}) {
  const leg = {
    role: over.role || "main",
    lengthIn: over.lengthIn == null ? 120 : over.lengthIn,
    items: over.items ? over.items.slice() : ["grill", "fridge", "combo"],
    stools: over.stools || 0,
    pinEnd: !!over.pinEnd
  };
  if (over.bases) leg.bases = over.bases;
  return {
    shape: over.shape || "straight",
    finish: over.finish || "stucco",
    counter: over.counter || "concrete",
    frame: "cmu",
    depth: 32,
    barOn: !!over.barOn,
    legs: over.legs || [leg]
  };
}

function ell(over = {}) {
  return island({
    shape: "ell",
    barOn: true,
    legs: [
      { role: "grill", lengthIn: 120, items: ["grill", "fridge"], stools: 0, pinEnd: false },
      { role: "bar", lengthIn: 60, items: [], stools: over.stools || 0, pinEnd: false }
    ],
    ...over
  });
}

const fridgeRight = () => island({ items: ["fridge"], barOn: true, pinEnd: true });
const run = () => island({ items: ["grill", "fridge", "combo"], barOn: true, pinEnd: false });

function gearKeys(code) {
  return decodeDesign(code).m.filter(row => !String(row[0]).startsWith("fill") && row[0] !== "corner24");
}

const CANNED = /already on the island|How long should it be|I can make the bar or the grill leg longer/;

const CASES = [];
function add(line, current, expect) {
  CASES.push({ line, current, expect });
}

const BRANDS = ["blaze", "blaise", "blase", "lynx", "coyote", "fire magic", "dcs", "alfresco", "summerset", "hestan", "twin eagles", "diablo", "yoder", "rcs"];
for (const brand of BRANDS) {
  add("um okay so add a " + brand + " grill on the left", fridgeRight, {
    items: ["grill", "fridge"], shape: "straight", lengthIn: 120, barOn: true,
    reply: /grill/i, notReply: CANNED
  });
}

add("add a combo unit under the grill", island({ items: ["grill", "fridge"], barOn: true, pinEnd: true }), {
  items: ["grill", "fridge"], bases: { grill: "combo" }, under: "BLZ-DDC-R-LTSC",
  shape: "straight", barOn: true, reply: /under the grill/i, notReply: CANNED
});
for (const [line, items] of [
  ["add a bbq on the left", ["grill", "fridge"]],
  ["add a barbecue on the left", ["grill", "fridge"]],
  ["add a barbeque on the left", ["grill", "fridge"]],
  ["add an access door on the left", ["door", "fridge"]],
  ["add a side burner on the left", ["side-burner", "fridge"]],
  ["add a power burner on the left", ["power", "fridge"]],
  ["add a sink on the left", ["sink", "fridge"]],
  ["add an ice maker on the left", ["ice", "fridge"]],
  ["add a trash pullout on the left", ["trash", "fridge"]],
  ["add a trash pull-out on the right", ["fridge", "trash"]]
]) {
  add(line, fridgeRight, { items, shape: "straight", barOn: true, reply: /Done|Added/i, notReply: CANNED });
}
for (const line of ["add a beverage center on the right", "add a kegerator on the right", "add a refrigerator on the right"]) {
  add(line, () => island({ items: ["grill"], barOn: true, pinEnd: true }), {
    items: ["grill", "fridge"], shape: "straight", barOn: true, reply: /fridge/i, notReply: CANNED
  });
}
add("add doors and drawers under the grill", island({ items: ["grill", "fridge"], barOn: true, pinEnd: true }), {
  items: ["grill", "fridge"], bases: { grill: "combo" }, under: "BLZ-DDC-R-LTSC", reply: /under the grill/i
});
add("add an access door below the grill", island({ items: ["grill", "fridge"], barOn: true }), {
  bases: { grill: "door" }, under: "BLZ-AD32-R-SC", reply: /under the grill|door/i
});
add("put drawers beneath the grill", island({ items: ["grill", "fridge"], barOn: true }), {
  bases: { grill: "drawer" }, under: "BLZ-DRW2-R-LT", reply: /under the grill|drawer/i
});

const SIZES = [
  ["add a 32 inch grill on the left", "grill"],
  ["add a 32-in grill on the left", "grill"],
  ["add a thirty two inch grill on the left", "grill"],
  ["add a 40 inch grill on the left", "grill-40"],
  ["add a forty inch grill on the left", "grill-40"],
  ["add a 40-in blaze grill on the left", "grill-40"]
];
for (const [line, id] of SIZES) {
  add(line, fridgeRight, { items: [id, "fridge"], reply: /grill/i, notReply: CANNED });
}

add("make it 12 feet", island({ items: ["grill", "fridge"], barOn: true, lengthIn: 120 }), {
  items: ["grill", "fridge"], lengthIn: 144, barOn: true, reply: /12 ft|longer/i, notReply: CANNED
});
add("make the island 8 ft", island({ items: ["grill"], lengthIn: 120 }), {
  items: ["grill"], lengthIn: 96, reply: /8 ft/i
});
add("um can you make it bigger", island({ items: ["grill", "fridge"], lengthIn: 120, barOn: true }), {
  items: ["grill", "fridge"], lengthIn: 144, barOn: true, reply: /longer|ft/i
});
add("make it 24 inches deep", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "fridge"], barOn: true, reply: /32 inches deep/i, notReply: /\$\d/
});

add("turn the bar on", island({ items: ["grill", "fridge"], barOn: false }), {
  items: ["grill", "fridge"], barOn: true, reply: /bar/i
});
add("turn the bar off", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "fridge"], barOn: false, reply: /bar/i
});
add("add a raised bar", island({ items: ["grill"], barOn: false }), {
  items: ["grill"], barOn: true, reply: /bar/i
});
add("room for three stools", island({ items: ["grill", "fridge"], barOn: false }), {
  items: ["grill", "fridge"], barOn: true, stools: 3, reply: /3 stools|three/i
});
add("make the bar longer", ell(), {
  shape: "ell", barOn: true, reply: /bar is now 7 ft/i
});
add("make the bar shorter", ell({ stools: 3 }), {
  shape: "ell", reply: /bar/i
});

add("switch to stacked stone", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "fridge"], finish: "stack", barOn: true, reply: /ledgestone|stone/i
});
add("switch to flagstone", island({ items: ["grill"] }), {
  finish: "flag", items: ["grill"], reply: /flagstone/i
});
add("use stucco", island({ items: ["grill"], finish: "stack" }), {
  finish: "stucco", items: ["grill"], reply: /stucco/i
});
add("change the counter to granite", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "fridge"], counter: "granite", reply: /granite/i, notReply: /\$\d/
});
add("use quartz", island({ items: ["grill"] }), {
  counter: "quartz", items: ["grill"], reply: /quartz/i
});
add("switch to quartzite", island({ items: ["grill"] }), {
  counter: "quartzite", reply: /quartzite/i
});
add("white concrete counter", island({ items: ["grill"] }), {
  counter: "concretew", reply: /concrete/i
});

add("make it an L with a 5 foot bar", island({ items: ["grill", "fridge"], barOn: true, lengthIn: 120 }), {
  shape: "ell", barOn: true, reply: /L|bar/i
});
add("turn this into a straight run", ell(), {
  shape: "straight", reply: /straight/i
});
add("make this a U with 4 ft on each side", island({ items: ["grill", "fridge"], lengthIn: 120 }), {
  shape: "yu", reply: /U/i
});
add("make it an L", island({ items: ["grill", "fridge"], barOn: true }), {
  shape: "straight", items: ["grill", "fridge"], reply: /How long should the bar/i, notReply: CANNED
});

add("remove the fridge", run(), {
  items: ["grill", "combo"], barOn: true, reply: /fridge|Removed/i
});
add("delete the combo", run(), {
  items: ["grill", "fridge"], reply: /combo|Removed/i
});
add("remove the grill and the fridge", run(), {
  items: ["combo"], reply: /Removed/i
});

add("I'd like to move the combo unit underneath the grill", run(), {
  items: ["grill", "fridge"], bases: { grill: "combo" }, under: "BLZ-DDC-R-LTSC",
  barOn: true, lengthIn: 120, reply: /under the grill/i, notReply: /already on the island/
});
add("relocate the combo under the grill", run(), {
  items: ["grill", "fridge"], bases: { grill: "combo" }, under: "BLZ-DDC-R-LTSC", reply: /under the grill/i
});
add("place the combo underneath the grill", run(), {
  bases: { grill: "combo" }, items: ["grill", "fridge"], reply: /under/i
});
add("put the combo below the grill", run(), {
  bases: { grill: "combo" }, items: ["grill", "fridge"], reply: /under/i
});
add("move the fridge to the right end", island({ items: ["fridge", "grill", "combo"] }), {
  reply: /right|fridge/i
});
add("swap fridge and combo", run(), {
  items: ["grill", "combo", "fridge"], reply: /Swapped|swap|fridge/i
});
add("put the sink on the left", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["sink", "grill", "fridge"], reply: /sink|left/i
});
add("put the sink in the middle", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "sink", "fridge"], reply: /sink/i
});
add("put the combo between the grill and the fridge", run(), {
  items: ["grill", "combo", "fridge"], reply: /combo/i
});
add("move the trash next to the grill", island({ items: ["grill", "fridge", "trash"], barOn: true }), {
  items: ["grill", "trash", "fridge"], reply: /trash/i
});
add("put the ice maker beside the grill", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["grill", "ice", "fridge"], reply: /ice/i
});
add("move the fridge to the left side", island({ items: ["grill", "fridge"], barOn: true, pinEnd: true }), {
  items: ["fridge", "grill"], reply: /left|fridge/i
});

add("undo", run(), {
  items: ["grill", "fridge", "combo"], barOn: true, reply: /earlier version|unchanged/i, notReply: CANNED
});
add("start over", run(), {
  items: [], barOn: true, lengthIn: 120, shape: "straight", reply: /Cleared/i
});
add("how much is this", run(), {
  items: ["grill", "fridge", "combo"], barOn: true, reply: /price on the design|catalog/i, notReply: /\$\d/
});
add("what fits on the left", run(), {
  items: ["grill", "fridge", "combo"], reply: /grill|fridge|sink|combo/i, notReply: /\$\d/
});
add("okay so whats the price", run(), {
  items: ["grill", "fridge", "combo"], reply: /catalog/i, notReply: /\$\d/
});

add("add a sink on the left and move the fridge to the right", island({ items: ["grill", "fridge"], barOn: true }), {
  items: ["sink", "grill", "fridge"], reply: /sink/i
});
add("um add a tv and a sink on the left", island({ items: ["grill"], barOn: true }), {
  items: ["sink", "grill"], reply: /TV isn't in the catalog/i
});
add("add a kamado and a side burner on the left", fridgeRight(), {
  items: ["side-burner", "fridge"], reply: /kamado/i
});
add("so yeah put a blaise bbq on the left and a fridge on the right", island({ items: [], barOn: true, lengthIn: 120 }), {
  items: ["grill", "fridge"], reply: /grill/i
});
add("i want a lynx refrigerator on the right and a coyote sink on the left", fridgeRight(), {
  reply: /sink|fridge/i
});

const VOICE = [
  ["hey can i get a grill", fridgeRight(), { items: ["grill", "fridge"], reply: /grill/i }],
  ["yeah add a fridge", island({ items: ["grill"], barOn: false }), { items: ["grill", "fridge"], reply: /fridge/i }],
  ["okay um remove the sink", island({ items: ["grill", "sink", "fridge"] }), { items: ["grill", "fridge"], reply: /sink|Removed/i }],
  ["so make the island longer", island({ items: ["grill"], lengthIn: 96 }), { lengthIn: 120, items: ["grill"], reply: /longer|ft/i }],
  ["please turn off the bar", island({ items: ["grill"], barOn: true }), { barOn: false, items: ["grill"], reply: /bar/i }],
  ["add three stools", island({ items: ["grill"], barOn: true }), { stools: 3, barOn: true, reply: /stool/i }],
  ["switch the finish to brick", island({ items: ["grill"] }), { finish: "brick", reply: /brick/i }],
  ["use a porcelain tile counter", island({ items: ["grill"] }), { counter: "tilep", reply: /tile|quote/i }],
  ["add a double side burner next to the grill", island({ items: ["grill", "fridge"] }), { items: ["grill", "side-burner", "fridge"], reply: /burner/i }],
  ["add a single side burner on the left", fridgeRight(), { items: ["side-burner-single", "fridge"], reply: /burner/i }],
  ["add a griddle on the left", fridgeRight(), { items: ["griddle", "fridge"], reply: /griddle/i }],
  ["add a pizza oven on the left", fridgeRight(), { items: ["pizza", "fridge"], reply: /pizza/i }],
  ["add a smoker on the left", fridgeRight(), { items: ["smoker", "fridge"], reply: /smoker/i }],
  ["nope leave the fridge where it is and add a sink on the left", island({ items: ["grill", "fridge"], pinEnd: true }), { items: ["sink", "grill", "fridge"], reply: /sink/i }]
];
for (const [line, current, expect] of VOICE) add(line, current, expect);

add("move the combo under the grill", island({
  items: ["grill", "fridge"], bases: { grill: "combo" }, barOn: true, pinEnd: true
}), {
  items: ["grill", "fridge"], bases: { grill: "combo" },
  reply: /already in the base under the grill/i, notReply: /already on the island/
});

add("straight 10 ft island with a grill and a fridge", null, {
  shape: "straight", items: ["grill", "fridge"], lengthIn: 120, reply: /straight/i
});
add("L-shape, 10 ft grill leg with a side burner and a fridge, 5 ft bar with 3 stools", null, {
  shape: "ell", barOn: true, reply: /L-shape|bar/i
});

add("add a blaze side burner combo on the right", fridgeRight, { items: ["fridge", "side-burner"], reply: /burner/i });
add("remove the side burner", island({ items: ["grill", "side-burner", "fridge"] }), { items: ["grill", "fridge"], reply: /Removed|burner/i });
add("swap the grill and the fridge", island({ items: ["grill", "fridge"], barOn: true }), { items: ["fridge", "grill"], reply: /Swapped/i });
add("make the grill leg longer", ell(), { shape: "ell", reply: /grill leg/i });
add("change to thin brick", island({ items: ["grill"] }), { finish: "brick", reply: /brick/i });
add("switch to chalk white brick", island({ items: ["grill"] }), { finish: "brickw", reply: /white brick|chalk/i });
add("fieldstone veneer please", island({ items: ["grill"] }), { finish: "cult", reply: /fieldstone/i });
add("i want an 8 foot straight island with a sink", null, { shape: "straight", items: ["sink"], lengthIn: 96, reply: /straight/i });
add("U shaped kitchen, 12 ft main with a grill, 5 ft each side", null, { shape: "yu", reply: /U-shape/i });
add("clear the island", run(), { items: [], barOn: true, reply: /Cleared/i });
add("go back", run(), { items: ["grill", "fridge", "combo"], reply: /earlier version/i });
add("what can i add", run(), { items: ["grill", "fridge", "combo"], reply: /sink|combo|grill/i });
add("add a blaise 32 inch barbecue on the left side", fridgeRight, { items: ["grill", "fridge"], reply: /grill/i });
add("okay so put a fire magic fridge on the right", island({ items: ["grill"], barOn: true }), { items: ["grill", "fridge"], reply: /fridge/i });
add("yeah add a hestan sink on the left and a dcs grill", fridgeRight, { reply: /sink|grill/i });
add("move the doors under the grill", island({ items: ["grill", "fridge", "door"], barOn: true }), { bases: { grill: "door" }, under: "BLZ-AD32-R-SC", reply: /under the grill/i });
add("put the drawers underneath the grill", island({ items: ["grill", "drawer", "fridge"] }), { bases: { grill: "drawer" }, under: "BLZ-DRW2-R-LT", reply: /under/i });
add("make the island 14 ft and add a sink on the left", island({ items: ["grill"], lengthIn: 120 }), { items: ["sink", "grill"], lengthIn: 168, reply: /sink|14/i });
add("no bar and add a trash pullout on the right", island({ items: ["grill"], barOn: true }), { barOn: false, reply: /trash|bar/i });
add("add 2 stools and a sink on the left", island({ items: ["grill"], barOn: false }), { stools: 2, barOn: true, reply: /stool|sink/i });
add("is a television in the catalog", run(), { items: ["grill", "fridge", "combo"], reply: /TV isn't in the catalog/i });
add("how long is the bar", ell(), { shape: "ell", reply: /bar|5 ft|kept/i });

describe("customer phrase suite", () => {
  test("at least 120 customer lines", () => {
    assert.ok(CASES.length >= 120, "suite has " + CASES.length + " lines");
  });
  for (const entry of CASES) {
    test(entry.line, () => {
      const current = typeof entry.current === "function" ? entry.current() : entry.current;
      const result = interpret(entry.line, current);
      const expect = entry.expect;
      const leg0 = result.spec && result.spec.legs[0];
      if (expect.items) assert.deepEqual(leg0.items, expect.items, result.reply);
      if (expect.bases) assert.deepEqual(leg0.bases, expect.bases, result.reply);
      if (expect.shape) assert.equal(result.spec.shape, expect.shape, result.reply);
      if (expect.barOn != null) assert.equal(!!result.spec.barOn, expect.barOn, result.reply);
      if (expect.lengthIn != null) assert.equal(leg0.lengthIn, expect.lengthIn, result.reply);
      if (expect.finish) assert.equal(result.spec.finish, expect.finish, result.reply);
      if (expect.counter) assert.equal(result.spec.counter, expect.counter, result.reply);
      if (expect.stools != null) assert.equal(leg0.stools, expect.stools, result.reply);
      if (expect.under) {
        const grill = gearKeys(result.code).find(row => row[0] === "BLZ-4LTE3" || row[0] === "BLZ-5LTE3");
        assert.ok(grill, result.reply);
        assert.equal(grill[5], expect.under, result.reply);
      }
      if (expect.reply) assert.match(result.reply, expect.reply);
      if (expect.notReply) assert.doesNotMatch(result.reply, expect.notReply);
      if (current && expect.items && expect.items.length === 0) {
        assert.equal(result.spec.shape, current.shape);
      }
      if (current && result.spec) {
        const wiped = current.legs.some(l => (l.items || []).length) && result.spec.legs.every(l => !(l.items || []).length) && !/Cleared/.test(result.reply);
        assert.equal(wiped, false, result.reply);
      }
    });
  }
});
