#!/usr/bin/env node
/* ==========================================================================
   Cutout reference pages — generator
   --------------------------------------------------------------------------
   Reads   data/cutouts.json          (manufacturer cutouts, audited 2026-11-21)
           design/app/index.html      (only to learn which models the designer
                                       can preselect with ?add=<key>)
   Writes  site/dimensions/cutouts/index.html             hub + instant search
           site/dimensions/cutouts/<brand>/index.html     Blaze, Hestan, Yoder
           site/dimensions/cutouts/<brand>/<model>/index.html   one per model
           site/sitemap.xml                               cutout URLs refreshed

   Run from eaglebuilt-site/:   node tools/build-cutouts.mjs

   Rules this file enforces, so a page can never say more than the data does:
     - A missing (null) dimension prints "check spec sheet", never a number.
     - A record whose status is not "verified" is labelled as such.
     - No prices, ratings or reviews anywhere — the JSON-LD carries only the
       model, brand, dimensions and the spec-sheet link.
     - BLZ-26-PZOVN (discontinued) is not listed; BLZ-LTE3OVN replaces it and
       answers a search for the old number.
   ========================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const ORIGIN = "https://eaglebuilt.ai";
const PHONE = "(916) 359-9692", TEL = "+19163599692";
/* A discontinued record with a named replacement and no cutout of its own is
   not listed; its model number becomes a search alias of the replacement. */
const RETIRED = { "BLZ-26-PZOVN": "BLZ-LTE3OVN" };

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/cutouts.json"), "utf8"));
for (const r of DATA) if (r.discontinued && r.replaced_by && !r.cutout_in) RETIRED[r.model] = r.replaced_by;

