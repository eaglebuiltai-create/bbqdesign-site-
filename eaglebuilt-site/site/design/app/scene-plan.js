/**
 * Parts for the WebGL view, using the same sizes and front-face offsets as
 * the canvas renderer. Rectangles come from takeoff()/decompose(). This file
 * does not pack or place.
 */

export const FINISH_KEYS = ["stucco", "stack", "cult", "flag", "brickw", "brick", "tile"];
export const COUNTER_KEYS = ["concrete", "concretew", "concrete2", "granite", "quartz", "quartzite", "tilep"];

function addRects(parts, rects, y0, y1, mat) {
  for (const r of rects || []) {
    const w = r.x1 - r.x0;
    const d = r.y1 - r.y0;
    if (w < 0.25 || d < 0.25 || y1 - y0 < 0.15) continue;
    parts.push({ kind: "box", x: (r.x0 + r.x1) / 2, z: (r.y0 + r.y1) / 2, w, d, y0, y1, mat });
  }
}

function bayParts(bay, H, slab) {
  const p = [];
  const box = (x, z, w, d, y0, y1, mat) => {
    if (y1 - y0 < 0.08 || w < 0.08 || d < 0.08) return;
    p.push({ kind: "box", x, z, w, d, y0, y1, mat });
  };
  const tube = (a, b, r, mat) => p.push({ kind: "tube", a, b, r, mat });
  const barrel = (x, z, w, d, y0, h, alongX, mat, flat, pw) => {
    if (h < 0.2 || w < 0.2 || d < 0.2) return;
    p.push({ kind: "barrel", x, z, w, d, y0, h, alongX: !!alongX, mat, flat: !!flat, pw: pw || 2 });
  };

  const f0 = bay.fx || 0;
  const f1 = bay.fz || 1;
  const isX = Math.abs(f0) > 0.5;
  const alongX = !isX;
  const halfDepth = isX ? bay.w / 2 : bay.d / 2;
  const faceW = bay.faceW || Math.max(6, (isX ? bay.d : bay.w) - 2);
  const yFace1 = bay.faceY1 || (H - slab - 1);
  const yFace0 = bay.faceY0 != null ? bay.faceY0 : 2;
  const cw = bay.cw || bay.w;
  const cd = Math.min(Math.max(8, (bay.d || 32) - 3.5), bay.cd || bay.d || 20);
  const hw = alongX ? cw : cd;
  const hd = alongX ? cd : cw;
  const fx = bay.x + f0 * (halfDepth + 0.35);
  const fz = bay.z + f1 * (halfDepth + 0.35);
  const facePt = (off, y, out) => [
    bay.x + f0 * (halfDepth + out) + (isX ? 0 : off),
    y,
    bay.z + f1 * (halfDepth + out) + (isX ? off : 0)
  ];
  const flangeTop = (ow, od, bar, y0, y1, mat) => {
    const w2 = alongX ? ow : od;
    const d2 = alongX ? od : ow;
    box(bay.x, bay.z - d2 / 2 + bar / 2, w2, bar, y0, y1, mat);
    box(bay.x, bay.z + d2 / 2 - bar / 2, w2, bar, y0, y1, mat);
    box(bay.x - w2 / 2 + bar / 2, bay.z, bar, d2 - bar * 2, y0, y1, mat);
    box(bay.x + w2 / 2 - bar / 2, bay.z, bar, d2 - bar * 2, y0, y1, mat);
  };

  function drawFace(t, fw, y0, y1) {
    const w = Math.min(fw, faceW);
    if (!t || t === "blank" || t === "bar" || t === "vent") return;
    const gap = 0.45;
    const iw = w - 1.6;
    const h = y1 - y0 - 1.2;
    const by = y0 + 0.6;
    box(fx, fz, isX ? 0.35 : w + 1.1, isX ? w + 1.1 : 0.35, y0 - 0.4, y1 + 0.4, "steelDark");
    if (t === "door1" || t === "trash") {
      boxAt(w * 0.86, by, by + h, 0, 0.55, "door");
      const pull = t === "trash"
        ? [Math.min(11, iw - 6), by + h - 3.2, true]
        : [Math.min(h - 6, 13), by + h / 2, false];
      handle(pull[0], pull[1], t === "trash" ? 0 : iw / 2 - 2.6, pull[2]);
    } else if (t === "door2") {
      const dw = (iw - gap) / 2;
      [-1, 1].forEach(k => {
        boxAt(dw, by, by + h, k * (dw + gap) / 2, 0.55, "door");
        handle(Math.min(h - 6, 13), by + h / 2, k * (gap / 2 + 2.6), false);
      });
    } else if (t === "drawer") {
      const n = h > 22 ? 3 : 2;
      const dh = (h - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const a0 = by + i * (dh + gap);
        boxAt(iw, a0, a0 + dh, 0, 0.55, "door");
        handle(Math.min(13, iw - 6), a0 + dh * 0.55, 0, true);
      }
    } else if (t === "combo") {
      const dw = iw * 0.45;
      const dr = iw - dw - gap;
      const lo = -iw / 2 + dw / 2;
      const ro = iw / 2 - dr / 2;
      const dh = (h - gap) / 2;
      for (let i = 0; i < 2; i++) {
        const a0 = by + i * (dh + gap);
        boxAt(dw, a0, a0 + dh, lo, 0.55, "door");
        handle(Math.min(11, dw - 4), a0 + dh * 0.55, lo, true);
      }
      boxAt(dr, by, by + h, ro, 0.55, "door");
      handle(Math.min(h - 6, 13), by + h / 2, ro - dr / 2 + 2.6, false);
    } else if (t === "fridge") {
      boxAt(iw, by, by + h, 0, 0.5, "steel");
      boxAt(iw - 1.7, by + 0.85, by + h - 0.85, 0, 0.72, "glass");
      handle(Math.min(h - 8, 16), by + h / 2, iw / 2 - 2.8, false);
    }
  }

  function boxAt(w, y0, y1, off, out, mat) {
    const o = off || 0;
    const cx = bay.x + f0 * (halfDepth + out) + (isX ? 0 : o);
    const cz = bay.z + f1 * (halfDepth + out) + (isX ? o : 0);
    box(cx, cz, isX ? 0.45 : w, isX ? w : 0.45, y0, y1, mat);
  }

  function handle(len, y, off, horizontal) {
    const a = facePt(off - (horizontal ? len / 2 : 0), y - (horizontal ? 0 : len / 2), 1.25);
    const b = facePt(off + (horizontal ? len / 2 : 0), y + (horizontal ? 0 : len / 2), 1.25);
    tube(a, b, 0.38, "handle");
  }

  const t = bay.t;
  if (bay.filler) return p;
  if (bay.sits || bay.mount === "counter") {
    const cdC = bay.cd || 16;
    const halfD = cdC / 2;
    const hwC = alongX ? (bay.cw || 24) : cdC;
    const hdC = alongX ? cdC : (bay.cw || 24);
    const ch = bay.ch || 13;
    if (t === "ctpizza") {
      box(bay.x, bay.z, hwC, hdC, H, H + ch * 0.55, "steel");
      barrel(bay.x, bay.z, hwC - 0.8, hdC - 0.8, H + ch * 0.55, ch * 0.45, alongX, "hood", false, 2);
      barrel(bay.x + f0 * halfD * 0.06, bay.z + f1 * halfD * 0.06, (alongX ? hwC : hdC) * 0.5, 2, H + 1.6, ch * 0.42, alongX, "cavity", false, 2);
      box(bay.x + f0 * halfD, bay.z + f1 * halfD, alongX ? hwC * 0.55 : 1.2, alongX ? 1.2 : hdC * 0.55, H, H + 1.4, "steelDark");
      tube(
        [bay.x - f0 * halfD * 0.5, H + ch, bay.z - f1 * halfD * 0.5],
        [bay.x - f0 * halfD * 0.5, H + ch + 5.5, bay.z - f1 * halfD * 0.5],
        1.3, "flue"
      );
    } else {
      box(bay.x, bay.z, hwC, hdC, H, H + ch, "steel");
    }
    return p;
  }

  if (bay.mount === "top" && (t === "grill" || t === "griddle" || t === "burner" || t === "wok" || t === "pizza")) {
    flangeTop(cw, cd, t === "burner" || t === "wok" ? 0.9 : 1.1, H, H + 0.45, "steel");
    const gw = (alongX ? cw : cd) - 3;
    const gd = (alongX ? cd : cw) - 3;
    if (t === "grill") {
      box(bay.x, bay.z, alongX ? gw : gd, alongX ? gd : gw, H - 4.2, H + 0.05, "cavity");
      const nr = Math.max(5, Math.round((alongX ? gd : gw) / 2.6));
      for (let i = 0; i < nr; i++) {
        const o = (i - (nr - 1) / 2) * ((alongX ? gd : gw) / nr);
        if (alongX) box(bay.x, bay.z + o, gw, 0.55, H - 0.35, H + 0.25, "grate");
        else box(bay.x + o, bay.z, 0.55, gd, H - 0.35, H + 0.25, "grate");
      }
    } else if (t === "griddle") {
      box(bay.x, bay.z, alongX ? gw : gd, alongX ? gd : gw, H - 0.3, H + 0.55, "grate");
    }
    if (t === "grill" || t === "griddle") {
      const hh = t === "grill" ? 10.5 : 8;
      barrel(bay.x, bay.z, hw - 0.6, hd - 0.4, H + 1.35, hh - 0.9, alongX, "steel", true, 2.6);
      const hy = H + 1.35 + (hh - 0.9) * 0.34;
      const hr = hd / 2 * 0.94 + 1.7;
      const a0 = alongX ? [bay.x - (hw - 8) / 2, hy, bay.z + f1 * hr] : [bay.x + f0 * hr, hy, bay.z - (hw - 8) / 2];
      const b0 = alongX ? [bay.x + (hw - 8) / 2, hy, bay.z + f1 * hr] : [bay.x + f0 * hr, hy, bay.z + (hw - 8) / 2];
      tube(a0, b0, 0.58, "handle");
      box(fx, fz, isX ? 0.55 : faceW * 0.92, isX ? faceW * 0.92 : 0.55, yFace1 - 6.2, yFace1, "dark");
      const nk = Math.max(3, Math.round(cw / 9));
      for (let i = 0; i < nk; i++) {
        const o = (i - (nk - 1) / 2) * Math.min(6, (faceW - 8) / Math.max(1, nk - 1));
        tube(facePt(o, yFace1 - 3.6, 0.7), facePt(o, yFace1 - 3.6, 2.05), 0.72, "steel");
      }
    } else if (t === "burner" || t === "wok") {
      barrel(bay.x, bay.z, hw - 1, hd - 0.6, H + 0.4, t === "wok" ? 5.4 : 4.2, alongX, "steel", true, 2);
      box(fx, fz, isX ? 0.55 : faceW * 0.9, isX ? faceW * 0.9 : 0.55, yFace1 - 6.2, yFace1, "dark");
      tube(facePt(0, yFace1 - 3.6, 0.7), facePt(0, yFace1 - 3.6, 2.05), 0.72, "steel");
    } else if (t === "pizza") {
      barrel(bay.x, bay.z, hw - 1, hd - 1, H + 0.5, 13.5, alongX, "hood", false, 2);
      const mr = hd / 2 * 0.94;
      barrel(bay.x + f0 * mr * 0.05, bay.z + f1 * mr * 0.05, (alongX ? hw : hd) * 0.55, 2.4, H + 1.2, 5.4, alongX, "cavity", false, 2);
      tube(
        [bay.x - f0 * hd * 0.22, H + 13, bay.z - f1 * hd * 0.22],
        [bay.x - f0 * hd * 0.22, H + 24, bay.z - f1 * hd * 0.22],
        1.5, "flue"
      );
    }
    if (bay.underT) drawFace(bay.underT, bay.faceW || faceW, yFace0, yFace1);
    return p;
  }

  if (bay.mount === "full" || bay.t === "fridge") {
    drawFace(t === "fridge" ? "fridge" : (bay.underT || t), bay.faceW || faceW, yFace0, yFace1);
    return p;
  }
  if (bay.underT || t === "door1" || t === "door2" || t === "drawer" || t === "combo" || t === "trash") {
    drawFace(bay.underT || t, bay.faceW || faceW, yFace0, yFace1);
  }
  return p;
}

export function islandBoxes(input) {
  const parts = [];
  const H = Number(input.height) || 37.5;
  const slab = Number(input.slab) || 3;
  const rise = input.barOn ? Number(input.barRise) || 0 : 0;
  const finish = FINISH_KEYS.includes(input.finish) ? input.finish : "stucco";
  const counter = COUNTER_KEYS.includes(input.counter) ? input.counter : "concrete";
  const wallTop = Math.max(3.4, H - slab);
  addRects(parts, input.base, 0, 3, "toe");
  addRects(parts, input.base, 3, wallTop, finish);
  addRects(parts, input.top, H - slab, H - 0.55, counter);
  addRects(parts, input.top, H - 0.55, H, counter + "Edge");
  if (rise > 0.25) {
    const cap = H + rise;
    addRects(parts, input.barWalls, 0, 3, "toe");
    addRects(parts, input.barWalls, 3, Math.max(3.4, cap - slab), finish);
    addRects(parts, input.barTop, cap - slab, cap - 0.45, counter);
    addRects(parts, input.barTop, cap - 0.45, cap, counter + "Edge");
  }
  for (const bay of input.bays || []) parts.push(...bayParts(bay, H, slab));
  return parts;
}
