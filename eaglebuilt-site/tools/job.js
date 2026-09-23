(async () => {
  const log = m => fetch("/__log?msg=" + encodeURIComponent(m));
  const shot = (name, cv) => new Promise(ok =>
    cv.toBlob(b => fetch("/__save?name=" + name, { method: "POST", body: b }).then(ok), "image/png"));
  const wait = ms => new Promise(ok => setTimeout(ok, ms));
  try {
    for (let i = 0; i < 100 && !window.__EB; i++) await wait(100);
    const EB = window.__EB;
    EB.fit(); EB.refresh(); await wait(300);

    // no bar at all: the radius must do nothing
    EB.applyShape("straight");
    EB.S.bar.on = false; EB.S.counterR = 5.3;
    EB.refresh(); await wait(250);
    const noBar = EB.takeoff();
    EB.S.counterR = 0; EB.refresh(); await wait(250);
    const noBarSq = EB.takeoff();
    await log("  no bar: round " + noBar.counterSqft.toFixed(2) +
              " vs square " + noBarSq.counterSqft.toFixed(2) + " sqft (want equal)");

    // John's U: bar off on the left leg. That leg's outer corners stay square,
    // the corners on the two runs that carry the bar get the bucket.
    EB.applyShape("yu");
    EB.S.bar.on = true; EB.S.bar.rise = 0; EB.S.bar.oh = 12; EB.S.counterR = 5.3;
    const legs = EB.runs().filter(r => !r.horiz).sort((a,b) => a.mods[0].x - b.mods[0].x);
    legs[0].mods.forEach(m => m.nb = 1);
    EB.refresh(); await wait(300);
    EB.setView("2d"); EB.refresh(); await wait(600);
    await shot("mixed-2d.png", document.getElementById("c2d"));
    EB.setView("3d"); EB.set3d(0.62, 0.85);
    EB.refresh(); await wait(900);
    await shot("mixed-3d.png", document.getElementById("c3d"));
    EB.S.counterR = 0; EB.refresh(); await wait(800);
    await shot("mixed-3d-square.png", document.getElementById("c3d"));
    await fetch("/__done");
  } catch (e) {
    await fetch("/__done?err=" + encodeURIComponent(e.message + " | " + e.stack));
  }
})();
