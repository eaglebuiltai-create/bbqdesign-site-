// Records reel.html to out/eaglebuilt-consultation-reel.mp4 (+ a cover PNG and
// stills) using the Chrome already installed. No ffmpeg, no npm packages.
//
//   cd "C:\Users\johns\Eaglebuilt AI. Claude\eaglebuilt-site\ads"
//   node record-reel.mjs
//
// Serves eaglebuilt-site/ over localhost (a file:// canvas is tainted and cannot
// be recorded), drives Chrome over the DevTools protocol, and the page POSTs the
// finished files back to this server.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(import.meta.dirname, "out");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".js": "text/javascript" };
const STILLS = { cover: 5.0, "step1": 8.6, "step2": 11.8, "step3": 15.0, "end": 19.5 };

let finish;
const finished = new Promise(ok => finish = ok);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/__save") {
    const name = path.basename(url.searchParams.get("name"));
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(path.join(OUT, name), buf);
      console.log(`  out/${name}  (${(buf.length / 1e6).toFixed(1)} MB)`);
      res.end("ok");
    });
    return;
  }
  if (url.pathname === "/__log") { console.log(url.searchParams.get("msg")); res.end("ok"); return; }
  if (url.pathname === "/__done") { res.end("ok"); finish(url.searchParams.get("err")); return; }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

// The page does the work; this snippet runs inside it once it has loaded.
const job = `
(async () => {
  const save = (name, blob) => fetch("/__save?name=" + name, { method: "POST", body: blob });
  try {
    await reel.ready;
    for (const [k, t] of Object.entries(${JSON.stringify(STILLS)}))
      await save("eaglebuilt-consultation-" + k + ".png", await reel.snapshot(t));
    const { blob, wall, late, total } = await reel.record();
    await fetch("/__log?msg=" + encodeURIComponent("  recorded " + total + " frames in " + wall.toFixed(1) + " s wall time, " + late + " late"));
    await save("eaglebuilt-consultation-reel.mp4", blob);
    // play the file back to prove it decodes, and report what it is
    const v = document.createElement("video");
    v.muted = true; v.src = URL.createObjectURL(blob);
    await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error("MP4 did not decode")); });
    if (v.duration === Infinity) { v.currentTime = 1e9; await new Promise(ok => v.ontimeupdate = ok); }
    await fetch("/__log?msg=" + encodeURIComponent("  verified: " + v.videoWidth + "x" + v.videoHeight + ", " + v.duration.toFixed(2) + " s"));
    await fetch("/__done");
  } catch (e) {
    await fetch("/__done?err=" + encodeURIComponent(e.message));
  }
})();`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eb-reel-"));
// Capture is real time, so a slow frame stretches the video. With the GPU off
// this took 29 s to record 21 s — keep the GPU flags. If "late" in the log is
// more than a handful of frames, the output length will drift.
const chrome = spawn(CHROME, [
  "--headless=new", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--hide-scrollbars", "--mute-audio",
  "--force-device-scale-factor=1", "--window-size=1080,1920",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0",
  `http://127.0.0.1:${port}/ads/reel.html?rec`
], { stdio: ["ignore", "ignore", "pipe"] });

// Chrome prints its DevTools websocket on stderr.
const wsUrl = await new Promise((ok, no) => {
  let buf = "";
  chrome.stderr.on("data", d => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\S+)/);
    if (m) ok(m[1]);
  });
  setTimeout(() => no(new Error("Chrome did not start")), 20000);
});
const { webSocketDebuggerUrl } = await fetch(wsUrl.replace(/^ws/, "http").replace(/\/devtools\/browser\/.*/, "/json/list"))
  .then(r => r.json()).then(l => l.find(t => t.type === "page"));

const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise(ok => ws.onopen = ok);
let id = 0;
const send = (method, params) => ws.send(JSON.stringify({ id: ++id, method, params }));
// wait for the page to finish loading before injecting the job
await new Promise(ok => setTimeout(ok, 1500));
console.log("Rendering stills, then recording ~21 s in real time...");
send("Runtime.evaluate", { expression: job });

const err = await Promise.race([
  finished,
  new Promise(ok => setTimeout(() => ok("timed out after 3 minutes"), 180000))
]);
ws.close(); chrome.kill(); server.close();
if (err) { console.error("Failed:", err); process.exit(1); }
console.log("Done.");
