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
    sessionMs: 8 * 60 * 1000,
    sessionChars: 3500,
    maxChars: 900
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
  power: { k: "BLZ-PBLTE3", spoken: "a power burner", w: 16, p: 1499 },
  griddle: { k: "BLZ-GRIDDLE-LTE3", spoken: "a 30 inch griddle", w: 30.25, p: 2749, under: "BLZ-AD25-R-SC" },
  pizza: { k: "BLZ-26-PZOVN", spoken: "a 26 inch pizza oven", w: 26.5, p: 2499 },
  trash: { k: "BLZ-TRLP-DRW-H", spoken: "a trash drawer", w: 20.375, p: 695 },
  door: { k: "BLZ-AD32-R-SC", spoken: "storage doors", w: 30.75, p: 521 },
  /* Real catalog SKUs. "combo unit" is the door + drawer combo, not a side burner. */
  combo: { k: "BLZ-DDC-R-LTSC", spoken: "a door and drawer combo", w: 32.25, p: 986 },
  drawer: { k: "BLZ-DRW2-R-LT", spoken: "a double drawer", w: 17.5, p: 812 },
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

const COUNTERS = {
  concrete: { n: "color concrete", quote: false },
  concretew: { n: "white concrete", quote: false },
  concrete2: { n: "2 inch color concrete", quote: false },
  granite: { n: "granite", quote: true },
  quartz: { n: "quartz", quote: true },
  quartzite: { n: "quartzite", quote: true },
  tilep: { n: "porcelain tile", quote: true }
};

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20
};

