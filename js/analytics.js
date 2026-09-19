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

  function track() {
    if (shouldSkip()) return;
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
})();
