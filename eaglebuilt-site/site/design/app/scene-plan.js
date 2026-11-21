/**
 * Boxes for the WebGL view. The page passes rectangles already produced by
 * takeoff() and decompose(), plus one descriptor per module. This file does
 * not pack, place, or read the parser.
 */

export const FINISH_KEYS = ["stucco", "stack", "cult", "flag", "brickw", "brick", "tile"];
export const COUNTER_KEYS = ["concrete", "concretew", "concrete2", "granite", "quartz", "quartzite", "tilep"];

function addRects(boxes, rects, y0, y1, mat) {
  for (const r of rects || []) {
    const w = r.x1 - r.x0;
    const d = r.y1 - r.y0;
    if (w < 0.25 || d < 0.25 || y1 - y0 < 0.2) continue;
    boxes.push({
      x: (r.x0 + r.x1) / 2,
      z: (r.y0 + r.y1) / 2,
      w, d, y0, y1, mat
    });
  }
}

function faceBox(bay, proud, faceW, y0, y1, mat) {
  const alongX = Math.abs(bay.fx) > 0.5;
  const half = alongX ? bay.w / 2 : bay.d / 2;
  return {
    x: bay.x + bay.fx * (half + proud),
    z: bay.z + bay.fz * (half + proud),
    w: alongX ? 0.5 : faceW,
    d: alongX ? faceW : 0.5,
    y0, y1, mat
  };
}

function bayBoxes(bay, H, slab) {
  const out = [];
  const alongX = Math.abs(bay.fx) > 0.5;
  const faceW = Math.max(4, (alongX ? bay.d : bay.w) - 2);
  const yTop = H - slab - 1;
  if (bay.filler) {
    out.push(faceBox(bay, 0.2, faceW * 0.92, 2.4, Math.max(3, yTop), "blank"));
    return out;
  }
  if (bay.sits || bay.mount === "counter") {
    const ch = Math.min(bay.ch || 12, 16);
    out.push({
      x: bay.x, z: bay.z,
      w: Math.max(8, bay.w * 0.72),
      d: Math.max(8, bay.d * 0.55),
      y0: H, y1: H + ch,
      mat: bay.t === "ctpizza" || bay.t === "pizza" ? "pizza" : "steel"
    });
    return out;
  }
  if (bay.mount === "top") {
    const ch = Math.min(bay.ch || 10, 14);
    const bw = Math.max(8, (alongX ? bay.d : bay.w) * 0.78);
    const bd = Math.max(8, (alongX ? bay.w : bay.d) * 0.62);
    out.push({
      x: bay.x, z: bay.z, w: alongX ? bd : bw, d: alongX ? bw : bd,
      y0: H - ch * 0.35, y1: H + ch * 0.55, mat: "grill"
    });
    if (bay.under) {
      out.push(faceBox(bay, 0.55, faceW * 0.84, 2.2, yTop, "door"));
      const mid = (2.2 + yTop) / 2;
      out.push(faceBox(bay, 1.15, 0.7, mid - 3.2, mid + 3.2, "handle"));
    }
    return out;
  }
  const mat = bay.t === "fridge" ? "fridge" : bay.t === "drawer" || bay.t === "combo" ? "drawer" : "door";
  out.push(faceBox(bay, 0.5, faceW * 0.9, 2, yTop, mat));
  const mid = (2 + yTop) / 2;
  if (bay.t === "drawer" || bay.t === "combo") {
    out.push(faceBox(bay, 1.1, faceW * 0.34, mid - 0.35, mid + 0.35, "handle"));
  } else {
    out.push(faceBox(bay, 1.1, 0.65, mid - 3, mid + 3, "handle"));
  }
  return out;
}

export function islandBoxes(input) {
  const boxes = [];
  const H = Number(input.height) || 37.5;
  const slab = Number(input.slab) || 3;
  const rise = input.barOn ? Number(input.barRise) || 0 : 0;
  const finish = FINISH_KEYS.includes(input.finish) ? input.finish : "stucco";
  const counter = COUNTER_KEYS.includes(input.counter) ? input.counter : "concrete";
  const wallTop = Math.max(3.4, H - slab);
  addRects(boxes, input.base, 0, 3, "toe");
  addRects(boxes, input.base, 3, wallTop, finish);
  addRects(boxes, input.top, H - slab, H, counter);
  if (rise > 0.25) {
    const cap = H + rise;
    addRects(boxes, input.barWalls, 0, 3, "toe");
    addRects(boxes, input.barWalls, 3, Math.max(3.4, cap - slab), finish);
    addRects(boxes, input.barTop, cap - slab, cap, counter);
  }
  for (const bay of input.bays || []) boxes.push(...bayBoxes(bay, H, slab));
  return boxes;
}
