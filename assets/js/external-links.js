(function () {
  "use strict";

  var tooltip;

  function buildTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "external-link-tooltip hover-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
  }

  function show(link) {
    if (!tooltip) buildTooltip();
    tooltip.textContent = link.hostname.replace(/^www\./, "") + " ↗";
    tooltip.hidden = false;

    var linkRect = link.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var top = window.scrollY + linkRect.top - tipRect.height - 8;
    var left = window.scrollX + linkRect.left - tipRect.width / 2 + linkRect.width / 2;

    // Keep it on-screen horizontally.
    var minLeft = window.scrollX + 8;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - tipRect.width - 8;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // If there's no room above, show below instead.
    if (top < window.scrollY + 8) {
      top = window.scrollY + linkRect.bottom + 8;
    }

    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function hide() {
    if (tooltip) tooltip.hidden = true;
  }

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

    link.addEventListener("mouseenter", function () { show(link); });
    link.addEventListener("mouseleave", hide);
    link.addEventListener("focus", function () { show(link); });
    link.addEventListener("blur", hide);
  });

  window.addEventListener("scroll", hide, { passive: true });
})();
