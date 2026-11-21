/**
 * WebGL view of an island that is already laid out. Geometry comes from
 * scene-plan.js. This module does not import the parser and does not pack.
 * Three.js loads only after createView() runs, which the page calls when
 * the 3D view opens with ?gl=1.
 */
import { islandBoxes } from "./scene-plan.js";

const TILE = 28;

function noise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function paint(draw) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const height = new Float32Array(128 * 128);
  draw(g, height, 128);
  return { color: c, height };
}

function brick(g, height, n, color, mortar, h, w) {
  g.fillStyle = mortar;
  g.fillRect(0, 0, n, n);
  const rows = Math.max(2, Math.round(n / h));
  const cols = Math.max(2, Math.round(n / w));
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * n / rows) + 1;
    const y1 = Math.floor((row + 1) * n / rows) - 1;
    const shift = row % 2 ? w / 2 : 0;
    for (let col = -1; col <= cols; col++) {
      const x0 = Math.floor(col * n / cols + shift) + 1;
      const x1 = Math.floor((col + 1) * n / cols + shift) - 1;
      g.fillStyle = color(row, col);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < n && y >= 0 && y < n) height[y * n + x] = 0.65;
      }
    }
  }
}

function speckle(g, height, n, base, dot, count) {
  g.fillStyle = base;
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(noise(i, 3) * n);
    const y = Math.floor(noise(3, i) * n);
    g.fillStyle = dot(i);
    g.fillRect(x, y, 1, 1);
    if (y < n && x < n) height[y * n + x] = 0.05;
  }
}

const PAINTERS = {
  stucco(g, height, n) {
    g.fillStyle = "#9c9588";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1800; i++) {
      const x = Math.floor(noise(i, 1) * n);
      const y = Math.floor(noise(2, i) * n);
      const shade = 130 + Math.floor(noise(i, 4) * 55);
      g.fillStyle = "rgb(" + shade + "," + (shade - 4) + "," + (shade - 12) + ")";
      g.fillRect(x, y, 2, 2);
      height[y * n + x] = noise(i, 8) * 0.55;
    }
  },
  stack(g, height, n) { brick(g, height, n, (r, c) => ["#7a756b", "#585449", "#93897a", "#635f58"][(r + c) & 3], "#3e3b36", 14, 36); },
  cult(g, height, n) { brick(g, height, n, (r, c) => ["#8a7f71", "#6b6157", "#a2937f", "#5e564c"][(r * 3 + c) & 3], "#4a453f", 28, 32); },
  flag(g, height, n) { brick(g, height, n, (r, c) => ["#9a9086", "#7c7468", "#afa598", "#6e675c"][(r + c * 2) & 3], "#5c564e", 36, 52); },
  brickw(g, height, n) { brick(g, height, n, (r, c) => ["#f1ede5", "#e9e4db", "#e7e2d8", "#c7c7c0"][(r + c) & 3], "#ddd6cc", 12, 28); },
  brick(g, height, n) { brick(g, height, n, (r, c) => ["#8c4a38", "#7a3e2e", "#a05b44", "#6e3a2c"][(r + c) & 3], "#c4b2a4", 12, 28); },
  tile(g, height, n) { brick(g, height, n, (r, c) => ["#3b4350", "#2a2f38", "#6b7480"][(r + c) & 2], "#1c2128", 32, 56); },
  concrete(g, height, n) { speckle(g, height, n, "#6a7078", (i) => (i % 4 ? "#8b929a" : "#4e545c"), 900); },
  concretew(g, height, n) { speckle(g, height, n, "#c9c4ba", (i) => (i % 3 ? "#ddd8ce" : "#9e978c"), 800); },
  concrete2(g, height, n) { speckle(g, height, n, "#6a7078", (i) => (i % 4 ? "#90979f" : "#525860"), 700); },
  granite(g, height, n) { speckle(g, height, n, "#5a5f66", (i) => ["#3e434a", "#8b919a", "#2c3036", "#6a7078"][i & 3], 2400); },
  quartz(g, height, n) { speckle(g, height, n, "#e4e1d8", (i) => (i % 5 ? "#f4f2ec" : "#b9b4aa"), 1800); },
  quartzite(g, height, n) { speckle(g, height, n, "#c5cad0", (i) => ["#9aa3ac", "#eef1f4", "#7e8790"][i % 3], 2000); },
  tilep(g, height, n) { brick(g, height, n, (r, c) => ["#9a8f80", "#b5ab9c", "#7e7568"][(r + c) & 2], "#6a6156", 40, 40); }
};

