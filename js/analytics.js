(function () {
  const VID_KEY = "shr_visitor_id";

  function visitorId() {
    try {
      let id = localStorage.getItem(VID_KEY);
      if (!id) {
        id =
          "v" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 10);
        localStorage.setItem(VID_KEY, id);
      }
      return id;
    } catch {
      return "anon";
    }
  }

  function shouldSkip() {
    const path = location.pathname || "/";
    return /^\/admin/i.test(path) || /^\/client/i.test(path);
  }

  let lastTrack = 0;

  function track() {
    if (shouldSkip()) return;
    const now = Date.now();
    if (now - lastTrack < 2000) return;
    lastTrack = now;
    fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "visit",
        visitorId: visitorId(),
        path: location.pathname + (location.search || ""),
        referrer: document.referrer || "",
      }),
      keepalive: true,
    }).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", track);
  } else {
    track();
  }
  window.addEventListener("pageshow", track);
})();
