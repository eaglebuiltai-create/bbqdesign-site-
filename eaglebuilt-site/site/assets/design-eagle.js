/**
 * Design Eagle page.
 * Typed turns and a future voice transcript both call applyTurn(), which
 * runs the same layout engine. The 3D view is the existing designer.
 */
import { CONFIG, interpret, summaryReply, validateContact, claimsSent, classifyTurn, usableTranscript, holdLongEnough, prefersScribe, originPath } from "./eagle-engine.js";
import { HANDOFF, spokenSummary, wantsSave, voiceSessionResult, voicePlayResult, VOICE_CAPPED } from "./eagle-voice.js";

const state = {
  spec: null,
  code: "",
  link: "",
  openedAt: Date.now(),
  /* The page that sent them here, read once at load. Read later and a share
     link or a back button could have rewritten the query out from under us. */
  from: (function () {
    try { return originPath(new URLSearchParams(location.search).get("from")); }
    catch (err) { return ""; }
  })(),
  frameReady: false,
  price: null,
  voiceToken: "",
  voiceOn: false,
  pendingRefine: null,
  heard: "",
  prevText: "",
  listening: false
};

const log = document.getElementById("log");
const frame = document.getElementById("designer");
const empty = document.getElementById("empty");
const book = document.getElementById("book");
const live = document.getElementById("live");
const audio = new Audio();

function money(total) {
  return "$" + Math.round(total).toLocaleString("en-US");
}

function stopTalking() {
  audio.pause();
  try { audio.removeAttribute("src"); } catch (e) {}
}

function paintBrand() {
  const c = CONFIG.colors;
  const root = document.documentElement;
  Object.entries({
    "--bg": c.bg, "--bg2": c.bg2, "--panel": c.panel, "--line": c.line,
    "--text": c.text, "--muted": c.muted, "--dim": c.dim,
    "--accent": c.accent, "--accent2": c.accent2, "--hot": c.hot
  }).forEach(([key, value]) => root.style.setProperty(key, value));
  const phone = document.getElementById("phoneLink");
  phone.textContent = CONFIG.phoneDisplay;
  phone.href = "tel:" + CONFIG.phoneTel;
  document.getElementById("bookTitle").textContent = CONFIG.booking.label;
  document.getElementById("bookPending").textContent = CONFIG.booking.enabled && CONFIG.booking.url
    ? ""
    : CONFIG.booking.pending;
  const bookPhone = document.getElementById("bookPhone");
  bookPhone.textContent = CONFIG.phoneDisplay;
  bookPhone.href = CONFIG.booking.enabled && CONFIG.booking.url ? CONFIG.booking.url : "tel:" + CONFIG.phoneTel;
  if (location.search.indexOf("embed=1") !== -1) document.body.dataset.embed = "1";
}

function revealLatest() {
  log.scrollTop = log.scrollHeight;
  const thread = log.closest(".thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function addMsg(role, text) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.textContent = text;
  log.appendChild(el);
  if (role === "bot") state.lastReply = el;
  revealLatest();
  return el;
}

function showPrice(total) {
  if (!total) return;
  state.price = total;
  const label = "Designer price: " + money(total) + ". Budget proposal from the catalog and the build rates, not a quote.";
  if (state.pendingRefine) {
    const el = state.pendingRefine;
    const base = el.dataset.base.endsWith(".") ? el.dataset.base : el.dataset.base + ".";
    const line = base + " New design price " + money(total) + ".";
    el.textContent = line;
    state.pendingRefine = null;
    speak(line);
  }
  let price = document.getElementById("livePrice");
  if (!price) {
    price = document.createElement("div");
    price.id = "livePrice";
    price.className = "price";
    log.appendChild(price);
  }
  price.textContent = label;
  revealLatest();
}

function showDesign(code) {
  state.code = code;
  empty.hidden = true;
  frame.hidden = false;
  book.hidden = false;
  const saveBtn = document.getElementById("openSave");
  if (saveBtn) saveBtn.hidden = false;
  const gl = /(?:^|[?&])gl=1(?:&|$)/.test(location.search) ? "&gl=1" : "";
  const src = CONFIG.designer.appPath + "?" + CONFIG.designer.eagleParam + gl + "#d=" + code;
  if (!state.frameReady) frame.src = src;
  else frame.contentWindow.postMessage({ source: "design-eagle", type: "load", code }, location.origin);
  try { sessionStorage.setItem("de:" + code, JSON.stringify(state.spec)); } catch (e) {}
  if (location.hash !== "#d=" + code) history.replaceState(null, "", "#d=" + code);
  const stage = document.querySelector(".stage");
  if (stage && stage.scrollIntoView) stage.scrollIntoView({ block: "start", inline: "nearest" });
}

function requestShot() {
  return new Promise(resolve => {
    if (!state.frameReady || !frame.contentWindow) { resolve(""); return; }
    const timer = setTimeout(() => finish(""), 2500);
    function finish(image) {
      clearTimeout(timer);
      window.removeEventListener("message", onShot);
      resolve(image || "");
    }
    function onShot(e) {
      if (e.origin !== location.origin) return;
      if (!e.data || e.data.source !== "eagle-app" || e.data.type !== "shot") return;
      finish(e.data.image || "");
    }
    window.addEventListener("message", onShot);
    frame.contentWindow.postMessage({ source: "design-eagle", type: "shot" }, location.origin);
  });
}

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  const data = e.data;
  if (!data || data.source !== "eagle-app") return;
  if (data.type === "brand" && data.brand) {
    state.brand = data.brand;
    state.brandExplicit = true;
  }
  if (data.type === "ready" || data.type === "loaded") {
    state.frameReady = true;
    if (data.total) showPrice(data.total);
  }
});