function mapsFor(THREE, key) {
  const painter = PAINTERS[key] || PAINTERS.stucco;
  const painted = paint(painter);
  const color = new THREE.CanvasTexture(painted.color);
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.colorSpace = THREE.SRGBColorSpace;
  const n = document.createElement("canvas");
  n.width = 128;
  n.height = 128;
  const g = n.getContext("2d");
  const img = g.createImageData(128, 128);
  const h = painted.height;
  const at = (x, y) => h[((y + 128) % 128) * 128 + ((x + 128) % 128)];
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = at(x + 1, y) - at(x - 1, y);
    const dy = at(x, y + 1) - at(x, y - 1);
    const i = (y * 128 + x) * 4;
    img.data[i] = 128 + dx * 90;
    img.data[i + 1] = 128 - dy * 90;
    img.data[i + 2] = 220;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const normal = new THREE.CanvasTexture(n);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  const rough = document.createElement("canvas");
  rough.width = 128;
  rough.height = 128;
  const rg = rough.getContext("2d");
  rg.fillStyle = key === "quartz" || key === "granite" || key === "quartzite" ? "#6a6a6a" : "#b4b4b4";
  rg.fillRect(0, 0, 128, 128);
  const roughness = new THREE.CanvasTexture(rough);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  return { map: color, normalMap: normal, roughnessMap: roughness };
}

function patioMesh(THREE) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  const wash = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  wash.addColorStop(0, "rgba(58,54,50,0.42)");
  wash.addColorStop(0.55, "rgba(36,34,32,0.22)");
  wash.addColorStop(1, "rgba(14,23,38,0)");
  g.fillStyle = wash;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(28,26,24,0.16)";
  g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(0, 18 + i * 32);
    g.lineTo(256, 14 + i * 32);
    g.stroke();
    g.beginPath();
    g.moveTo(16 + i * 32, 0);
    g.lineTo(12 + i * 32, 256);
    g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  return mesh;
}

function solid(THREE, color, metal, rough, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color, metalness: metal, roughness: rough, envMapIntensity: metal > 0.5 ? 1.35 : 0.4
  }, extra || {}));
}

function FINISH_OR_COUNTER(mat) {
  return mat === "stucco" || mat === "stack" || mat === "cult" || mat === "flag" || mat === "brickw" || mat === "brick" || mat === "tile"
    || mat === "concrete" || mat === "concretew" || mat === "concrete2" || mat === "granite" || mat === "quartz" || mat === "quartzite" || mat === "tilep"
    || mat.endsWith("Edge");
}

function cylMesh(THREE, part, mat) {
  const h = Math.max(0.1, part.y1 - part.y0);
  const geo = new THREE.CylinderGeometry(part.r, part.r, h, 28);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(part.x, (part.y0 + part.y1) / 2, part.z);
  return mesh;
}

