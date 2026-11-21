/**
 * Design Eagle layout engine.
 *
 * One module, imported by the page, the worker, and the tests. The model
 * never writes drawing code. It may only propose a spec, and every proposal
 * comes through validateSpec / compileSpec before a visitor sees it.
 *
 * White-label seam: CONFIG is the only place the brand, colors, phone,
 * booking link, and lead-routing binding names live. Phase 1 reads those
 * bindings from the EagleBuilt worker. A later embed swaps CONFIG, not the
 * layout math. ?embed=1 on /design-eagle/ hides the site header for that.
 */

export const CONFIG = {
  product: "Design Eagle",
  brand: "EagleBuilt",
  brandMark: "EAGLEBUILT",
  accentMark: "AI",
  phoneDisplay: "(916) 359-9692",
  phoneTel: "+19163599692",
  colors: {
    bg: "#070A12",
    bg2: "#0B111C",
    panel: "#0F1826",
    line: "#1E2C42",
    text: "#E7EEF7",
    muted: "#8DA0B8",
    dim: "#5F7391",
    accent: "#2E9BFF",
    accent2: "#1668C4",
    hot: "#E8342B"
  },
  booking: {
    enabled: false,
    label: "Book a live design session with John",
    with: "John Simpson",
    url: "",
    pending: "Live booking isn't connected yet."
  },
  leads: {
    source: "design-eagle",
    page: "/design-eagle/",
    bindings: {
      kv: "CHAT_LEADS",
      slack: "LEAD_SLACK_WEBHOOK_URL",
      email: "EMAIL",
      emailTo: "LEAD_EMAIL_TO",
      crmUrl: "CRM_INGEST_URL",
      crmKey: "CRM_LEADS_API_KEY",
      visitorKey: "RESEND_API_KEY"
    },
    visitorFrom: "EagleBuilt AI <info@eaglebuilt.ai>",
    notifyTo: "info@eaglebuilt.ai"
  },
  designer: {
    appPath: "/design/app/",
    pagePath: "/design-eagle/",
    shareOrigin: "https://eaglebuilt.ai",
    eagleParam: "eagle=1"
  },
  /* ElevenLabs premade Adam. Swap voiceId here for a cloned EB voice.
     The API key never lives in this object. */
  voice: {
    provider: "elevenlabs",
    name: "Adam",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    modelId: "eleven_flash_v2_5",
    /* Batch speech-to-text. scribe_v1 is rejected immediately (HTTP 422). */
    sttModelId: "scribe_v2"
  },
  voiceLimits: {
    sessionMs: 30 * 60 * 1000,
    sessionChars: 8000,
    maxChars: 900,
    /* One refresh after the budget runs low. 16k chars a visit stays well under a Creator month. */
    maxRenew: 1
  }
};

export function publicConfig() {
  return {
    product: CONFIG.product,
    brand: CONFIG.brand,
    brandMark: CONFIG.brandMark,
    accentMark: CONFIG.accentMark,
    phoneDisplay: CONFIG.phoneDisplay,
    phoneTel: CONFIG.phoneTel,
    colors: { ...CONFIG.colors },
    booking: { ...CONFIG.booking },
    designer: {
      appPath: CONFIG.designer.appPath,
      pagePath: CONFIG.designer.pagePath
    },
    voice: {
      provider: CONFIG.voice.provider,
      name: CONFIG.voice.name,
      voiceId: CONFIG.voice.voiceId
    }
  };
}

/* Widths are the designer's module widths: cutout + 2 inches, except where
   the catalog stores an explicit overall width (the Yoder smoker, fillers,
   the corner). Prices are the catalog's p field. Under-counter keys are the
   combo or door defaultUnder() would pick for that width. */
export const CATALOG = {
  grill: { k: "BLZ-4LTE3", spoken: "a 32 inch Blaze grill", w: 32.625, p: 2499, under: "BLZ-DDC-R-LTSC" },
  "grill-40": { k: "BLZ-5LTE3", spoken: "a 40 inch Blaze grill", w: 40.375, p: 2999, under: "BLZ-DDC-R-39-LTSC" },
  "side-burner": { k: "BLZ-SB2-LTEPLUS", spoken: "a double side burner", w: 13, p: 949 },
  "side-burner-single": { k: "BLZ-SB1-LTE3", spoken: "a single side burner", w: 13.25, p: 549 },
  fridge: { k: "BLZ-SSRF20-4.3", spoken: "a 20 inch fridge", w: 24.625, p: 1549 },
  "fridge-24": { k: "BLZ-SSRF-5.5", spoken: "a 24 inch fridge", w: 28, p: 2199 },
  sink: { k: "BLZ-30CKT-SNK", spoken: "a 30 inch sink", w: 30.25, p: 1899, under: "BLZ-AD25-R-SC" },
  /* Blaze 30" beverage center: sink plus ice bin. Same SKU and $1899 as the
     designer catalog (BLZ-30CKT-SNK, "Sink + ice bin"). Bartending station,
     cocktail station, and bar center are this unit, not a separate price. */
  "bev-sink": { k: "BLZ-30CKT-SNK", spoken: "a 30 inch bartending station", w: 30.25, p: 1899, under: "BLZ-AD25-R-SC" },
  power: { k: "BLZ-PBLTE3", spoken: "a power burner", w: 16, p: 1499 },
  griddle: { k: "BLZ-GRIDDLE-LTE3", spoken: "a 30 inch griddle", w: 30.25, p: 2749, under: "BLZ-AD25-R-SC" },
  pizza: { k: "BLZ-26-PZOVN", spoken: "a 26 inch pizza oven", w: 26.5, p: 2499 },
  ctpizza: { k: "ctpizza", spoken: "a countertop pizza oven", w: 24, p: 0 },
  trash: { k: "BLZ-TRLP-DRW-H", spoken: "a trash drawer", w: 20.375, p: 695 },
  door: { k: "BLZ-AD32-R-SC", spoken: "a 32 inch access door", w: 30.75, p: 521 },
  "door-25": { k: "BLZ-AD25-R-SC", spoken: "a 25 inch access door", w: 23.375, p: 429 },
  "door-40": { k: "BLZ-AD40-R-SC", spoken: "a 40 inch access door", w: 37.875, p: 579 },
  /* 17x24 vertical and 24x17 horizontal. MSRP $463.24 for both, BBQGuys
     access-door list, checked 2026-11-21 (current price there is $429):
     https://www.bbqguys.com/d/2178/outdoor-kitchens/storage/access-doors
     Same list price at https://www.garcogrillsandmore.com/Blaze-BLZ-single-2417-R-p/blz-single-2417-r-sc.htm
     and https://www.garcogrillsandmore.com/Blaze-BLZ-SH-22417-R-SC-p/blz-sh-2417-r-sc.htm
     Stored price is that MSRP rounded to the dollar, matching the designer catalog. */
  "door-v": { k: "BLZ-SINGLE-2417-R-SC", spoken: "a 17 inch single access door", w: 19, p: 463 },
  "door-h": { k: "BLZ-SH-2417-R-SC", spoken: "a 24 inch horizontal access door", w: 26.125, p: 463 },
  /* Real catalog SKUs. "combo unit" is the door + drawer combo, not a side burner. */
  combo: { k: "BLZ-DDC-R-LTSC", spoken: "a door and drawer combo", w: 32.25, p: 986 },
  drawer: { k: "BLZ-DRW2-R-LT", spoken: "a double drawer", w: 17.5, p: 812 },
  "drawer-3": { k: "BLZ-DRW3-R-LT", spoken: "a triple drawer", w: 17.5, p: 1044 },
  bev: { k: "BLZ-GDBEV-5.5", spoken: "a beverage refrigerator", w: 28, p: 2049 },
  ctwok: { k: "ctwok", spoken: "a countertop wok", w: 16, p: 0 },
  ice: { k: "BLZ-ICEMKR-50GR", spoken: "a 15 inch ice maker", w: 18.75, p: 2749 },
  smoker: { k: "YS640S-CM", spoken: "a pellet smoker", w: 54.2, p: 3049 },
  corner: { k: "corner24", spoken: "a corner", w: 24, p: 349 }
};

const FILLERS = [24, 16, 12, 8, 6, 4];
const MIN_LEG = 48;
const MAX_LEG = 240;
const HARD_MAX = 288;
const DEPTH = 32;

const FINISHES = {
  stucco: "stucco",
  stack: "ledgestone veneer",
  cult: "fieldstone veneer",
  flag: "flagstone veneer",
  brick: "thin brick veneer",
  brickw: "chalk white brick",
  tile: "porcelain tile veneer"
};

/* Names and colors match the designer swatches. Stone and tile stay quote
   adds. Concrete stays in the build rate. No new prices. */
const COUNTERS = {
  concrete: { n: "gray color concrete", color: "gray", quote: false },
  concretew: { n: "white concrete", color: "white", quote: false },
  concrete2: { n: "2 inch gray concrete", color: "gray", quote: false },
  granite: { n: "black granite", color: "black", quote: true },
  quartz: { n: "white quartz", color: "white", quote: true },
  quartzite: { n: "gray quartzite", color: "gray", quote: true },
  tilep: { n: "tan porcelain tile", color: "tan", quote: true }
};
const COUNTER_SHADE = ["granite", "concrete", "quartzite", "concretew", "quartz"];
const COLOR_COUNTER = { black: "granite", white: "concretew", gray: "concrete", tan: "tilep", brown: "tilep" };

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20
};

const ITEM_RES = [
  [/single side burner/, "side-burner-single"],
  [/side burner combo|double side burner|side burner|sideburner/, "side-burner"],
  [/table\s*top\s*(?:walk|wok)|tabletop\s*(?:walk|wok)/, "ctwok"],
  [/power burner|\bwok\b/, "power"],
  [/\b40\s*(?:inch|in)?\s*(?:\w+\s+){0,2}grill/, "grill-40"],
  [/griddle/, "griddle"],
  [/pizza oven on top|pizza on top|countertop pizza|tabletop pizza/, "ctpizza"],
  [/pizza oven|\bpizza\b/, "pizza"],
  [/smoker/, "smoker"],
  [/ice maker|icemaker/, "ice"],
  [/trash pull ?out|pull ?out trash|trash drawer|\btrash\b/, "trash"],
  [/doors and drawers|door\s+(?:and\s+)?drawers?(?:\s+combo)?|combo unit|combo cabinet|\bcombo\b/, "combo"],
  [/three drawer unit|drawer unit three drawers|triple drawer|three drawers|drawer unit three|3 drawers/, "drawer-3"],
  [/two drawers|double drawer|drawer unit/, "drawer"],
  [/\bdrawers?\b/, "drawer"],
  [/horizontal access doors?|horizontal doors?/, "door-h"],
  [/single access doors?|single doors?|one door\b/, "door-v"],
  [/access doors?/, "door"],
  [/\bdoors?\b/, "door"],
  [/beverage center sink|bar sink|beverage sink|bartending station|bartender station|bar station|cocktail station|bar center/, "bev-sink"],
  [/\bsink\b/, "sink"],
  [/beverage refrigerator|beverage fridge|bev fridge/, "bev"],
  [/beverage center|bev center|refrigerator|\bfridge\b|\bcooler\b|kegerator|\bkeg\b/, "fridge"],
  [/\b(?:bbq|barbeque|barbecue)(?:\s+grill)?\b|\bgrill\b/, "grill"]
];

const UNKNOWN_RES = [
  [/\b(tv|television)\b/, "A TV isn't in the catalog, so I left it off."],
  [/\bkamado\b|big green egg/, "A kamado isn't a catalog cutout here, so I didn't add one."]
];

const CLARIFY = "Do you want a straight run, an L, or a U? A length for each leg helps, for example a 10 ft grill leg and a 5 ft bar.";

function num(token) {
  if (WORD_NUM[token] != null) return WORD_NUM[token];
  const n = parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

export function normalize(text) {
  let t = String(text || "").toLowerCase().replace(/[’']/g, "'");
  t = t.replace(/\bel[\s-]*shaped?\b/g, "l shaped");
  t = t.replace(/\byou[\s-]*shaped?\b/g, "u shaped");
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:"|″|”)/g, "$1 inch ");
  t = t.replace(/(\d)\s*'/g, "$1 ft");
  t = t.replace(/(\d)\s*ft\b/g, "$1 ft");
  t = t.replace(/(\d)\s*-\s*(foot|feet|ft)\b/g, "$1 ft");
  t = t.replace(/\b(?:to|too|two)\s+feet\b/g, "2 ft");
  t = t.replace(/\btwo\s+foot\b/g, "2 ft");
  t = t.replace(/\b(?:a|one)\s+foot\b/g, "12 inch");
  t = t.replace(/\bsix\s+inches\b/g, "6 inch");
  t = t.replace(/\b(foot|feet)\b/g, "ft");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)\s+ft\b/g, "$1 ft by $2 ft");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s+ft\s+by\s+(\d+(?:\.\d+)?)(?!\s*ft)\b/g, "$1 ft by $2 ft");
  t = t.replace(/[^a-z0-9.\s]/g, " ");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)(?!\s*ft)\b/g, (full, a, b) => {
    const x = Number(a);
    const y = Number(b);
    if (x < 3 || y < 3 || x > 40 || y > 40) return full;
    return a + " ft by " + b + " ft";
  });
  /* Leg lengths said in inches. Appliance sizes ("32 inch grill") stay put. */
  t = t.replace(/\b(\d+(?:\.\d+)?)\s*(?:inches|inch|in)\b(?!\s+(?:grill|bbq|barbecue|barbeque|fridge|refrigerator|burner|door|doors|combo|drawer|drawers|sink|trash|keg|cooler|ice|pizza|griddle|smoker|blaze))/g, (full, n) => {
    const inches = Number(n);
    if (!Number.isFinite(inches) || inches < 48) return full;
    const ft = Math.round((inches / 12) * 10) / 10;
    return (ft % 1 === 0 ? String(ft) : ft.toFixed(1)) + " ft";
  });
  t = t.replace(/\b12\s*(?:inch(?:es)?|in)?\s*to\s*2\s*ft(?:\s*away)?\b/g, " grillgap ");
  t = t.replace(/\bi want to refrigerator\b/g, "i want a refrigerator");
  return t.replace(/\s+/g, " ").trim();
}

function detectShape(t) {
  if (/\bu\s*shape|\bu shaped|\bbig u\b|\ba u\b|\bu island\b/.test(t)) return "yu";
  if (/\bl\s*shape|\bl shaped|\ban l\b|\bell\b|\bcorner\b|\bl with\b|\bfoot l\b|\bft l\b|\bl island\b|\breturn\b/.test(t)) return "ell";
  if (/\bstraight\b|\blinear\b|\bsingle run\b/.test(t)) return "straight";
  return "";
}

function findLengths(t) {
  const out = [];
  const re = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|\d+(?:\.\d+)?)\s*ft\b/g;
  let m;
  while ((m = re.exec(t))) {
    const ft = num(m[1]);
    if (ft == null) continue;
    const from = Math.max(0, m.index - 24);
    const before = t.slice(from, m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14);
    out.push({ ft, index: m.index, end: m.index + m[0].length, before, after, role: roleOf(before, after) });
  }
  return out;
}

function roleOf(before, after) {
  if (/\beach side\b/.test(after)) return "each";
  if (/\b(bar|stools?)\b/.test(after)) return "bar";
  if (/\bleft\b/.test(after)) return "left";
  if (/\bright\b/.test(after)) return "right";
  if (/\b(return|short)\b/.test(after)) return "return";
  if (/\bone side\b/.test(after)) return "grill";
  if (/\b(?:grill\s+(?:side|leg|run)|cook|main|back)\b/.test(after)) return "grill";
  const tail = before.slice(-18);
  if (/\b(?:grill\s+(?:side|leg|run)|main|back)\b/.test(tail)) return "grill";
  if (/\bbar\b/.test(tail)) return "bar";
  return "";
}

function stripRoleWords(text) {
  return String(text || "")
    .replace(/\bgrill\s+(leg|run)\b/g, " ")
    .replace(/\bgrill\s+side\b(?!\s+burner)/g, " ");
}

