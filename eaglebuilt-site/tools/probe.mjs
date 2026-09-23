// Loads the designer in headless Chrome, builds a U with the bar off on one leg,
// and posts back 3D shots + the slab geometry so the corner can be inspected.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";

const ROOT = "C:/Users/johns/Eaglebuilt AI. Claude/eaglebuilt-site/site";
const OUT = path.join(import.meta.dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TYPES = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

let finish; const finished = new Promise(ok => finish = ok);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/__save") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const name = path.basename(url.searchParams.get("name"));
      fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks));
      console.log("  " + name);
      res.end("ok");
    });
    return;
  }
  if (url.pathname === "/__log") { console.log(url.searchParams.get("msg")); res.end("ok"); return; }
  if (url.pathname === "/__done") { res.end("ok"); finish(url.searchParams.get("err")); return; }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

const job = fs.readFileSync(path.join(import.meta.dirname, "job.js"), "utf8");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eb-probe-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist",
  "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1",
  "--window-size=2000,1400", `--user-data-dir=${profile}`, "--remote-debugging-port=0",
  `http://127.0.0.1:${port}/design/app/index.html`
], { stdio: ["ignore", "ignore", "pipe"] });

const wsUrl = await new Promise((ok, no) => {
  let buf = "";
  chrome.stderr.on("data", d => { buf += d; const m = buf.match(/DevTools listening on (ws:\S+)/); if (m) ok(m[1]); });
  setTimeout(() => no(new Error("Chrome did not start")), 20000);
});
const { webSocketDebuggerUrl } = await fetch(wsUrl.replace(/^ws/, "http").replace(/\/devtools\/browser\/.*/, "/json/list"))
  .then(r => r.json()).then(l => l.find(t => t.type === "page"));
const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise(ok => ws.onopen = ok);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.result?.exceptionDetails) console.error(JSON.stringify(m.result.exceptionDetails.exception)); };
await new Promise(ok => setTimeout(ok, 2500));
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: job } }));

const err = await Promise.race([finished, new Promise(ok => setTimeout(() => ok("timed out"), 90000))]);
ws.close(); chrome.kill(); server.close();
if (err) { console.error("Failed:", err); process.exit(1); }
console.log("Done.");