/* ---------- designer keys (?add=) ---------------------------------------- */
const designerHtml = fs.readFileSync(path.join(SITE, "design/app/index.html"), "utf8");
const DESIGNER_KEYS = new Set([...designerHtml.matchAll(/^\s*\["([A-Za-z0-9_.\-]+)",\s*"/gm)].map(m => m[1]));
/* The audit names the two Yoder mounts in words; the designer keys them -CM / -NM. */
const KEY_ALIAS = { "YS640S (center mount)": "YS640S-CM", "YS640S (notch mount)": "YS640S-NM" };
function designerKey(r) {
  const k = r.designer_key || KEY_ALIAS[r.model] || r.model;
  return DESIGNER_KEYS.has(k) ? k : null;
}

/* ---------- taxonomy ---------------------------------------------------- */
const GROUPS = [
  ["grills", "Grills, kamados & smokers", ["grill", "kamado sleeve", "pellet smoker"]],
  ["burners", "Side & power burners", ["side burner", "power burner"]],
  ["griddles", "Griddles", ["griddle"]],
  ["ovens", "Ovens", ["pizza oven"]],
  ["refrigeration", "Refrigeration & ice", ["refrigerator", "ice maker", "ice drawer", "ice bin"]],
  ["doors", "Doors & storage", ["access door", "dry storage"]],
  ["drawers", "Drawers & warming drawers", ["drawer", "warming drawer"]],
  ["combos", "Door & drawer combos", ["door/drawer combo"]],
  ["trash", "Trash & propane pullouts", ["trash / propane", "trash / recycle", "trash"]],
  ["bar", "Bar centers & sinks", ["sink / bar center"]],
  ["accessories", "Accessories & vents", ["accessory", "vent"]],
];
/* Words a contractor types that the catalog names differently. */
const SYNONYMS = {
  grills: "grill bbq barbecue smoker kamado", burners: "burner wok", griddles: "griddle flat top flattop plancha",
  ovens: "oven pizza", refrigeration: "fridge refrigerator cooler beverage kegerator ice", doors: "door cabinet storage",
  drawers: "drawer warming warmer", combos: "combo door drawer", trash: "trash garbage recycle bin propane tank pullout",
  bar: "bar sink cocktail beverage", accessories: "accessory vent towel",
};
const groupOf = cat => {
  const g = GROUPS.find(g => g[2].includes(cat));
  if (!g) throw new Error("No group for category " + cat);
  return g;
};
/* Brand order on the hub: most searched first, then alphabetical. */
const BRAND_ORDER = ["Blaze", "Bull", "Napoleon", "Fire Magic", "Lynx", "Coyote", "Summerset", "Twin Eagles", "Hestan", "Alfresco", "DCS", "RCS", "Diablo Grills", "Delta Heat", "Dometic", "Yoder Smokers"];
const BRAND_SLUG = { "Yoder Smokers": "yoder", "Diablo Grills": "diablo-grills" };
const BRANDS = {};
for (const name of [...new Set(DATA.map(r => r.brand))].sort((a, b) => {
  const ia = BRAND_ORDER.indexOf(a), ib = BRAND_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
})) BRANDS[name] = { slug: BRAND_SLUG[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name };

/* ---------- formatting -------------------------------------------------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/* 24.5 -> 24 1/2"  ·  2.8125 -> 2 13/16"  ·  52.2 (not a 1/16) -> 52.2" */
function inch(v) {
  if (v === null || v === undefined) return null;
  const s = Math.round(v * 16);
  if (Math.abs(v * 16 - s) > 1e-6) return `${+v.toFixed(3)}"`;
  const whole = Math.floor(s / 16), rem = s % 16;
  if (!rem) return `${whole}"`;
  const g = gcd(rem, 16);
  return `${whole ? whole + " " : ""}${rem / g}/${16 / g}"`;
}
const inchPlain = v => (inch(v) || "").replace(/"$/, " in");
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]} ${d}, ${y}`;
}
const slugify = s => s.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

/* ---------- records ----------------------------------------------------- */
const RECS = DATA.filter(r => !RETIRED[r.model]).map(r => {
  const b = BRANDS[r.brand];
  if (!b) throw new Error("Unknown brand " + r.brand);
  const g = groupOf(r.category);
  const slug = slugify(r.model);
  const aliases = Object.keys(RETIRED).filter(k => RETIRED[k] === r.model);
  return {
    ...r, b, g, slug, aliases,
    url: `/dimensions/cutouts/${b.slug}/${slug}/`,
    displayModel: r.model.replace(/\((.+)\)/, (_, x) => "(" + x + ")"),
    verified: r.status === "verified",
    key: designerKey(r),
  };
});
/* "Most searched cutouts" on the hub. Curated, not measured: built from
   BBQGuys' 2026 top-rated built-in grill picks (Blaze Premium LTE+, Napoleon,
   Bull Outlaw) and each brand's best-selling grill, door, fridge and burner.
   No keyword-volume data was available when this list was written. */
const POPULAR = ["BLZ-4LTE3", "26038", "BIG38", "BLZ-5LTE3", "A790i", "57568", "BIPRO500", "L36TR", "C2C36", "SZRPRO32",
  "BLZ-4BCM", "E790i", "87048", "BLZ-SSRF-5.5", "L601", "TRLPRO32", "BLZ-AD32-R-SC", "33580", "C1C28", "BLZ-PBLTE3", "E660i",
  "BLZ-30CKT-SNK", "TEBQ36R-C", "ALXE-36", "RJC32A", "DHBQ38"];
RECS.forEach(r => { const i = POPULAR.indexOf(r.model); if (i > -1) r.popularRank = i + 1; });
const retiredInfo = DATA.filter(r => RETIRED[r.model]);
const sortRecs = list => GROUPS.flatMap(g => list.filter(r => r.g === g));

/* ---------- shared chrome ----------------------------------------------- */
const tpl = fs.readFileSync(path.join(SITE, "dimensions/clearances/index.html"), "utf8");
const HEADER = tpl.match(/<header>[\s\S]*?<\/header>/)[0];
const FOOTER_COLS = tpl.match(/<footer>[\s\S]*?<div class="legal">/)[0]
  .replace(/href="\/dimensions\/cutouts\/blaze\/">Grill cutouts/g, 'href="/dimensions/cutouts/">Equipment cutouts');

function footer(brands) {
  const tm = brands.length ? `${brands.join(", ").replace(/, ([^,]*)$/, " and $1")} ${brands.length > 1 ? "are trademarks of their owners" : "is a trademark of its owner"}; EagleBuilt AI is not affiliated with or endorsed by ${brands.length > 1 ? "them" : "it"}. ` : "";
  return `${FOOTER_COLS}
      <div style="margin-bottom:6px">CSLB Lic. #992251 &middot; General Contractor &amp; C-29 Masonry &middot; <a href="/privacy/">Privacy</a></div>
      © <span id="yr">2026</span> EagleBuilt AI. ${esc(tm)}Dimensions are as published by the manufacturer —
      always confirm with the manufacturer's spec sheet before cutting.
    </div>
  </div>
</footer>
<script>document.getElementById("yr").textContent=new Date().getFullYear();</script>`;
}

const CSS = `<style>
.coTools{position:sticky;top:57px;z-index:20;background:rgba(7,10,18,.96);backdrop-filter:blur(8px);
  padding:12px 0;border-bottom:1px solid var(--line)}
.coSearch{display:flex;gap:10px;align-items:center}
.coSearch input{flex:1;min-width:0;font-size:18px;padding:14px 16px;border-radius:10px;background:#0A121E;
  border:1px solid var(--line2);color:var(--txt);outline:none;font-family:inherit}
.coSearch input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(46,155,255,.16)}
.coCount{font-size:13px;color:var(--dim);margin-top:6px}
.coJump{display:flex;gap:7px;overflow-x:auto;margin-top:9px;padding-bottom:2px;scrollbar-width:none}
.coJump a{flex:0 0 auto;font-size:12.5px;padding:5px 11px;border-radius:16px;border:1px solid var(--line2);color:var(--muted);white-space:nowrap}
.coGroup{padding:22px 0 4px}
.coGroup h2{font-size:20px;margin:0 0 10px;color:var(--blue2);letter-spacing:.01em;scroll-margin-top:150px}
.co{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 12px}
.coHead{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.coModel{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:17px;color:var(--txt)}
.coBrand{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);font-weight:800}
.coName{width:100%;color:var(--muted);font-size:14.5px}
.coDims{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 8px}
.coDim{min-width:0;background:#0A121E;border:1px solid var(--line);border-radius:9px;padding:8px 6px 9px;text-align:center}
.coDim b{display:block;font-size:clamp(22px,6.4vw,30px);line-height:1.1;font-weight:800;color:var(--txt);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;white-space:nowrap}
.coDim span{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:800}
.coDim.miss b{font-size:13px;color:var(--warn);white-space:normal;line-height:1.3;padding:5px 0}
.coOverall{font-size:13.5px;color:var(--muted)}
.coOverall i{font-style:normal;color:var(--warn)}
.coMeta{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:8px;font-size:13.5px}
.coOk{color:var(--good);font-weight:700}
.coWarn{color:var(--warn);font-weight:700}
.coNote{font-size:13px;color:var(--warn);margin-top:6px}
.coEmpty{padding:24px 0;color:var(--muted)}
.coBig .coDim b{font-size:clamp(30px,9vw,46px)}
.coDim.lg b{font-size:clamp(18px,4.9vw,30px)}
.coBig .coDim.lg b{font-size:clamp(21px,5.6vw,46px)}
.coDim.rng b,.coBig .coDim.rng b{font-size:clamp(17px,4.6vw,30px);white-space:normal}
.coCta{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.coFacts{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:6px;color:var(--muted);font-size:15px}
.coFacts b{color:var(--txt)}
@media(min-width:900px){.coList{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}}
</style>`;

function head({ title, desc, canonical, ogType = "article", jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${ORIGIN}${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">

<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${ORIGIN}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ORIGIN}/design/view-elevation.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}/design/view-elevation.jpg">

<link rel="icon" href="/assets/eaglebuilt-emblem.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/assets/app/apple-touch-icon.png">
<meta name="theme-color" content="#070A12">
<meta name="apple-mobile-web-app-title" content="EagleBuilt">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<script src="/assets/install.js" defer></script>
<link rel="stylesheet" href="/assets/site.css">

<script type="application/ld+json">
${JSON.stringify(jsonld, null, 1).replace(/</g, "\\u003c")}
</script>
${CSS}
<script src="/assets/track.js"></script>
</head>

<body>
<a class="skip" href="#main">Skip to content</a>

${HEADER}
`;
}

const crumbsLd = items => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: ORIGIN + url })),
});
const crumbsHtml = items => `<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    ${items.map(([n, u], i) => i < items.length - 1 ? `<a href="${u}">${esc(n)}</a>` : esc(n)).join("<span>/</span>")}
  </nav>
</div>`;