/* Placement phrases name a spot, not a second grill. Tokens stay so whereOf can see them. */
function prepareGearText(text) {
  return stripRoleWords(String(text || ""))
    .replace(/\bjust to the left of the (?:grill|bbq|barbecue|barbeque)\b/g, " __leftadj__ ")
    .replace(/\bjust left of the (?:grill|bbq|barbecue|barbeque)\b/g, " __leftadj__ ")
    .replace(/\bimmediately right of the (?:grill|bbq|barbecue|barbeque)\b/g, " __rightadj__ ")
    .replace(/\bright next to the (?:grill|bbq|barbecue|barbeque)\b/g, " __next__ ")
    .replace(/\bnext to the grill\b/g, " __next__ ")
    .replace(/\bbeside the grill\b/g, " __next__ ")
    .replace(/\bby the grill\b/g, " __next__ ")
    .replace(/\bbetween the grill and the (?:fridge|refrigerator)\b/g, " __between__ ")
    .replace(/\bin the middle\b|\bin the center\b/g, " __between__ ")
    .replace(/\b(?:under|underneath|below|beneath) the (?:(?:barbecue|barbeque|bbq|blaze)\s+)?(?:grill|bbq|barbecue|barbeque)\b/g, " __under__ ")
    .replace(/\b(?:under|underneath|below|beneath) it\b/g, " __under__ ")
    .replace(/\bend of the grill(?: leg)?\b/g, " __end__ ")
    .replace(/\bunder the bar\b/g, " __bar__ ")
    .replace(/\bon the bar(?: side)?\b/g, " __bar__ ")
    .replace(/\s+/g, " ")
    .trim();
}

function whereOf(after) {
  if (/__bar__|\bunder the bar\b|\bon the bar\b/.test(after)) return "bar";
  if (/__under__/.test(after)) return "under";
  if (/__between__/.test(after)) return "between";
  if (/__leftadj__/.test(after)) return "leftadj";
  if (/__rightadj__/.test(after)) return "rightadj";
  if (/__next__|\bnext to\b|\bbeside\b/.test(after)) return "next";
  if (/__end__|\bend of\b/.test(after)) return "end";
  if (/\bright side\b|\bon the right\b|\bto the right\b|\bright end\b|\bright\b/.test(after)) return "right";
  if (/\bleft side\b|\bon the left\b|\bto the left\b|\bleft end\b|\bleft\b/.test(after)) return "left";
  if (/\bon the other\b|\bother side\b/.test(after)) return "return";
  if (/\bone side\b/.test(after)) return "main";
  return "";
}

function findItemHits(text) {
  const src = prepareGearText(text);
  const used = [];
  const hits = [];
  for (const [re, id] of ITEM_RES) {
    const global = new RegExp(re.source, "g");
    let m;
    while ((m = global.exec(src))) {
      const from = m.index;
      const to = from + m[0].length;
      if (used.some(span => from < span.to && to > span.from)) continue;
      used.push({ from, to });
      hits.push({ index: from, end: to, id, where: "" });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  for (let i = 0; i < hits.length; i++) {
    const next = i + 1 < hits.length ? hits[i + 1].index : src.length;
    hits[i].where = whereOf(src.slice(hits[i].end, next));
  }
  /* "doors and drawers under the bar" — the phrase covers the whole list.
     "on the right" stays on the piece it follows, so a grill named first is not moved. */
  const tail = hits.length ? whereOf(src.slice(hits[hits.length - 1].end)) : "";
  if (tail === "bar") {
    for (const hit of hits) if (!hit.where) hit.where = "bar";
  }
  /* "on one side ... on the other" is the two legs of an L, in that order. */
  if (/\bone side\b/.test(src) && /\bon the other\b|\bother side\b/.test(src) && hits.length >= 2) {
    if (!hits[0].where || hits[0].where === "main") hits[0].where = "main";
    if (!hits[1].where || hits[1].where === "return") hits[1].where = "return";
  }
  return hits;
}

function findItems(text) {
  const items = [];
  for (const hit of findItemHits(text)) if (!items.includes(hit.id)) items.push(hit.id);
  return items;
}

function pieceOnSpec(spec, id) {
  if (!spec || !spec.legs) return false;
  return spec.legs.some(l => (l.items || []).includes(id) || (l.bases && Object.values(l.bases).includes(id)));
}

/* "Pizza oven" is the built-in unless the island already has the countertop
   one. A move should take the oven that is actually there. */
function resolvePresent(id, spec) {
  if (id === "pizza" && spec && !pieceOnSpec(spec, "pizza") && pieceOnSpec(spec, "ctpizza")) return "ctpizza";
  if (id === "ctpizza" && spec && !pieceOnSpec(spec, "ctpizza") && pieceOnSpec(spec, "pizza")) return "pizza";
  return id;
}

function speechClean(text) {
  return String(text || "")
    .replace(/\b(uh+|um+|er+|ah+|hmm+)\b/g, " ")
    .replace(/\ball right\b/g, " ")
    .replace(/\b(basically|actually|kinda|sorta|please|just|like|okay|ok|alright|so|well|yeah|yep|hey)\b/g, " ")
    .replace(/^\s*now\b/, " ")
    .replace(/\b(blaise|blase|blayze|blaze|lynx|coyote|fire magic|firemagic|dcs|alfresco|summerset|hestan|twin eagles|diablo|yoder|rcs)\b/g, " ")
    .replace(/\bthirty[\s-]*two\b/g, "32")
    .replace(/\bforty[\s-]*two\b/g, "42")
    .replace(/\bforty\b/g, "40")
    .replace(/\s+/g, " ")
    .trim();
}

function findStools(text) {
  const m = text.match(/\b(one|two|three|four|five|six|seven|eight|\d+)\s+stools?\b/);
  if (!m) return 0;
  return Math.max(0, Math.round(num(m[1]) || 0));
}

function findUnknown(text) {
  const notes = [];
  for (const [re, note] of UNKNOWN_RES) if (re.test(text)) notes.push(note);
  return notes;
}

function finishOf(text) {
  if (/flagstone/.test(text)) return "flag";
  if (/fieldstone/.test(text)) return "cult";
  if (/chalk|white brick/.test(text)) return "brickw";
  if (/thin brick|brick veneer|\bbrick\b/.test(text)) return "brick";
  if (/porcelain tile veneer|tile veneer/.test(text)) return "tile";
  if (/stone veneer|ledgestone|stacked stone/.test(text)) return "stack";
  if (/\bstucco\b/.test(text)) return "stucco";
  return "";
}

function wallTalk(text) {
  return /\b(?:brick|stucco|veneer|flagstone|fieldstone|ledgestone|finish)\b/.test(text);
}

function colorWord(text) {
  if (/\bblack\b/.test(text)) return "black";
  if (/\bwhite\b/.test(text)) return "white";
  if (/\bgr[ae]y\b/.test(text)) return "gray";
  if (/\btan\b/.test(text)) return "tan";
  if (/\bbrown\b/.test(text)) return "brown";
  return "";
}

/* A counter color maps onto a catalog key. The swatch already on that key
   is the color the plan and the 3D draw. */
function counterOf(text) {
  const t = String(text || "");
  if (wallTalk(t) && !/\bcounter(?:\s*top)?\b/.test(t)) return "";
  if (/quartzite/.test(t)) return "quartzite";
  if (/quartz/.test(t)) return "quartz";
  if (/granite/.test(t)) return "granite";
  if (/white concrete/.test(t)) return "concretew";
  if (/\b2\s+inch\b/.test(t) && /concrete/.test(t)) return "concrete2";
  if (/porcelain|\btile counter\b|\btilep\b/.test(t)) return "tilep";
  if (/concrete/.test(t)) return "concrete";
  const color = colorWord(t);
  if (!color) return "";
  const named = /\bcounter(?:\s*top)?\b/.test(t);
  const bare = /^(?:black|white|gr[ae]y|tan|brown)$/.test(t.trim());
  const brief = /\b(?:make|change|set|use)\b/.test(t) && t.trim().split(/\s+/).length <= 5;
  if (named || bare || brief) return COLOR_COUNTER[color];
  return "";
}

function counterShade(t, spec) {
  if (!/\b(?:darker|lighter)\b/.test(t)) return null;
  if (wallTalk(t) && !/\bcounter(?:\s*top)?\b/.test(t)) return null;
  if (!/\bcounter(?:\s*top)?\b/.test(t) && findItems(t).length) return null;
  const cur = spec && spec.counter || "concrete";
  let i = COUNTER_SHADE.indexOf(cur);
  if (i < 0) i = 1;
  if (/\bdarker\b/.test(t)) {
    if (i <= 0) return { same: "darkest" };
    return { id: COUNTER_SHADE[i - 1] };
  }
  if (i >= COUNTER_SHADE.length - 1) return { same: "lightest" };
  return { id: COUNTER_SHADE[i + 1] };
}

function asksCounterColor(t) {
  if (!/\bcounter(?:\s*top)?\b/.test(t)) return false;
  if (!/\b(?:color|colour)\b/.test(t)) return false;
  if (counterOf(t) || /\b(?:darker|lighter)\b/.test(t)) return false;
  return true;
}

function counterChoices() {
  const list = Object.keys(COUNTERS).map(id => COUNTERS[id].n).join(", ");
  return "The countertop choices are " + list + ". Gray color concrete, white concrete, and the 2 inch top are included in the build rate. Granite, quartz, quartzite, and porcelain tile are quote adds, so I won't put a price on them. Which color do you want?";
}

function counterNote(id) {
  const named = COUNTERS[id];
  if (!named) return "Switched the countertop.";
  if (named.quote) return "Switched the countertop to " + named.n + ", which the designer lists as a quote add, so I won't put a price on it.";
  return "Switched the countertop to " + named.n + ". That color is included in the build rate.";
}

function frameOf(text) {
  if (/steel stud/.test(text)) return "stud";
  if (/\bcmu\b|block\b/.test(text) && /frame|stud|block/.test(text)) return "cmu";
  return "";
}

function blankSpec(over) {
  return {
    shape: "straight",
    finish: "stucco",
    counter: "concrete",
    frame: "cmu",
    depth: DEPTH,
    barOn: false,
    legs: [],
    ...over
  };
}

function leg(role, lengthIn, items, stools, pinEnd, bases) {
  const out = { role, lengthIn, items: items || [], stools: stools || 0, pinEnd: !!pinEnd };
  if (bases && Object.keys(bases).length) out.bases = bases;
  return out;
}

/* "fridge on the left" and "side burner on the right" are positions on this run, around the grill. */
function orderBySide(items, text) {
  const wanted = new Set(items);
  const hits = [];
  for (const hit of findItemHits(text)) {
    if (!wanted.has(hit.id) || hits.some(h => h.id === hit.id)) continue;
    hits.push(hit);
  }
  const left = hits.filter(h => h.where === "left").map(h => h.id);
  const right = hits.filter(h => h.where === "right" || h.where === "end").map(h => h.id);
  const mid = items.filter(id => !left.includes(id) && !right.includes(id));
  return { items: [...left, ...mid, ...right], pinEnd: right.length > 0 };
}

function withDefaultGrill(items, text) {
  const next = items.slice();
  const cooking = next.some(id => id === "grill" || id === "grill-40" || id === "griddle" || id === "power" || id === "pizza" || id === "smoker");
  const asked = /\bgrill\s+(leg|side|run)\b/.test(text) || next.includes("side-burner") || next.includes("side-burner-single");
  if (asked && !cooking) next.unshift("grill");
  return next;
}

/* "two drawers underneath the grill" is the grill base, not a cabinet beside it. */
function splitUnder(text, items) {
  const list = items.slice();
  const bases = {};
  for (const hit of mentionHits(text)) {
    if (hit.where !== "under" || !isBaseCabinet(hit.id) || !list.includes(hit.id)) continue;
    const host = hit.host && list.includes(hit.host)
      ? hit.host
      : (list.includes("grill-40") && !list.includes("grill") ? "grill-40" : "grill");
    if (!list.includes(host)) continue;
    bases[host] = hit.id;
  }
  const skip = new Set(Object.values(bases));
  return { items: list.filter(id => !skip.has(id)), bases };
}

function splitSegments(t) {
  const re = /\b(?:then on the next part(?: of the island)?|then the next side(?: of the island)?|on the next part(?: of the island)?|the next part(?: of the island)?|the next side(?: of the island)?|next part(?: of the island)?|next side(?: of the island)?|then on the other side|the third side|(?:then |on |at )?the corner|left leg|right leg)\b/g;
  const chunks = [];
  let last = 0;
  let m;
  while ((m = re.exec(t))) {
    chunks.push(t.slice(last, m.index).trim());
    last = m.index + m[0].length;
  }
  chunks.push(t.slice(last).trim());
  return chunks.filter(Boolean);
}

function buildSegmented(chunks, grillGap, unknown) {
  const roles = ["grill", "left", "right"];
  const lengths = [120, 72, 72];
  const spec = blankSpec({ shape: "yu", barOn: false, grillGap: grillGap || 0 });
  const notes = unknown.slice();
  notes.push("I used 10 ft for the main run and 6 ft for the returns. Say if you want different lengths.");
  if (grillGap) notes.push("I left 2 ft between the grill and the side burner.");
  chunks.slice(0, 3).forEach((chunk, i) => {
    const hits = mentionHits(chunk);
    const items = [];
    const bases = {};
    for (const hit of hits) {
      if (hit.where === "under" && isBaseCabinet(hit.id)) {
        const host = hit.host || (i === 0 ? "grill" : "");
        if (host) bases[host] = hit.id;
        else items.push(hit.id);
      } else if (!items.includes(hit.id)) items.push(hit.id);
    }
    const legItems = i === 0 ? withDefaultGrill(items, chunk) : items;
    const legObj = leg(roles[i], lengths[i], legItems, 0);
    if (Object.keys(bases).length) legObj.bases = bases;
    legObj.fixed = true;
    spec.legs.push(legObj);
  });
  while (spec.legs.length < 3) {
    const i = spec.legs.length;
    const legObj = leg(roles[i], lengths[i], [], 0);
    legObj.fixed = true;
    spec.legs.push(legObj);
  }
  if (spec.legs.some(l => (l.items || []).includes("ctpizza"))) {
    notes.push("The countertop pizza oven sits on the counter and has no equipment price in the catalog.");
  }
  return { handled: true, spec, notes };
}

function parseNew(t) {
  const grillGap = /\bgrillgap\b/.test(t) ? 24 : 0;
  const body = t.replace(/\bgrillgap\b/g, " ");
  const segments = splitSegments(body);
  if (detectShape(t) === "yu" && segments.length > 1 && !findLengths(body).length) {
    return buildSegmented(segments, grillGap, findUnknown(t));
  }
  const shapeWord = detectShape(t);
  const found = findLengths(t);
  const unknown = findUnknown(t);
  const itemsAnywhere = findItems(t);
  if (!found.length && !itemsAnywhere.length && !findStools(t)) {
    const recognized = /\b(island|kitchen|bbq|barbeque|design|leg|bar)\b/.test(t);
    return { handled: recognized || t.split(" ").length < 14, clarify: CLARIFY, notes: unknown };
  }
  if (!found.length) {
    return { handled: true, clarify: "How long should it be, and is it a straight run, an L, or a U?", notes: unknown };
  }

  const parts = [];
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].index : t.length;
    parts.push({ ...found[i], text: t.slice(found[i].index, end) });
  }
  const bySplit = parts.length === 2 && /\bby\b/.test(parts[0].text) && !findItems(parts[0].text).length;
  const trailingItems = findItems(parts[parts.length - 1].text);
  const leadItems = findItems(t.slice(0, found[0].index));

  function itemsFor(index) {
    if (bySplit) return index === 0 ? trailingItems.slice() : [];
    return findItems(parts[index].text);
  }

  let shape = shapeWord;
  if (!shape && found.some(h => h.role === "each" || h.role === "left" || h.role === "right")) shape = "yu";
  if (!shape && found.length >= 2) shape = "ell";
  if (!shape) shape = "straight";

  if (shape === "ell" && found.length < 2) {
    return {
      handled: true,
      clarify: "How long should the other leg be? I have " + found[0].ft + " ft so far.",
      notes: unknown
    };
  }
  if (shape === "yu" && found.length < 2 && !found.some(h => h.role === "each" || h.role === "left" || h.role === "right")) {
    return {
      handled: true,
      clarify: "How long should the two return legs be? I have the " + found[0].ft + " ft run.",
      notes: unknown
    };
  }

  const spec = blankSpec({
    shape,
    finish: finishOf(t) || "stucco",
    counter: counterOf(t) || "concrete",
    frame: frameOf(t) || "cmu"
  });

  if (shape === "straight") {
    const placed = orderBySide(withDefaultGrill(itemsFor(0), (parts[0].before || "") + " " + parts[0].text), t);
    const under = splitUnder(t, placed.items);
    spec.legs.push(leg("main", Math.round(parts[0].ft * 12), under.items, findStools(t), placed.pinEnd, under.bases));
  } else if (shape === "ell") {
    const grillIndex = parts.findIndex(p => p.role === "grill");
    const g = grillIndex >= 0 ? grillIndex : 0;
    let b = parts.findIndex((p, i) => i !== g && (p.role === "bar" || p.role === "return"));
    if (b < 0) b = parts.findIndex((_, i) => i !== g);
    const grillItems = withDefaultGrill(itemsFor(g), (parts[g].before || "") + " " + parts[g].text);
    const barItems = itemsFor(b).filter(id => id === "sink" || !grillItems.includes(id));
    for (const id of leadItems) if (!grillItems.includes(id) && !barItems.includes(id)) grillItems.unshift(id);
    /* A grill named beside the return, not "on the bar", belongs on the main run. */
    if (parts[b].role !== "bar") {
      for (const id of barItems.filter(item => item === "grill" || item === "grill-40")) {
        barItems.splice(barItems.indexOf(id), 1);
        if (!grillItems.includes(id)) grillItems.push(id);
      }
    }
    const placedGrill = orderBySide(grillItems, t);
    grillItems.length = 0;
    for (const id of placedGrill.items) grillItems.push(id);
    const grillUnder = splitUnder(parts[g].text + " " + t, grillItems);
    const barUnder = splitUnder(parts[b].text, barItems);
    const grillStools = findStools(parts[g].text);
    const barStools = findStools(parts[b].text) || (findStools(t) - grillStools);
    spec.legs.push(leg("grill", Math.round(parts[g].ft * 12), grillUnder.items, grillStools, placedGrill.pinEnd, grillUnder.bases));
    spec.legs.push(leg("bar", Math.round(parts[b].ft * 12), barUnder.items, Math.max(0, barStools), false, barUnder.bases));
  } else {
    const mainIndex = parts.findIndex(p => p.role === "grill" || p.role === "");
    const m = mainIndex >= 0 ? mainIndex : 0;
    const each = parts.find(p => p.role === "each");
    const left = parts.find(p => p.role === "left") || each || (parts.length >= 2 ? parts.find((p, i) => i !== m) : null);
    const right = parts.find(p => p.role === "right") || each || left;
    if (!left || !right) {
      return { handled: true, clarify: "How long is the back, and how long is each return?", notes: unknown };
    }
    const mainItems = withDefaultGrill(itemsFor(m), (parts[m].before || "") + " " + parts[m].text);
    for (const id of leadItems) if (!mainItems.includes(id)) mainItems.unshift(id);
    if (each) {
      for (const id of findItems(each.text)) if (!mainItems.includes(id)) mainItems.push(id);
    }
    const sharedSide = bySplit || (left === right && left !== each);
    const mainUnder = splitUnder(parts[m].text + " " + t, mainItems);
    const leftItems = sharedSide || left === each ? [] : findItems(left.text);
    const rightItems = sharedSide || right === each ? [] : findItems(right.text);
    const leftUnder = splitUnder(left.text, leftItems);
    const rightUnder = splitUnder(right.text, rightItems);
    spec.legs.push(leg("grill", Math.round(parts[m].ft * 12), mainUnder.items, 0, false, mainUnder.bases));
    spec.legs.push(leg("left", Math.round(left.ft * 12), leftUnder.items, 0, false, leftUnder.bases));
    spec.legs.push(leg("right", Math.round(right.ft * 12), rightUnder.items, 0, false, rightUnder.bases));
  }

  spec.barOn = spec.legs.some(l => l.stools > 0) || /\braised bar\b|\bbar\b|\bstools?\b/.test(t);
  spec.legs.forEach(l => { l.fixed = true; });
  const notes = unknown.slice();
  if (!shapeWord && shape === "straight") notes.push("I laid this out as a straight run. Say if you wanted an L or a U.");
  return { handled: true, spec, notes };
}

