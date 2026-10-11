/* "Add to home screen" for phones. The site installs as an app (see
   /manifest.webmanifest): an icon on the home screen that opens full screen.
   This offers it once, quietly, and never again for 30 days after a dismiss.

   Android Chrome: hands us an install prompt (beforeinstallprompt); the banner's
   button opens it. iPhone Safari has no prompt, so the banner says how: Share,
   then Add to Home Screen. Nothing shows on desktop, inside the installed app,
   or in the designer itself, where screen room matters most. No service worker:
   the installed app always loads the live site, so a deploy is never stale. */
(function () {
  var KEY = 'eb-install-dismissed';
  var DAYS = 30;

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var phone = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  var inDesigner = /^\/design\/app\//.test(location.pathname);
  var dismissedAt = Number(store(function (s) { return s.getItem(KEY); }) || 0);
  if (standalone || !phone || inDesigner || Date.now() - dismissedAt < DAYS * 864e5) return;

  var ua = navigator.userAgent;
  var iosSafari = /iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  var deferred = null;

  function dismiss(bar) {
    store(function (s) { s.setItem(KEY, String(Date.now())); });
    bar.remove();
  }

  function show(text, action) {
    if (document.getElementById('eb-install')) return;
    var bar = document.createElement('div');
    bar.id = 'eb-install';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Add EagleBuilt to your home screen');
    bar.style.cssText =
      'position:fixed;z-index:79;left:12px;right:12px;bottom:max(76px,calc(env(safe-area-inset-bottom) + 64px));' +
      'display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:14px;' +
      'background:#0F1826;border:1px solid #2A3B57;box-shadow:0 10px 30px rgba(0,0,0,.45);' +
      'color:#E7EEF7;font:15px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    var icon = document.createElement('img');
    icon.src = '/assets/app/icon-192.png';
    icon.alt = '';
    icon.style.cssText = 'width:40px;height:40px;border-radius:10px;flex:none';
    var msg = document.createElement('div');
    msg.style.cssText = 'flex:1;min-width:0';
    msg.innerHTML = text;
    bar.appendChild(icon);
    bar.appendChild(msg);
    if (action) {
      var go = document.createElement('button');
      go.type = 'button';
      go.textContent = 'Install';
      go.style.cssText = 'flex:none;border:0;border-radius:10px;padding:10px 14px;background:#2E9BFF;color:#fff;font:600 15px system-ui,sans-serif';
      go.onclick = function () { action(bar); };
      bar.appendChild(go);
    }
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Not now');
    close.textContent = '×';
    close.style.cssText = 'flex:none;border:0;background:none;color:#8DA0B8;font-size:26px;line-height:1;padding:4px 6px';
    close.onclick = function () { dismiss(bar); };
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  // Wait a little, so the offer never covers the page someone just arrived to read.
  var DELAY = 12000;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    setTimeout(function () {
      show('<b>Get the EagleBuilt app</b><br><span style="color:#8DA0B8">Free. Opens full screen from your home screen.</span>', function (bar) {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function () { dismiss(bar); });
        deferred = null;
      });
    }, DELAY);
  });

  window.addEventListener('appinstalled', function () {
    var bar = document.getElementById('eb-install');
    if (bar) dismiss(bar);
  });

  if (iosSafari) {
    setTimeout(function () {
      show('<b>Add EagleBuilt to your home screen</b><br><span style="color:#8DA0B8">Tap Share <span aria-hidden="true">↑</span>, then “Add to Home Screen”.</span>');
    }, DELAY);
  }
})();
