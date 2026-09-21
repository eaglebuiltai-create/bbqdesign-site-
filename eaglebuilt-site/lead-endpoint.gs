/**
 * EagleBuilt AI — lead endpoint
 * =============================================================================
 * Receives a lead from the designer, appends it to a Google Sheet, and emails
 * you a readable copy. Free, no third-party service, and you own the data.
 *
 * DEPLOY (about five minutes)
 * ---------------------------------------------------------------------------
 *  1. Go to sheets.new and make a sheet. Name it "EagleBuilt Leads".
 *  2. Extensions -> Apps Script. Delete whatever is in the editor.
 *  3. Paste this whole file in. Save.
 *  4. Set NOTIFY below to the address you want the alerts at.
 *  5. Deploy -> New deployment -> gear icon -> Web app.
 *       Execute as:        Me
 *       Who has access:    Anyone            <-- must be "Anyone", not "Anyone with Google account"
 *  6. Deploy. Authorise when prompted (it will warn the app is unverified —
 *     that is expected for your own script; continue).
 *  7. Copy the Web app URL. It looks like:
 *       https://script.google.com/macros/s/AKfy...../exec
 *  8. Paste it into CONFIG.leadEndpoint in the designer, and set
 *     CONFIG.leadContentType to "text/plain" (Apps Script needs that — see below).
 *
 * WHY text/plain
 * ---------------------------------------------------------------------------
 * A browser sending application/json cross-origin fires a CORS preflight, which
 * Apps Script does not answer, so the POST fails. Sending text/plain keeps it a
 * "simple request" with no preflight. The body is still JSON — we just parse it
 * ourselves below.
 * =============================================================================
 */

var NOTIFY = "info@eaglebuilt.ai";
var SHEET  = "Leads";

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var d = {};
    try { d = JSON.parse(raw); } catch (err) { d = { raw: raw }; }

    var sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      d.name || "",
      d.email || "",
      d.phone || "",
      d.zip || "",
      d.timeline || "",
      d.estimate || "",
      d.notes || "",
      d.design_link || "",
      d.page || "",
      d.spec || ""
    ]);

    notify_(d);
    return json_({ ok: true });
  } catch (err) {
    // Still return 200 so the designer does not queue an endless retry on a
    // permanent error; the failure is recorded in the sheet's execution log.
    return json_({ ok: false, error: String(err) });
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return json_({ ok: true, service: "EagleBuilt lead endpoint" });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(["Received", "Name", "Email", "Phone", "ZIP", "Timeline",
                  "Estimate", "Notes", "Design link", "Page", "Full spec"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function notify_(d) {
  var money = d.estimate ? "$" + Math.round(d.estimate).toLocaleString() : "—";
  var subject = "New outdoor kitchen design — " + (d.name || "no name") + " (" + money + ")";
  var body =
    "Name:      " + (d.name || "—") + "\n" +
    "Email:     " + (d.email || "—") + "\n" +
    "Phone:     " + (d.phone || "—") + "\n" +
    "ZIP:       " + (d.zip || "—") + "\n" +
    "Timeline:  " + (d.timeline || "—") + "\n" +
    "Estimate:  " + money + "\n\n" +
    "Notes:\n" + (d.notes || "—") + "\n\n" +
    "REOPEN THEIR DESIGN:\n" + (d.design_link || "—") + "\n\n" +
    "----------------------------------------------------------------\n" +
    (d.spec || "");
  MailApp.sendEmail({
    to: NOTIFY,
    subject: subject,
    body: body,
    replyTo: d.email || undefined      // hit reply and it goes straight to the customer
  });
}

function json_(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