function cloneSpec(spec) {
  return JSON.parse(JSON.stringify(spec));
}

const GRILLS = { grill: 1, "grill-40": 1 };
const HOT_BESIDE_GRILL = {
  grill: 1, "grill-40": 1, "side-burner": 1, "side-burner-single": 1,
  power: 1, griddle: 1, sink: 1, pizza: 1, smoker: 1,
  /* Blaze 15" ice maker is a gravity-drain wet unit. A fridge is not. */
  ice: 1, ctwok: 1, ctpizza: 1, "bev-sink": 1
};
const FILLER_SIZES = [4, 6, 8, 12, 16, 24];

function isGrill(id) { return !!GRILLS[id]; }
function hotBesideGrill(a, b) {
  return (isGrill(a) && HOT_BESIDE_GRILL[b]) || (isGrill(b) && HOT_BESIDE_GRILL[a]);
}
function pairsNeedGrillGap(spec) {
  for (const leg of (spec && spec.legs) || []) {
    const items = leg.items || [];
    for (let i = 0; i < items.length - 1; i++) if (hotBesideGrill(items[i], items[i + 1])) return true;
  }
  return false;
}
function nearestFiller(want) {
  let best = 6;
  let dist = Math.abs(want - best);
  for (const size of FILLER_SIZES) {
    const d = Math.abs(want - size);
    if (d < dist) { best = size; dist = d; }
  }
  return best;
}
function readGap(t) {
  if (/\b(?:no fillers|without fillers|remove (?:the )?filler panels|remove (?:the )?fillers)\b/.test(t)) return { gapIn: 0, clear: true };
  const m = t.match(/\b(\d+(?:\.\d+)?)\s+inch(?:es)?\s+fillers?\b/) || t.match(/\bfiller(?:\s+panels?)?\s+(?:of\s+|to\s+)?(\d+(?:\.\d+)?)\s+inch/);
  if (!m) return null;
  return { gapIn: Number(m[1]), clear: false };
}
function gapNote(spec, gap) {
  if (gap.clear || gap.gapIn === 0) {
    const keep = pairsNeedGrillGap(spec) ? " I kept 12 inches beside the grill. A side burner, griddle, or sink needs that much." : "";
    return "Removed the filler panels between appliances." + keep;
  }
  const best = nearestFiller(gap.gapIn);
  let note = "Set the filler panels between appliances to " + best + " inches.";
  if (best !== gap.gapIn) note += " " + gap.gapIn + " inches isn't a panel we build, so " + best + " is the closest.";
  if (pairsNeedGrillGap(spec) && gap.gapIn < 12) note += " I kept 12 inches beside the grill. A side burner, griddle, or sink needs that much.";
  return note;
}

function sentenceLeg(t) {
  if (/\b(bar side|of the bar|on the bar|the return|return leg)\b/.test(t)) return "return";
  if (/\b(grill side|cook side)\b/.test(t)) return "grill";
  if (/\blong side\b/.test(t)) return "long";
  if (/\bshort side\b/.test(t)) return "short";
  if (/\bother side\b/.test(t)) return "other";
  if (/\bcorner\b/.test(t)) return "corner";
  return "";
}

function resolveLeg(spec, which) {
  const legs = spec.legs || [];
  const grill = legs.find(l => l.role === "grill" || l.role === "main") || legs[0];
  const ret = legs.find(l => l.role === "bar" || l.role === "return" || l.role === "right") || legs[1] || grill;
  if (which === "return" || which === "other") return ret;
  if (which === "grill" || which === "corner") return grill;
  if (which === "long") return legs.slice().sort((a, b) => b.lengthIn - a.lengthIn)[0] || grill;
  if (which === "short") return legs.slice().sort((a, b) => a.lengthIn - b.lengthIn)[0] || grill;
  return grill;
}

function moveGroup(t, current) {
  if (!current || !/\b(that|those|them)\b/.test(t) || !/\bother side\b/.test(t)) return null;
  const ids = (current.lastAdded || []).slice();
  if (!ids.length) return { clarify: "Tell me which pieces should move to the other side." };
  const spec = cloneSpec(current);
  spec.holdLengths = true;
  const dest = resolveLeg(spec, "other");
  const taken = [];
  let already = 0;
  for (const id of ids) {
    let from = null;
    for (let li = spec.legs.length - 1; li >= 0; li--) {
      const legN = spec.legs[li];
      const at = (legN.items || []).lastIndexOf(id);
      if (at >= 0) { from = legN; break; }
    }
    if (!from) continue;
    if (from === dest) { already++; continue; }
    const at = from.items.lastIndexOf(id);
    from.items.splice(at, 1);
    if (from.bases && from.bases[id]) {
      if (!dest.bases) dest.bases = {};
      dest.bases[id] = from.bases[id];
      delete from.bases[id];
    }
    taken.push(id);
  }
  if (!taken.length && already) {
    return { clarify: "Those are already on the other side. The grill leg is unchanged." };
  }
  const ask = gearSpan([...(dest.items || []), ...taken], spec.gapIn);
  if (dest.fixed && ask > dest.lengthIn + 0.5) {
    return {
      clarify: "Those pieces need about " + feet(ask) + " on the " + dest.role + " leg, which is " + feet(dest.lengthIn) + ". I left them where they are. " + feet(Math.ceil(ask / 12) * 12) + " would fit them."
    };
  }
  dest.items = dest.items || [];
  for (const id of taken) dest.items.push(id);
  spec.lastAdded = taken.slice();
  return { spec, brief: true, notes: ["Moved " + joinSpoken(taken.map(id => CATALOG[id] ? CATALOG[id].spoken : id)) + " to the other side."] };
}

/* The customer stands in the opening, looking at the main run. Plan +X is
   their right and plan +Y is toward them, so the left return is the leg on
   their left. Facing that cabinet from inside the U, their left is the open
   end, away from the corner. Facing the right return, their left is back
   toward the corner. "Down that side", "away from the corner", and "toward
   the end" always move toward the open end. */
function slideSign(leg, t) {
  const away = /\b(?:away from the corner|down that side|toward the end)\b/.test(t);
  const toward = /\btoward the corner\b/.test(t);
  if (away && !toward) return 1;
  if (toward && !away) return -1;
  if (/\bleft\b/.test(t) && !/\bright\b/.test(t)) return leg.role === "right" ? -1 : 1;
  if (/\bright\b/.test(t) && !/\bleft\b/.test(t)) return leg.role === "right" ? 1 : -1;
  return 1;
}

function slideAmount(t) {
  const inch = t.match(/\b(\d+(?:\.\d+)?)\s*(?:inch|inches|in)\b/);
  if (inch) return Number(inch[1]);
  const ft = t.match(/\b(\d+(?:\.\d+)?)\s*ft\b/);
  if (ft) return Number(ft[1]) * 12;
  if (/\b(?:a|one) foot\b|\b1 ft\b/.test(t)) return 12;
  return 12;
}

function isRunNudge(t) {
  return /\b(?:slide|shift|nudge|a little|a bit|further|away from the corner|down that side|toward the end|toward the corner)\b/.test(t)
    || (/\bmove\b/.test(t) && /\bover\b/.test(t) && /\b(?:\d|ft|inch|little|bit|further)\b/.test(t));
}

function slidePiece(t, current) {
  if (!current || !current.legs) return null;
  if (!isRunNudge(t)) return null;
  const spec = cloneSpec(current);
  let ids = findItems(t).map(id => resolvePresent(id, current));
  if (!ids.length && /\bit\b/.test(t)) {
    const one = pronounItem(current);
    if (!one) return { clarify: "Which piece should I slide?" };
    ids = [one];
  }
  const wanted = ids.find(id => pieceOnSpec(spec, id)) || ids[0];
  let legN = wanted ? spec.legs.find(l => (l.items || []).includes(wanted)) : null;
  if (!legN && !wanted) legN = spec.legs.find(l => (l.items || []).some(id => id === "ctpizza" || id === "ctwok"));
  if (!legN) return { clarify: "Which piece should I slide?" };
  const pieceId = wanted && (legN.items || []).includes(wanted)
    ? wanted
    : (legN.items || []).find(id => id === "ctpizza" || id === "ctwok");
  if (!pieceId || !CATALOG[pieceId]) return { clarify: "Which piece should I slide?" };
  const sign = (/\bfurther\b/.test(t) || (/\bover\b/.test(t) && !/\bleft\b/.test(t) && !/\bright\b/.test(t))) && spec.lastDir
    ? spec.lastDir
    : slideSign(legN, t);
  const amount = slideAmount(t);
  if (counterLanding({ ...legN, slide: 0 }) != null && (legN.items || []).filter(id => CATALOG[id]).length === 1) {
    const piece = CATALOG[pieceId].w;
    const spare = Math.max(0, legN.lengthIn - piece);
    const base = counterLanding({ ...legN, slide: 0 });
    const next = Math.max(-base, Math.min(spare - base, (Number(legN.slide) || 0) + sign * amount));
    const moved = Math.round((next - (Number(legN.slide) || 0)) * 10) / 10;
    legN.slide = next;
    spec.lastMoved = pieceId;
    spec.lastDir = sign;
    noteMove(spec, current, pieceId);
    if (!moved) return { clarify: theName(pieceId).replace(/^the /, "The ") + " is already as far that way as this side allows." };
    const way = sign > 0 ? "toward the open end, away from the corner" : "back toward the corner";
    return { spec, brief: true, notes: ["Moved " + CATALOG[pieceId].spoken + " " + Math.abs(moved) + " inches " + way + "."] };
  }
  const spare = Math.max(0, legN.lengthIn - gearSpan(legN.items, spec.gapIn, spec.grillGap));
  const cur = Number(legN.shift) || 0;
  const next = Math.max(-spare, Math.min(spare, cur + sign * amount));
  const moved = Math.round((next - cur) * 10) / 10;
  if (!moved) {
    const side = sign > 0 ? "right" : "left";
    return { clarify: theName(pieceId).replace(/^the /, "The ") + " is already at the " + side + " end of the open counter. The 12 inch grill gap and the 6 inch fillers stay where they are, and there's no free counter left to move that way." };
  }
  legN.shift = next;
  spec.holdLengths = true;
  spec.lastMoved = pieceId;
  noteMove(spec, current, pieceId);
  spec.lastDir = sign;
  spec.lastMentioned = pieceId;
  const side = sign > 0 ? "right" : "left";
  return { spec, brief: true, notes: ["Moved " + theName(pieceId) + " " + Math.abs(moved) + " inches to the " + side + ", and shifted the open counter to the other side."] };
}

function legName(leg) {
  if (!leg) return "the other leg";
  if (leg.role === "bar" || leg.role === "return") return "the return";
  if (leg.role === "left") return "the left return";
  if (leg.role === "right") return "the right return";
  if (leg.role === "grill" || leg.role === "main") return "the main leg";
  return "the " + leg.role + " leg";
}

function theName(id) {
  return CATALOG[id] ? CATALOG[id].spoken.replace(/^an? /, "the ") : "that piece";
}

function otherLeg(spec, fromLeg) {
  const legs = spec.legs || [];
  const others = legs.filter(l => l !== fromLeg);
  if (others.length <= 1) return others[0] || null;
  if (!fromLeg || fromLeg.role === "grill" || fromLeg.role === "main") {
    return legs.find(l => l.role === "left")
      || legs.find(l => l.role === "bar" || l.role === "return")
      || others[0];
  }
  return legs.find(l => l.role === "grill" || l.role === "main") || others[0];
}

function legIntent(t) {
  if (/\bother leg\b/.test(t)) return "opposite";
  if (/\bmove\b/.test(t) && /\bover\b/.test(t)) return "opposite";
  if (/\bother side of\b/.test(t)) return "";
  if (/\bother side\b/.test(t)) return "return";
  if (/\b(?:bar side|return leg|on the return|the return)\b/.test(t)) return "return";
  if (/\bshort side\b/.test(t)) return "short";
  if (/\blong side\b/.test(t)) return "long";
  if (/\b(?:grill side|grill leg|main leg)\b/.test(t)) return "grill";
  return "";
}

function pronounItem(spec) {
  if (spec.lastMoved && pieceOnSpec(spec, spec.lastMoved)) return spec.lastMoved;
  if (spec.lastMentioned && pieceOnSpec(spec, spec.lastMentioned)) return spec.lastMentioned;
  const added = (spec.lastAdded || []).filter(id => pieceOnSpec(spec, id));
  return added.length ? added[added.length - 1] : "";
}

/* "The other side of the griddle" flips around that piece on the same run.
   "The other side" with no reference is still a move to the other leg. */
