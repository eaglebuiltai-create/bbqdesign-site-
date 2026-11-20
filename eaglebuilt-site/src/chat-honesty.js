/**
 * The chat cannot send mail, draw a design, or put a person on the job.
 * Anything the model says that claims otherwise is replaced before the
 * visitor sees it. A saved lead is the only success, and even then the
 * reply is that the team will follow up — not that a design was emailed.
 */

export const DESIGNER_URL = "https://eaglebuilt.ai/design/";
export const PHONE = "(916) 359-9692";

export const SAVED_REPLY = "Your request went to the EagleBuilt team, and they will follow up. You can try a layout now at " + DESIGNER_URL;

export const FAILED_REPLY = "That didn't go through. Call " + PHONE + ".";

export const ASK_REPLY = "I can't send a design or an email from this chat. To have the EagleBuilt team follow up, I need your name, phone, email, and city, and the layout you want. You can try a layout now at " + DESIGNER_URL + ".";

const CLAIMS = [
  /\b(i|we)(?:'ll| will| just| have|'ve)?\s+(?:just\s+)?(?:sent|emailed|mailed|scheduled)\b/i,
  /\b(?:has been|was|have been)\s+sent\b/i,
  /\bsent exactly\b/i,
  /\bemail(?:ed)?\s+(?:it|you|that|the|a|your)\b/i,
  /\bcheck your inbox\b/i,
  /\bhit your inbox\b/i,
  /\bputting it together\b/i,
  /\bput together\b/i,
  /\bdesigner\b.{0,80}\b(?:put|working|is putting)\b/i,
  /\bhave (?:one of )?(?:our |a )?designer/i,
  /\bin the next\b/i,
  /\bwithin the next\b/i,
  /\bcouple of hours\b/i,
  /\bfew minutes\b/i,
  /\bexactly as[- ]is\b/i
];

export function claimsUnperformedWork(text) {
  const s = String(text || "");
  return CLAIMS.some(re => re.test(s));
}

/**
 * saved: a lead was kept this turn (or it was already kept).
 * failed: a submit was attempted and nothing was kept.
 * Otherwise a false claim is rewritten into a request for the lead details.
 */
export function visitorReply(text, state) {
  const s = state || {};
  if (s.saved) return SAVED_REPLY;
  if (s.failed) return FAILED_REPLY;
  if (claimsUnperformedWork(text)) return ASK_REPLY;
  return String(text || "");
}
