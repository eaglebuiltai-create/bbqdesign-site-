/**
 * Design Eagle page.
 * Typed turns and a future voice transcript both call applyTurn(), which
 * runs the same layout engine. The 3D view is the existing designer.
 */
import { CONFIG, interpret, summaryReply, validateContact, claimsSent } from "./eagle-engine.js";
import { HANDOFF, wantsSave } from "./eagle-voice.js";

const state = {
  spec: null,
  code: "",
  link: "",
  openedAt: Date.now(),
  frameReady: false,
  price: null,
  voiceToken: "",
  voiceOn: false,
  pendingRefine: null,
  heard: ""
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

function addMsg(role, text) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
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
  log.scrollTop = log.scrollHeight;
}

function showDesign(code) {
  state.code = code;
  empty.hidden = true;
  frame.hidden = false;
  book.hidden = false;
  const saveBtn = document.getElementById("openSave");
  if (saveBtn) saveBtn.hidden = false;
  const src = CONFIG.designer.appPath + "?" + CONFIG.designer.eagleParam + "#d=" + code;
  if (!state.frameReady) frame.src = src;
  else frame.contentWindow.postMessage({ source: "design-eagle", type: "load", code }, location.origin);
  try { sessionStorage.setItem("de:" + code, JSON.stringify(state.spec)); } catch (e) {}
  if (location.hash !== "#d=" + code) history.replaceState(null, "", "#d=" + code);
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
  if (data.type === "ready" || data.type === "loaded") {
    state.frameReady = true;
    if (data.total) showPrice(data.total);
  }
});

async function applyTurn(text, source) {
  const clean = String(text || "").trim();
  if (!clean) return;
  addMsg("user", clean);
  if (state.spec && wantsSave(clean)) {
    openSaveForm();
    return;
  }
  let result = interpret(clean, state.spec);
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
  if (result.spec && result.code) {
    state.spec = result.spec;
    state.link = result.link || "";
    showDesign(result.code);
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
  book.scrollIntoView({ block: "nearest" });
  if (data && data.leadSubmitted && window.ebTrack) {
    window.ebTrack("design_lead", { tool: "Design Eagle" });
  }
}

function openChat() { document.body.classList.add("chat-open"); }
function closeChat() { document.body.classList.remove("chat-open"); }

paintBrand();
const saveBtn = document.createElement("button");
saveBtn.type = "button";
saveBtn.className = "secondary";
saveBtn.id = "openSave";
saveBtn.textContent = "Save";
saveBtn.hidden = true;
document.querySelector(".composer").appendChild(saveBtn);
saveBtn.addEventListener("click", () => openSaveForm());

openChat();
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
document.getElementById("showChat").addEventListener("click", openChat);
document.getElementById("hideChat").addEventListener("click", closeChat);

window.DesignEagle = {
  applyTurn,
  getState: () => ({ spec: state.spec, code: state.code, link: state.link }),
  config: CONFIG
};

async function ensureVoice() {
  if (state.voiceToken || state.voiceChecked) return;
  state.voiceChecked = true;
  try {
    const res = await fetch("/api/design-eagle/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!res.ok) return;
    const data = await res.json();
    state.voiceOn = !!data.speak;
    state.voiceToken = data.token || "";
    if (!data.speak) live.textContent = "Voice playback isn't set up. You can keep typing, and hold to talk if the mic is allowed.";
  } catch (e) {}
}

async function speak(text, grant) {
  if (!state.voiceOn || !state.voiceToken || !text) return;
  stopTalking();
  try {
    const res = await fetch("/api/design-eagle/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.voiceToken, text, grant: grant || "" })
    });
    const next = res.headers.get("X-Voice-Token");
    if (next) state.voiceToken = next;
    if (!res.ok) {
      if (res.status === 429 || res.status === 401) {
        state.voiceOn = false;
        live.hidden = false;
        live.textContent = "Voice time is up for this visit. You can keep typing.";
      }
      return;
    }
    const blob = await res.blob();
    audio.src = URL.createObjectURL(blob);
    audio.play().catch(() => {});
  } catch (e) {}
}

function wireMic() {
  const mic = document.getElementById("mic");
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let media = null;
  let chunks = [];

  async function start(e) {
    e.preventDefault();
    stopTalking();
    await ensureVoice();
    live.hidden = false;
    live.textContent = "Listening…";
    mic.textContent = "Listening…";
    if (Rec) {
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
      rec.onend = () => {
        const said = state.heard;
        state.heard = "";
        rec = null;
        live.hidden = !said;
        if (said) applyTurn(said, "voice");
      };
      rec.onerror = () => { live.textContent = "The mic didn't start. You can type instead."; };
      try { rec.start(); } catch (err) { live.textContent = "The mic didn't start. You can type instead."; }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      media = new MediaRecorder(stream);
      media.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
        const body = new FormData();
        body.set("audio", blob, "speech.webm");
        live.textContent = "Hearing that…";
        try {
          const res = await fetch("/api/design-eagle/voice/transcribe", { method: "POST", body });
          const data = await res.json();
          if (data.text) applyTurn(data.text, "voice");
          else live.textContent = data.error || "I didn't catch that. You can type it.";
        } catch (err) {
          live.textContent = "I didn't catch that. You can type it.";
        }
      };
      media.start();
    } catch (err) {
      live.textContent = "The mic didn't start. You can type instead.";
    }
  }

  function stop() {
    mic.textContent = "Hold to talk";
    if (rec) {
      try { rec.stop(); } catch (e) {}
    } else if (media && media.state === "recording") {
      media.stop();
    }
  }

  mic.addEventListener("pointerdown", start);
  mic.addEventListener("pointerup", stop);
  mic.addEventListener("pointercancel", stop);
  mic.addEventListener("pointerleave", (e) => { if (e.buttons) stop(); });
}

wireMic();