function flipBeside(t, current) {
  if (!current || !current.legs) return null;
  if (!/\bother side of\b/.test(t)) return null;
  const named = findItems(t).map(id => resolvePresent(id, current)).filter(id => CATALOG[id]);
  let subject = "";
  let anchor = "";
  if (/\bit\b/.test(t)) {
    subject = pronounItem(current);
    anchor = named[0] || "";
  } else if (named.length >= 2) {
    anchor = named[named.length - 1];
    subject = named.find(id => id !== anchor) || "";
  }
  if (!anchor) return null;
  if (!subject || subject === anchor) return { clarify: "Which piece should I move to the other side of " + theName(anchor) + "?" };
  if (!pieceOnSpec(current, anchor)) return { clarify: "I don't see " + theName(anchor) + " on this island." };
  if (!pieceOnSpec(current, subject)) return { clarify: "I don't see " + theName(subject) + " on this island." };
  const spec = cloneSpec(current);
  let from = null;
  let dest = null;
  spec.legs.forEach(legN => {
    if ((legN.items || []).includes(subject)) from = legN;
    if ((legN.items || []).includes(anchor)) dest = legN;
  });
  if (!from || !dest || from !== dest) {
    return { clarify: theName(subject).replace(/^the /, "The ") + " and " + theName(anchor) + " are on different legs. I left them where they are." };
  }
  const wasLeft = from.items.indexOf(subject) < from.items.indexOf(anchor);
  const base = from.bases && from.bases[subject];
  if (base) delete from.bases[subject];
  from.items = from.items.filter(id => id !== subject);
  const at = from.items.indexOf(anchor);
  if (wasLeft) from.items.splice(at + 1, 0, subject);
  else from.items.splice(at, 0, subject);
  if (base) {
    if (!from.bases) from.bases = {};
    from.bases[subject] = base;
  }
  spec.holdLengths = true;
  spec.lastMoved = subject;
  spec.lastMentioned = subject;
  noteMove(spec, current, subject);
  const side = wasLeft ? "right" : "left";
  return { spec, brief: true, notes: ["Moved " + theName(subject) + " to the " + side + " of " + theName(anchor) + "."] };
}

/* Move one piece, and the cabinet under it, from one leg to another.
   "The other leg" is the opposite of where it sits. "The other side" and
   "the return" are the return. Lengths stay unless the piece does not fit. */
function moveAcross(t, current) {
  if (!current || !current.legs || current.legs.length < 2) return null;
  if (!/\b(?:move|put|place|relocate)\b/.test(t)) return null;
  if (/\b(?:under|underneath|below|beneath|swap)\b/.test(t)) return null;
  if (isRunNudge(t)) return null;
  const which = legIntent(t);
  if (!which) return null;
  let ids = findItems(t).map(id => resolvePresent(id, current));
  if (!ids.length && /\bit\b/.test(t)) {
    const one = pronounItem(current);
    if (!one) return { clarify: "Tell me which piece should move to the other leg." };
    ids = [one];
  }
  if (ids.length !== 1) return null;
  const id = ids[0];
  if (!CATALOG[id]) return null;
  const fromI = current.legs.findIndex(l => (l.items || []).includes(id));
  if (fromI < 0) return null;
  const spec = cloneSpec(current);
  spec.holdLengths = true;
  const fromLeg = spec.legs[fromI];
  let dest = fromLeg;
  if (which === "opposite") dest = otherLeg(spec, fromLeg);
  else if (which === "short" || which === "long") dest = resolveLeg(spec, which);
  else if (which === "grill") dest = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
  else dest = resolveLeg(spec, "return");
  if (!dest || dest === fromLeg) {
    if (which === "opposite") return { clarify: "This island doesn't have another leg to move " + theName(id) + " to." };
    const place = which === "return" && /\bother side\b/.test(t)
      ? "the other side"
      : (which === "short" ? "the short side" : which === "long" ? "the long side" : legName(fromLeg));
    return { clarify: "That's already on " + place + "." };
  }
  const others = (dest.items || []).filter(x => x !== id);
  const ask = gearSpan(others.concat(id), spec.gapIn, spec.grillGap);
  if (dest.fixed && ask > dest.lengthIn + 4) {
    const name = theName(id).replace(/^the /, "The ");
    const piece = CATALOG[id] ? CATALOG[id].w : ask;
    const held = others.length
      ? " It is " + feet(piece) + " wide. " + legName(dest).replace(/^the /, "The ") + " already holds " + joinSpoken(others.map(theName)) + ", so together they need about " + feet(ask) + ". That leg is " + feet(dest.lengthIn) + "."
      : " It needs about " + feet(ask) + " with the filler panels, and " + legName(dest) + " is " + feet(dest.lengthIn) + ".";
    return { clarify: name + " doesn't fit on " + legName(dest) + "." + held + " I left it where it is." };
  }
  const base = fromLeg.bases && fromLeg.bases[id];
  if (base) delete fromLeg.bases[id];
  fromLeg.items = (fromLeg.items || []).filter(x => x !== id);
  if (id === "ctpizza" || id === "ctwok") fromLeg.slide = 0;
  dest.items = dest.items || [];
  dest.items.push(id);
  if (base) {
    if (!dest.bases) dest.bases = {};
    dest.bases[id] = base;
  }
  if (id === "ctpizza" || id === "ctwok") dest.slide = 0;
  spec.lastMentioned = id;
  spec.lastMoved = id;
  spec.lastAdded = [id];
  noteMove(spec, current, id);
  return { spec, brief: true, notes: ["Moved " + theName(id) + " to " + legName(dest) + "."] };
}

function shiftRun(t, current) {
  if (!current || !current.legs || !current.legs.length) return null;
  if (!/\b(?:move|shift)\b/.test(t)) return null;
  if (!/\b(?:both items|both pieces|both of them|both|them|everything|all of it|all of them)\b/.test(t)) return null;
  const left = /\b(?:to the left|left end|on the left)\b/.test(t) && !/\bright\b/.test(t);
  const right = /\b(?:to the right|right end|on the right)\b/.test(t) && !/\bleft\b/.test(t);
  if (!left && !right) return null;
  const spec = cloneSpec(current);
  spec.holdLengths = true;
  const legN = spec.legs.find(l => (l.items || []).length) || spec.legs[0];
  legN.align = left ? "left" : "right";
  legN.pinEnd = !left;
  spec.lastDir = left ? -1 : 1;
  const gear = (legN.items || []).filter(id => CATALOG[id]);
  if (gear.length) {
    spec.lastMoved = gear[gear.length - 1];
    noteMove(spec, current, gear[gear.length - 1]);
  }
  return { spec, brief: true, notes: ["Moved the equipment to the " + (left ? "left" : "right") + " end."] };
}

const INCH_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, "twenty four": 24
};

/* Spoken sizes for a filler panel. "a foot" is already 12 inch. "two foot"
   arrives as "2 ft". Other sizes snap to 4, 6, 8, 12, 16, or 24. */
function fillerText(t) {
  let s = String(t || "")
    .replace(/\bfill her\b/g, "filler")
    .replace(/\bpannels\b/g, "panels")
    .replace(/\bpannel\b/g, "panel")
    .replace(/\b(\d+(?:\.\d+)?)\s+ft\b(?=\s+(?:filler|panel))/, (_, n) => (Number(n) * 12) + " inch")
    .replace(/\b(?:filler|panel)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s+ft\b/, (_, n) => "filler " + (Number(n) * 12) + " inch");
  const words = Object.keys(INCH_WORDS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const n = INCH_WORDS[word];
    const re = word.replace(" ", "\\s+");
    s = s.replace(new RegExp("\\b" + re + "\\s+inch", "g"), n + " inch");
    s = s.replace(new RegExp("\\b" + re + "\\s+(?=filler|panel)", "g"), n + " inch ");
  }
  return s;
}

function fridgeEnd(legN) {
  const items = legN.items || [];
  const i = items.findIndex(id => id === "fridge" || id === "fridge-24");
  if (i < 0) return "end";
  if (i === 0) return "start";
  return "end";
}

/* A spoken filler is an extra panel. It lengthens the run and has no equipment price. */
function placeFiller(t0, current) {
  if (!current || !current.legs || !current.legs.length) return null;
  const t = fillerText(t0);
  if (!/\bfiller/.test(t)) return null;
  const removing = /\b(?:remove|delete)\b/.test(t);
  const atEnd = /\b(?:left end|right end|both ends|the end|at the end|on the end)\b/.test(t);
  const adding = /\b(?:add|put|place)\b/.test(t) || atEnd;
  if (!removing && !adding) return null;
  if (removing && /\bfiller panels\b|\bfillers\b/.test(t) && !/\b(?:by|next to|end|left|right|fridge|refrigerator)\b/.test(t)) return null;
  const spec = cloneSpec(current);
  const legN = spec.legs.find(l => (l.items || []).some(id => id === "fridge" || id === "fridge-24"))
    || spec.legs.find(l => (l.items || []).length)
    || spec.legs[0];
  legN.panels = legN.panels || [];
  const sized = t.match(/\b(\d+(?:\.\d+)?)\s+inch/);
  const want = sized ? Number(sized[1]) : 6;
  const w = nearestFiller(want);
  let at = "end";
  let after = "";
  if (/\bboth ends\b/.test(t)) at = "both";
  else if (/\bleft end\b/.test(t)) at = "start";
  else if (/\bright end\b/.test(t)) at = "end";
  else if (/\bbetween\b/.test(t)) {
    at = "after";
    const ids = findItems(t0).map(id => resolvePresent(id, current));
    const order = legN.items || [];
    const placed = ids.filter(id => order.includes(id));
    if (placed.length >= 2) {
      const ia = order.indexOf(placed[0]);
      const ib = order.indexOf(placed[1]);
      after = order[Math.min(ia, ib)];
    } else after = placed[0] || order[0] || "";
  } else if (/\b(?:fridge|refrigerator)\b/.test(t) || /\bend\b/.test(t)) {
    at = fridgeEnd(legN);
  }
  if (removing) {
    const idx = legN.panels.findIndex(panel => panel.at === (at === "both" ? "end" : at));
    let cut = w;
    if (idx >= 0) {
      cut = legN.panels[idx].w;
      legN.panels.splice(idx, 1);
    }
    legN.lengthIn = Math.max(48, legN.lengthIn - cut);
    return { spec, brief: true, notes: ["Removed the filler panel. The run is now " + feet(legN.lengthIn) + ". Filler panels have no equipment price."] };
  }
  const spots = at === "both" ? ["start", "end"] : [at];
  for (const spot of spots) legN.panels.push({ w, at: spot, after });
  legN.lengthIn += w * spots.length;
  let note = "Added a " + w + " inch filler panel";
  if (at === "both") note = "Added a " + w + " inch filler panel on both ends";
  else if (at === "start") note += " on the left end";
  else if (at === "after") note += " between those pieces";
  else note += " on the end";
  if (w !== want) note += ". " + want + " inches isn't a panel we build, so " + w + " is the closest";
  note += ". Filler panels have no equipment price. The run is now " + feet(legN.lengthIn);
  return { spec, brief: true, notes: [note + "."] };
}

function pieceSpot(spec, id) {
  if (!spec || !spec.legs || !CATALOG[id]) return null;
  for (let li = 0; li < spec.legs.length; li++) {
    const legN = spec.legs[li];
    const index = (legN.items || []).indexOf(id);
    if (index < 0) continue;
    return {
      id,
      leg: li,
      index,
      shift: Math.round(Number(legN.shift) || 0),
      slide: Math.round(Number(legN.slide) || 0),
      align: legN.align === "left" || legN.align === "right" ? legN.align : "",
      pinEnd: !!legN.pinEnd,
      base: legN.bases && CATALOG[legN.bases[id]] ? legN.bases[id] : ""
    };
  }
  return null;
}

function sameSpot(a, b) {
  return !!a && !!b && a.id === b.id && a.leg === b.leg && a.index === b.index
    && a.shift === b.shift && a.slide === b.slide && a.align === b.align
    && !!a.pinEnd === !!b.pinEnd && (a.base || "") === (b.base || "");
}

function noteMove(spec, before, id) {
  const was = pieceSpot(before, id);
  const now = pieceSpot(spec, id);
  if (!was || !now || sameSpot(was, now)) return;
  const hist = Array.isArray(spec.moveHist) ? spec.moveHist.slice() : [];
  hist.push(was);
  spec.moveHist = hist.slice(-6);
}

function applySpot(spec, spot) {
  const id = spot && spot.id;
  const dest = spec.legs && spec.legs[spot.leg];
  if (!CATALOG[id] || !dest) return false;
  let from = null;
  spec.legs.forEach(legN => {
    if ((legN.items || []).includes(id)) from = legN;
  });
  const carried = (from && from.bases && from.bases[id]) || (CATALOG[spot.base] ? spot.base : "");
  if (from) {
    if (from.bases && from.bases[id]) delete from.bases[id];
    from.items = (from.items || []).filter(x => x !== id);
  }
  const items = dest.items || [];
  items.splice(Math.max(0, Math.min(spot.index, items.length)), 0, id);
  dest.items = items;
  if (carried) {
    if (!dest.bases) dest.bases = {};
    dest.bases[id] = carried;
  }
  if (spot.shift) dest.shift = spot.shift;
  else delete dest.shift;
  if (spot.slide) dest.slide = spot.slide;
  else delete dest.slide;
  if (spot.align === "left" || spot.align === "right") dest.align = spot.align;
  else delete dest.align;
  dest.pinEnd = !!spot.pinEnd;
  return true;
}

function besidePhrase(spec, id) {
  for (const legN of spec.legs || []) {
    const items = (legN.items || []).filter(x => CATALOG[x]);
    const i = items.indexOf(id);
    if (i < 0) continue;
    if (i > 0) return "to the right of " + theName(items[i - 1]);
    if (i + 1 < items.length) return "to the left of " + theName(items[i + 1]);
    return "to " + legName(legN);
  }
  return "where it was";
}

function wantsUndo(t) {
  if (/\bback toward\b|\bback to the corner\b/.test(t)) return false;
  if (/\b(?:move|put|place)\s+(?:it|that)\s+back\b/.test(t)) return true;
  if (/\bput\s+(?:it|that)\s+where\s+it\s+was\b/.test(t)) return true;
  if (/\bwhere\s+it\s+was\b/.test(t) && /\b(?:put|move|place)\b/.test(t)) return true;
  if (/\bundo(?:\s+that)?\b/.test(t)) return true;
  if (/\bgo back\b/.test(t) && !/\bgo back to\b/.test(t)) return true;
  if (/\bnever\s*mind\b/.test(t)) return true;
  return false;
}

function nothingMoved() {
  return { clarify: "Nothing has moved yet. I don't have an earlier version of this design. The island is unchanged." };
}

/* "Move it back" restores the previous leg and index. A second say restores
   the one before that. "The other side" with no "back" is still a leg change. */
function moveBack(t, current) {
  if (!current || !wantsUndo(t)) return null;
  const hist = Array.isArray(current.moveHist) ? current.moveHist.slice() : [];
  if (!hist.length) return nothingMoved();
  const spot = hist.pop();
  const spec = cloneSpec(current);
  spec.moveHist = hist;
  if (!applySpot(spec, spot)) return nothingMoved();
  spec.holdLengths = true;
  spec.lastMoved = spot.id;
  spec.lastMentioned = spot.id;
  return { spec, brief: true, notes: ["Moved " + theName(spot.id) + " back " + besidePhrase(spec, spot.id) + "."] };
}