/* ---------- row ---------------------------------------------------------- */
/* A manufacturer range (Napoleon prints min-max) shows as "30–32\"". */
const span = (v, vmax) => (inch(v) && inch(vmax) && vmax !== v ? inch(v).replace(/"$/, "") + "–" + inch(vmax) : inch(v));
function dimCell(label, v, vmax) {
  const t = span(v, vmax);
  return t ? `<div class="coDim${vmax != null && vmax !== v ? " rng" : (t.length >= 6 ? " lg" : "")}"><b>${esc(t)}</b><span>${label}</span></div>`
           : `<div class="coDim miss"><b>check spec sheet</b><span>${label}</span></div>`;
}
function overallLine(r) {
  const o = r.overall_in;
  if (!o) return `Overall size: <i>check spec sheet</i>`;
  const p = (v, l) => (inch(v) ? `${esc(inch(v))} ${l}` : `<i>check spec sheet</i> ${l}`);
  return `Overall: ${p(o.w, "W")} &times; ${p(o.h, "H")} &times; ${p(o.d, "D")}`;
}
function verifiedBadge(r) {
  return r.verified
    ? `<span class="coOk">&#10003; Verified ${fmtDate(r.verified_date)}</span>`
    : `<span class="coWarn">Not fully verified (checked ${fmtDate(r.verified_date)}) — check spec sheet</span>`;
}
function specLinks(r) {
  const out = [];
  if (r.spec_sheet_url) out.push(`<a href="${esc(r.spec_sheet_url)}" target="_blank" rel="noopener nofollow">Spec sheet &#8599;</a>`);
  else out.push(`<span class="coWarn">No spec sheet on file</span>`);
  if (r.source_url && r.source_url !== r.spec_sheet_url) out.push(`<a href="${esc(r.source_url)}" target="_blank" rel="noopener nofollow">Product page &#8599;</a>`);
  return out.join("");
}
const designHref = r => r.key ? `/design/app/?add=${encodeURIComponent(r.key)}` : "/design/app/";
/* Hub index text: the per-row part only. Brand and group words are added in
   the browser from the brand name and the group table, so they are not
   repeated on every row. */
function hubSearchText(r) {
  return [r.model, r.product_name, r.category, r.key || "", ...r.aliases, ...(r.also || [])].map(s => s + " " + norm(s)).join(" ").toLowerCase();
}
const groupSearchText = g => [g[1], SYNONYMS[g[0]]].map(s => s + " " + norm(s)).join(" ").toLowerCase();
function searchText(r) {
  return [r.model, r.brand, r.b.slug, r.product_name, r.category, r.g[1], SYNONYMS[r.g[0]], r.key || "", ...r.aliases, ...(r.also || [])].map(s => s + " " + norm(s)).join(" ").toLowerCase();
}
function statusBadge(r) {
  if (!r.discontinued) return "";
  return `<span class="coWarn">Discontinued${r.replaced_by ? ` — replaced by ${esc(r.replaced_by)}` : ""}</span>`;
}
function row(r, { showBrand = true } = {}) {
  const c = r.cutout_in || {}, cm = r.cutout_max_in || {};
  const alias = r.aliases.length ? `<div class="coNote" style="color:var(--muted)">Replaces ${r.aliases.map(esc).join(", ")} (previous model).</div>` : "";
  return `<article class="co" data-q="${esc(searchText(r))}" id="m-${r.slug}">
  <div class="coHead">
    <a class="coModel" href="${r.url}">${esc(r.displayModel)}</a>${showBrand ? `<span class="coBrand">${esc(r.b.name)}</span>` : ""}
    <span class="coName">${esc(r.product_name)}</span>
  </div>
  <div class="coDims" aria-label="Cutout width, height, depth">${dimCell("Cutout W", c.w, cm.w)}${dimCell("Cutout H", c.h, cm.h)}${dimCell("Cutout D", c.d, cm.d)}</div>
  <div class="coOverall">${overallLine(r)}</div>
  <div class="coMeta">${statusBadge(r)}${verifiedBadge(r)}${specLinks(r)}<a href="${r.url}">Details &rarr;</a></div>${r.verified ? "" : `\n  <div class="coNote">${esc(r.notes)}</div>`}${alias}
</article>`;
}

function listing(recs, opts) {
  const groups = GROUPS.map(g => [g, recs.filter(r => r.g === g)]).filter(([, l]) => l.length);
  const jump = groups.map(([g]) => `<a href="#${g[0]}">${esc(g[1])}</a>`).join("");
  const body = groups.map(([g, l]) => `<div class="coGroup" data-group>
  <h2 id="${g[0]}">${esc(g[1])}</h2>
  <div class="coList">
${l.map(r => row(r, opts)).join("\n")}
  </div>
</div>`).join("\n");
  return { jump, body };
}

const SEARCH_JS = `<script>
(function(){
  var q=document.getElementById("coQ"), rows=[].slice.call(document.querySelectorAll(".co[data-q]")),
      groups=[].slice.call(document.querySelectorAll("[data-group]")), count=document.getElementById("coCount"),
      empty=document.getElementById("coEmpty"), total=rows.length;
  function run(){
    var raw=q.value.trim().toLowerCase(), terms=raw.split(/\\s+/).filter(Boolean), shown=0;
    rows.forEach(function(r){
      var t=r.getAttribute("data-q"), ok=terms.every(function(w){var n=w.replace(/[^a-z0-9]+/g,"");return t.indexOf(w)>-1||(n&&t.indexOf(n)>-1);});
      r.hidden=!ok; if(ok) shown++;
    });
    groups.forEach(function(g){g.hidden=!g.querySelector(".co:not([hidden])");});
    count.textContent=terms.length?(shown+" of "+total+" match"):(total+" models");
    empty.hidden=shown>0;
    var intro=document.getElementById("coIntro"); if(intro) intro.hidden=terms.length>0;
  }
  q.addEventListener("input",run);
  var p=new URLSearchParams(location.search).get("q"); if(p){q.value=p;}
  run();
})();
</script>`;

/* Hub renderer: builds the grouped rows from the compact index, then the same
   instant filter as the brand pages. Popular rows hide while searching so a
   model never shows twice. */
const HUB_JS = `<script>
(function(){
  var D=JSON.parse(document.getElementById("coData").textContent), all=document.getElementById("coAll");
  function e(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function inch(v){if(v===null||v===undefined)return null;var s=Math.round(v*16);if(Math.abs(v*16-s)>1e-6)return (+v.toFixed(3))+'"';
    var w=Math.floor(s/16),r=s%16;if(!r)return w+'"';var g=r%8===0?8:r%4===0?4:r%2===0?2:1;return (w?w+" ":"")+(r/g)+"/"+(16/g)+'"';}
  function span(v,m){var a=inch(v),b=inch(m);return a&&b&&m!==v?a.replace(/"$/,"")+"\u2013"+b:a;}
  function cell(l,v,m){var t=span(v,m);return t?'<div class="coDim'+(m!=null&&m!==v?' rng':(t.length>=6?' lg':''))+'"><b>'+e(t)+'</b><span>'+l+'</span></div>':'<div class="coDim miss"><b>check spec sheet</b><span>'+l+'</span></div>';}
  function ov(w,h,d){if(w===null&&h===null&&d===null)return 'Overall size: <i>check spec sheet</i>';
    function p(v,l){var t=inch(v);return t?e(t)+" "+l:"<i>check spec sheet</i> "+l;}return "Overall: "+p(w,"W")+" &times; "+p(h,"H")+" &times; "+p(d,"D");}
  var html=D.g.map(function(g,gi){
    var rows=D.r.filter(function(r){return r[14]===gi;}).map(function(r){
      var bq=r[1].toLowerCase();bq+=" "+bq.replace(/[^a-z0-9]+/g,"")+" "+bq.replace(/[^a-z0-9]+/g,"-");
      return '<article class="co" data-q="'+e(r[15]+" "+bq+" "+g[2])+'"><div class="coHead"><a class="coModel" href="'+r[3]+'">'+e(r[0])+'</a><span class="coBrand">'+e(r[1])+'</span><span class="coName">'+e(r[2])+'</span></div>'+
        '<div class="coDims">'+cell("Cutout W",r[4],r[7])+cell("Cutout H",r[5],r[17])+cell("Cutout D",r[6],r[8])+'</div><div class="coOverall">'+ov(r[9],r[10],r[11])+'</div>'+
        '<div class="coMeta">'+(r[16]?'<span class="coWarn">Discontinued'+(r[16]!=="-"?" \u2014 replaced by "+e(r[16]):"")+'</span>':'')+(r[12]?'<span class="coOk">&#10003; Verified</span>':'<span class="coWarn">Not fully verified \u2014 check spec sheet</span>')+
        (r[13]?'<a href="'+e(r[13])+'" target="_blank" rel="noopener nofollow">Spec sheet &#8599;</a>':'')+'<a href="'+r[3]+'">Details &rarr;</a></div></article>';
    }).join("");
    return '<div class="coGroup" data-group><h2 id="'+g[0]+'">'+e(g[1])+'</h2><div class="coList">'+rows+'</div></div>';
  }).join("");
  all.innerHTML=html;
  var q=document.getElementById("coQ"), rows=[].slice.call(all.querySelectorAll(".co[data-q]")), groups=[].slice.call(all.querySelectorAll("[data-group]")),
      pop=document.querySelector("[data-popular]"), count=document.getElementById("coCount"), empty=document.getElementById("coEmpty"), total=rows.length;
  function run(){
    var terms=q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean), shown=0;
    rows.forEach(function(r){var t=r.getAttribute("data-q"),ok=terms.every(function(w){var n=w.replace(/[^a-z0-9]+/g,"");return t.indexOf(w)>-1||(n&&t.indexOf(n)>-1);});r.hidden=!ok;if(ok)shown++;});
    groups.forEach(function(g){g.hidden=!g.querySelector(".co:not([hidden])");});
    if(pop) pop.hidden=terms.length>0;
    count.textContent=terms.length?(shown+" of "+total+" match"):(total+" models");
    empty.hidden=shown>0;
    var intro=document.getElementById("coIntro"); if(intro) intro.hidden=terms.length>0;
  }
  q.addEventListener("input",run);
  var p=new URLSearchParams(location.search).get("q"); if(p){q.value=p;}
  run();
})();
</script>`;

function toolsBar(placeholder, jump) {
  return `<div class="coTools">
  <div class="wrap">
    <label class="coSearch" for="coQ"><span class="skip">Search cutouts</span>
      <input id="coQ" type="search" inputmode="search" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(placeholder)}" enterkeyhint="search">
    </label>
    <div class="coCount" id="coCount" aria-live="polite"></div>
    <nav class="coJump" aria-label="Categories">${jump}</nav>
  </div>
</div>`;
}
const emptyMsg = `<p class="coEmpty" id="coEmpty" hidden>No model matches that yet. Call <a href="tel:${TEL}">${PHONE}</a> and we will look it up, or check the manufacturer's spec sheet.</p>`;

const ctaBand = (title, text, href, label) => `<section class="alt">
  <div class="wrap">
    <div class="band">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="heroCta" style="justify-content:center">
        <a href="${href}" class="btn">${esc(label)}</a>
        <a href="/design-eagle/" class="btn ghost">Talk it through with Design Eagle</a>
      </div>
      <p class="heroNote" style="margin-top:16px">Rather talk to a builder? <a href="tel:${TEL}">${PHONE}</a></p>
    </div>
  </div>
</section>`;

const itemListLd = (recs, name, url) => ({
  "@type": "ItemList", "@id": ORIGIN + url + "#models", name, numberOfItems: recs.length,
  itemListElement: recs.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: `${r.b.name} ${r.model}`, url: ORIGIN + r.url })),
});