function tubeMesh(THREE, part, mat) {
  const a = part.a;
  const b = part.b;
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(0.05, dir.length());
  const geo = new THREE.CylinderGeometry(part.r, part.r, len, 12);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function barrelMesh(THREE, part, mat) {
  const segs = 16;
  const e = part.pw || 2;
  const prof = [];
  for (let i = 0; i <= segs; i++) {
    const th = Math.PI * i / segs;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    let px = (ct < 0 ? -1 : 1) * Math.pow(Math.abs(ct), 2 / e) * part.d / 2;
    const py = Math.pow(Math.abs(st), 2 / e) * part.h;
    if (part.flat && px < 0) px *= 0.78;
    prof.push([px, py]);
  }
  const pos = [];
  const idx = [];
  for (const end of [-part.w / 2, part.w / 2]) {
    for (const p of prof) {
      if (part.alongX) pos.push(end, p[1], p[0]);
      else pos.push(p[0], p[1], end);
    }
  }
  const n = prof.length;
  for (let i = 0; i < segs; i++) {
    idx.push(i, n + i, i + 1, i + 1, n + i, n + i + 1);
  }
  for (const start of [0, n]) {
    for (let i = 1; i < segs; i++) idx.push(start, start + i, start + i + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(part.x, part.y0, part.z);
  return mesh;
}

export async function createView(canvas, opts) {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  const phone = !!(opts && opts.phone);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0e1726");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 45;
  controls.maxDistance = 1800;
  const sun = new THREE.DirectionalLight(0xfff6ee, 0.72);
  sun.position.set(-80, 160, 90);
  sun.castShadow = true;
  const shadow = phone ? 1024 : 2048;
  sun.shadow.mapSize.set(shadow, shadow);
  sun.shadow.bias = -0.00035;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xd0d8e4, 0.55));
  const patio = patioMesh(THREE);
  patio.receiveShadow = true;
  scene.add(patio);
  let grid = null;
  function showGrid(cx, cz, span) {
    const size = Math.max(120, Math.ceil(span * 1.2 / 12) * 12);
    const divs = Math.max(8, Math.round(size / 12));
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      grid.material.dispose();
    }
    grid = new THREE.GridHelper(size, divs, 0x8aa0bc, 0x6c849c);
    grid.material.transparent = true;
    grid.material.opacity = 0.055;
    grid.material.depthWrite = false;
    grid.position.set(cx, 0.02, cz);
    scene.add(grid);
  }
  const root = new THREE.Group();
  scene.add(root);
  const library = {};
  function material(mat) {
    if (library[mat]) return library[mat];
    const metal = {
      steel: ["#d8e0ea", 0.92, 0.28],
      steelDark: ["#9aa6b3", 0.84, 0.36],
      door: ["#c2ccd8", 0.78, 0.4],
      handle: ["#eff4f9", 1, 0.16],
      grate: ["#59626d", 0.7, 0.42],
      hood: ["#2a3036", 0.62, 0.4],
      cavity: ["#0e1116", 0.15, 0.72],
      dark: ["#232a33", 0.35, 0.55],
      flue: ["#3a4048", 0.6, 0.4],
      basin: ["#b7c1cb", 0.72, 0.32],
      knobRed: ["#c34a3e", 0.35, 0.42],
      glass: ["#40586e", 0.2, 0.08]
    };
    if (metal[mat]) {
      const spec = metal[mat];
      const extra = mat === "glass" ? { transparent: true, opacity: 0.72 } : {};
      return library[mat] = solid(THREE, spec[0], spec[1], spec[2], extra);
    }
    if (mat === "toe") return library.toe = solid(THREE, "#10161f", 0.04, 0.9);
    const finish = mat.endsWith("Edge") ? mat.slice(0, -4) : mat;
    const maps = mapsFor(THREE, finish);
    const polished = finish === "granite" || finish === "quartz" || finish === "quartzite";
    const Mat = polished ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    return library[mat] = new Mat({
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      color: mat.endsWith("Edge") ? "#c5ccd4" : "#f2f2f2",
      metalness: polished ? 0.04 : 0.02,
      roughness: mat.endsWith("Edge") ? 0.2 : (polished ? 0.22 : 0.84),
      clearcoat: polished ? 0.4 : 0,
      clearcoatRoughness: 0.3,
      envMapIntensity: polished ? 0.85 : 0.4
    });
  }
  function tileUVs(geo, w, h) {
    const uv = geo.attributes.uv;
    if (!uv) return;
    const su = Math.max(0.35, w / TILE);
    const sv = Math.max(0.35, h / TILE);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
  }
  let frame = 0;
  let paused = false;
  let fitted = "";
  function resize() {
    const stage = canvas.parentElement;
    const w = (stage && stage.clientWidth) || canvas.clientWidth || 800;
    const h = (stage && stage.clientHeight) || canvas.clientHeight || 600;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  let lastScene = null;
  function placeCamera(sceneData, forShot) {
    const fit = sceneData.fit || {};
    const x0 = fit.x0 != null ? fit.x0 : (sceneData.cx || 0) - 40;
    const x1 = fit.x1 != null ? fit.x1 : (sceneData.cx || 0) + 40;
    const z0 = fit.z0 != null ? fit.z0 : (sceneData.cz || 0) - 40;
    const z1 = fit.z1 != null ? fit.z1 : (sceneData.cz || 0) + 40;
    const w = Math.max(40, x1 - x0);
    const d = Math.max(40, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const inset = forShot ? 0.95 : 0.98;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const ix0 = mx + (x0 - mx) * inset;
    const ix1 = mx + (x1 - mx) * inset;
    const iz0 = mz + (z0 - mz) * inset;
    const iz1 = mz + (z1 - mz) * inset;
    const topY = (sceneData.height || 37) + 14;
    const pitch = 0.42;
    const yaw = -0.62;
    const ty = topY * (forShot ? 0.55 : 0.5);
    const aspect = Math.max(0.42, camera.aspect || 1);
    const fov = camera.fov * Math.PI / 180;
    const tanV = Math.tan(fov / 2);
    const tanH = tanV * aspect;
    const cp = Math.cos(pitch);
    const ox = cp * Math.sin(yaw);
    const oy = Math.sin(pitch);
    const oz = cp * Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const yx = -oy * ox / cp;
    const yy = cp;
    const yz = -oy * oz / cp;
    const margin = forShot ? 1.0 : 0.94;
    let dist = 80;
    for (const x of [ix0, ix1]) for (const z of [iz0, iz1]) for (const y of [2, topY]) {
      const vx = x - cx;
      const vy = y - ty;
      const vz = z - cz;
      const depth = vx * ox + vy * oy + vz * oz;
      const sx = vx * rx + vz * rz;
      const sy = vx * yx + vy * yy + vz * yz;
      dist = Math.max(dist, depth + Math.abs(sx) / (tanH * margin), depth + Math.abs(sy) / (tanV * margin));
    }
    dist = Math.max(70, Math.min(1800, dist));
    camera.position.set(
      cx + dist * Math.cos(pitch) * Math.sin(yaw),
      ty + dist * Math.sin(pitch),
      cz + dist * Math.cos(pitch) * Math.cos(yaw)
    );
    controls.target.set(cx, ty, cz);
    const span = Math.max(w, d, 80);
    sun.shadow.camera.left = -span;
    sun.shadow.camera.right = span;
    sun.shadow.camera.top = span;
    sun.shadow.camera.bottom = -span;
    sun.position.set(cx - span * 0.45, ty + span * 1.1, cz + span * 0.55);
    sun.target.position.set(cx, 18, cz);
    scene.add(sun.target);
    sun.shadow.camera.updateProjectionMatrix();
    patio.scale.set(span * 0.62, span * 0.62, 1);
    patio.position.set(cx, 0.04, cz);
    showGrid(cx, cz, span);
    controls.update();
  }
  function loop() {
    if (paused || document.hidden) { frame = 0; return; }
    frame = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    paused = true;
    if (opts && opts.onFail) opts.onFail("context lost");
  });
  return {
    canvas,
    sync(sceneData) {
      resize();
      while (root.children.length) {
        const child = root.children.pop();
        if (child.geometry) child.geometry.dispose();
        root.remove(child);
      }
      const parts = islandBoxes(sceneData);
      lastScene = sceneData;
      for (const part of parts) {
        let mesh;
        if (part.kind === "tube") mesh = tubeMesh(THREE, part, material(part.mat));
        else if (part.kind === "cyl") mesh = cylMesh(THREE, part, material(part.mat));
        else if (part.kind === "barrel") mesh = barrelMesh(THREE, part, material(part.mat));
        else {
          const bw = Math.max(0.4, part.w);
          const bh = Math.max(0.2, part.y1 - part.y0);
          const bd = Math.max(0.4, part.d);
          const geo = new THREE.BoxGeometry(bw, bh, bd);
          if (part.mat && FINISH_OR_COUNTER(part.mat)) tileUVs(geo, Math.max(bw, bd), bh);
          mesh = new THREE.Mesh(geo, material(part.mat));
          mesh.position.set(part.x, (part.y0 + part.y1) / 2, part.z);
        }
        mesh.castShadow = part.mat !== "glass";
        mesh.receiveShadow = true;
        root.add(mesh);
      }
      const key = (sceneData.bays || []).length + ":" + Math.round(sceneData.cx) + ":" + Math.round(sceneData.cz) + ":" + sceneData.finish + ":" + sceneData.counter;
      if (key !== fitted) { placeCamera(sceneData, false); fitted = key; }
    },
    start() { paused = false; if (!frame) loop(); },
    stop() { paused = true; if (frame) cancelAnimationFrame(frame); frame = 0; },
    setPaused(value) { if (value) this.stop(); else this.start(); },
    dolly(factor) {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(factor);
      const len = offset.length();
      if (len < 45 || len > 1800) return;
      camera.position.copy(controls.target).add(offset);
    },
    renderNow() { resize(); controls.update(); renderer.render(scene, camera); },
    captureFrame() {
      const pos = camera.position.clone();
      const target = controls.target.clone();
      resize();
      if (lastScene) placeCamera(lastScene, true);
      controls.update();
      renderer.render(scene, camera);
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    },
    resize
  };
}