function refine(t, current) {
  if (!current) return null;
  const undone = moveBack(t, current);
  if (undone) return undone;
  const spec = cloneSpec(current);
  const movedGroup = moveGroup(t, current);
  if (movedGroup) return movedGroup;
  const flipped = flipBeside(t, current);
  if (flipped) return flipped;
  const across = moveAcross(t, current);
  if (across) return across;
  const shifted = shiftRun(t, current);
  if (shifted) return shifted;
  const panel = placeFiller(t, current);
  if (panel) return panel;
  const slid = slidePiece(t, current);
  if (slid) return slid;
  const gap = readGap(t);
  if (gap) {
    spec.gapIn = gap.gapIn === 0 ? 0 : nearestFiller(gap.gapIn);
    return { spec, brief: true, notes: [gapNote(spec, gap)] };
  }
  if (/\b(stone veneer|ledgestone|stacked stone)\b/.test(t) || /\bswap to stone\b|\bswitch to stone\b/.test(t)) {
    spec.finish = "stack";
    return { spec, brief: true, notes: ["Switched the finish to ledgestone veneer."] };
  }
  if (/\bstucco\b/.test(t) && /\b(swap|switch|make|change|use)\b/.test(t)) {
    spec.finish = "stucco";
    return { spec, brief: true, notes: ["Switched the finish back to stucco."] };
  }
  const fin = finishOf(t);
  if (fin && /\b(swap|switch|make|change|use|finish)\b/.test(t)) {
    spec.finish = fin;
    return { spec, brief: true, notes: ["Finish is now " + FINISHES[fin] + "."] };
  }
  if (/\bbar\b/.test(t) && /\b(longer|shorter)\b/.test(t)) {
    const delta = /\bshorter\b/.test(t) ? -24 : 24;
    const bar = spec.legs.find(l => l.role === "bar") || spec.legs[spec.legs.length - 1];
    if (!bar || spec.legs.length < 2 && bar.role !== "bar") {
      return { clarify: "Which leg should I change? This one doesn't have a separate bar leg yet." };
    }
    bar.lengthIn += delta;
    return { spec, brief: true, notes: [delta > 0 ? "Made the bar longer." : "Made the bar shorter."] };
  }
  if (/\bgrill\b/.test(t) && /\b(longer|shorter)\b/.test(t)) {
    const delta = /\bshorter\b/.test(t) ? -24 : 24;
    const grill = spec.legs.find(l => l.role === "grill" || l.role === "main");
    if (!grill) return { clarify: "I don't see a grill leg to resize." };
    grill.lengthIn += delta;
    return { spec, brief: true, notes: [delta > 0 ? "Made the grill leg longer." : "Made the grill leg shorter."] };
  }
  const placed = /\b(left|right side|on the right|on the left|under the bar|under(?:neath)? the grill|under(?:neath)? it|below the grill|beneath the grill|next to|end of)\b/.test(t);
  const reposition = /\b(move|relocate|swap|put|place)\b/.test(t);
  const add = !reposition && t.match(/\badd (?:a |an )?(sink|fridge|refrigerator|side burner|single side burner|grill|power burner|griddle|trash|cooler)\b/);
  if (add && !placed && !sentenceLeg(t) && findItems(t).length < 2) {
    const id = findItems(add[1])[0] || (add[1] === "cooler" || add[1] === "refrigerator" ? "fridge" : "");
    if (!id) return { clarify: "I can add a sink, fridge, side burner, grill, griddle, or trash drawer. That one isn't in the catalog." };
    const dest = spec.legs.find(l => l.role === "bar" && !l.items.includes(id))
      || spec.legs.find(l => !l.items.includes(id))
      || spec.legs[0];
    if (dest.items.includes(id)) return { spec: current, brief: true, notes: ["That's already on the " + dest.role + " leg."] };
    dest.items.push(id);
    return { spec, brief: true, notes: ["Added " + CATALOG[id].spoken + "."] };
  }
  if (/\b(remove|delete)\b/.test(t)) {
    const ids = findItems(t);
    if (!ids.length) return { clarify: "Tell me which piece to remove: sink, fridge, side burner, grill, or combo." };
    let hit = false;
    spec.legs.forEach(l => {
      const next = (l.items || []).filter(id => !ids.includes(id));
      if (next.length !== (l.items || []).length) hit = true;
      l.items = next;
    });
    if (!hit) return { spec: current, brief: true, notes: ["That piece isn't on the design."] };
    return { spec, brief: true, notes: ["Removed " + joinSpoken(ids.map(id => CATALOG[id].spoken)) + "."] };
  }
  if (/\b(undo|go back|never mind|nevermind)\b/.test(t)) {
    return { clarify: "I don't have an earlier version of this design. The island is unchanged. Tell me what to move." };
  }
  if (/\b(start over|from scratch|clear the island|clear it)\b/.test(t)) {
    spec.legs.forEach(l => { l.items = []; delete l.bases; });
    return { spec, brief: true, notes: ["Cleared the equipment. The run is still here."] };
  }
  if (/\bhow long\b/.test(t) && !findItems(t).length) {
    const bar = spec.legs.find(l => l.role === "bar");
    const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
    const which = /\bbar\b/.test(t) && bar ? bar : main;
    return { clarify: "The " + which.role + " leg is " + feet(which.lengthIn) + ". I haven't changed the layout." };
  }
  if (/\b(how much|what fits|what can i add|whats the price|what is the price)\b/.test(t) || (/\bprice\b/.test(t) && !findItems(t).length)) {
    if (/\bwhat fits\b|\bwhat can i add\b/.test(t)) {
      return { clarify: "A grill, fridge, sink, side burner, combo, or trash drawer fit on this run. What should I add?" };
    }
    return { clarify: "The price is the one on the design, from the catalog and the build rates. I haven't changed the layout." };
  }
  const unknownOnly = findUnknown(t);
  if (unknownOnly.length && !findItems(t).length) {
    return { clarify: unknownOnly.join(" ") + " The layout is unchanged." };
  }
  if (/\b(?:inches|inch|in)\s*deep\b|\bdeeper\b|\bshallower\b|\bdepth\b/.test(t) && !findItems(t).length) {
    return { clarify: "This layout stays 32 inches deep. That's the counter depth we build. I left the rest as it is." };
  }
  if (/\b(bigger|longer)\b/.test(t) && !/\bbar\b/.test(t) && !/\bgrill leg\b/.test(t) && !findItems(t).length) {
    const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
    main.lengthIn += 24;
    return { spec, brief: true, notes: ["Made the main run longer."] };
  }
  if (/\b(make|change|set)\b/.test(t) && findLengths(t).length === 1 && !findItems(t).length && !detectShape(t)) {
    const ft = findLengths(t)[0].ft;
    const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
    main.lengthIn = Math.round(ft * 12);
    return { spec, brief: true, notes: ["Made the main run " + ft + " ft."] };
  }
  if (((/\bbar\b/.test(t) && /\boff\b/.test(t)) || /\bno bar\b/.test(t)) && !findItems(t).length) {
    spec.barOn = false;
    spec.legs.forEach(l => { l.stools = 0; });
    return { spec, brief: true, notes: ["Turned the raised bar off."] };
  }
  if (/\b(bar on|raised bar|add a bar|turn the bar on)\b/.test(t) && !findItems(t).length) {
    spec.barOn = true;
    return { spec, brief: true, notes: ["Turned the raised bar on."] };
  }
  if (findStools(t) && !findItems(t).length) {
    const stools = findStools(t);
    const legN = spec.legs.find(l => l.role === "bar") || spec.legs[spec.legs.length - 1];
    legN.stools = stools;
    spec.barOn = true;
    return { spec, brief: true, notes: ["Set the bar for " + stools + " stools."] };
  }
  if (asksCounterColor(t) && !findItems(t).length) {
    return { clarify: counterChoices() };
  }
  const shade = counterShade(t, spec);
  if (shade && !findItems(t).length) {
    if (shade.same) {
      const edge = shade.same === "darkest" ? "black granite" : "white quartz";
      return { clarify: "The countertop is already the " + shade.same + " catalog color, " + edge + ". I left it." };
    }
    spec.counter = shade.id;
    return { spec, brief: true, notes: [counterNote(shade.id)] };
  }
  const counter = counterOf(t);
  if (counter && !findItems(t).length) {
    if (spec.counter === counter) {
      return { clarify: "The countertop is already " + COUNTERS[counter].n + ". I left it." };
    }
    spec.counter = counter;
    return { spec, brief: true, notes: [counterNote(counter)] };
  }
  if (fin && !findItems(t).length && fin !== spec.finish) {
    spec.finish = fin;
    return { spec, brief: true, notes: ["Switched the finish to " + FINISHES[fin] + "."] };
  }
  if (detectShape(t) === "straight" && spec.shape !== "straight" && /\b(make|turn|change|straighten)\b/.test(t)) {
    const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
    spec.shape = "straight";
    spec.legs = [leg("main", main.lengthIn, main.items, 0, main.pinEnd, main.bases)];
    return { spec, brief: true, notes: ["Made it a straight run."] };
  }
  if (detectShape(t) === "ell" && spec.shape !== "ell" && findLengths(t).length < 2 && /\b(make|turn|change|switch|build|want)\b/.test(t)) {
    const lens = findLengths(t);
    if (!lens.length) {
      if (/\b(make|turn|change)\b/.test(t)) return { clarify: "How long should the bar leg be? I kept this layout." };
      return null;
    }
    const main = spec.legs[0];
    main.role = "grill";
    spec.shape = "ell";
    spec.barOn = !!spec.barOn || /\bbar\b|\bstools?\b/.test(t);
    spec.legs = [main, leg("bar", Math.round(lens[0].ft * 12), [], findStools(t))];
    return { spec, brief: true, notes: ["Made it an L with a " + lens[0].ft + " ft return."] };
  }
  if (detectShape(t) === "yu" && spec.shape !== "yu" && findLengths(t).length < 2 && /\b(make|turn|change|switch|build|want)\b/.test(t)) {
    const lens = findLengths(t);
    if (!lens.length) {
      if (/\b(make|turn|change)\b/.test(t)) return { clarify: "How long should each return be? I kept this layout." };
      return null;
    }
    const main = spec.legs[0];
    main.role = "grill";
    spec.shape = "yu";
    const side = Math.round(lens[0].ft * 12);
    spec.legs = [main, leg("left", side, [], 0), leg("right", side, [], 0)];
    return { spec, brief: true, notes: ["Made it a U with " + lens[0].ft + " ft returns."] };
  }
  if ((/^(make|add|remove|swap|change|switch)\b/.test(t) || /\b(longer|shorter)\b/.test(t)) && !findItems(t).length) {
    return { clarify: "I can make the bar or the grill leg longer or shorter, add or remove a sink, fridge, side burner, or grill, or swap the finish to stone veneer or stucco." };
  }
  return null;
}

function joinSpoken(parts) {
  const names = parts.filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return names[0] + " and " + names[1];
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
}

function placePhrase(where, anchor) {
  const who = anchor && CATALOG[anchor] ? CATALOG[anchor].spoken.replace(/^an? /, "the ") : "the grill";
  if (where === "right" || where === "end") return " on the right";
  if (where === "left") return " on the left";
  if (where === "return") return " on the return";
  if (where === "main") return " on the main run";
  if (where === "bar") return " under the bar";
  if (where === "under") return " in the base under the grill";
  if (where === "next" || where === "rightadj") return " next to " + who;
  if (where === "leftadj") return " just left of " + who;
  return "";
}

function isBaseCabinet(id) {
  return id === "combo" || id === "door" || id === "door-25" || id === "door-40" || id === "door-v" || id === "door-h" || id === "drawer" || id === "drawer-3";
}

function readBases(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const out = {};
  for (const host of ["grill", "grill-40", "sink", "bev-sink", "side-burner", "side-burner-single"]) {
    if (isBaseCabinet(raw[host])) out[host] = raw[host];
  }
  return Object.keys(out).length ? out : undefined;
}

function hostGrill(leg) {
  if (!leg) return "";
  if ((leg.items || []).includes("grill-40")) return "grill-40";
  if ((leg.items || []).includes("grill")) return "grill";
  if (leg.bases && leg.bases["grill-40"]) return "grill-40";
  if (leg.bases && leg.bases.grill) return "grill";
  return "";
}

/* Drop-in grills do not stack a second module underneath. The 3D view reads
   the grill's u field and draws that cabinet face in the base opening
   directly under the cutout (faceSpan → drawFace). */
function attachUnder(spec, baseId, hostId, fresh) {
  const leg = hostId
    ? spec.legs.find(l => (l.items || []).includes(hostId) || (l.bases && l.bases[hostId]))
    : spec.legs.find(l => hostGrill(l));
  if (!leg) {
    return { clarify: "There's no grill to put that under. I can put " + CATALOG[baseId].spoken + " on the left or the right." };
  }
  const host = hostId || hostGrill(leg);
  const name = CATALOG[baseId].spoken;
  const sitting = spec.legs.some(l => (l.items || []).includes(baseId));
  const underName = host === "sink" || host === "bev-sink" ? "sink"
    : host === "side-burner" || host === "side-burner-single" ? "side burner"
    : "grill";
  if (leg.bases && leg.bases[host] === baseId && !sitting && !fresh) {
    return { clarify: name.replace(/^a /, "The ") + " is already in the base under the " + underName + ". I can move it out beside the grill, or leave the fridge at the right end." };
  }
  if (!fresh) spec.legs.forEach(l => { l.items = (l.items || []).filter(id => id !== baseId); });
  const prev = leg.bases && leg.bases[host];
  if (!leg.bases) leg.bases = {};
  if (prev && prev !== baseId && !leg.items.includes(prev)) {
    const at = leg.items.indexOf(host);
    if (at >= 0) leg.items.splice(at + 1, 0, prev);
    else leg.items.push(prev);
  }
  leg.bases[host] = baseId;
  if (leg.items[leg.items.length - 1] === "fridge" || leg.items[leg.items.length - 1] === "fridge-24") leg.pinEnd = true;
  const word = !fresh && (sitting || prev === baseId) ? "Moved " : "Added ";
  return { note: word + name + " into the base under the " + underName + "." };
}

function layoutKey(spec) {
  return JSON.stringify((spec.legs || []).map(l => ({
    items: l.items || [],
    bases: l.bases || null,
    pin: !!l.pinEnd
  })));
}

function unchangedReply(t, spec) {
  const hits = findItemHits(t);
  const id = hits[0] && hits[0].id;
  const name = id && CATALOG[id] ? CATALOG[id].spoken.replace(/^a /, "The ") : "That piece";
  if (hits.some(h => h.where === "under")) {
    return name + " is already in the base under the grill. I can move it out beside the grill, or leave the fridge at the right end.";
  }
  if (hits.some(h => h.where === "right" || h.where === "end")) {
    return name + " is already at the right end. I can move it to the left, or put the combo under the grill.";
  }
  if (hits.some(h => h.where === "left")) {
    return name + " is already on the left. I can move it to the right end, or put a cabinet under the grill.";
  }
  const where = spec && spec.legs && spec.legs.some(l => l.bases && Object.values(l.bases).includes(id));
  if (where) return name + " is in the base under the grill. I can move it out beside the grill, or move the fridge to the right end.";
  return name + " is already on this island. Say which side, or say under the grill.";
}

function swapPair(current, a, b) {
  const spec = cloneSpec(current);
  const loc = id => {
    for (const l of spec.legs) {
      const i = (l.items || []).indexOf(id);
      if (i >= 0) return { leg: l, i };
    }
    return null;
  };
  const A = loc(a);
  const B = loc(b);
  const underA = spec.legs.some(l => l.bases && Object.values(l.bases).includes(a));
  const underB = spec.legs.some(l => l.bases && Object.values(l.bases).includes(b));
  if ((underA || underB) && !(A && B)) {
    return { clarify: "Those two are not side by side. The cabinet under the grill stays in that base. I can move it out beside the grill, or move the fridge to the right end." };
  }
  if (!A || !B) {
    const missing = !A ? a : b;
    return { clarify: "I don't see " + CATALOG[missing].spoken + " on this island. I can add it on the left or the right." };
  }
  if (A.leg === B.leg && A.i === B.i) {
    return { clarify: unchangedReply("swap " + a + " and " + b, spec) };
  }
  const baseA = A.leg.bases && A.leg.bases[a];
  const baseB = B.leg.bases && B.leg.bases[b];
  if (A.leg === B.leg) {
    const items = A.leg.items;
    const tmp = items[A.i];
    items[A.i] = items[B.i];
    items[B.i] = tmp;
  } else {
    if (baseA) delete A.leg.bases[a];
    if (baseB) delete B.leg.bases[b];
    A.leg.items[A.i] = b;
    B.leg.items[B.i] = a;
    if (baseB) {
      if (!A.leg.bases) A.leg.bases = {};
      A.leg.bases[b] = baseB;
    }
    if (baseA) {
      if (!B.leg.bases) B.leg.bases = {};
      B.leg.bases[a] = baseA;
    }
  }
  spec.lastMentioned = a;
  spec.lastMoved = a;
  noteMove(spec, current, a);
  noteMove(spec, current, b);
  return { spec, brief: true, notes: ["Swapped " + CATALOG[a].spoken + " and " + CATALOG[b].spoken + "."] };
}

function rearrange(t, current) {
  if (!current || !current.legs || !current.legs.length) return null;
  if (!/\bswap\b/.test(t)) return null;
  if (/\b(stone|stucco|finish|veneer|longer|shorter)\b/.test(t)) return null;
  const ids = findItems(t).map(id => resolvePresent(id, current));
  if (ids.length < 2) return { clarify: "Tell me the two pieces to swap, for example the fridge and the combo." };
  return swapPair(current, ids[0], ids[1]);
}

function gearCount(spec) {
  if (!spec || !Array.isArray(spec.legs)) return 0;
  let n = 0;
  for (const l of spec.legs) {
    for (const id of l.items || []) if (CATALOG[id] && id !== "corner") n++;
  }
  return n;
}