/* ---------- writers ------------------------------------------------------ */
const written = [];
function write(rel, html) {
  const f = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  written.push(rel);
}
const AUDIT_DATE = fmtDate(DATA.map(r => r.verified_date).sort().pop());
const nVerified = RECS.filter(r => r.verified).length;
const brandNames = list => [...new Set(list.map(r => r.b.name))];

/* Hub */
(function hub() {
  const recs = sortRecs(RECS);
  const url = "/dimensions/cutouts/";
  const groupsUsed = GROUPS.filter(g => recs.some(r => r.g === g));
  const jump = groupsUsed.map(g => `<a href="#${g[0]}">${esc(g[1])}</a>`).join("");
  /* Compact index: one short array per model, rendered by HUB_JS. Keeps the
     hub small and fast with hundreds of models; brand and model pages carry
     the full server-rendered rows for search engines. */
  const idx = recs.map(r => {
    const c = r.cutout_in || {}, cm = r.cutout_max_in || {}, o = r.overall_in || {};
    return [r.model, r.b.name, r.product_name, r.url, c.w ?? null, c.h ?? null, c.d ?? null, cm.w ?? null, cm.d ?? null,
      o.w ?? null, o.h ?? null, o.d ?? null, r.verified ? 1 : 0, r.spec_sheet_url || "", groupsUsed.indexOf(r.g),
      hubSearchText(r), r.discontinued ? (r.replaced_by || "-") : "", cm.h ?? null];
  });
  const popular = recs.filter(r => r.popularRank).sort((a, b) => a.popularRank - b.popularRank).slice(0, 24);
  const body = `<section class="coGroup" id="popular" style="border-top:0;padding:22px 0 4px" data-popular>
  <h2>Most searched cutouts</h2>
  <p class="coCount" style="margin:-4px 0 10px">The built-ins people look up most — best sellers and most-asked models across the top brands.</p>
  <div class="coList">
${popular.map(r => row(r, { showBrand: true }).replace('class="co"', 'class="co" data-pop')).join("\n")}
  </div>
</section>
<div id="coAll"></div>
<noscript><p>Browse by brand: ${Object.values(BRANDS).map(b => `<a href="/dimensions/cutouts/${b.slug}/">${esc(b.name)}</a>`).join(" &middot; ")}</p></noscript>
<script type="application/json" id="coData">${JSON.stringify({ g: groupsUsed.map(g => [g[0], g[1], groupSearchText(g)]), r: idx }).replace(/</g, "\\u003c")}</script>`;
  const title = "BBQ Equipment Cutout Dimensions — Grills, Fridges, Doors | EagleBuilt";
  const bl = Object.keys(BRANDS);
  const desc = `Cutout width, height and depth for ${recs.length} built-in grills, burners, griddles, refrigeration, doors and drawers from ${bl.slice(0, 5).join(", ")} and more, checked against manufacturer spec sheets.`;
  const brandCards = Object.values(BRANDS).map(b => {
    const n = RECS.filter(r => r.b === b).length;
    return `<a href="/dimensions/cutouts/${b.slug}/"><b>${esc(b.name)}</b> &middot; ${n} model${n > 1 ? "s" : ""}</a>`;
  }).join("");
  const ld = { "@context": "https://schema.org", "@graph": [
    crumbsLd([["Home", "/"], ["Dimensions", "/dimensions/"], ["Equipment cutouts", url]]),
    { "@type": "CollectionPage", "@id": ORIGIN + url, url: ORIGIN + url, name: "BBQ equipment cutout dimensions",
      description: desc, dateModified: DATA.map(r => r.verified_date).sort().pop(), mainEntity: { "@id": ORIGIN + url + "#models" } },
    itemListLd(popular, "Most searched built-in equipment cutouts", url),
  ] };
  write("dimensions/cutouts/index.html", head({ title, desc, canonical: url, ogType: "website", jsonld: ld }) + `
<main id="main">
${crumbsHtml([["Home", "/"], ["Dimensions", "/dimensions/"], ["Equipment cutouts", url]])}

<div class="hero slim" style="padding:22px 0 14px">
  <div class="wrap">
    <h1 style="font-size:clamp(26px,6vw,44px);margin-bottom:6px">BBQ equipment cutout dimensions</h1>
    <p style="margin:0;color:var(--muted);font-size:15px">Cutout W &times; H &times; D in inches. <b style="color:var(--txt)">Always confirm with the manufacturer's spec sheet before cutting.</b></p>
  </div>
</div>

${toolsBar("Model, brand or type — e.g. BLZ-4LTE3, fridge, Hestan", jump)}

<div class="wrap">
  <div id="coIntro"><p class="lede" style="margin:18px 0 0;font-size:15.5px">The opening to frame for ${recs.length} built-in grills, burners, refrigeration, doors and drawers, from the manufacturer's spec sheets and product pages. Every row links its spec sheet and shows when it was checked.</p>
  <div class="brands" style="margin-top:12px">${brandCards}</div></div>
${body}
${emptyMsg}
  <p class="heroNote" style="margin:18px 0 0">${nVerified} of ${recs.length} models verified against the manufacturer's spec sheet or product page on ${AUDIT_DATE}. A blank field means the sources disagree or don't publish it — it says <i>check spec sheet</i> instead of a guess.</p>
</div>

${ctaBand("Design an island with this", "Pick a layout in the designer and drop in the grill, doors and fridge you looked up here. It checks the fit against the island depth and the pieces around it.", "/design/app/", "Design an island with this")}
</main>

${footer(brandNames(recs))}
${HUB_JS}
</body>
</html>
`);
})();

