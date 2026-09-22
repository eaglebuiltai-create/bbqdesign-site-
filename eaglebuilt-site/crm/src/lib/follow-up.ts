/**
 * Follow-up email templates.
 *
 * The confirmation the site already sent this person promises "an itemized
 * budget proposal — usually within one business day". These exist to keep that
 * promise, so the job of every one of them is the same: deliver the number,
 * then ask for the site visit. They do not sell.
 *
 * Bracketed spans are the only things that need a human: availability and the
 * town. Everything else is filled from the lead.
 */

export type FollowUpKey = "budget" | "nudge" | "closeout";

export const SIGNATURE = [
  "John Simpson",
  "EagleBuilt AI",
  "CSLB #992251 — General Contractor & C-29 Masonry",
  "(949) 564-1948",
].join("\n");

export type FollowUpLead = {
  name?: string | null;
  email?: string | null;
  zip?: string | null;
  designSummary?: string | null;
};

/** "Sarah Chen" -> "Sarah". An email or a placeholder name gets a neutral greeting. */
export function firstName(lead: FollowUpLead): string {
  const n = (lead.name || "").trim();
  if (!n || n.includes("@")) return "there";
  const first = n.split(/\s+/)[0];
  // Imported rows can carry a description rather than a person ("First designer-built job").
  if (first.length > 20 || /^(first|sample|test|new)$/i.test(first)) return "there";
  return first;
}

export type FollowUp = { key: FollowUpKey; label: string; when: string; subject: string; body: string };

export function followUps(lead: FollowUpLead): FollowUp[] {
  const hi = firstName(lead);
  const spec = (lead.designSummary || "").trim();

  const budget: FollowUp = {
    key: "budget",
    label: "Itemized budget",
    when: "They sent a finished design. Reply same day.",
    subject: "Your outdoor kitchen — itemized budget",
    body: [
      `Hi ${hi},`,
      "",
      "Thanks for sending your design over. Here is the itemized budget for what you laid out:",
      "",
      spec || "[paste the spec from the lead email]",
      "",
      "Two things worth knowing about that number.",
      "",
      "The island build and the equipment are priced separately, so you can see what a change actually costs. Dropping the fridge, or moving from Blaze to Fire Magic, moves one line rather than the whole total.",
      "",
      "And it is a budget proposal, not a firm quote. What moves it — yard access, grade, where the gas and power have to run — is not visible from a drawing. That is what the site visit is for.",
      "",
      "If that is in the range you expected, I can come out and measure. I am in [town] [day] and [day], and it takes about 45 minutes.",
      "",
      "If it came in higher than you had in mind, tell me the number you were working with and I will show you what fits it.",
      "",
      SIGNATURE,
    ].join("\n"),
  };

  const nudge: FollowUp = {
    key: "nudge",
    label: "Never sent a design",
    when: "They opened a designer and stopped. Give it 2–3 days, send once.",
    subject: "Get stuck on the designer?",
    body: [
      `Hi ${hi},`,
      "",
      "You opened the outdoor kitchen designer the other day but did not send a design through. Just checking whether something got in the way, or the numbers landed higher than you expected.",
      "",
      "In case it helps: the build runs about $275 a linear foot on top of a fixed $3,300, so a 12-foot island is roughly $6,600 before equipment. Shorter costs more per foot, because the fixed part does not shrink. Equipment is quoted separately and you are welcome to supply your own.",
      "",
      `If it is easier, just reply with the length, what you want in it${lead.zip ? "" : " and your ZIP"}, and I will send a budget back the same day.`,
      "",
      "John Simpson",
      "EagleBuilt AI",
      "(949) 564-1948",
    ].join("\n"),
  };

  const closeout: FollowUp = {
    key: "closeout",
    label: "Close it out",
    when: "No reply to the first two. Send once, then stop.",
    subject: "Still happy to help",
    body: [
      `Hi ${hi},`,
      "",
      "Still happy to put a budget together whenever you are ready. If the project is off, no problem at all — just say so and I will leave you alone.",
      "",
      "John Simpson",
      "EagleBuilt AI",
      "(949) 564-1948",
    ].join("\n"),
  };

  // A lead carrying a design gets the budget reply first; one that never sent
  // anything gets the nudge, because there is no design to price.
  return spec ? [budget, nudge, closeout] : [nudge, budget, closeout];
}
