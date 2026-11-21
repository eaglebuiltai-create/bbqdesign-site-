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
    const s = 1 + Math.floor(noise(i, 9) * 3);
    g.fillStyle = dot(i);
    g.fillRect(x, y, s, s);
    for (let yy = y; yy < y + s && yy < n; yy++) for (let xx = x; xx < x + s && xx < n; xx++) {
      height[yy * n + xx] = 0.25;
    }
  }
}

const PAINTERS = {
  stucco(g, height, n) {
    g.fillStyle = "#cfc8bc";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1800; i++) {
      const x = Math.floor(noise(i, 1) * n);
      const y = Math.floor(noise(2, i) * n);
      const shade = 180 + Math.floor(noise(i, 4) * 50);
      g.fillStyle = "rgb(" + shade + "," + (shade - 6) + "," + (shade - 14) + ")";
      g.fillRect(x, y, 2, 2);
      height[y * n + x] = noise(i, 8) * 0.35;
    }
  },
  stack(g, height, n) { brick(g, height, n, (r, c) => ["#7a756b", "#585449", "#93897a", "#635f58"][(r + c) & 3], "#3e3b36", 14, 36); },
  cult(g, height, n) { brick(g, height, n, (r, c) => ["#8a7f71", "#6b6157", "#a2937f", "#5e564c"][(r * 3 + c) & 3], "#4a453f", 28, 32); },
  flag(g, height, n) { brick(g, height, n, (r, c) => ["#9a9086", "#7c7468", "#afa598", "#6e675c"][(r + c * 2) & 3], "#5c564e", 36, 52); },
  brickw(g, height, n) { brick(g, height, n, (r, c) => ["#f1ede5", "#e9e4db", "#e7e2d8", "#c7c7c0"][(r + c) & 3], "#ddd6cc", 12, 28); },
  brick(g, height, n) { brick(g, height, n, (r, c) => ["#8c4a38", "#7a3e2e", "#a05b44", "#6e3a2c"][(r + c) & 3], "#c4b2a4", 12, 28); },
  tile(g, height, n) { brick(g, height, n, (r, c) => ["#3b4350", "#2a2f38", "#6b7480"][(r + c) & 2], "#1c2128", 32, 56); },
  concrete(g, height, n) { speckle(g, height, n, "#8e9298", (i) => (i % 5 ? "#9aa0a6" : "#6e747c"), 700); },
  concretew(g, height, n) { speckle(g, height, n, "#e4e1d9", (i) => (i % 4 ? "#f2efe8" : "#c8c4ba"), 600); },
  concrete2(g, height, n) { speckle(g, height, n, "#8e9298", (i) => (i % 5 ? "#a8adb3" : "#757b83"), 500); },
  granite(g, height, n) { speckle(g, height, n, "#5a5f66", (i) => ["#3e434a", "#8b919a", "#2c3036", "#6a7078"][i & 3], 1400); },
  quartz(g, height, n) { speckle(g, height, n, "#e6e3db", (i) => (i % 7 ? "#f7f5f0" : "#b7b3aa"), 900); },
  quartzite(g, height, n) { speckle(g, height, n, "#c5cad0", (i) => ["#9aa3ac", "#eef1f4", "#7e8790"][i % 3], 1000); },
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

function solid(THREE, color, metal, rough) {
  return new THREE.MeshStandardMaterial({
    color, metalness: metal, roughness: rough
  });
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#121820");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 45;
  controls.maxDistance = 1400;
  const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
  sun.position.set(-80, 160, 90);
  sun.castShadow = true;
  const shadow = phone ? 1024 : 2048;
  sun.shadow.mapSize.set(shadow, shadow);
  sun.shadow.bias = -0.00035;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xc5d0de, 0.45));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ color: "#8a8178", roughness: 0.92, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const root = new THREE.Group();
  scene.add(root);
  const library = {};
  function material(mat) {
    if (mat === "toe") return library.toe || (library.toe = solid(THREE, "#10161f", 0.04, 0.9));
    if (mat === "steel" || mat === "door" || mat === "drawer" || mat === "fridge") {
      return library.steel || (library.steel = solid(THREE, "#c5ccd4", 0.82, 0.38));
    }
    if (mat === "handle") return library.handle || (library.handle = solid(THREE, "#f2f5f8", 0.95, 0.22));
    if (mat === "grill") return library.grill || (library.grill = solid(THREE, "#2a3138", 0.7, 0.45));
    if (mat === "pizza") return library.pizza || (library.pizza = solid(THREE, "#1c1f24", 0.4, 0.55));
    if (mat === "blank") return library.blank || (library.blank = solid(THREE, "#6d675f", 0.02, 0.95));
    if (library[mat]) return library[mat];
    const maps = mapsFor(THREE, mat);
    maps.map.repeat.set(1, 1);
    return library[mat] = new THREE.MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      metalness: mat === "granite" || mat === "quartz" || mat === "quartzite" ? 0.08 : 0.02,
      roughness: mat === "quartz" ? 0.28 : 0.78
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
  function fit(sceneData) {
    const dist = Math.max((sceneData.span || 120) * 1.7, 140);
    const pitch = 0.42;
    const yaw = -0.62;
    camera.position.set(
      sceneData.cx + dist * Math.cos(pitch) * Math.sin(yaw),
      18 + dist * Math.sin(pitch),
      sceneData.cz + dist * Math.cos(pitch) * Math.cos(yaw)
    );
    controls.target.set(sceneData.cx, (sceneData.height || 37) * 0.42, sceneData.cz);
    const span = Math.max(sceneData.span || 120, 80);
    sun.shadow.camera.left = -span;
    sun.shadow.camera.right = span;
    sun.shadow.camera.top = span;
    sun.shadow.camera.bottom = -span;
    sun.target.position.set(sceneData.cx, 20, sceneData.cz);
    scene.add(sun.target);
    sun.shadow.camera.updateProjectionMatrix();
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
      const boxes = islandBoxes(sceneData);
      for (const box of boxes) {
        const bw = Math.max(0.4, box.w);
        const bh = Math.max(0.2, box.y1 - box.y0);
        const bd = Math.max(0.4, box.d);
        const geo = new THREE.BoxGeometry(bw, bh, bd);
        tileUVs(geo, Math.max(bw, bd), bh);
        const mesh = new THREE.Mesh(geo, material(box.mat));
        mesh.position.set(box.x, (box.y0 + box.y1) / 2, box.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
      }
      const key = (sceneData.bays || []).length + ":" + Math.round(sceneData.cx) + ":" + Math.round(sceneData.cz) + ":" + sceneData.finish + ":" + sceneData.counter;
      if (key !== fitted) { fit(sceneData); fitted = key; }
    },
    start() { paused = false; if (!frame) loop(); },
    stop() { paused = true; if (frame) cancelAnimationFrame(frame); frame = 0; },
    setPaused(value) { if (value) this.stop(); else this.start(); },
    dolly(factor) {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(factor);
      const len = offset.length();
      if (len < 45 || len > 1400) return;
      camera.position.copy(controls.target).add(offset);
    },
    renderNow() { resize(); controls.update(); renderer.render(scene, camera); },
    resize
  };
}