/* Brand pages */
const BRAND_EXTRA = {
  blaze: recs => {
    const deep = recs.filter(r => r.cutout_in && r.cutout_in.d > 23.5 && r.g[0] !== "doors");
    const faq = [
      ["What cutout does a 32-inch Blaze grill need?", `30 5/8" wide × 8 1/2" tall × 21 1/4" deep for the BCM and Premium LTE+ four-burner (BLZ-4BCM, BLZ-4LTE3). The LTE PRO 32" (BLZ-4LTEPRO) differs at 30 3/4" × 9 1/2" × 21 1/4". Always confirm with the manufacturer's spec sheet before cutting.`],
      ["Can I put a triple drawer under a Blaze grill?", `Not the tall ones. Blaze's catalog notes mark the 16" and 30" triple drawers "tall — no grill above". A grill drops roughly 8 1/2 inches below the counter and the triple drawer wants 27 1/2, and a 36-inch counter has nowhere near that to give.`],
      ["Do I need an island vent?", `If you are running liquid propane, yes. Blaze lists the 6 × 14 inch island vent (BLZ-ISLAND-VENT) as required for LP — heavier-than-air gas needs a low path out of an enclosed island.`],
      [`How many Blaze components need a 30-inch island?`, `${deep.length} of the ${recs.length} Blaze components listed here need more than 23 1/2 inches of cutout depth: ${deep.map(r => r.model).join(", ")}. Build those into a 30-inch-deep island.`],
    ];
    return {
      ld: { "@type": "FAQPage", "@id": ORIGIN + "/dimensions/cutouts/blaze/#faq",
        mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      intro: `<div class="note" style="margin-top:18px"><p><b>Read the cutout, not the model name.</b> A &quot;32 inch&quot; Blaze grill needs a 30 5/8&quot; opening, and the LTE PRO version of the same size needs a taller one. The number in the product name is the grill; the number you frame to is below.</p></div>`,
      html: `<section>
  <div class="wrap">
    <div class="kicker">Depth check</div>
    <h2>${deep.length} Blaze components need a 30-inch island</h2>
    <p class="lede">Anything needing more than about 23 1/2 inches of cutout depth leaves no workable structure in a
      24-inch island. For Blaze that means:</p>
    <div class="brands">${deep.map(r => `<a href="${r.url}">${esc(r.model)} &middot; ${esc(inch(r.cutout_in.d))} deep</a>`).join("")}</div>
  </div>
</section>
<section>
  <div class="wrap narrow">
    <div class="kicker">Questions</div>
    <h2>Blaze cutout questions</h2>
${faq.map(([q, a]) => `    <details>
      <summary>${esc(q)}</summary>
      <p>${esc(a)}</p>
    </details>`).join("\n")}
  </div>
</section>`,
    };
  },
};
for (const b of Object.values(BRANDS)) {
  const recs = sortRecs(RECS.filter(r => r.b === b));
  const url = `/dimensions/cutouts/${b.slug}/`;
  const extra = BRAND_EXTRA[b.slug] ? BRAND_EXTRA[b.slug](recs) : null;
  const { jump, body } = listing(recs, { showBrand: false });
  const cats = [...new Set(recs.map(r => r.g[1].split(/[,&]/)[0].trim().toLowerCase()))];
  const title = `${b.name} Cutout Dimensions — ${recs.length} Built-In Model${recs.length > 1 ? "s" : ""} | EagleBuilt`;
  const desc = `${b.name} built-in cutout width, height and depth for ${recs.length} model${recs.length > 1 ? "s" : ""} (${cats.slice(0, 6).join(", ")}), with spec sheet links and verification dates.`;
  const ld = { "@context": "https://schema.org", "@graph": [
    crumbsLd([["Home", "/"], ["Dimensions", "/dimensions/"], ["Equipment cutouts", "/dimensions/cutouts/"], [`${b.name} cutouts`, url]]),
    { "@type": "CollectionPage", "@id": ORIGIN + url, url: ORIGIN + url, name: `${b.name} cutout dimensions`, description: desc,
      about: { "@type": "Brand", name: b.name }, mainEntity: { "@id": ORIGIN + url + "#models" } },
    itemListLd(recs, `${b.name} built-in cutouts`, url),
    ...(extra ? [extra.ld] : []),
  ] };
  const others = Object.values(BRANDS).filter(x => x !== b).map(x => `<a href="/dimensions/cutouts/${x.slug}/">${esc(x.name)} cutouts</a>`).join("");
  write(`dimensions/cutouts/${b.slug}/index.html`, head({ title, desc, canonical: url, jsonld: ld }) + `
<main id="main">
${crumbsHtml([["Home", "/"], ["Dimensions", "/dimensions/"], ["Equipment cutouts", "/dimensions/cutouts/"], [`${b.name} cutouts`, url]])}

<div class="hero slim" style="padding:22px 0 14px">
  <div class="wrap">
    <h1 style="font-size:clamp(26px,6vw,44px);margin-bottom:6px">${esc(b.name)} cutout dimensions</h1>
    <p style="margin:0;color:var(--muted);font-size:15px">${recs.length} ${esc(b.name)} built-in model${recs.length > 1 ? "s" : ""}, cutout W &times; H &times; D in inches. <b style="color:var(--txt)">Always confirm with the manufacturer's spec sheet before cutting.</b></p>
  </div>
</div>

${toolsBar(`Search ${b.name} — model or type`, jump)}

<div class="wrap">
  <div id="coIntro"><div class="brands" style="margin-top:16px"><a href="/dimensions/cutouts/">All brands</a>${others}</div>
${extra ? extra.intro : ""}</div>
${body}
${emptyMsg}
</div>
${extra ? extra.html : ""}
${ctaBand("Design an island with this", `Every ${b.name} model on this page is in the designer. Drop one in and it checks the fit.`, "/design/app/", "Design an island with this")}
</main>

${footer([b.name])}
${SEARCH_JS}
</body>
</html>
`);
}

/* Model pages */
const CAT_LABEL = {
  "grill": "built-in grill", "kamado sleeve": "kamado sleeve", "pellet smoker": "built-in pellet smoker",
  "side burner": "side burner", "power burner": "power burner", "griddle": "built-in griddle", "pizza oven": "built-in pizza oven",
  "refrigerator": "outdoor refrigerator", "ice maker": "outdoor ice maker", "ice drawer": "ice drawer", "ice bin": "drop-in ice bin",
  "access door": "access door", "dry storage": "dry storage cabinet", "drawer": "drawer", "door/drawer combo": "door and drawer combo",
  "trash / propane": "trash / propane pullout", "trash / recycle": "trash / recycle pullout", "trash": "trash pullout",
  "sink / bar center": "bar center", "accessory": "accessory", "vent": "island vent",
};
for (const r of RECS) {
  const c = r.cutout_in || {};
  const nameModel = r.model.replace(/\s*\((.+)\)/, (_, x) => " " + x.replace(/\b\w/g, m => m.toUpperCase()));
  const title = `${r.b.name} ${nameModel} Cutout Dimensions | EagleBuilt`;
  const cm = r.cutout_max_in || {};
  const dimTxt = ["w", "h", "d"].map((k, i) => (span(c[k], cm[k]) || "check spec sheet") + " " + "WHD"[i]).join(" × ");
  const desc = `${r.b.name} ${r.model} (${r.product_name}) cutout: ${dimTxt}. Overall size, spec sheet link${r.verified ? `, verified ${fmtDate(r.verified_date)}` : ""}.`;
  const siblings = RECS.filter(x => x !== r && x.b === r.b && x.g === r.g).slice(0, 6);
  const deep = c.d && c.d > 23.5 && r.g[0] !== "doors";
  const add = [];
  const pv = (name, v, vmax) => v === null || v === undefined ? null
    : Object.assign({ "@type": "PropertyValue", name, unitCode: "INH", unitText: "in" },
        vmax && vmax !== v ? { minValue: v, maxValue: vmax } : { value: v });
  if (r.cutout_in) add.push(pv("Cutout width", c.w, cm.w), pv("Cutout height", c.h, cm.h), pv("Cutout depth", c.d, cm.d));
  if (r.fuel_power) add.push({ "@type": "PropertyValue", name: "Fuel / power", value: r.fuel_power });
  const product = {
    "@type": "Product", "@id": ORIGIN + r.url + "#product", name: `${r.b.name} ${r.model} ${r.product_name}`,
    brand: { "@type": "Brand", name: r.b.name }, model: r.model, category: CAT_LABEL[r.category] || r.category,
    url: ORIGIN + r.url, additionalProperty: add.filter(Boolean),
  };
  if (/^[A-Z0-9.\-]+$/.test(r.model)) product.mpn = r.model;
  const o = r.overall_in || {};
  const qv = v => (v === null || v === undefined ? undefined : { "@type": "QuantitativeValue", value: v, unitCode: "INH" });
  if (qv(o.w)) product.width = qv(o.w);
  if (qv(o.h)) product.height = qv(o.h);
  if (qv(o.d)) product.depth = qv(o.d);
  if (r.spec_sheet_url) product.subjectOf = { "@type": "DigitalDocument", name: `${r.b.name} spec sheet`, url: r.spec_sheet_url };
  const crumbs = [["Home", "/"], ["Dimensions", "/dimensions/"], ["Equipment cutouts", "/dimensions/cutouts/"], [`${r.b.name} cutouts`, `/dimensions/cutouts/${r.b.slug}/`], [r.model, r.url]];
  const ld = { "@context": "https://schema.org", "@graph": [crumbsLd(crumbs), product] };
  const facts = [
    `<li><b>Category:</b> ${esc(CAT_LABEL[r.category] || r.category)}</li>`,
    r.fuel_power ? `<li><b>Fuel / power:</b> ${esc(r.fuel_power)}</li>` : "",
    `<li><b>Overall size:</b> ${overallLine(r).replace(/^Overall(?: size)?: /, "")}</li>`,
    `<li><b>Source:</b> ${esc(r.notes)}</li>`,
    r.aliases.length ? `<li><b>Replaces:</b> ${r.aliases.map(a => esc(a)).join(", ")} (previous model, no longer in Blaze's catalog). ${retiredInfo.filter(x => r.aliases.includes(x.model)).some(x => !x.cutout_in) ? "The older unit's cutout was not re-verified from a Blaze document — if you are fitting one, check its own manual." : ""}</li>` : "",
  ].filter(Boolean).join("\n      ");
  write(`dimensions/cutouts/${r.b.slug}/${r.slug}/index.html`, head({ title, desc, canonical: r.url, ogType: "article", jsonld: ld }) + `
<main id="main">
${crumbsHtml(crumbs)}

<div class="hero slim" style="padding-bottom:10px">
  <div class="wrap narrow">
    <span class="eyebrow">${esc(r.b.name)} &middot; ${esc(r.g[1])}</span>
    <h1 style="font-size:clamp(26px,6vw,42px)">${esc(r.b.name)} ${esc(r.displayModel)} cutout dimensions</h1>
    <p class="lede">${esc(r.product_name)}. Always confirm with the manufacturer's spec sheet before cutting.</p>
  </div>
</div>

<section style="padding-top:18px;border-top:0">
  <div class="wrap narrow">
    <div class="co coBig" data-q="${esc(searchText(r))}">
      <div class="coHead"><span class="coModel">${esc(r.displayModel)}</span><span class="coBrand">Cutout (W &times; H &times; D)</span></div>
      <div class="coDims">${dimCell("Width", c.w, cm.w)}${dimCell("Height", c.h, cm.h)}${dimCell("Depth", c.d, cm.d)}</div>
      <div class="coOverall">${overallLine(r)}</div>
      <div class="coMeta">${statusBadge(r)}${verifiedBadge(r)}${specLinks(r)}</div>${r.verified ? "" : `\n      <div class="coNote">${esc(r.notes)}</div>`}
    </div>
${deep ? `    <div class="note warn"><p><b>Plan a 30-inch-deep island.</b> This cutout is ${esc(inch(c.d))} deep; anything past about 23 1/2&quot; leaves no workable structure in a 24-inch island.</p></div>\n` : ""}    <ul class="coFacts">
      ${facts}
    </ul>
    <div class="coCta">
      <a class="btn" href="${designHref(r)}">Design an island with this</a>
      <a class="btn ghost" href="tel:${TEL}">Call ${PHONE}</a>
    </div>
    <p class="heroNote">${r.key ? `Opens the designer with the ${esc(r.model)} already placed.` : `Opens the designer; pick the ${esc(r.model)} from the ${esc(r.b.name)} tab, or <a href="/design-eagle/">tell Design Eagle</a> what you want.`}</p>
  </div>
</section>
${siblings.length ? `
<section class="alt">
  <div class="wrap">
    <div class="kicker">Same category</div>
    <h2>Other ${esc(r.b.name)} ${esc(r.g[1].toLowerCase())}</h2>
    <div class="coList">
${siblings.map(x => row(x, { showBrand: false })).join("\n")}
    </div>
    <p style="margin-top:12px"><a href="/dimensions/cutouts/${r.b.slug}/">All ${esc(r.b.name)} cutouts &rarr;</a> &middot; <a href="/dimensions/cutouts/">Every brand &rarr;</a> &middot; <a href="/dimensions/clearances/">Clearances &rarr;</a></p>
  </div>
</section>` : `
<section class="alt">
  <div class="wrap">
    <p><a href="/dimensions/cutouts/${r.b.slug}/">All ${esc(r.b.name)} cutouts &rarr;</a> &middot; <a href="/dimensions/cutouts/">Every brand &rarr;</a> &middot; <a href="/dimensions/clearances/">Clearances &rarr;</a></p>
  </div>
</section>`}
</main>

${footer([r.b.name])}
</body>
</html>
`);
}

/* ---------- /dimensions/ counts ----------------------------------------- */
(function dimensionsCounts() {
  const f = path.join(SITE, "dimensions/index.html");
  if (!fs.existsSync(f)) return;
  const words = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
  const nb = Object.keys(BRANDS).length;
  let h = fs.readFileSync(f, "utf8");
  h = h.replace(/<!--cutout-count-->[\s\S]*?<!--\/cutout-count-->/, `<!--cutout-count-->${RECS.length} models across ${words[nb] || nb} manufacturers<!--/cutout-count-->`);
  /* The meta description cannot hold a marker; keep its count in step by pattern. */
  h = h.replace(/real cutout sizes for \d+ built-in models/, `real cutout sizes for ${RECS.length} built-in models`);
  h = h.replace(/real manufacturer cutouts for \d+ built-in (components|models)/g, `real manufacturer cutouts for ${RECS.length} built-in models`);
  fs.writeFileSync(f, h);
})();

/* ---------- sitemap ------------------------------------------------------ */
(function sitemap() {
  const f = path.join(SITE, "sitemap.xml");
  if (!fs.existsSync(f)) return;
  let xml = fs.readFileSync(f, "utf8");
  xml = xml.replace(/\s*<url><loc>https:\/\/eaglebuilt\.ai\/dimensions\/cutouts\/[^<]*<\/loc>[^\n]*<\/url>/g, "");
  const lastmod = DATA.map(r => r.verified_date).sort().pop();
  const urls = [
    ["/dimensions/cutouts/", "0.8"],
    ...Object.values(BRANDS).map(b => [`/dimensions/cutouts/${b.slug}/`, "0.7"]),
    ...sortRecs(RECS).map(r => [r.url, "0.5"]),
  ].map(([u, p]) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>${p}</priority></url>`).join("\n");
  xml = xml.replace(/(\s*<url><loc>https:\/\/eaglebuilt\.ai\/dimensions\/clearances\/<\/loc>[^\n]*<\/url>)/, `$1\n${urls}`);
  fs.writeFileSync(f, xml);
})();

console.log(`cutouts: ${written.length} pages (${RECS.length} models, ${nVerified} verified, ${RECS.filter(r => r.key).length} designer-linked)`);
