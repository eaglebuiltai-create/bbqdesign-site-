/* ==========================================================================
   EAGLEBUILT AI — EMAIL SANITY CHECK
   --------------------------------------------------------------------------
   Used by every form that asks for an email to open a designer: /design/ and
   the gates on the kitchen, fire pit, fireplace and backyard tools.

   It never blocks anyone for good. A likely typo ("gmial.com") or a placeholder
   ("test@test.com", a throwaway inbox) gets ONE message; submitting the same
   address again lets it through. Honest typos cost more real leads than fakes
   do, so the typo fix is one tap.

   Optional by design: each page calls it as
     if (window.EBEmailCheck && !EBEmailCheck.gate(email, input, errEl)) return;
   so if this file fails to load, the forms work exactly as before.
   ========================================================================== */
(function () {
  var TYPOS = {
    "gmail.com":   ["gmial.com","gmai.com","gmal.com","gamil.com","gnail.com","gmaill.com","gmail.co","gmail.cm","gmail.con","gmail.om","gmail.comm","gmail.cmo","gmail.ocm","gmsil.com","gmeil.com","gmail.c","gmali.com","gimail.com"],
    "yahoo.com":   ["yaho.com","yahooo.com","yhoo.com","yahoo.con","yahoo.cm","yahoo.om","yhaoo.com","yahho.com","yahoo.comm"],
    "hotmail.com": ["hotmial.com","hotmai.com","hotmal.com","hotmail.con","hotmail.co","hotmali.com","hotamil.com","hotmail.cm","homail.com"],
    "outlook.com": ["outlok.com","outloo.com","outlook.con","outllook.com","otlook.com","outlook.co"],
    "icloud.com":  ["iclod.com","icoud.com","icloud.con","iclound.com","icluod.com","icloud.co"],
    "aol.com":     ["aol.con","aol.co","aoll.com"],
    "comcast.net": ["comcast.ne","comcast.nt","comcat.net"],
    "sbcglobal.net": ["sbcglobal.com","sbcgloble.net","sbcglobal.ne","sbcglobl.net"],
    "att.net":     ["att.ne","att.nt"]
  };
  var FIX = {};
  Object.keys(TYPOS).forEach(function (good) { TYPOS[good].forEach(function (bad) { FIX[bad] = good; }); });

  var JUNK_DOMAINS = ["example.com","example.org","test.com","test.test","fake.com","fakeemail.com","asdf.com","qwerty.com",
    "abc.com","none.com","nomail.com","noemail.com","email.email","mail.mail",
    "mailinator.com","guerrillamail.com","sharklasers.com","10minutemail.com","tempmail.com","temp-mail.org",
    "yopmail.com","trashmail.com","getnada.com","dispostable.com","maildrop.cc","throwawaymail.com","fakeinbox.com","mailnesia.com"];
  var JUNK_LOCAL = ["test","testing","asdf","asdfg","asdfgh","qwerty","fake","none","noemail","nomail","no","na","n/a",
    "abc","abc123","123","1234","12345","xxx","aaa","sample","example","spam","nope","blah","null","nobody","noone"];

  function check(email) {
    var e = String(email || "").trim().toLowerCase();
    var at = e.lastIndexOf("@");
    if (at < 1) return { ok: true };
    var local = e.slice(0, at), domain = e.slice(at + 1);

    if (FIX[domain]) return { suggest: e.slice(0, at) + "@" + FIX[domain] };
    // Any other domain ending in a mistyped .com
    var m = domain.match(/^(.+)\.(con|cmo|ocm|comm|vom|xom)$/);
    if (m) return { suggest: e.slice(0, at) + "@" + m[1] + ".com" };

    var label = domain.split(".")[0];
    if (JUNK_DOMAINS.indexOf(domain) !== -1 || label.length < 2) return { junk: true };
    if (JUNK_LOCAL.indexOf(local) !== -1) return { junk: true };
    if (/^(.)\1{2,}$/.test(local)) return { junk: true };          // aaa@, xxxx@
    return { ok: true };
  }

  var warned = "";   // the address we already warned about; the same one again goes through

  function gate(email, input, errEl) {
    var r = check(email);
    var key = String(email || "").trim().toLowerCase();
    if (r.ok || warned === key) { warned = ""; return true; }
    warned = key;

    errEl.textContent = "";
    if (r.suggest) {
      errEl.appendChild(document.createTextNode("Did you mean "));
      // A link, not a <button>: the gates style every button in them as the
      // full-width red Start button, which would break this out of the sentence.
      var b = document.createElement("a");
      b.href = "#";
      b.setAttribute("role", "button");
      b.textContent = r.suggest;
      b.style.cssText = "color:inherit;font-weight:700;text-decoration:underline;cursor:pointer";
      b.onclick = function (ev) {
        ev.preventDefault();
        input.value = r.suggest;
        warned = "";
        errEl.style.display = "none";
        input.focus();
      };
      errEl.appendChild(b);
      errEl.appendChild(document.createTextNode("? Tap it to fix, or press the button again to keep what you typed."));
    } else {
      errEl.textContent = "That looks like a placeholder address. We send your design and its itemized budget here, " +
        "so use one you check. Press the button again to continue anyway.";
    }
    errEl.style.display = "block";
    input.focus();
    return false;
  }

  window.EBEmailCheck = { check: check, gate: gate };
})();
