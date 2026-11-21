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
  const cyl = (x, z, r, y0, y1, mat) => {
    if (y1 - y0 < 0.08 || r < 0.08) return;
    p.push({ kind: "cyl", x, z, r, y0, y1, mat });
  };
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
    box(fx, fz, isX ? 0.4 : w + 1.4, isX ? w + 1.4 : 0.4, y0 - 0.2, y0 + 0.35, "steelDark");
    ring(w + 0.2, y0, y1, 1.05, 1.25, "steelDark");
    if (t === "door1" || t === "trash") {
      boxAt(w * 0.72, by + 0.7, by + h - 0.7, 0, 0.16, "door");
      const pull = t === "trash"
        ? [Math.min(15, iw - 3), by + h - 3.2, true]
        : [Math.min(h - 3, 18), by + h / 2, false];
      handle(pull[0], pull[1], t === "trash" ? 0 : iw / 2 - 2.4, pull[2]);
    } else if (t === "door2") {
      const dw = (iw - gap) / 2;
      [-1, 1].forEach(k => {
      boxAt(dw * 0.86, by + 0.55, by + h - 0.55, k * (dw + gap) / 2, 0.16, "door");
      handle(Math.min(h - 3, 18), by + h / 2, k * (gap / 2 + 2.4), false);
      });
    } else if (t === "drawer") {
      const n = h > 22 ? 3 : 2;
      const dh = (h - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const a0 = by + i * (dh + gap);
        boxAt(iw * 0.84, a0 + 0.45, a0 + dh - 0.45, 0, 0.16, "door");
        handle(Math.min(18, iw - 2), a0 + dh * 0.55, 0, true);
      }
    } else if (t === "combo") {
      const dw = iw * 0.45;
      const dr = iw - dw - gap;
      const lo = -iw / 2 + dw / 2;
      const ro = iw / 2 - dr / 2;
      const dh = (h - gap) / 2;
      for (let i = 0; i < 2; i++) {
        const a0 = by + i * (dh + gap);
        boxAt(dw * 0.82, a0 + 0.4, a0 + dh - 0.4, lo, 0.16, "door");
        handle(Math.min(14, dw - 1.5), a0 + dh * 0.55, lo, true);
      }
      boxAt(dr * 0.82, by + 0.55, by + h - 0.55, ro, 0.16, "door");
      handle(Math.min(h - 3, 18), by + h / 2, ro - dr / 2 + 2.4, false);
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
    box(cx, cz, isX ? 0.4 : w, isX ? w : 0.4, y0, y1, mat);
  }
  function ring(w, y0, y1, out, thick, mat) {
    const b = Math.min(thick, (y1 - y0) / 3, w / 3);
    boxAt(w, y1 - b, y1, 0, out, mat);
    boxAt(w, y0, y0 + b, 0, out, mat);
    boxAt(b, y0, y1, -w / 2 + b / 2, out, mat);
    boxAt(b, y0, y1, w / 2 - b / 2, out, mat);
  }
  function knobs(count, y) {
    const n = Math.max(1, count);
    const span = Math.max(4, faceW - 8);
    for (let i = 0; i < n; i++) {
      const o = n === 1 ? -1.2 : (i - (n - 1) / 2) * Math.min(6.2, span / Math.max(1, n - 1));
      tube(facePt(o, y, 0.4), facePt(o, y, 0.7), 1.55, "steel");
      tube(facePt(o, y, 0.75), facePt(o, y, 2.7), 1.05, "steel");
    }
    tube(facePt(faceW / 2 - 2.6, y, 0.4), facePt(faceW / 2 - 2.6, y, 1.7), 0.88, "knobRed");
  }

  function handle(len, y, off, horizontal) {
    const a = facePt(off - (horizontal ? len / 2 : 0), y - (horizontal ? 0 : len / 2), 2.05);
    const b = facePt(off + (horizontal ? len / 2 : 0), y + (horizontal ? 0 : len / 2), 2.05);
    tube(a, b, 1.15, "handle");
    const posts = horizontal ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
    posts.forEach(([kx, ky]) => {
      const p = off + kx * (len / 2 - 0.8);
      const py = y + ky * (len / 2 - 0.8);
      tube(facePt(p, py, 0.35), facePt(p, py, 2.05), 0.38, "handle");
    });
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
      const shell = ch * 0.46;
      box(bay.x, bay.z, hwC * 0.98, hdC * 0.98, H, H + shell, "steelDark");
      barrel(bay.x, bay.z, hwC - 1.4, hdC - 1.4, H + shell * 0.82, ch * 0.62, alongX, "hood", false, 2);
      barrel(bay.x + f0 * halfD * 0.1, bay.z + f1 * halfD * 0.1, (alongX ? hwC : hdC) * 0.48, 2.4, H + 1.5, ch * 0.4, alongX, "cavity", false, 2);
      box(bay.x + f0 * halfD, bay.z + f1 * halfD, alongX ? hwC * 0.52 : 1.35, alongX ? 1.35 : hdC * 0.52, H, H + 1.6, "steel");
      tube(
        [bay.x - f0 * halfD * 0.42, H + ch * 0.92, bay.z - f1 * halfD * 0.42],
        [bay.x - f0 * halfD * 0.42, H + ch + 6.4, bay.z - f1 * halfD * 0.42],
        1.25, "flue"
      );
    } else if (t === "ctwok") {
      const bh = Math.max(4.6, ch * 0.55);
      const R = Math.min(hwC, hdC) * 0.46;
      const lip = H + bh;
      cyl(bay.x, bay.z, R * 0.7, H + 0.15, H + bh * 0.58, "hood");
      cyl(bay.x, bay.z, R, lip - 1.2, lip + 0.2, "steel");
      cyl(bay.x, bay.z, R * 0.58, lip - 0.85, lip + 0.45, "cavity");
      box(bay.x, bay.z, R * 1.15, 0.32, lip + 0.15, lip + 0.42, "grate");
      box(bay.x, bay.z, 0.32, R * 1.15, lip + 0.15, lip + 0.42, "grate");
      tube(
        [bay.x + f0 * R * 0.2, H + bh * 0.4, bay.z + f1 * R * 0.2],
        [bay.x + f0 * (R + 1.8), H + bh * 0.4, bay.z + f1 * (R + 1.8)],
        0.85, "steel"
      );
    } else {
      box(bay.x, bay.z, hwC, hdC, H, H + ch, "steel");
    }
    return p;
  }

  if (bay.mount === "top" && (t === "grill" || t === "griddle" || t === "burner" || t === "wok" || t === "pizza" || t === "sink")) {
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
      knobs(t === "griddle" ? Math.max(2, Math.round(cw / 12)) : Math.max(3, Math.round(cw / 9)), yFace1 - 3.5);
    } else if (t === "burner" || t === "wok") {
      barrel(bay.x, bay.z, hw - 1, hd - 0.6, H + 0.4, t === "wok" ? 5.4 : 4.2, alongX, "steel", true, 2);
      box(fx, fz, isX ? 0.55 : faceW * 0.9, isX ? faceW * 0.9 : 0.55, yFace1 - 6.2, yFace1, "dark");
      knobs(1, yFace1 - 3.5);
    } else if (t === "pizza") {
      barrel(bay.x, bay.z, hw - 1, hd - 1, H + 0.4, 14.2, alongX, "hood", false, 2);
      const mr = hd / 2 * 0.94;
      barrel(bay.x + f0 * mr * 0.05, bay.z + f1 * mr * 0.05, (alongX ? hw : hd) * 0.52, 2.6, H + 1.1, 5.8, alongX, "cavity", false, 2);
      tube(
        [bay.x - f0 * hd * 0.22, H + 14, bay.z - f1 * hd * 0.22],
        [bay.x - f0 * hd * 0.22, H + 24, bay.z - f1 * hd * 0.22],
        1.35, "flue"
      );
    } else if (t === "sink") {
      flangeTop(cw, cd, 1.15, H, H + 0.45, "steel");
      const bw = Math.max(8, (alongX ? cw : cd) - 5);
      const bd = Math.max(8, (alongX ? cd : cw) - 5);
      const wall = 0.85;
      const floor = H - 5.7;
      box(bay.x, bay.z, bw - wall * 2, bd - wall * 2, floor, floor + 0.4, "basin");
      box(bay.x, bay.z - bd / 2 + wall / 2, bw, wall, floor, H + 0.12, "basin");
      box(bay.x, bay.z + bd / 2 - wall / 2, bw, wall, floor, H + 0.12, "basin");
      box(bay.x - bw / 2 + wall / 2, bay.z, wall, bd - wall * 2, floor, H + 0.12, "basin");
      box(bay.x + bw / 2 - wall / 2, bay.z, wall, bd - wall * 2, floor, H + 0.12, "basin");
      tube([bay.x, floor + 0.2, bay.z], [bay.x, floor + 1.1, bay.z], 0.55, "steelDark");
      const bx = bay.x - f0 * (cd / 2 - 2.4);
      const bz = bay.z - f1 * (cd / 2 - 2.4);
      tube([bx, H + 0.1, bz], [bx, H + 1.2, bz], 1.4, "handle");
      tube([bx, H + 1.2, bz], [bx, H + 9.4, bz], 0.62, "handle");
      tube([bx, H + 9.4, bz], [bx + f0 * 5.4, H + 9.4, bz + f1 * 5.4], 0.5, "handle");
      tube([bx + f0 * 5.4, H + 9.4, bz + f1 * 5.4], [bx + f0 * 5.4, H + 6.6, bz + f1 * 5.4], 0.34, "handle");
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

function sinkOpening(bay) {
  if (!bay || bay.t !== "sink" || bay.sits || bay.mount === "counter") return null;
  const alongX = Math.abs(bay.fx || 0) <= 0.5;
  const cw = bay.cw || bay.w || 22;
  const cd = bay.cd || bay.d || 18;
  const bw = Math.max(8, (alongX ? cw : cd) - 6.2);
  const bd = Math.max(8, (alongX ? cd : cw) - 6.2);
  return { x0: bay.x - bw / 2, y0: bay.z - bd / 2, x1: bay.x + bw / 2, y1: bay.z + bd / 2 };
}

function cutRect(rect, hole) {
  const hx0 = Math.max(rect.x0, hole.x0);
  const hy0 = Math.max(rect.y0, hole.y0);
  const hx1 = Math.min(rect.x1, hole.x1);
  const hy1 = Math.min(rect.y1, hole.y1);
  if (hx1 - hx0 < 0.4 || hy1 - hy0 < 0.4) return [rect];
  const out = [];
  if (hy0 - rect.y0 > 0.2) out.push({ x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: hy0 });
  if (rect.y1 - hy1 > 0.2) out.push({ x0: rect.x0, y0: hy1, x1: rect.x1, y1: rect.y1 });
  if (hx0 - rect.x0 > 0.2) out.push({ x0: rect.x0, y0: hy0, x1: hx0, y1: hy1 });
  if (rect.x1 - hx1 > 0.2) out.push({ x0: hx1, y0: hy0, x1: rect.x1, y1: hy1 });
  return out;
}

function openCounters(rects, bays) {
  let out = (rects || []).map(rect => ({ x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1 }));
  for (const bay of bays || []) {
    const hole = sinkOpening(bay);
    if (!hole) continue;
    out = out.flatMap(rect => cutRect(rect, hole));
  }
  return out;
}

export function islandBoxes(input) {
  const parts = [];
  const H = Number(input.height) || 37.5;
  const slab = Number(input.slab) || 3;
  const rise = input.barOn ? Number(input.barRise) || 0 : 0;
  const finish = FINISH_KEYS.includes(input.finish) ? input.finish : "stucco";
  const counter = COUNTER_KEYS.includes(input.counter) ? input.counter : "concrete";
  const wallTop = Math.max(3.4, H - slab);
  const tops = openCounters(input.top, input.bays);
  addRects(parts, input.base, 0, 3, "toe");
  addRects(parts, input.base, 3, wallTop, finish);
  addRects(parts, tops, H - slab, H - 0.55, counter);
  addRects(parts, tops, H - 0.55, H, counter + "Edge");
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
