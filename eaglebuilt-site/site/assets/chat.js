/**
 * EagleBuilt site chat.
 * Opt in on any page with: <script src="/assets/chat.js" defer></script>
 * Posts to same-origin /api/chat. No API key lives here.
 */
(function () {
  var STORE = "eb.chat.v1";
  var WELCOME = "Ask about outdoor kitchens or our free 3D designer.";

  function boot() {
    if (!document.body || document.getElementById("eb-chat")) return;

    var style = document.createElement("style");
    style.textContent = [
      "#eb-chat{position:fixed;z-index:80;right:16px;bottom:max(16px,env(safe-area-inset-bottom));",
      "font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
      "color:#E7EEF7}",
      "#eb-chat *{box-sizing:border-box}",
      "#eb-chat-panel{position:absolute;right:0;bottom:62px;width:min(360px,calc(100vw - 32px));",
      "max-height:min(520px,calc(100vh - 110px));display:none;flex-direction:column;",
      "background:#0F1826;border:1px solid #2A3B57;border-radius:14px;",
      "box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden}",
      "#eb-chat.is-open #eb-chat-panel{display:flex}",
      "#eb-chat-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;",
      "background:#0B111C;border-bottom:1px solid #1E2C42}",
      "#eb-chat-head b{display:block;font-size:14px;letter-spacing:.04em;font-weight:800}",
      "#eb-chat-head b i{font-style:normal;color:#E8342B}",
      "#eb-chat-head span{display:block;color:#8DA0B8;font-size:12.5px;font-weight:600}",
      "#eb-chat-x{margin-left:auto;width:32px;height:32px;border-radius:8px;border:1px solid #2A3B57;",
      "background:transparent;color:#8DA0B8;font-size:20px;line-height:1;cursor:pointer}",
      "#eb-chat-x:hover{color:#E7EEF7;background:#16233A}",
      "#eb-chat-log{flex:1;min-width:0;overflow-x:hidden;overflow-y:auto;padding:14px;",
      "display:flex;flex-direction:column;gap:8px;min-height:180px}",
      ".eb-msg{max-width:88%;min-width:0;padding:9px 12px;border-radius:12px;white-space:pre-wrap;",
      "overflow-wrap:anywhere;word-break:break-word;font-size:14.5px}",
      ".eb-msg-bot{align-self:flex-start;background:#0B111C;border:1px solid #1E2C42;color:#E7EEF7}",
      ".eb-msg-user{align-self:flex-end;background:linear-gradient(180deg,#2E9BFF,#1668C4);color:#fff}",
      ".eb-msg-err{align-self:flex-start;background:rgba(231,200,154,.08);border:1px solid rgba(231,200,154,.35);",
      "color:#E7C89A;font-size:13.5px}",
      ".eb-msg-wait{align-self:flex-start;color:#8DA0B8;border:1px solid #1E2C42;background:#0B111C}",
      "#eb-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid #1E2C42;background:#0B111C}",
      "#eb-chat-input{flex:1;min-width:0;padding:10px 12px;border-radius:9px;border:1px solid #2A3B57;",
      "background:#0A121E;color:#E7EEF7;font:inherit;font-size:15px;outline:none}",
      "#eb-chat-input:focus{border-color:#2E9BFF;box-shadow:0 0 0 3px rgba(46,155,255,.16)}",
      "#eb-chat-input::placeholder{color:#5F7391}",
      "#eb-chat-send{border:0;border-radius:9px;padding:10px 14px;font-weight:700;font-size:14px;cursor:pointer;",
      "color:#fff;background:linear-gradient(180deg,#2E9BFF,#1668C4)}",
      "#eb-chat-send:disabled{opacity:.55;cursor:default}",
      "#eb-chat-open{display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;color:#fff;",
      "padding:11px 16px;border-radius:999px;font-weight:700;font-size:14.5px;",
      "background:linear-gradient(180deg,#2E9BFF,#1668C4);box-shadow:0 4px 18px rgba(46,155,255,.32)}",
      "#eb-chat-open:hover{filter:brightness(1.08)}",
      "#eb-chat-open svg{display:block}",
      "@media (max-width:520px){",
      "#eb-chat{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}",
      "#eb-chat-panel{position:fixed;left:12px;right:12px;bottom:max(72px,calc(env(safe-area-inset-bottom) + 60px));width:auto}}",
      "@media (prefers-reduced-motion:reduce){#eb-chat-open{transition:none}}"
    ].join("");
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.id = "eb-chat";
    root.innerHTML =
      '<div id="eb-chat-panel" role="dialog" aria-label="EagleBuilt chat" hidden>' +
        '<div id="eb-chat-head"><div><b>EAGLEBUILT<i> AI</i></b><span>Granite Bay · Sacramento</span></div>' +
        '<button type="button" id="eb-chat-x" aria-label="Close chat">×</button></div>' +
        '<div id="eb-chat-log" role="log" aria-live="polite"></div>' +
        '<form id="eb-chat-form">' +
          '<input id="eb-chat-input" type="text" maxlength="2000" autocomplete="off" ' +
            'placeholder="Ask about a kitchen, fireplace, or fire pit" aria-label="Message">' +
          '<button type="submit" id="eb-chat-send">Send</button>' +
        '</form>' +
      '</div>' +
      '<button type="button" id="eb-chat-open" aria-expanded="false" aria-controls="eb-chat-panel">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H9l-4 4v-4.2A3.5 3.5 0 0 1 5 12.5v-6z"/>' +
        '</svg>' +
        '<span>Chat</span>' +
      '</button>';
    document.body.appendChild(root);

    var panel = document.getElementById("eb-chat-panel");
    var log = document.getElementById("eb-chat-log");
    var form = document.getElementById("eb-chat-form");
    var input = document.getElementById("eb-chat-input");
    var send = document.getElementById("eb-chat-send");
    var openBtn = document.getElementById("eb-chat-open");
    var history = load();
    var pending = false;

    addBubble("bot", WELCOME);
    history.forEach(function (m) { addBubble(m.role === "user" ? "user" : "bot", m.content); });

    function setOpen(on) {
      root.classList.toggle("is-open", on);
      panel.hidden = !on;
      openBtn.setAttribute("aria-expanded", on ? "true" : "false");
      openBtn.querySelector("span").textContent = on ? "Close" : "Chat";
      if (on) {
        log.scrollTop = log.scrollHeight;
        input.focus();
      }
    }

    openBtn.addEventListener("click", function () { setOpen(!root.classList.contains("is-open")); });
    document.getElementById("eb-chat-x").addEventListener("click", function () { setOpen(false); openBtn.focus(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root.classList.contains("is-open")) setOpen(false);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || pending) return;
      input.value = "";
      history.push({ role: "user", content: text });
      history = history.slice(-10);
      save(history);
      addBubble("user", text);
      ask();
    });

    function ask() {
      pending = true;
      send.disabled = true;
      input.disabled = true;
      var wait = addBubble("wait", "…");
      var payload = {
        messages: history.slice(-10).map(function (m) {
          return { role: m.role, content: String(m.content).slice(0, 2000) };
        })
      };
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      }).then(function (res) {
        wait.remove();
        if (res.ok && res.data && typeof res.data.reply === "string" && res.data.reply.trim()) {
          var reply = res.data.reply.trim();
          history.push({ role: "assistant", content: reply });
          history = history.slice(-10);
          save(history);
          addBubble("bot", reply);
        } else {
          addBubble("err", fallback(res.status));
        }
      }).catch(function () {
        wait.remove();
        addBubble("err", fallback(0));
      }).then(function () {
        pending = false;
        send.disabled = false;
        input.disabled = false;
        input.focus();
      });
    }

    function addBubble(kind, text) {
      var el = document.createElement("div");
      el.className = "eb-msg eb-msg-" + (kind === "user" ? "user" : kind === "err" ? "err" : kind === "wait" ? "wait" : "bot");
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function fallback(status) {
      if (status === 503) return "Chat isn’t turned on yet. Email info@eaglebuilt.ai and we’ll help.";
      if (status === 429) return "Too many messages just now. Email info@eaglebuilt.ai or call 916.751.8607.";
      return "That didn’t go through. Email info@eaglebuilt.ai or call 916.751.8607.";
    }

    function load() {
      try {
        var raw = JSON.parse(sessionStorage.getItem(STORE) || "[]");
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (m) {
          return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content;
        }).slice(-10);
      } catch (e) { return []; }
    }
    function save(list) {
      try { sessionStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
    }
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
