/**
 * Design Eagle voice adapter.
 *
 * The browser never sees the ElevenLabs key. The worker mints an HMAC
 * session token, speaks only text that has passed the layout honesty guard,
 * and returns a replacement token with the remaining character budget.
 * The token is not tied to an IP. Phones change address mid-visit, so a
 * mismatch must not end the session. Expiry and the character budget are
 * the limits. Per-IP rate limiting stays a separate check in the worker.
 * Contact fields are not taken by voice: wantsSave() hands those to the form.
 */

import { CONFIG, claimsSent, normalize } from "./eagle-engine.js";

const enc = new TextEncoder();

export function wantsSave(text) {
  const t = normalize(text).replace(/\bi m\b/g, "im");
  if (!t) return false;
  return /\b(save( it| this| the design)?|email( me| it| this)?|e mail|send (it|this|me)|i'm done|im done|i am done|that'?s it|that is it)\b/.test(t);
}

export const HANDOFF = "I'll use the form for your name, email, and phone so I don't mishear them.";

export const VOICE_CAPPED = "Voice time is up for a few minutes, reply is on screen";

/* A session check that failed is retried on the next turn. Success is the
   only state that should stick. A 429 is shown; it is not a permanent mute. */
export function voiceSessionResult(status, data) {
  const body = data && typeof data === "object" ? data : {};
  if (status === 429 || body.capped) {
    return { ok: false, retry: true, capped: true, banner: VOICE_CAPPED };
  }
  if (status === 200 && body.speak && body.token) {
    return { ok: true, retry: false, capped: false, token: body.token, voiceOn: true, banner: "" };
  }
  return { ok: false, retry: true, capped: false, token: "", voiceOn: false, banner: "" };
}

/* play() after an awaited fetch is outside the gesture. NotAllowedError
   means the clip is ready and a tap can start it. */
export function voicePlayResult(err) {
  const name = err && err.name ? err.name : "";
  return {
    hear: true,
    blocked: name === "NotAllowedError",
    banner: name === "NotAllowedError" ? "" : "Voice is paused, reply is on screen"
  };
}

export function guardSpoken(text, allowedSent) {
  const s = String(text || "").trim().slice(0, CONFIG.voiceLimits.maxChars);
  if (!s) return "";
  if (claimsSent(s) && !allowedSent) {
    return "I can't say that was sent. Call " + CONFIG.phoneDisplay + " if it didn't go through.";
  }
  return s;
}

function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return b64url(new Uint8Array(sig));
}

export async function mintVoiceToken(secret, fields) {
  const body = b64url(enc.encode(JSON.stringify(fields)));
  return body + "." + await hmac(secret, body);
}

export async function readVoiceToken(secret, token) {
  const raw = String(token || "");
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = await hmac(secret, body);
  if (expect.length !== sig.length || expect !== sig) return null;
  try {
    const json = new TextDecoder().decode(fromB64url(body));
    const data = JSON.parse(json);
    if (!data || typeof data.exp !== "number" || typeof data.left !== "number") return null;
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function spokenSummary(text) {
  const clean = String(text || "")
    .replace(/\$[\d,]+(?:\.\d+)?/g, "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = clean.split(/(?<=\.)\s+/).filter(sentence => {
    return sentence && !/price on the design|filler panel|build rate covers|no equipment price/i.test(sentence);
  });
  let out = sentences.slice(0, 2).join(" ");
  if (out.length > 250) out = out.slice(0, 247).replace(/\s+\S*$/, "").replace(/\.+$/, "") + ".";
  if (out && !/[.!?]$/.test(out)) out += ".";
  return out;
}

export function newVoiceSession() {
  const now = Date.now();
  return {
    exp: now + CONFIG.voiceLimits.sessionMs,
    left: CONFIG.voiceLimits.sessionChars,
    gen: 0
  };
}

export function spendVoiceSession(session, chars) {
  const n = Math.max(0, Math.round(chars) || 0);
  if (!session || n > session.left || n > CONFIG.voiceLimits.maxChars) return null;
  return { exp: session.exp, left: session.left - n, gen: session.gen || 0 };
}
