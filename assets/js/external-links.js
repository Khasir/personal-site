(function () {
  "use strict";

  document.querySelectorAll("a[href]").forEach(function (link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (e) {
      return; // unparseable href, leave it alone
    }

    // No hostname (mailto:, tel:, etc.) or same-site -- leave as-is.
    if (!url.hostname || url.hostname === window.location.hostname) return;

    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.classList.add("external-link");
  });
})();