function destLeg(spec, where) {
  const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
  if (where === "bar" || where === "return" || where === "other") {
    return spec.legs.find(l => l.role === "bar" || l.role === "return" || l.role === "right") || spec.legs[1] || main;
  }
  if (where === "main" || where === "grill" || where === "corner") return main;
  if (where === "left") return spec.legs.find(l => l.role === "left") || main;
  if (where === "right" && spec.shape === "yu") return spec.legs.find(l => l.role === "right") || main;
  if (where === "right" && spec.shape === "ell") return spec.legs.find(l => l.role === "bar") || main;
  return main;
}

function isFullLayout(t) {
  return findLengths(t).length > 0;
}

/* A fridge already on the right stays the right end. Left, right, and
   "under the grill" insert around it instead of appending past it. */
function placeOnLeg(leg, id, where, fresh, keepFridgeEnd, anchor) {
  leg.items = leg.items || [];
  if (!fresh) {
    if ((where === "main" || where === "return") && leg.items.includes(id)) return;
    leg.items = leg.items.filter(x => x !== id);
  }
  if (where === "right" || where === "end") {
    leg.items.push(id);
    leg.pinEnd = true;
    return;
  }
  if (where === "left") {
    leg.items.unshift(id);
    return;
  }
  if (where === "between") {
    const g = leg.items.findIndex(x => x === "grill" || x === "grill-40");
    const f = leg.items.lastIndexOf("fridge");
    if (g >= 0) leg.items.splice(g + 1, 0, id);
    else if (f > 0) leg.items.splice(f, 0, id);
    else leg.items.splice(Math.min(1, leg.items.length), 0, id);
    if (leg.items[leg.items.length - 1] === "fridge") leg.pinEnd = true;
    return;
  }
  if (where === "leftadj" || where === "rightadj" || (where === "next" && anchor)) {
    const at = anchor
      ? leg.items.indexOf(anchor)
      : leg.items.findIndex(x => x === "grill" || x === "grill-40");
    if (where === "leftadj") {
      if (at >= 0) leg.items.splice(at, 0, id);
      else leg.items.unshift(id);
    } else if (at >= 0) {
      leg.items.splice(at + 1, 0, id);
      if (leg.items[leg.items.length - 1] === "fridge") leg.pinEnd = true;
    } else leg.items.push(id);
    return;
  }
  if (where === "next") {
    const at = leg.items.findIndex(x => x === "grill" || x === "grill-40");
    if (at >= 0) {
      leg.items.splice(at + 1, 0, id);
      if (leg.items[leg.items.length - 1] === "fridge") leg.pinEnd = true;
      return;
    }
  }
  const last = leg.items[leg.items.length - 1];
  if (keepFridgeEnd && (last === "fridge" || last === "fridge-24") && id !== "fridge" && id !== "fridge-24") {
    leg.items.splice(leg.items.length - 1, 0, id);
    leg.pinEnd = true;
    return;
  }
  leg.items.push(id);
}

function mentionHits(text) {
  const src = prepareGearText(text);
  const hits = [];
  for (const hit of findItemHits(text)) {
    const prevSame = [...hits].reverse().find(h => h.id === hit.id);
    if (prevSame && hit.index - prevSame.end < 16) continue;
    let id = hit.id;
    let sizeNote = "";
    if (hit.id === "door") {
      const window = text.slice(Math.max(0, hit.index - 10), hit.end + 18);
      const sized = window.match(/\b(\d+)\s*(?:inch|in)\b/);
      if (sized) {
        const n = Number(sized[1]);
        const choices = [[25, "door-25"], [32, "door"], [40, "door-40"]];
        let best = choices[1];
        for (const choice of choices) if (Math.abs(choice[0] - n) < Math.abs(best[0] - n)) best = choice;
        id = best[1];
        if (best[0] !== n) sizeNote = n + " inches isn't an access door we stock, so I used the " + best[0] + " inch door.";
      }
    }
    let where = hit.where;
    let host = where === "under" ? (([...hits].reverse().find(h => !isBaseCabinet(h.id)) || {}).id || "") : "";
    const before = src.slice(Math.max(0, hit.index - 48), hit.index);
    const after = src.slice(hit.end, hit.end + 48);
    const near = before + " " + after;
    const namedUnder = near.match(/\b(?:under|underneath|below|beneath) the (side burner|sink|grill)\b/);
    if (isBaseCabinet(id) && (/\b(?:under|underneath|below|beneath) the grill\b/.test(before) || /__under__(?:\s+(?:a|an))?\s*$/.test(before))) {
      where = "under";
      host = host || "grill";
    } else if (isBaseCabinet(id) && namedUnder) {
      where = "under";
      host = namedUnder[1] === "sink" ? "sink" : namedUnder[1] === "side burner" ? "side-burner" : "grill";
    } else if (isBaseCabinet(id) && /\b(?:under|underneath|below|beneath)\b/.test(near) && !/\b(?:under|underneath|below|beneath) the bar\b/.test(near)) {
      where = "under";
      host = ([...hits].reverse().find(h => !isBaseCabinet(h.id)) || {}).id || "";
    }
    if (id === "pizza" && /\bon top\b/.test(text.slice(hit.index, hit.end + 24))) id = "ctpizza";
    const hostOnly = !isBaseCabinet(id) && /\b(?:under|underneath|below|beneath|where|by|next to|beside) the\s*$/.test(before);
    hits.push({ ...hit, id, where, sizeNote, host, hostOnly, anchor: "" });
  }
  for (let i = 0; i < hits.length; i++) {
    const before = src.slice(Math.max(0, hits[i].index - 64), hits[i].index);
    const rel = referenceRelation(before);
    if (!rel) continue;
    hits[i].hostOnly = true;
    for (let j = i - 1; j >= 0; j--) {
      if (hits[j].hostOnly) continue;
      hits[j].where = rel;
      hits[j].anchor = hits[i].id;
      if (rel === "under") hits[j].host = hits[i].id;
      break;
    }
  }
  return hits;
}

function referenceRelation(before) {
  if (/\b(?:just\s+to\s+the\s+left\s+of|just\s+left\s+of|to\s+the\s+left\s+of|left\s+of)\s+the\s*$/.test(before)) return "leftadj";
  if (/\b(?:immediately\s+right\s+of|to\s+the\s+right\s+of|right\s+of)\s+the\s*$/.test(before)) return "rightadj";
  if (/\b(?:right\s+next\s+to|next\s+to|beside)\s+the\s*$/.test(before)) return "next";
  if (/\b(?:under|underneath|below|beneath)\s+the\s*$/.test(before)) return "under";
  return "";
}

/* Equipment with no shape or length is an add. It never starts an empty island. */
function addEquipment(t, current) {
  /* "we have the 10 ft bar, now add a grill" is an add, not a new island. */
  const adding = current && current.legs && current.legs.length && /\b(add|put|place)\b/.test(t);
  if (/\b(remove|delete)\b/.test(t) || (isFullLayout(t) && !adding)) return null;
  if ((!current || !current.legs || !current.legs.length) && (detectShape(t) === "ell" || detectShape(t) === "yu")) return null;
  const hits = mentionHits(t);
  if (!hits.length) return null;
  for (const hit of hits) hit.id = resolvePresent(hit.id, current);
  const have = {};
  for (const legN of (current && current.legs) || []) {
    for (const id of legN.items || []) have[id] = (have[id] || 0) + 1;
    for (const id of Object.values(legN.bases || {})) have[id] = (have[id] || 0) + 1;
  }
  const listing = /\b(add|want|need|got|another|also)\b/.test(t) && !/\b(move|relocate|swap)\b/.test(t);
  const seen = {};
  for (const hit of hits) {
    seen[hit.id] = (seen[hit.id] || 0) + 1;
    const another = /\b(another|extra|second|third)\b/.test(t.slice(Math.max(0, hit.index - 30), hit.index));
    hit.fresh = another || seen[hit.id] > (have[hit.id] || 0) || (listing && hit.where === "under");
  }
  const aimed = sentenceLeg(t);
    if (aimed === "return" || aimed === "long" || aimed === "short" || aimed === "other") {
    const where = aimed === "long" ? "long" : aimed === "short" ? "short" : "return";
    for (const hit of hits) if (!hit.anchor && hit.where !== "under" && hit.where !== "leftadj" && hit.where !== "rightadj") hit.where = where;
  } else if (aimed === "grill" || aimed === "corner") {
    for (const hit of hits) if (!hit.anchor && hit.where !== "under" && hit.where !== "leftadj" && hit.where !== "rightadj") hit.where = "grill";
  }

  const left = hits.filter(h => h.where === "left");
  const right = hits.filter(h => h.where === "right" || h.where === "end");
  const mid = hits.filter(h => h.where !== "left" && h.where !== "right" && h.where !== "end");
  const ordered = [...left, ...mid, ...right];
  const pin = right.length > 0;

  if (!current || !current.legs || !current.legs.length) {
    const bay = ordered.filter(h => !(h.where === "under" && isBaseCabinet(h.id)));
    const ids = bay.map(h => h.id);
    const width = ids.reduce((sum, id) => sum + (CATALOG[id] ? CATALOG[id].w : 0), 0);
    const spec = blankSpec({ shape: "straight", barOn: false });
    spec.legs.push(leg("main", Math.max(120, Math.ceil(width)), ids, 0, pin));
    const notes = ["I laid this out as a straight run. Say if you wanted an L or a U."];
    for (const h of ordered) {
      if (h.where === "under" && isBaseCabinet(h.id)) {
        const under = attachUnder(spec, h.id);
        if (under.note) notes.push(under.note);
        else if (under.clarify) spec.legs[0].items.push(h.id);
      }
    }
    if (pin) notes.push("I put " + joinSpoken(right.map(h => CATALOG[h.id].spoken)) + " on the right.");
    return { spec, notes };
  }

  const spec = cloneSpec(current);
  spec.holdLengths = true;
  const before = layoutKey(current);
  const added = [];
  const moved = [];
  const underNotes = [];
  const wasAt = id => {
    for (const l of current.legs || []) {
      const i = (l.items || []).indexOf(id);
      if (i >= 0) return l.role + "#" + i;
      if (l.bases && Object.values(l.bases).includes(id)) return l.role + "#under";
    }
    return "";
  };
  const nowAt = id => {
    for (const l of spec.legs || []) {
      const i = (l.items || []).indexOf(id);
      if (i >= 0) return l.role + "#" + i;
      if (l.bases && Object.values(l.bases).includes(id)) return l.role + "#under";
    }
    return "";
  };
  const queue = [...left].reverse().concat(mid, right);
  for (const hit of queue) {
    if (hit.hostOnly) continue;
    const anchorLeg = hit.anchor && spec.legs.find(l => (l.items || []).includes(hit.anchor));
    if (hit.anchor && !anchorLeg) {
      return { clarify: "I don't see " + theName(hit.anchor) + " on this island, so I didn't move " + theName(hit.id) + "." };
    }
    const dest = anchorLeg || (hit.where === "long" || hit.where === "short" ? resolveLeg(spec, hit.where) : destLeg(spec, hit.where));
    const had = !!wasAt(hit.id);
    const fresh = !!hit.fresh;
    if (!fresh) spec.legs.forEach(l => { if (l !== dest) l.items = (l.items || []).filter(id => id !== hit.id); });
    if (hit.where === "under" && isBaseCabinet(hit.id)) {
      const under = attachUnder(spec, hit.id, hit.host, fresh || listing);
      if (under.clarify) return { clarify: under.clarify };
      underNotes.push(under.note);
      continue;
    }
    if (/\b(move|relocate|put|place)\b/.test(t) && had && !hit.where && !listing && !hit.hostOnly) {
      return { clarify: "Where should " + CATALOG[hit.id].spoken.replace(/^a /, "the ") + " go? Under the grill, on the left, or on the right." };
    }
    const keepFridgeEnd = ((current.legs.find(l => l === dest || l.role === dest.role) || {}).items || []).slice(-1)[0] === "fridge"
      || ((current.legs.find(l => l === dest || l.role === dest.role) || {}).items || []).slice(-1)[0] === "fridge-24";
    placeOnLeg(dest, hit.id, hit.where, fresh, keepFridgeEnd, hit.anchor);
    if (fresh || !had) added.push(hit);
    else if (wasAt(hit.id) !== nowAt(hit.id)) moved.push(hit);
  }
  if (layoutKey(spec) === before) return { clarify: unchangedReply(t, spec) };
  const spoken = h => CATALOG[h.id].spoken + placePhrase(h.where, h.anchor);
  const bits = [];
  if (added.length) bits.push("Added " + joinSpoken(added.map(spoken)));
  if (moved.length) bits.push("Moved " + joinSpoken(moved.map(spoken)));
  for (const line of underNotes) bits.push(String(line).replace(/\.$/, ""));
  let note = bits.join(". ");
  if (!note) note = "Moved " + joinSpoken(ordered.map(spoken));
  const unknown = findUnknown(t);
  if (unknown.length) note += " " + unknown.join(" ");
  if (findLengths(t).length === 1 && /\b(make|set)\b/.test(t)) {
    const main = spec.legs.find(l => l.role === "grill" || l.role === "main") || spec.legs[0];
    main.lengthIn = Math.round(findLengths(t)[0].ft * 12);
    note += " The run is " + findLengths(t)[0].ft + " ft.";
  }
  if (/\bno bar\b|\bbar off\b|\bturn off the bar\b/.test(t)) {
    spec.barOn = false;
    note += " The raised bar is off.";
  }
  if (findStools(t)) {
    const stools = findStools(t);
    const legN = spec.legs[spec.legs.length - 1];
    legN.stools = stools;
    spec.barOn = true;
    note += " Room for " + stools + " stools.";
  }
  const tail = [];
  if (hits.some(h => h.id === "ctwok")) tail.push("The countertop wok sits on the counter and has no equipment price in the catalog.");
  for (const hit of hits) if (hit.sizeNote) tail.push(hit.sizeNote);
  spec.lastAdded = added.map(h => h.id);
  for (const hit of moved) noteMove(spec, current, hit.id);
  const touched = moved[moved.length - 1] || added[added.length - 1];
  if (touched) {
    spec.lastMentioned = touched.id;
    spec.lastMoved = touched.id;
  }
  return { spec, brief: true, notes: [joinSentences([note].concat(tail))] };
}

function underFor(id, items, bases) {
  if (bases && isBaseCabinet(bases[id])) return CATALOG[bases[id]].k;
  const piece = CATALOG[id];
  if (!piece || !piece.under) return "";
  if ((id === "grill" || id === "grill-40") && items.some(isBaseCabinet)) return "";
  return piece.under;
}

function gapWidth(prev, id, requested, grillGap) {
  let want = requested;
  if (hotBesideGrill(prev, id)) want = Math.max(12, grillGap || 0, requested);
  return want > 0 ? nearestFiller(want) : 0;
}

function gearSpan(items, gapIn, grillGap) {
  const requested = gapIn == null ? 6 : gapIn;
  let sum = 0;
  let prev = "";
  for (const id of items || []) {
    const item = CATALOG[id];
    if (!item) continue;
    if (prev) sum += gapWidth(prev, id, requested, grillGap);
    sum += item.w;
    prev = id;
  }
  return sum;
}

/* A countertop appliance alone on a return sits in the usable run past a
   landing at the corner, not jammed against the main. Null means the usual
   split. A number is how many inches of filler go on the corner end. */
function counterLanding(leg) {
  const items = (leg.items || []).filter(id => CATALOG[id]);
  const alone = items.length === 1 && (items[0] === "ctpizza" || items[0] === "ctwok");
  const ret = leg.role === "left" || leg.role === "right" || leg.role === "return" || leg.role === "bar";
  if (!alone || !ret) return null;
  const piece = CATALOG[items[0]].w;
  const spare = Math.max(0, leg.lengthIn - piece);
  const landing = Math.min(24, spare);
  const pad = Math.max(0, (leg.lengthIn - landing - piece) / 2);
  const want = landing + pad + (Number(leg.slide) || 0);
  return Math.max(0, Math.min(spare, want));
}

function takeFillers(want) {
  const sizes = [];
  let left = Math.max(0, want);
  for (const size of FILLERS) {
    while (left >= size - 0.01) {
      sizes.push(size);
      left -= size;
    }
  }
  return { sizes, used: sizes.reduce((sum, size) => sum + size, 0) };
}