const ITEM_RES = [
  [/single side burner/, "side-burner-single"],
  [/side burner combo|double side burner|side burner|sideburner/, "side-burner"],
  [/power burner|\bwok\b/, "power"],
  [/\b40\s*(?:inch|in)?\s*(?:\w+\s+){0,2}grill/, "grill-40"],
  [/griddle/, "griddle"],
  [/pizza oven|\bpizza\b/, "pizza"],
  [/smoker/, "smoker"],
  [/ice maker|icemaker/, "ice"],
  [/trash pull ?out|pull ?out trash|trash drawer|\btrash\b/, "trash"],
  [/doors and drawers|door\s+(?:and\s+)?drawers?(?:\s+combo)?|combo unit|combo cabinet|\bcombo\b/, "combo"],
  [/\bdrawers?\b/, "drawer"],
  [/access doors?/, "door"],
  [/\bdoors?\b/, "door"],
  [/\bsink\b/, "sink"],
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
    .replace(/\bnext to the grill\b/g, " __next__ ")
    .replace(/\bbeside the grill\b/g, " __next__ ")
    .replace(/\bby the grill\b/g, " __next__ ")
    .replace(/\bbetween the grill and the (?:fridge|refrigerator)\b/g, " __between__ ")
    .replace(/\bin the middle\b|\bin the center\b/g, " __between__ ")
    .replace(/\b(?:under|underneath|below|beneath) the (?:grill|bbq|barbecue|barbeque)\b/g, " __under__ ")
    .replace(/\b(?:under|underneath) it\b/g, " __under__ ")
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

function speechClean(text) {
  return String(text || "")
    .replace(/\b(uh+|um+|er+|ah+|hmm+)\b/g, " ")
    .replace(/\b(basically|actually|kinda|sorta|please|just|like|okay|ok|so|well|yeah|yep|hey)\b/g, " ")
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

function counterOf(text) {
  if (/quartzite/.test(text)) return "quartzite";
  if (/quartz/.test(text)) return "quartz";
  if (/granite/.test(text)) return "granite";
  if (/white concrete/.test(text)) return "concretew";
  if (/tile counter|porcelain tile counter/.test(text)) return "tilep";
  return "";
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

function parseNew(t) {
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
    spec.legs.push(leg("main", Math.round(parts[0].ft * 12), placed.items, findStools(t), placed.pinEnd));
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
    const grillStools = findStools(parts[g].text);
    const barStools = findStools(parts[b].text) || (findStools(t) - grillStools);
    spec.legs.push(leg("grill", Math.round(parts[g].ft * 12), grillItems, grillStools));
    spec.legs.push(leg("bar", Math.round(parts[b].ft * 12), barItems, Math.max(0, barStools)));
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
    spec.legs.push(leg("grill", Math.round(parts[m].ft * 12), mainItems, 0));
    spec.legs.push(leg("left", Math.round(left.ft * 12), sharedSide || left === each ? [] : findItems(left.text), 0));
    spec.legs.push(leg("right", Math.round(right.ft * 12), sharedSide || right === each ? [] : findItems(right.text), 0));
  }

  spec.barOn = spec.legs.some(l => l.stools > 0 || l.role === "bar") || /\bbar\b|\bstools?\b/.test(t);
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
  ice: 1
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

function refine(t, current) {
  if (!current) return null;
  const spec = cloneSpec(current);
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
  if (add && !placed && findItems(t).length < 2) {
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
  const counter = counterOf(t);
  if (counter && !findItems(t).length) {
    spec.counter = counter;
    const named = COUNTERS[counter];
    const quote = named.quote ? ", which the designer lists as a quote add" : "";
    return { spec, brief: true, notes: ["Switched the counter to " + named.n + quote + "."] };
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
    spec.barOn = true;
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

function placePhrase(where) {
  if (where === "right" || where === "end") return " on the right";
  if (where === "left") return " on the left";
  if (where === "return") return " on the return";
  if (where === "main") return " on the main run";
  if (where === "bar") return " under the bar";
  if (where === "under") return " in the base under the grill";
  if (where === "next") return " next to the grill";
  return "";
}

function isBaseCabinet(id) {
  return id === "combo" || id === "door" || id === "drawer";
}

function readBases(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const out = {};
  for (const host of ["grill", "grill-40"]) {
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
function attachUnder(spec, baseId) {
  const leg = spec.legs.find(l => hostGrill(l));
  if (!leg) {
    return { clarify: "There's no grill to put that under. I can put " + CATALOG[baseId].spoken + " on the left or the right." };
  }
  const host = hostGrill(leg);
  const name = CATALOG[baseId].spoken;
  const sitting = spec.legs.some(l => (l.items || []).includes(baseId));
  if (leg.bases && leg.bases[host] === baseId && !sitting) {
    return { clarify: name.replace(/^a /, "The ") + " is already in the base under the grill. I can move it out beside the grill, or leave the fridge at the right end." };
  }
  spec.legs.forEach(l => { l.items = (l.items || []).filter(id => id !== baseId); });
  const prev = leg.bases && leg.bases[host];
  if (!leg.bases) leg.bases = {};
  if (prev && prev !== baseId && !leg.items.includes(prev)) {
    const at = leg.items.indexOf(host);
    if (at >= 0) leg.items.splice(at + 1, 0, prev);
    else leg.items.push(prev);
  }
  leg.bases[host] = baseId;
  if (leg.items[leg.items.length - 1] === "fridge" || leg.items[leg.items.length - 1] === "fridge-24") leg.pinEnd = true;
  const word = sitting || prev === baseId ? "Moved " : "Added ";
  return { note: word + name + " into the base under the grill." };
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
  if (A.leg === B.leg) {
    const items = A.leg.items;
    const tmp = items[A.i];
    items[A.i] = items[B.i];
    items[B.i] = tmp;
  } else {
    A.leg.items[A.i] = b;
    B.leg.items[B.i] = a;
  }
  return { spec, brief: true, notes: ["Swapped " + CATALOG[a].spoken + " and " + CATALOG[b].spoken + "."] };
}

function rearrange(t, current) {
  if (!current || !current.legs || !current.legs.length) return null;
  if (!/\bswap\b/.test(t)) return null;
  if (/\b(stone|stucco|finish|veneer|longer|shorter)\b/.test(t)) return null;
  const ids = findItems(t);
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
  if (where === "bar" || where === "return") {
    return spec.legs.find(l => l.role === "bar" || l.role === "return" || l.role === "right") || spec.legs[1] || main;
  }
  if (where === "main") return main;
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
function placeOnLeg(leg, id, where) {
  if ((where === "main" || where === "return") && (leg.items || []).includes(id)) return;
  leg.items = (leg.items || []).filter(x => x !== id);
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
  if (where === "next") {
    const at = leg.items.findIndex(x => x === "grill" || x === "grill-40");
    if (at >= 0) {
      leg.items.splice(at + 1, 0, id);
      if (leg.items[leg.items.length - 1] === "fridge") leg.pinEnd = true;
      return;
    }
  }
  const last = leg.items[leg.items.length - 1];
  if ((last === "fridge" || last === "fridge-24") && id !== "fridge" && id !== "fridge-24") {
    leg.items.splice(leg.items.length - 1, 0, id);
    leg.pinEnd = true;
    return;
  }
  leg.items.push(id);
}

/* Equipment with no shape or length is an add. It never starts an empty island. */
function addEquipment(t, current) {
  /* "we have the 10 ft bar, now add a grill" is an add, not a new island. */
  const adding = current && current.legs && current.legs.length && /\b(add|put|place)\b/.test(t);
  if (/\b(remove|delete)\b/.test(t) || (isFullLayout(t) && !adding)) return null;
  const hits = [];
  for (const hit of findItemHits(t)) {
    if (!hits.some(h => h.id === hit.id)) hits.push(hit);
  }
  if (!hits.length) return null;

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
    const dest = destLeg(spec, hit.where);
    const had = !!wasAt(hit.id);
    spec.legs.forEach(l => { if (l !== dest) l.items = (l.items || []).filter(id => id !== hit.id); });
    if (hit.where === "under" && isBaseCabinet(hit.id)) {
      const under = attachUnder(spec, hit.id);
      if (under.clarify) return { clarify: under.clarify };
      underNotes.push(under.note);
      continue;
    }
    if (/\b(move|relocate|put|place)\b/.test(t) && had && !hit.where) {
      return { clarify: "Where should " + CATALOG[hit.id].spoken.replace(/^a /, "the ") + " go? Under the grill, on the left, or on the right." };
    }
    placeOnLeg(dest, hit.id, hit.where);
    const phraseHit = hit;
    if (!had) added.push(phraseHit);
    else if (wasAt(hit.id) !== nowAt(hit.id)) moved.push(phraseHit);
  }
  if (layoutKey(spec) === before) return { clarify: unchangedReply(t, spec) };
  const spoken = h => CATALOG[h.id].spoken + placePhrase(h.where);
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
  return { spec, brief: true, notes: [note] };
}

function underFor(id, items, bases) {
  if (bases && isBaseCabinet(bases[id])) return CATALOG[bases[id]].k;
  const piece = CATALOG[id];
  if (!piece || !piece.under) return "";
  if ((id === "grill" || id === "grill-40") && items.some(isBaseCabinet)) return "";
  return piece.under;
}

function pack(items, targetIn, pinEnd, bases, gapIn) {
  const requested = gapIn == null ? 6 : gapIn;
  const pieces = [];
  for (const id of items) {
    const item = CATALOG[id];
    if (!item) continue;
    pieces.push({ id, k: item.k, w: item.w, u: underFor(id, items, bases) });
  }
  const between = [];
  for (let i = 0; i < pieces.length - 1; i++) {
    const want = hotBesideGrill(pieces[i].id, pieces[i + 1].id) ? Math.max(12, requested) : requested;
    if (want > 0) {
      const w = nearestFiller(want);
      between.push({ k: "fill" + w, w });
    }
  }
  const base = pieces.reduce((sum, item) => sum + item.w, 0) + between.reduce((sum, gap) => sum + gap.w, 0);
  let target = targetIn;
  const notes = [];
  if (base > target + 0.01) {
    const fit = Math.ceil(base / 12) * 12;
    target = base;
    notes.push("Those pieces and the filler panels need about " + feet(base) + ", so this leg is longer than asked. " + feet(fit) + " fits them.");
  }
  let remain = target - base;
  const fillers = [];
  for (const size of FILLERS) {
    while (remain >= size - 0.01) {
      fillers.push(size);
      remain -= size;
    }
  }
  const endCount = pieces.length && pinEnd ? 1 : Math.max(1, pieces.length ? 2 : 1);
  const buckets = Array.from({ length: endCount }, () => []);
  fillers.forEach((size, i) => buckets[i % endCount].push(size));
  const pushEnd = (bucket) => { for (const size of bucket || []) seq.push({ k: "fill" + size, w: size, u: "" }); };
  const seq = [];
  if (!pieces.length) {
    pushEnd(buckets[0]);
    if (!seq.length) seq.push({ k: "fill24", w: 24, u: "" });
  } else {
    pushEnd(buckets[0]);
    for (let i = 0; i < pieces.length; i++) {
      if (i > 0 && between[i - 1]) seq.push({ k: between[i - 1].k, w: between[i - 1].w, u: "" });
      seq.push({ k: pieces[i].k, w: pieces[i].w, u: pieces[i].u || "" });
    }
    if (!pinEnd) pushEnd(buckets[1]);
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
    cu: []
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, "");
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
    Array.isArray(raw && raw.items) ? raw.items.map(id => String(id)).slice(0, 8) : [],
    Number(raw && raw.stools) || 0,
    !!(raw && raw.pinEnd),
    readBases(raw && raw.bases)
  ));
  return {
    ok: true,
    spec: {
      shape,
      finish,
      counter,
      frame,
      depth: DEPTH,
      barOn: !!src.barOn || legs.some(l => l.stools > 0 || l.role === "bar"),
      gapIn: src.gapIn == null ? 6 : Math.max(0, Number(src.gapIn) || 0),
      legs
    }
  };
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
        if (cab) line += ", with " + cab.spoken + " in the base under the grill";
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
  if (notes.length) text += " " + notes.join(" ");
  text += " The price on the design comes from the catalog and the build rates. Tell me what to change, or save it when it looks right.";
  return text.replace(/\s+/g, " ").trim();
}

function changeReply(spec, notes) {
  const changes = (notes || []).filter(n => /^(Made |Added |Removed |Moved |Swapped |Switched |Finish |That's |That piece|Cleared |Turned |Set )/ .test(n));
  const bar = spec.legs.find(l => l.role === "bar");
  const grill = spec.legs.find(l => l.role === "grill" || l.role === "main");
  let text = "Done";
  const first = changes[0] || "";
  if (/^Made the bar/.test(first) && bar) {
    text = "Done, the bar is now " + feet(bar.lengthIn);
    if (bar.stools) text += ", room for " + bar.stools + (bar.stools === 1 ? " stool" : " stools");
  } else if (/^Made the grill/.test(first) && grill) {
    text = "Done, the grill leg is now " + feet(grill.lengthIn);
  } else if (first) {
    text = "Done. " + first.replace(/\.$/, "");
  }
  const filler = (notes || []).find(n => /^I added |^I left 12 inches/.test(n));
  if (filler && /^Added /.test(first)) text += " " + filler;
  const limit = (notes || []).find(n => /longer than asked|shorter than a leg|longer than a single/.test(n));
  if (limit) text += ". " + limit.replace(/\.$/, "");
  return text + ".";
}

export function summaryReply(spec) {
  if (!spec) return "";
  return describe(spec, []);
}

export function compileSpec(input, extraNotes) {
  const checked = validateSpec(input);
  if (!checked.ok) return { ok: false, reply: checked.message, spec: null, code: "", link: "", warnings: [] };
  const spec = checked.spec;
  const notes = (extraNotes || []).slice();
  if (spec.shape === "ell" && spec.legs.length < 2) return { ok: false, reply: "An L needs two legs. How long is the second one?", spec: null, code: "", link: "", warnings: [] };
  if (spec.shape === "yu" && spec.legs.length < 3) return { ok: false, reply: "A U needs a back and two returns. How long is each?", spec: null, code: "", link: "", warnings: [] };
  spec.legs.forEach(l => clampLeg(l, notes));
  const packed = spec.legs.map(l => {
    const result = pack(l.items, Math.min(HARD_MAX, l.lengthIn), !!l.pinEnd, l.bases, spec.gapIn);
    if (result.span > l.lengthIn + 0.5) l.lengthIn = Math.round(result.span);
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
  const reply = parsed.brief && built.ok ? changeReply(built.spec, parsed.notes || []) : built.reply;
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
