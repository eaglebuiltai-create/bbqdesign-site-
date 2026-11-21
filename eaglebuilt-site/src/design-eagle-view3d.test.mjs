/**
 * Graphics fixtures for the WebGL view. These do not exercise the parser,
 * the catalog, pricing, or lead capture. The behavior suite is unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { decodeDesign } from "../site/assets/eagle-engine.js";
import { FINISH_KEYS, COUNTER_KEYS, islandBoxes } from "../site/design/app/scene-plan.js";

const SPOKEN_U = "eyJ2Ijo0LCJtIjpbWyJmaWxsMjQiLC0xMzQ4LC00MywyNzAsMCwiIiwwLDAsMCwwXSxbImZpbGwxMiIsLTEzNDgsNTMzLDI3MCwwLCIiLDAsMCwwLDBdLFsiY3RwaXp6YSIsLTEzNDgsMTEwOSwyNzAsMCwiIiwwLDAsMCwwXSxbImZpbGwxMiIsLTEzNDgsMTY4NSwyNzAsMCwiIiwwLDAsMCwwXSxbImZpbGwxNiIsLTE2MDQsLTkzOSwwLDAsIiIsMCwwLDAsMF0sWyJCTFotNExURTMiLC04MjYsLTkzOSwwLDAsIkJMWi1EREMtUi1MVFNDIiwwLDAsMCwwXSxbImZpbGwyNCIsODAsLTkzOSwwLDAsIiIsMCwwLDAsMF0sWyJCTFotU0IyLUxURVBMVVMiLDY3MiwtOTM5LDAsMCwiQkxaLVNJTkdMRS0yNDE3LVItU0MiLDAsMCwwLDBdLFsiZmlsbDYiLDk3NiwtOTM5LDAsMCwiIiwwLDAsMCwwXSxbIkJMWi1TU1JGMjAtNC4zIiwxNDY2LC05MzksMCwwLCIiLDAsMCwwLDBdLFsiZmlsbDE2IiwxMzQ4LC0xNzEsOTAsMCwiIiwwLDAsMCwwXSxbIkJMWi1EUlczLVItTFQiLDEzNDgsMzY1LDkwLDAsIiIsMCwwLDAsMF0sWyJmaWxsNiIsMTM0OCw3NDEsOTAsMCwiIiwwLDAsMCwwXSxbIkJMWi1HUklERExFLUxURTMiLDEzNDgsMTMyMSw5MCwwLCJCTFotQUQyNS1SLVNDIiwwLDAsMCwwXV0sImMiOiJjb25jcmV0ZSIsIm8iOjEuNSwiZHAiOjMyLCJodCI6MzcuNSwiZiI6InN0dWNjbyIsImNyIjo1LjMsInNlIjoxLCJiYXIiOjAsIm9sIjoyLCJtcyI6ImF1dG8iLCJmYyI6MCwiZnIiOiJjbXUiLCJhIjpbInRyYXNoIl0sIm9nIjpbXSwiY3UiOltdLCJsZyI6WzEyMCw3Miw3Ml19";
const L_10_17 = "eyJ2Ijo0LCJtIjpbWyJmaWxsMjQiLC0xOTIwLC0yMzQ3LDAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsLTExNTIsLTIzNDcsMCwwLCIiLDAsMCwwLDBdLFsiZmlsbDI0IiwtMzg0LC0yMzQ3LDAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMzg0LC0yMzQ3LDAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMTE1MiwtMjM0NywwLDAsIiIsMCwwLDAsMF0sWyJjb3JuZXIyNCIsMTkyMCwtMjM0NywwLDAsIiIsMCwwLDAsMF0sWyJmaWxsMjQiLDE3OTIsLTE0NTEsOTAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMTc5MiwtNjgzLDkwLDAsIiIsMCwwLDAsMF0sWyJmaWxsMjQiLDE3OTIsODUsOTAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMTc5Miw4NTMsOTAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMTc5MiwxNjIxLDkwLDAsIiIsMCwwLDAsMF0sWyJmaWxsMjQiLDE3OTIsMjM4OSw5MCwwLCIiLDAsMCwwLDBdLFsiZmlsbDI0IiwxNzkyLDMxNTcsOTAsMCwiIiwwLDAsMCwwXSxbImZpbGwyNCIsMTc5MiwzOTI1LDkwLDAsIiIsMCwwLDAsMF0sWyJmaWxsMTIiLDE3OTIsNDUwMSw5MCwwLCIiLDAsMCwwLDBdXSwiYyI6ImNvbmNyZXRlIiwibyI6MS41LCJkcCI6MzIsImh0IjozNy41LCJmIjoic3R1Y2NvIiwiY3IiOjUuMywic2UiOjEsImJhciI6MCwib2wiOjIsIm1zIjoiYXV0byIsImZjIjowLCJmciI6ImNtdSIsImEiOlsidHJhc2giXSwib2ciOltdLCJjdSI6W10sImxnIjpbMTIwLDIwNF19";

function keysOf(code) {
  return decodeDesign(code).m.map(row => row[0]);
}

describe("webgl view fixtures", () => {
  test("the spoken U fixture keeps three legs, the pizza oven, and the single door", () => {
    const design = decodeDesign(SPOKEN_U);
    assert.deepEqual(design.lg, [120, 72, 72]);
    assert.equal(design.f, "stucco");
    assert.equal(design.c, "concrete");
    assert.equal(design.bar, 0);
    const keys = keysOf(SPOKEN_U);
    assert.ok(keys.includes("ctpizza"));
    assert.ok(keys.includes("BLZ-4LTE3"));
    assert.ok(keys.includes("BLZ-GRIDDLE-LTE3"));
    assert.ok(design.m.some(row => row[5] === "BLZ-SINGLE-2417-R-SC"));
    assert.ok(design.m.some(row => row[0] === "ctpizza" && row[3] === 270));
  });

  test("the 10 ft by 17 ft L fixture is a corner and two runs", () => {
    const design = decodeDesign(L_10_17);
    assert.deepEqual(design.lg, [120, 204]);
    assert.equal(design.bar, 0);
    const keys = keysOf(L_10_17);
    assert.ok(keys.includes("corner24"));
    assert.ok(design.m.some(row => row[3] === 0));
    assert.ok(design.m.some(row => row[3] === 90));
  });

  test("every finish and counter becomes a box the view can shade", () => {
    const base = [{ x0: 0, y0: 0, x1: 80, y1: 32 }];
    const top = [{ x0: -2, y0: -2, x1: 82, y1: 34 }];
    for (const finish of FINISH_KEYS) {
      const boxes = islandBoxes({
        finish, counter: "concrete", height: 37.5, slab: 3,
        barOn: false, barRise: 0, base, top, bays: []
      });
      assert.ok(boxes.some(box => box.mat === finish), finish);
      assert.ok(boxes.some(box => box.mat === "toe"), finish);
    }
    for (const counter of COUNTER_KEYS) {
      const boxes = islandBoxes({
        finish: "stucco", counter, height: 37.5, slab: counter === "concrete2" ? 2 : 3,
        barOn: true, barRise: 6,
        base, barWalls: [{ x0: 0, y0: -6, x1: 80, y1: 0 }],
        top, barTop: [{ x0: -12, y0: -18, x1: 92, y1: 1 }],
        bays: [{
          x: 40, z: 16, w: 32, d: 32, fx: 0, fz: 1,
          t: "grill", mount: "top", cw: 32, cd: 22, ch: 10,
          underT: "door2", faceW: 28, faceY0: 2, faceY1: 30, sits: false
        }]
      });
      assert.ok(boxes.some(box => box.mat === counter), counter);
      assert.ok(boxes.some(box => box.kind === "barrel" && box.mat === "steel"), counter);
      assert.ok(boxes.some(box => box.mat === "brushed"), counter);
      assert.ok(boxes.some(box => box.kind === "tube" && box.mat === "handle"), counter);
      assert.ok(boxes.some(box => box.mat === "knobRed"), counter);
    }
  });

  test("the webgl module is graphics only and stays behind gl=1", () => {
    const view = readFileSync(new URL("../site/design/app/view3d.js", import.meta.url), "utf8");
    const page = readFileSync(new URL("../site/design/app/index.html", import.meta.url), "utf8");
    const eagle = readFileSync(new URL("../site/assets/design-eagle.js", import.meta.url), "utf8");
    const license = readFileSync(new URL("../site/design/app/vendor/three/LICENSE", import.meta.url), "utf8");
    assert.equal(view.includes("eagle-engine"), false);
    assert.equal(view.includes("interpret("), false);
    assert.match(license, /MIT License/);
    for (const key of FINISH_KEYS.concat(COUNTER_KEYS)) assert.match(view, new RegExp("\\b" + key + "\\b"));
    assert.match(page, /importmap/);
    assert.match(page, /gl=1/);
    assert.match(page, /render3d\(\)/);
    assert.match(eagle, /gl=1/);
    assert.match(view, /-0\.62/);
    assert.match(view, /0\.42/);
    assert.match(view, /captureFrame/);
    assert.match(view, /clearcoat/);
    assert.match(view, /knobRed/);
    const pizza = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 72, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 72, y1: 32 }],
      bays: [{
        x: 20, z: 40, w: 28, d: 32, fx: 0, fz: 1,
        t: "ctpizza", mount: "counter", sits: true, cw: 24, cd: 16, ch: 13
      }]
    });
    assert.ok(pizza.some(part => part.kind === "barrel"));
    assert.ok(pizza.some(part => part.kind === "tube" && part.mat === "flue"));
    const cold = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      bays: [{
        x: 16, z: 16, w: 24, d: 32, fx: 0, fz: 1,
        t: "fridge", mount: "full", faceW: 22, faceY0: 2, faceY1: 33
      }]
    });
    assert.ok(cold.some(part => part.mat === "glass"));
    const sink = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 80, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 80, y1: 32 }],
      bays: [{
        x: 50, z: 16, w: 32, d: 32, fx: 0, fz: 1,
        t: "sink", mount: "top", cw: 28, cd: 20, ch: 9
      }]
    });
    assert.ok(sink.some(part => part.mat === "basin"));
    assert.ok(sink.some(part => part.kind === "tube" && part.mat === "handle"));
    const covered = sink.some(part => (part.mat === "concrete" || part.mat === "concreteEdge")
      && Math.abs(part.x - 50) < part.w / 2 - 1
      && Math.abs(part.z - 16) < part.d / 2 - 1);
    assert.equal(covered, false);
    const wok = islandBoxes({
      finish: "stucco", counter: "granite", height: 37.5, slab: 1.25,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      bays: [{
        x: 16, z: 16, w: 20, d: 32, fx: 0, fz: 1,
        t: "ctwok", mount: "counter", sits: true, cw: 16, cd: 16, ch: 10
      }]
    });
    assert.ok(wok.some(part => part.kind === "cyl" && part.mat === "steel"));
    assert.ok(wok.some(part => part.kind === "cyl" && part.mat === "cavity"));
    const underGrill = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 80, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 80, y1: 32 }],
      bays: [{
        x: 40, z: 16, w: 34, d: 32, fx: 0, fz: 1,
        t: "grill", mount: "top", cw: 32, cd: 22,
        underT: "drawer", faceW: 30, faceY0: 2, faceY1: 28
      }]
    });
    const knobYs = underGrill.filter(part => part.kind === "tube" && (part.mat === "knobRed" || (part.mat === "steel" && part.r >= 0.7))).map(part => part.a[1]);
    assert.ok(knobYs.length > 0);
    assert.ok(knobYs.every(y => y > 37.5), knobYs.join(","));
    assert.ok(underGrill.filter(part => part.mat === "brushed").length >= 2);
    const triple = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      bays: [{
        x: 16, z: 16, w: 24, d: 32, fx: 0, fz: 1,
        t: "drawer", mount: "base", faceW: 20, faceY0: 2, faceY1: 32
      }]
    });
    assert.ok(triple.filter(part => part.mat === "brushed").length >= 3);
    assert.ok(triple.some(part => part.mat === "steel" && part.kind === "box"));
    const access = islandBoxes({
      finish: "stucco", counter: "concrete", height: 37.5, slab: 3,
      barOn: false, barRise: 0,
      base: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      top: [{ x0: 0, y0: 0, x1: 40, y1: 32 }],
      bays: [{
        x: 16, z: 16, w: 24, d: 32, fx: 0, fz: 1,
        t: "door1", mount: "base", faceW: 20, faceY0: 2, faceY1: 32
      }]
    });
    assert.ok(access.some(part => part.mat === "brushed"));
    assert.ok(access.some(part => part.mat === "steel" && part.kind === "box"));
    assert.ok(access.some(part => part.kind === "tube" && part.mat === "standoff" && part.r <= 0.3));
    assert.ok(access.some(part => part.kind === "tube" && part.mat === "handle" && part.r > 0.3 && part.r < 0.5));
    const pulls = underGrill.filter(part => part.kind === "tube" && part.mat === "handle" && part.a[1] < 37);
    assert.ok(pulls.length >= 2);
    for (const pull of pulls) {
      const span = Math.hypot(pull.b[0] - pull.a[0], pull.b[2] - pull.a[2]);
      const rise = Math.abs(pull.b[1] - pull.a[1]);
      assert.ok(span > rise, "drawer pulls lie flat");
      assert.ok(pull.r * 2 < 1, "drawer pulls stay under an inch across");
    }
    assert.match(page, /image\/jpeg/);
  });
});