function pack(items, targetIn, pinEnd, bases, gapIn, locked, grillGap, cornerInset, align, panels, shift) {
  const requested = gapIn == null ? 6 : gapIn;
  const extras = Array.isArray(panels) ? panels : [];
  const pieces = [];
  for (const id of items) {
    const item = CATALOG[id];
    if (!item) continue;
    pieces.push({ id, k: item.k, w: item.w, u: underFor(id, items, bases) });
  }
  const between = [];
  for (let i = 0; i < pieces.length - 1; i++) {
    const w = gapWidth(pieces[i].id, pieces[i + 1].id, requested, grillGap);
    if (w > 0) between.push({ k: "fill" + w, w });
  }
  const extraW = extras.reduce((sum, panel) => sum + panel.w, 0);
  const base = pieces.reduce((sum, item) => sum + item.w, 0) + between.reduce((sum, gap) => sum + gap.w, 0) + extraW;
  let target = targetIn;
  const notes = [];
  if (base > target + 0.01) {
    const fit = Math.ceil(base / 12) * 12;
    const quiet = locked && base <= target + 4;
    target = base;
    if (!quiet) notes.push("Those pieces and the filler panels need about " + feet(base) + ", so this leg is longer than asked. About " + feet(fit) + " would fit them.");
  }
  let remain = target - base;
  const spare = remain;
  const fillers = [];
  for (const size of FILLERS) {
    while (remain >= size - 0.01) {
      fillers.push(size);
      remain -= size;
    }
  }
  let buckets;
  const delta = Number(shift) || 0;
  if (cornerInset != null && pieces.length) {
    const corner = takeFillers(Math.min(spare, cornerInset));
    const end = takeFillers(spare - corner.used);
    buckets = [corner.sizes, end.sizes];
  } else if (delta) {
    const baseLeft = align === "left" ? 0 : (pinEnd || align === "right" ? spare : Math.round(spare / 2));
    const leftIn = Math.max(0, Math.min(Math.max(0, spare), baseLeft + delta));
    const left = takeFillers(leftIn);
    const right = takeFillers(Math.max(0, spare - left.used));
    buckets = [left.sizes, right.sizes];
  } else if (align === "left") {
    buckets = [[], takeFillers(spare).sizes];
  } else if (pinEnd || align === "right") {
    buckets = [takeFillers(spare).sizes, []];
  } else {
    const endCount = pieces.length ? 2 : 1;
    buckets = Array.from({ length: endCount }, () => []);
    fillers.forEach((size, i) => buckets[i % endCount].push(size));
  }
  const pushEnd = (bucket) => { for (const size of bucket || []) seq.push({ k: "fill" + size, w: size, u: "" }); };
  const pushPanel = (panel) => seq.push({ k: "fill" + panel.w, w: panel.w, u: "" });
  const seq = [];
  if (!pieces.length) {
    extras.filter(panel => panel.at === "start").forEach(pushPanel);
    pushEnd(buckets[0]);
    extras.filter(panel => panel.at !== "start").forEach(pushPanel);
    if (align === "left") pushEnd(buckets[1]);
    if (!seq.length) seq.push({ k: "fill24", w: 24, u: "" });
  } else {
    pushEnd(buckets[0]);
    extras.filter(panel => panel.at === "start").forEach(pushPanel);
    for (let i = 0; i < pieces.length; i++) {
      if (i > 0 && between[i - 1]) seq.push({ k: between[i - 1].k, w: between[i - 1].w, u: "" });
      seq.push({ k: pieces[i].k, w: pieces[i].w, u: pieces[i].u || "" });
      extras.filter(panel => panel.at === "after" && panel.after === pieces[i].id).forEach(pushPanel);
    }
    extras.filter(panel => panel.at === "end").forEach(pushPanel);
    if (align === "left" || !pinEnd || delta) pushEnd(buckets[1]);
  }
  const span = seq.reduce((sum, part) => sum + part.w, 0);
  return { seq, span, notes, between: between.map(gap => gap.w) };
}

function feet(inches) {
  const ft = Math.round(inches / 12 * 10) / 10;
  return (ft % 1 === 0 ? String(ft) : ft.toFixed(1)) + " ft";
}

function q32(v) {
  return Math.round(v * 32) / 32;
}

function lay(seq, y, r, startAt) {
  let p = startAt || 0;
  const mods = [];
  for (const part of seq) {
    const m = { k: part.k, x: 0, y: 0, r: r || 0, u: part.u || "" };
    if (r === 90 || r === 270) { m.y = p + part.w / 2; m.x = y; }
    else { m.x = p + part.w / 2; m.y = y; }
    p += part.w;
    mods.push(m);
  }
  return { mods, end: p };
}

function place(spec, packed) {
  const mods = [];
  if (spec.shape === "straight") {
    const run = lay(packed[0].seq, 0, 0, 0);
    const ox = q32(run.end / 2);
    run.mods.forEach(m => { m.x = q32(m.x - ox); mods.push(m); });
    return mods;
  }
  if (spec.shape === "ell") {
    const main = lay(packed[0].seq, 0, 0, 0);
    const corner = { k: "corner24", x: q32(main.end + 12), y: 0, r: 0, u: "" };
    const right = main.end + 24;
    const ret = lay(packed[1].seq, right - DEPTH / 2, 90, DEPTH / 2);
    const all = [...main.mods, corner, ...ret.mods];
    const ox = q32(right / 2);
    const oy = q32(ret.end / 3);
    all.forEach(m => { m.x = q32(m.x - ox); m.y = q32(m.y - oy); mods.push(m); });
    return mods;
  }
  const main = lay(packed[0].seq, 0, 0, 0);
  const left = lay(packed[1].seq, DEPTH / 2, 270, DEPTH / 2);
  const right = lay(packed[2].seq, main.end - DEPTH / 2, 90, DEPTH / 2);
  const all = [...left.mods, ...main.mods, ...right.mods];
  const ox = q32(main.end / 2);
  const oy = q32(Math.max(left.end, right.end) / 3);
  all.forEach(m => { m.x = q32(m.x - ox); m.y = q32(m.y - oy); mods.push(m); });
  return mods;
}

export function encodeDesign(spec, mods) {
  const o = {
    v: 4,
    m: mods.map(m => [
      m.k,
      Math.round(m.x * 32),
      Math.round(m.y * 32),
      m.r || 0,
      0,
      m.u || "",
      0, 0, 0, 0
    ]),
    c: spec.counter || "concrete",
    o: 1.5,
    dp: spec.depth || DEPTH,
    ht: 37.5,
    f: spec.finish || "stucco",
    cr: 5.3,
    se: 1,
    bar: spec.barOn ? [6, 6] : 0,
    ol: 2,
    ms: "auto",
    fc: 0,
    fr: spec.frame || "cmu",
    a: ["trash"],
    og: [],
    cu: [],
    /* Spec leg lengths, grill run first. The designer chip reads these so a
       wider cabinet face under a narrow appliance cannot change the size. */
    lg: (spec.legs || []).map(l => Math.round(l.lengthIn))
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, "");
}

/* "10' + 6' + 6' returns". The first leg is the grill run. */
export function legChip(spec) {
  const legs = spec && spec.legs || [];
  if (legs.length < 2) return "";
  const feet = (n) => Math.max(1, Math.round(Number(n) / 12)) + "'";
  const rest = legs.slice(1).map(l => feet(l.lengthIn));
  return feet(legs[0].lengthIn) + " + " + rest.join(" + ") + (rest.length > 1 ? " returns" : " return");
}

export function decodeDesign(code) {
  const json = decodeURIComponent(escape(atob(code)));
  return JSON.parse(json);
}

function clampLeg(legObj, notes) {
  const asked = legObj.lengthIn;
  if (asked < MIN_LEG) {
    notes.push(feet(asked) + " is shorter than a leg we lay out, so the " + legObj.role + " leg is 4 ft.");
    legObj.lengthIn = MIN_LEG;
  } else if (asked > MAX_LEG) {
    notes.push(feet(asked) + " is longer than a single leg here, so the " + legObj.role + " leg is 20 ft.");
    legObj.lengthIn = MAX_LEG;
  }
  legObj.stools = Math.max(0, Math.min(8, Math.round(legObj.stools || 0)));
  legObj.items = (legObj.items || []).filter(id => CATALOG[id] && id !== "corner");
}

function stoolNote(legObj) {
  if (!legObj.stools) return "";
  const each = legObj.lengthIn / legObj.stools;
  if (each < 22) {
    return legObj.stools + " stools on " + feet(legObj.lengthIn) + " is about " + Math.round(each) + " inches each, which is tight. " + feet(legObj.stools * 24) + " fits them more comfortably.";
  }
  return "";
}

function cleanHist(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const spot of raw.slice(-6)) {
    if (!spot || !CATALOG[spot.id]) continue;
    const leg = Math.round(Number(spot.leg));
    const index = Math.round(Number(spot.index));
    if (!Number.isFinite(leg) || leg < 0 || leg > 2) continue;
    if (!Number.isFinite(index) || index < 0 || index > 12) continue;
    out.push({
      id: spot.id,
      leg,
      index,
      shift: Math.round(Number(spot.shift) || 0),
      slide: Math.round(Number(spot.slide) || 0),
      align: spot.align === "left" || spot.align === "right" ? spot.align : "",
      pinEnd: !!spot.pinEnd,
      base: CATALOG[spot.base] ? spot.base : ""
    });
  }
  return out;
}

export function validateSpec(input) {
  const src = input && typeof input === "object" ? input : {};
  const shape = src.shape === "ell" || src.shape === "yu" || src.shape === "straight" ? src.shape : "";
  if (!shape) return { ok: false, message: CLARIFY };
  const finish = FINISHES[src.finish] ? src.finish : "stucco";
  const counter = COUNTERS[src.counter] ? src.counter : "concrete";
  const frame = src.frame === "stud" ? "stud" : "cmu";
  const rawLegs = Array.isArray(src.legs) ? src.legs.slice(0, 3) : [];
  if (!rawLegs.length) return { ok: false, message: CLARIFY };
  const legs = rawLegs.map(raw => leg(
    ["grill", "bar", "left", "right", "main", "return"].includes(raw && raw.role) ? raw.role : "main",
    Math.round(Number(raw && (raw.lengthIn != null ? raw.lengthIn : raw.lengthFt && raw.lengthFt * 12)) || 0),
    Array.isArray(raw && raw.items) ? raw.items.map(id => String(id)).slice(0, 12) : [],
    Number(raw && raw.stools) || 0,
    !!(raw && raw.pinEnd),
    readBases(raw && raw.bases)
  ));
  legs.forEach((out, i) => {
    const raw = rawLegs[i] || {};
    out.fixed = !!raw.fixed;
    if (raw.slide) out.slide = Math.round(Number(raw.slide) || 0);
    if (raw.align === "left" || raw.align === "right") out.align = raw.align;
    if (raw.shift) out.shift = Math.round(Number(raw.shift) || 0);
    const panels = Array.isArray(raw.panels) ? raw.panels : [];
    out.panels = panels.slice(0, 8).map(panel => ({
      w: nearestFiller(Number(panel && panel.w) || 6),
      at: panel && (panel.at === "start" || panel.at === "after") ? panel.at : "end",
      after: panel && CATALOG[panel.after] ? panel.after : ""
    })).filter(panel => panel.w > 0);
  });
  return {
    ok: true,
    spec: {
      shape,
      finish,
      counter,
      frame,
      depth: DEPTH,
      barOn: !!src.barOn || legs.some(l => l.stools > 0),
      gapIn: src.gapIn == null ? 6 : Math.max(0, Number(src.gapIn) || 0),
      grillGap: src.grillGap ? 24 : 0,
      lastAdded: Array.isArray(src.lastAdded) ? src.lastAdded.filter(id => CATALOG[id]).slice(0, 12) : [],
      lastMentioned: CATALOG[src.lastMentioned] ? src.lastMentioned : "",
      lastMoved: CATALOG[src.lastMoved] ? src.lastMoved : "",
      lastDir: src.lastDir === 1 || src.lastDir === -1 ? src.lastDir : 0,
      moveHist: cleanHist(src.moveHist),
      pending: Array.isArray(src.pending) ? src.pending.filter(id => CATALOG[id]).slice(0, 12) : [],
      legs
    }
  };
}

function stripClaimed(notes, ids) {
  const counts = {};
  for (const id of ids) {
    const name = CATALOG[id] ? CATALOG[id].spoken : String(id);
    counts[name] = (counts[name] || 0) + 1;
  }
  for (let i = 0; i < notes.length; i++) {
    if (!/^Added /.test(notes[i])) continue;
    let text = notes[i];
    for (const name of Object.keys(counts)) {
      for (let n = 0; n < counts[name]; n++) {
        const at = text.lastIndexOf(name);
        if (at < 0) break;
        text = text.slice(0, at) + text.slice(at + name.length);
      }
    }
    text = text.replace(/Added\s+(,|and)\s+/gi, "Added ");
    text = text.replace(/(,\s*)+(and\s*)?/g, ", ");
    text = text.replace(/,\s*,/g, ",");
    text = text.replace(/,\s+and\s+,/g, ", ");
    text = text.replace(/,\s*\./g, ".");
    text = text.replace(/,\s*$/g, "");
    text = text.replace(/\s{2,}/g, " ").trim();
    notes[i] = /^Added\s+\S/.test(text) ? text : "";
  }
}

function joinSentences(parts) {
  const bits = [];
  for (const part of parts) {
    const clean = String(part || "").trim().replace(/^\.+/, "").replace(/\.+$/, "");
    if (clean) bits.push(clean);
  }
  return bits.join(". ") + (bits.length ? "." : "");
}

function describe(spec, notes) {
  const shapeName = spec.shape === "ell" ? "an L-shape" : spec.shape === "yu" ? "a U-shape" : "a straight run";
  const bits = spec.legs.map(l => {
    const names = l.items.map(id => CATALOG[id] ? CATALOG[id].spoken : "").filter(Boolean);
    let line = "The " + l.role + " leg is about " + feet(l.lengthIn);
    if (names.length) line += " with " + names.join(", ");
    if (l.bases) {
      for (const host of Object.keys(l.bases)) {
        const cab = CATALOG[l.bases[host]];
        const under = host === "grill" || host === "grill-40"
          ? "the grill"
          : (CATALOG[host] ? CATALOG[host].spoken.replace(/^an? /, "the ") : "that piece");
        if (cab) line += ", with " + cab.spoken + " in the base under " + under;
      }
    }
    if (l.stools) line += ", with the raised bar on for " + l.stools + (l.stools === 1 ? " stool" : " stools");
    return line;
  });
  let text = "Here's " + shapeName + ". " + bits.join(". ") + ".";
  if (spec.barOn && !spec.legs.some(l => l.stools)) text += " The raised bar is on.";
  if (spec.finish !== "stucco") text += " Finish is " + FINISHES[spec.finish] + ".";
  const counter = COUNTERS[spec.counter];
  if (counter && spec.counter !== "concrete") {
    text += counter.quote
      ? " The counter is " + counter.n + ", which the designer lists as a quote add, so I won't put a price on it."
      : " The counter is " + counter.n + ".";
  }
  text += " The price on the design comes from the catalog and the build rates. Tell me what to change, or save it when it looks right.";
  return joinSentences([text].concat(notes || []));
}