function gearCount(spec) {
  if (!spec || !Array.isArray(spec.legs)) return 0;
  return spec.legs.reduce((n, l) => n + (Array.isArray(l.items) ? l.items.filter(Boolean).length : 0), 0);
}

function wouldWipe(current, result) {
  return !!(current && gearCount(current) && result.kind !== "refine" && !gearCount(result.spec));
}

function noteMiss(body) {
  try {
    fetch("/api/design-eagle/miss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => {});
  } catch (e) {}
}

function clearLive() {
  if (state.listening) return;
  live.hidden = true;
  live.textContent = "";
}

async function applyTurn(text, source) {
  const clean = String(text || "").trim();
  try {
    if (!clean) return;
    addMsg("user", clean);
    if (state.spec && wantsSave(clean)) {
      openSaveForm();
      return;
    }
    const before = state.spec ? JSON.parse(JSON.stringify(state.spec)) : null;
    let result = interpret(clean, state.spec, {
      brand: state.brandExplicit ? state.brand : "",
      brandExplicit: !!state.brandExplicit
    });
    state.brandExplicit = false;
    if (!result.handled) {
      try {
        const res = await fetch("/api/design-eagle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: clean, spec: state.spec, source: source || "typed" })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) result = data;
        }
      } catch (e) {}
    }
    let reply = String(result.reply || "");
    if (claimsSent(reply)) {
      reply = "I'll keep the drawing here. Call " + CONFIG.phoneDisplay + " if you'd rather talk it through.";
    }
    if (result.spec && result.code && !wouldWipe(state.spec, result)) {
      state.link = result.link || state.link;
      const same = result.code === state.code;
      state.spec = result.spec;
      if (!same) showDesign(result.code);
    }
    const el = addMsg("bot", reply);
    if (result.kind === "refine") {
      el.dataset.base = reply.replace(/\.$/, "");
      state.pendingRefine = el;
      setTimeout(() => {
        if (state.pendingRefine === el) {
          state.pendingRefine = null;
          speak(el.textContent);
        }
      }, 1800);
    } else if (source === "voice" || state.voiceOn) {
      speak(reply);
    }
    const kind = classifyTurn(clean, reply, before, state.spec, state.prevText);
    state.prevText = clean;
    if (kind) {
      noteMiss({
        text: clean,
        reply,
        kind,
        specBefore: before,
        specAfter: state.spec,
        source: source === "voice" ? "voice" : "typed",
        ts: Date.now()
      });
    }
  } finally {
    if (source === "voice") clearLive();
  }
}

function openSaveForm() {
  if (!state.spec) {
    addMsg("bot", "Describe an island first, then you can save it.");
    return;
  }
  addMsg("bot", summaryReply(state.spec));
  addMsg("bot", HANDOFF);
  speak(HANDOFF);
  document.getElementById("composer").hidden = true;
  document.getElementById("save").hidden = false;
  document.getElementById("name").focus();
}

async function onSave(event) {
  event.preventDefault();
  const err = document.getElementById("saveErr");
  const body = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    zip: document.getElementById("zip").value,
    city: document.getElementById("city").value,
    notes: document.getElementById("notes").value,
    hp: document.getElementById("hp").value,
    t: state.openedAt,
    from: state.from,
    spec: state.spec
  };
  const checked = validateContact(body);
  if (!checked.ok) {
    err.hidden = false;
    err.textContent = checked.message;
    const field = document.getElementById(checked.field);
    if (field) field.focus();
    return;
  }
  err.hidden = true;
  const button = document.getElementById("saveGo");
  button.disabled = true;
  button.textContent = "Sending…";
  body.image = await requestShot();
  let data = null;
  try {
    const res = await fetch("/api/design-eagle/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    data = await res.json();
  } catch (e) {
    data = { reply: "That didn't go through. Call " + CONFIG.phoneDisplay + ".", emailConfirmed: false, leadSubmitted: false };
  }
  button.disabled = false;
  button.textContent = "Email me this design";
  const reply = data && data.reply ? data.reply : "That didn't go through. Call " + CONFIG.phoneDisplay + ".";
  addMsg("bot", claimsSent(reply) && !(data && data.emailConfirmed) ? "That didn't go through. Call " + CONFIG.phoneDisplay + "." : reply);
  if (data && data.emailConfirmed) speak(reply, data.voiceGrant);
  else speak(claimsSent(reply) ? "" : reply);
  document.getElementById("save").hidden = true;
  document.getElementById("composer").hidden = false;
  book.hidden = false;
  revealLatest();
  if (data && data.leadSubmitted && window.ebTrack) {
    window.ebTrack("design_lead", { tool: "Design Eagle" });
  }
}

paintBrand();
const saveBtn = document.createElement("button");
saveBtn.type = "button";
saveBtn.className = "secondary";
saveBtn.id = "openSave";
saveBtn.textContent = "Save";
saveBtn.hidden = true;
document.querySelector(".composer").appendChild(saveBtn);
saveBtn.addEventListener("click", () => openSaveForm());

addMsg("bot", "Describe the island you want. For example: L-shape, 10 ft grill leg with a side burner and a fridge, 5 ft bar with 3 stools.");

const hash = location.hash.match(/^#d=(.+)$/);
if (hash) {
  try { state.spec = JSON.parse(sessionStorage.getItem("de:" + hash[1]) || "null"); } catch (e) {}
  showDesign(hash[1]);
  addMsg("bot", state.spec
    ? "This link reopened your design. Tell me what to change."
    : "This link reopened the design. Tell me the change in a full sentence if you want me to redraw a leg.");
}

document.getElementById("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("text");
  const text = input.value;
  input.value = "";
  applyTurn(text, "typed");
});
document.getElementById("save").addEventListener("submit", onSave);
document.getElementById("saveBack").addEventListener("click", () => {
  document.getElementById("save").hidden = true;
  document.getElementById("composer").hidden = false;
});

window.DesignEagle = {
  applyTurn,
  getState: () => ({ spec: state.spec, code: state.code, link: state.link }),
  config: CONFIG
};

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function primeAudio() {
  if (state.audioReady) return;
  const playing = audio.src && !audio.paused && audio.currentTime > 0;
  if (playing) { state.audioReady = true; return; }
  audio.src = SILENT_WAV;
  const started = audio.play();
  if (started && started.then) {
    started.then(() => {
      audio.pause();
      state.audioReady = true;
    }).catch(() => {});
  }
}

function showBanner(text) {
  if (!text) return;
  live.hidden = false;
  live.textContent = text;
}

function hearButton(el, url) {
  if (!el || !url || el.querySelector(".hear")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hear";
  btn.textContent = "Tap to hear";
  btn.addEventListener("click", () => {
    audio.src = url;
    const started = audio.play();
    if (started && started.then) started.then(() => btn.remove()).catch(() => {});
  });
  el.appendChild(btn);
}

async function ensureVoice() {
  if ((state.voiceToken && state.voiceChecked) || state.voiceChecking) return;
  state.voiceChecking = true;
  try {
    const res = await fetch("/api/design-eagle/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    const decided = voiceSessionResult(res.status, data);
    if (!decided.ok) {
      state.voiceChecked = false;
      if (decided.capped) showBanner(decided.banner || VOICE_CAPPED);
      else if (!data.speak && res.ok) showBanner("Voice playback isn't set up. You can keep typing, and hold to talk if the mic is allowed.");
      return;
    }
    state.voiceChecked = true;
    state.voiceOn = !!decided.voiceOn;
    state.voiceToken = decided.token || "";
  } catch (e) {
    state.voiceChecked = false;
  } finally {
    state.voiceChecking = false;
  }
}

function voicePaused(why, banner) {
  console.log("design-eagle voice: " + why);
  if (banner === false) return;
  showBanner(banner || "Voice is paused, reply is on screen");
}

async function speak(text, grant) {
  const summary = spokenSummary(text);
  if (state.listening || !summary) return;
  if (!state.voiceOn || !state.voiceToken) await ensureVoice();
  if (state.listening || !state.voiceOn || !state.voiceToken) return;
  stopTalking();
  try {
    const res = await fetch("/api/design-eagle/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.voiceToken, text: summary, grant: grant || "" })
    });
    const next = res.headers.get("X-Voice-Token");
    if (next) state.voiceToken = next;
    if (state.listening) return;
    if (!res.ok) {
      if (res.status === 429) {
        voicePaused("speak http 429", VOICE_CAPPED);
        return;
      }
      if (res.status === 401) {
        state.voiceToken = "";
        state.voiceChecked = false;
        state.voiceOn = false;
      }
      voicePaused("speak http " + res.status);
      return;
    }
    const blob = await res.blob();
    if (state.listening) return;
    const url = URL.createObjectURL(blob);
    audio.src = url;
    const started = audio.play();
    if (started && started.then) {
      started.catch((err) => {
        const decided = voicePlayResult(err);
        console.log("design-eagle voice: play rejected " + (err && err.name || ""));
        if (decided.hear) hearButton(state.lastReply, url);
        if (decided.banner) showBanner(decided.banner);
      });
    }
  } catch (e) {
    voicePaused("speak failed");
  }
}

function missHint() {
  state.listening = false;
  state.heard = "";
  live.hidden = false;
  live.textContent = "Didn't catch that, hold and talk";
  micLabel("Hold to talk");
}

function micLabel(text) {
  const mic = document.getElementById("mic");
  if (mic) mic.textContent = text;
}

function wireMic() {
  const mic = document.getElementById("mic");
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let media = null;
  let stream = null;
  let chunks = [];
  let aborted = false;
  let startedAt = 0;
  let forceScribe = prefersScribe(navigator.userAgent);

  function useScribe() {
    return forceScribe || !Rec;
  }

  function beginRecorder() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      missHint();
      return;
    }
    const pending = navigator.mediaDevices.getUserMedia({ audio: true });
    pending.then(got => {
      if (aborted) {
        got.getTracks().forEach(track => track.stop());
        state.listening = false;
        return;
      }
      stream = got;
      chunks = [];
      media = new MediaRecorder(stream);
      media.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      media.onstop = () => {
        const tracks = stream ? stream.getTracks() : [];
        tracks.forEach(track => track.stop());
        stream = null;
        const recorded = chunks.slice();
        const type = media && media.mimeType || "audio/webm";
        media = null;
        if (aborted || !holdLongEnough(performance.now() - startedAt)) {
          missHint();
          return;
        }
        finishRecording(recorded, type);
      };
      media.start();
    }).catch(() => missHint());
  }

  async function finishRecording(recorded, type) {
    state.listening = false;
    const blob = new Blob(recorded, { type: type || "audio/webm" });
    if (!blob.size) { missHint(); return; }
    const body = new FormData();
    body.set("audio", blob, prefersScribe(navigator.userAgent) ? "speech.mp4" : "speech.webm");
    live.textContent = "Hearing that…";
    try {
      const res = await fetch("/api/design-eagle/voice/transcribe", { method: "POST", body });
      const data = await res.json();
      const said = usableTranscript(data && data.text);
      if (!said || state.listening) { missHint(); return; }
      applyTurn(said, "voice");
    } catch (err) {
      missHint();
    }
  }

  function start(e) {
    if (e && e.preventDefault) e.preventDefault();
    aborted = false;
    startedAt = performance.now();
    state.listening = true;
    state.heard = "";
    stopTalking();
    try { if (e && mic.setPointerCapture) mic.setPointerCapture(e.pointerId); } catch (err) {}
    live.hidden = false;
    live.textContent = "Listening…";
    mic.textContent = "Listening… release to send";
    ensureVoice();
    if (useScribe()) {
      beginRecorder();
      return;
    }
    try {
      rec = new Rec();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev) => {
        let said = "";
        for (let i = 0; i < ev.results.length; i++) said += ev.results[i][0].transcript;
        live.textContent = said;
        state.heard = said;
      };
      rec.onerror = () => { forceScribe = true; beginRecorder(); };
      rec.onend = () => {
        const heard = state.heard;
        const elapsed = performance.now() - startedAt;
        rec = null;
        if (aborted || !holdLongEnough(elapsed)) { missHint(); return; }
        const said = usableTranscript(heard);
        if (!said && elapsed < 500) {
          forceScribe = true;
          missHint();
          return;
        }
        state.listening = false;
        if (!said) { missHint(); return; }
        applyTurn(said, "voice");
      };
      rec.start();
    } catch (err) {
      forceScribe = true;
      beginRecorder();
    }
  }

  function stop() {
    const elapsed = performance.now() - startedAt;
    if (!holdLongEnough(elapsed)) {
      aborted = true;
      if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
      if (media && media.state === "recording") { try { media.stop(); } catch (e) {} }
      else if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
      missHint();
      return;
    }
    mic.textContent = "Hold to talk";
    if (rec) {
      try { rec.stop(); } catch (e) {}
    } else if (media && media.state === "recording") {
      try { media.stop(); } catch (e) {}
    } else {
      state.listening = false;
    }
  }

  mic.addEventListener("pointerdown", start);
  mic.addEventListener("pointerup", stop);
  mic.addEventListener("pointercancel", stop);
  mic.addEventListener("pointerleave", (e) => { if (e.buttons) stop(); });
}

document.addEventListener("pointerdown", primeAudio);
ensureVoice();
wireMic();
