/* ==========================================================================
   EAGLEBUILT AI — CONVERSION TRACKING
   --------------------------------------------------------------------------
   INERT UNTIL CONFIGURED. With the IDs below left empty, this loads nothing
   from Google and sets no cookie on anyone. Fill them in and every page starts
   reporting at once — nothing else needs touching.

   What gets counted:
     consultation   the free-consultation form was delivered      (/consultation/)
     contact_lead   the contact form was delivered                (/contact/)
     design_lead    a customer sent a finished design             (kitchen designer)
     designer_open  someone gave their email to open a tool       (all four tools)
     phone_click    someone tapped the phone number               (every page)

   Only ever fired on a CONFIRMED success — after the lead has actually been
   delivered — so a failed send can never be counted as a lead.
   ========================================================================== */
(function () {
  var CFG = {
    ga4: "G-1P2Q3CD8TZ",     // Google Analytics 4 measurement ID (set 2026-09-15)
    ads: "AW-18410742850", // Google Ads conversion ID - account 467-487-5109 (set 2026-10-06)
    labels: {              // Google Ads conversion label per action
      /* All four of these point at the one "Lead" action on purpose - see
         the note in CHANGELOG for 2026-10-06. */
      consultation:  "W4LsCKmL35MdEMLI9spE",   // Lead
      contact_lead:  "W4LsCKmL35MdEMLI9spE",   // Lead
      design_lead:   "W4LsCKmL35MdEMLI9spE",   // Lead
      phone_click:   "W4LsCKmL35MdEMLI9spE",   // Lead
      designer_open: "f8gcCKyL35MdEMLI9spE"    // Designer opened
    }
  };

  /* Coarse geography for an opt-in, so a national campaign can be read as
     "how many of these can we actually build for". Deliberately a three-way
     bucket and never the raw ZIP: Google policy forbids sending anything that
     could identify a person, and ZIP alongside an email edges toward that.
       service    - the Sacramento metro we build in
       california - elsewhere in CA, a drive or a partner job
       other      - the rest of the US */
  window.ebArea = function (zip) {
    var z = String(zip || "").replace(/[^0-9]/g, "");
    if (z.length < 3) return "unknown";
    var p = z.slice(0, 3);
    if (p === "956" || p === "957" || p === "958") return "service";
    var n = parseInt(p, 10);
    return (n >= 900 && n <= 961) ? "california" : "other";
  };

  /* A no-op until there is somewhere to send it, so every call site can fire
     unconditionally without checking whether tracking is switched on. */
  window.ebTrack = function () {};

  var tagId = CFG.ga4 || CFG.ads;
  if (!tagId) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  if (CFG.ga4) gtag("config", CFG.ga4);
  if (CFG.ads) gtag("config", CFG.ads);

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(tagId);
  document.head.appendChild(s);

  window.ebTrack = function (name, params) {
    params = params || {};
    try {
      if (CFG.ga4) gtag("event", name, params);
      var label = CFG.labels[name];
      if (CFG.ads && label) gtag("event", "conversion", { send_to: CFG.ads + "/" + label });
    } catch (e) {}
  };

  /* Phone taps, site-wide. For a contractor a call is often the lead, and it
     never passes through a form to be counted any other way. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a) window.ebTrack("phone_click", { page: location.pathname });
  }, true);
})();