function changeReply(spec, notes) {
  const changes = (notes || []).filter(n => /^(Made |Added |Removed |Moved |Swapped |Switched |Finish |That's |That piece|Cleared |Turned |Set )/ .test(n));
  const bar = spec.legs.find(l => l.role === "bar");
  const grill = spec.legs.find(l => l.role === "grill" || l.role === "main");
  const first = changes[0] || "";
  let lead = "Done. ";
  let body = first;
  if (/^Made the bar/.test(first) && bar) {
    lead = "Done, ";
    body = "the bar is now " + feet(bar.lengthIn);
    if (bar.stools) body += ", room for " + bar.stools + (bar.stools === 1 ? " stool" : " stools");
  } else if (/^Made the grill/.test(first) && grill) {
    lead = "Done, ";
    body = "the grill leg is now " + feet(grill.lengthIn);
  }
  const extra = (notes || []).filter(n => n && n !== first && /so I put |either leg|longer than asked|shorter than a leg|longer than a single|^I added |^I left 12 inches/.test(n));
  if (!body && !extra.length) return "Done.";
  return lead + joinSentences([body].concat(extra));
}

export function summaryReply(spec) {
  if (!spec) return "";
  return describe(spec, []);
}

export function compileSpec(input, extraNotes) {
  const hold = !!(input && input.holdLengths);
  const checked = validateSpec(input);
  if (!checked.ok) return { ok: false, reply: checked.message, spec: null, code: "", link: "", warnings: [] };
  const spec = checked.spec;
  const notes = (extraNotes || []).slice();
  if (spec.shape === "ell" && spec.legs.length < 2) return { ok: false, reply: "An L needs two legs. How long is the second one?", spec: null, code: "", link: "", warnings: [] };
  if (spec.shape === "yu" && spec.legs.length < 3) return { ok: false, reply: "A U needs a back and two returns. How long is each?", spec: null, code: "", link: "", warnings: [] };
  spec.legs.forEach(l => clampLeg(l, notes));
  if (hold) {
    for (const l of spec.legs) {
      if (!l.fixed) continue;
      const ask = gearSpan(l.items || [], spec.gapIn, spec.grillGap);
      if (ask <= l.lengthIn + 4) continue;
      const dropped = [];
      while ((l.items || []).length && gearSpan(l.items, spec.gapIn, spec.grillGap) > l.lengthIn + 4) dropped.push(l.items.pop());
      dropped.reverse();
      const moved = [];
      const pending = [];
      for (const id of dropped) {
        const home = spec.legs.find(o => {
          if (o === l) return false;
          const span = gearSpan((o.items || []).concat(id), spec.gapIn, spec.grillGap);
          const room = o.fixed ? o.lengthIn : Math.max(o.lengthIn, span);
          return span <= room + 4;
        });
        if (home) {
          home.items = home.items || [];
          home.items.push(id);
          moved.push({ id, dest: home });
        } else pending.push(id);
      }
      const legName = l.role === "grill" || l.role === "main" ? "grill leg" : l.role + " leg";
      if (moved.length) {
        const dest = moved[0].dest;
        const destName = dest.role === "bar" || dest.role === "return" ? "the return" : "the other leg";
        notes.push("The " + legName + " stays " + feet(l.lengthIn) + ", so I put " + joinSpoken(moved.map(row => CATALOG[row.id] ? CATALOG[row.id].spoken : row.id)) + " on " + destName + ".");
        stripClaimed(notes, moved.map(row => row.id));
      }
      if (pending.length) {
        spec.pending = (spec.pending || []).concat(pending);
        const names = joinSpoken(pending.map(id => CATALOG[id] ? CATALOG[id].spoken : id));
        notes.push(names + (pending.length > 1 ? " don't fit on either leg. " : " doesn't fit on either leg. ") + "Where should " + (pending.length > 1 ? "they" : "it") + " go, or should a leg be longer? " + feet(Math.ceil(ask / 12) * 12) + " would fit them.");
        stripClaimed(notes, pending);
      }
    }
  }
  const packed = spec.legs.map(l => {
    const inset = counterLanding(l);
    const result = pack(l.items, Math.min(HARD_MAX, l.lengthIn), !!l.pinEnd, l.bases, spec.gapIn, hold && l.fixed, spec.grillGap, inset, l.align || "", l.panels || [], l.shift || 0);
    if (inset >= 24 && (l.items || []).includes("ctpizza") && !notes.some(n => /corner before the pizza/.test(n))) {
      notes.push("I left " + feet(inset) + " of counter at the corner before the pizza oven.");
    }
    if (!(hold && l.fixed) && result.span > l.lengthIn + 0.5) l.lengthIn = Math.round(result.span);
    notes.push(...result.notes);
    const tight = stoolNote(l);
    if (tight) notes.push(tight);
    return result;
  });
  const gaps = packed.flatMap(result => result.between || []);
  if (gaps.length && !notes.some(n => /filler panel|beside the grill/i.test(n))) {
    const has6 = gaps.some(w => w === 6);
    const has12 = gaps.some(w => w === 12);
    const other = gaps.find(w => w !== 6 && w !== 12);
    let blurb = "";
    if (has6 && has12) blurb = "I added 6 inch filler panels between appliances, and 12 inches beside the grill.";
    else if (has12) blurb = "I left 12 inches beside the grill. A side burner, griddle, or sink needs that much.";
    else if (has6) blurb = "I added 6 inch filler panels between appliances.";
    else if (other) blurb = "I added " + other + " inch filler panels between appliances.";
    if (blurb) notes.push(blurb + " Filler panels have no equipment price of their own. The build rate covers the extra length.");
  }
  const mods = place(spec, packed);
  const code = encodeDesign(spec, mods);
  const link = CONFIG.designer.shareOrigin + CONFIG.designer.pagePath + "#d=" + code;
  const dropped = [];
  spec.legs.forEach(l => {
    (l.items || []).forEach(id => { if (!CATALOG[id]) dropped.push(id); });
  });
  return {
    ok: true,
    spec,
    code,
    link,
    reply: describe(spec, notes),
    warnings: notes,
    placed: spec.legs.map((l, i) => ({ role: l.role, span: packed[i].span, keys: packed[i].seq.map(part => part.k) })),
    catalogKeys: mods.map(m => m.k)
  };
}

function askBit(t) {
  if (/\b(fridge|refrigerator|cooler)\b/.test(t)) return "Got it, which side should the fridge go on?";
  if (/\bcombo\b/.test(t)) return "Got it, which side should the combo go on?";
  if (/\bsink\b/.test(t)) return "Got it, which side should the sink go on?";
  return "What should I add, and which side?";
}

function keepResult(current, reply, notes) {
  const kept = current ? compileSpec(current) : null;
  return {
    handled: true,
    kind: "clarify",
    reply,
    spec: current || null,
    code: kept && kept.ok ? kept.code : "",
    link: kept && kept.ok ? kept.link : "",
    warnings: notes || []
  };
}

function guardWipe(current, result, t) {
  if (!current || !gearCount(current)) return result;
  if (result.kind === "refine" && result.spec) return result;
  if (result.spec && gearCount(result.spec) > 0) return result;
  if (/\b(start over|from scratch|clear the island|empty island)\b/.test(t)) return result;
  return keepResult(current, "I kept this layout. " + askBit(t));
}

function finishResult(parsed, current) {
  if (parsed.clarify && !parsed.spec) {
    const kept = current ? compileSpec(current) : null;
    return {
      handled: parsed.handled !== false,
      kind: "clarify",
      reply: [parsed.clarify].concat(parsed.notes || []).join(" "),
      spec: current || null,
      code: kept ? kept.code : "",
      link: kept ? kept.link : "",
      warnings: parsed.notes || []
    };
  }
  const built = compileSpec(parsed.spec, parsed.notes || []);
  const reply = parsed.brief && built.ok ? changeReply(built.spec, built.warnings && built.warnings.length ? built.warnings : (parsed.notes || [])) : built.reply;
  return {
    handled: true,
    kind: parsed.brief ? "refine" : "draw",
    reply,
    spec: built.spec,
    code: built.code,
    link: built.link,
    warnings: built.warnings || [],
    placed: built.placed
  };
}

function plainWords(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/* A turn worth keeping for the training log. Null means the layout landed
   and there is nothing to learn from. Contact-shaped text is never a miss. */
export function holdLongEnough(ms) {
  return Number(ms) >= 300;
}

/* Bracketed non-speech tags and one-word scraps are not a design request. */
export function usableTranscript(text) {
  const raw = String(text || "").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const words = raw.split(" ").filter(word => /[a-z0-9]/i.test(word));
  if (words.length < 2) return "";
  return words.join(" ");
}

export function prefersScribe(ua) {
  const agent = String(ua || "");
  const iOS = /iPhone|iPad|iPod/.test(agent);
  const safari = /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(agent);
  return iOS && safari;
}

export function classifyTurn(text, reply, before, after, prevText) {
  const t = String(text || "").trim();
  const r = String(reply || "");
  if (!t || !r) return null;
  const card = [/\bname\s*:/i, /\bemail\s*:/i, /\bphone\s*:/i].filter(re => re.test(t)).length;
  if (card >= 2) return null;
  const prev = plainWords(prevText);
  const now = plainWords(t);
  const repeat = prev.length > 8 && (prev === now || now.includes(prev) || prev.includes(now));
  const changed = JSON.stringify(before || null) !== JSON.stringify(after || null);
  if (repeat) return "repeat";
  if (/isn't in the catalog|left it off|didn't add/i.test(r) && changed) return "partial";
  if (/already|unchanged|haven't changed|left the rest|still there/i.test(r)) return "unchanged";
  if (/I can make the bar or the grill leg/i.test(r)) return "help";
  if (/I kept this layout|didn't catch|which side should|How long should|isn't in the catalog|earlier version/i.test(r)) return "miss";
  return null;
}

function keepUnmentioned(spec, current, t) {
  if (!current || !spec || !spec.legs || !spec.legs.length) return;
  const named = new Set(findItems(t));
  const have = new Set();
  spec.legs.forEach(l => (l.items || []).forEach(id => have.add(id)));
  const main = spec.legs[0];
  for (const l of current.legs || []) {
    for (const id of l.items || []) {
      if (!id || named.has(id) || have.has(id) || !CATALOG[id]) continue;
      main.items.push(id);
      have.add(id);
    }
  }
  if (current.barOn && !/\bno bar\b|\bbar off\b/.test(t)) spec.barOn = true;
}

function defaultShape(t, current) {
  const shape = detectShape(t);
  if (shape !== "ell" && shape !== "yu") return null;
  if (findLengths(t).length || /\b(make|turn|change)\b/.test(t)) return null;
  if (current && current.shape === shape) return { handled: true, spec: cloneSpec(current), notes: [] };
  const src = current && current.legs && current.legs[0];
  const mainLen = src && src.lengthIn || 120;
  const named = findItems(t);
  const spec = blankSpec({
    shape,
    finish: (current && current.finish) || finishOf(t) || "stucco",
    counter: (current && current.counter) || counterOf(t) || "concrete",
    frame: (current && current.frame) || "cmu",
    barOn: !!(current && current.barOn) || /\bbar\b|\bstools?\b/.test(t)
  });
  const items = named.length ? named.slice() : (src && src.items ? src.items.slice() : []);
  const bases = named.length ? undefined : src && src.bases;
  spec.legs.push(leg(shape === "ell" ? "grill" : "grill", mainLen, items, 0, src && src.pinEnd, bases));
  if (shape === "ell") spec.legs.push(leg("bar", 72, [], findStools(t)));
  else {
    spec.legs.push(leg("left", 72, [], 0));
    spec.legs.push(leg("right", 72, [], 0));
  }
  keepUnmentioned(spec, current, t);
  const which = shape === "ell" ? "return" : "returns";
  return {
    handled: true,
    spec,
    notes: ["I used " + feet(mainLen) + " for the main run and " + feet(72) + " for the " + which + ". Say if you want different lengths."]
  };
}

export function interpret(text, current) {
  const t = speechClean(normalize(text));
  if (!t) return keepResult(current, current ? "I kept this layout. What should I change?" : CLARIFY);
  const change = refine(t, current);
  if (change) return guardWipe(current, finishResult({ handled: true, ...change }, current), t);
  const moved = rearrange(t, current);
  if (moved) return guardWipe(current, finishResult({ handled: true, ...moved }, current), t);
  const added = addEquipment(t, current);
  if (added) {
    if (added.clarify && !added.spec) return keepResult(current, added.clarify, added.notes);
    return finishResult({ handled: true, ...added }, current);
  }
  const parsed = parseNew(t);
  if (parsed.spec && current && detectShape(t) && detectShape(t) !== current.shape) keepUnmentioned(parsed.spec, current, t);
  if (parsed.spec) return guardWipe(current, finishResult(parsed, current), t);
  const shaped = defaultShape(t, current);
  if (shaped) return guardWipe(current, finishResult(shaped, current), t);
  if (!parsed.handled) {
    const reply = current ? "I kept this layout. " + askBit(t) : (parsed.clarify || CLARIFY);
    return keepResult(current, reply, parsed.notes);
  }
  if (parsed.clarify && !parsed.spec && current) {
    return keepResult(current, "I kept this layout. " + askBit(t), parsed.notes);
  }
  return guardWipe(current, finishResult(parsed, current), t);
}

export function applyModelSpec(raw, current) {
  const data = raw && typeof raw === "object" ? raw : {};
  if (data.action === "clarify" || !data.spec) {
    const question = String(data.question || "").trim();
    const safe = !question || claimsSent(question) ? CLARIFY + " Call " + CONFIG.phoneDisplay + " if you'd rather talk it through." : question;
    const kept = current ? compileSpec(current) : null;
    return {
      handled: true,
      reply: safe,
      spec: current || null,
      code: kept ? kept.code : "",
      link: kept ? kept.link : "",
      warnings: []
    };
  }
  const specIn = { ...data.spec };
  delete specIn.price;
  delete specIn.total;
  delete specIn.say;
  if (Array.isArray(specIn.legs)) {
    specIn.legs = specIn.legs.map(l => ({
      ...l,
      items: (Array.isArray(l.items) ? l.items : []).filter(id => CATALOG[id])
    }));
  }
  const built = compileSpec(specIn);
  if (!built.ok || (current && gearCount(current) && !gearCount(built.spec))) {
    const kept = current ? compileSpec(current) : null;
    return {
      handled: true,
      kind: "clarify",
      reply: current ? "I kept this layout. " + askBit("") : built.reply,
      spec: current || null,
      code: kept && kept.ok ? kept.code : "",
      link: kept && kept.ok ? kept.link : "",
      warnings: []
    };
  }
  return { handled: true, reply: built.reply, spec: built.spec, code: built.code, link: built.link, warnings: built.warnings || [] };
}

export function claimsSent(text) {
  const s = String(text || "");
  return [
    /\b(i|we)(?:'ll| will| just| have|'ve)?\s+(?:just\s+)?(?:sent|emailed|mailed)\b/i,
    /\bsent exactly\b/i,
    /\bemail(?:ed)?\s+(?:it|you|that|the|a|your)\b/i,
    /\bcheck your inbox\b/i,
    /\bon its way\b/i,
    /\bhas been sent\b/i
  ].some(re => re.test(s));
}

export function saveReply(status) {
  const phone = CONFIG.phoneDisplay;
  const email = status && status.email || "";
  const link = status && status.link || "";
  if (status && status.emailConfirmed) {
    const what = status.imageAttached ? "The picture and the link are" : "The link is";
    const team = status.leadSubmitted ? " John has the design too." : "";
    return "Sent. " + what + " on their way to " + email + "." + team + (link ? " Open it any time: " + link : "");
  }
  if (status && status.leadSubmitted) {
    return "The email did not go through. The EagleBuilt team has the design and will follow up. Call " + phone + "." + (link ? " Your link: " + link : "");
  }
  return "That didn't go through. Call " + phone + ".";
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function cleanField(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateContact(input) {
  const src = input && typeof input === "object" ? input : {};
  const name = cleanField(src.name, 80);
  const phone = cleanField(src.phone, 40);
  const email = cleanField(src.email, 254).toLowerCase();
  const zip = cleanField(src.zip, 12);
  const city = cleanField(src.city, 80);
  const notes = cleanField(src.notes != null ? src.notes : src.project, 400);

  if (name.length < 2 || !/[a-z]/i.test(name) || /https?:|@/i.test(name)) {
    return { ok: false, field: "name", message: "Name is required." };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, field: "email", message: "Email is required." };
  }
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10 || /^(\d)\1{9}$/.test(national)) {
    return { ok: false, field: "phone", message: "Phone is required." };
  }
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    return { ok: false, field: "zip", message: "ZIP should be 5 digits, or leave it blank." };
  }
  if (city && (city.length < 2 || !/[a-z]/i.test(city))) {
    return { ok: false, field: "city", message: "That city doesn't look right. You can leave it blank." };
  }
  return { ok: true, contact: { name, email, phone, zip, city, notes } };
}

export function layoutSummary(spec) {
  if (!spec || !spec.legs) return "";
  const shape = spec.shape === "ell" ? "L-shape" : spec.shape === "yu" ? "U-shape" : "Straight";
  const legs = spec.legs.map(l => feet(l.lengthIn) + " " + l.role + (l.items && l.items.length ? " (" + l.items.join(", ") + ")" : "")).join("; ");
  return (shape + ": " + legs).slice(0, 400);
}

export const MODEL_SYSTEM = [
  "You turn a homeowner's words into a JSON spec for an outdoor BBQ island.",
  "Return only JSON. No markdown.",
  "Shape is straight, ell, or yu. Finish is stucco, stack, cult, flag, brick, brickw, or tile.",
  "Counter is concrete, concretew, granite, quartz, quartzite, or tilep. Frame is cmu or stud.",
  "Legs have role (main, grill, bar, left, right), lengthFt, items, and stools.",
  "Items must be chosen from: grill, grill-40, side-burner, side-burner-single, fridge, fridge-24, sink, power, griddle, pizza, trash, door, smoker.",
  "If the request is ambiguous, return {\"action\":\"clarify\",\"question\":\"one short question\"}.",
  "Otherwise return {\"action\":\"spec\",\"spec\":{...}} with the full spec.",
  "Never include a price, a dollar amount, a review, or a timeline.",
  "Never say you sent, emailed, or scheduled anything.",
  "Apply a follow-up to the current spec instead of starting over, unless they ask for a new island."
].join(" ");
