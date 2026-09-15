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

  var OFFSET = 16;

  function position(clientX, clientY) {
    var tipRect = tooltip.getBoundingClientRect();
    var top = window.scrollY + clientY - tipRect.height - OFFSET;
    var left = window.scrollX + clientX + OFFSET;

    // Keep it on-screen horizontally.
    var minLeft = window.scrollX + 8;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - tipRect.width - 8;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Keep it on-screen vertically - flip below the cursor if there's no room above.
    var minTop = window.scrollY + 8;
    if (top < minTop) {
      top = window.scrollY + clientY + OFFSET;
    }

    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function show(link, clientX, clientY) {
    if (!tooltip) buildTooltip();
    tooltip.textContent = link.hostname.replace(/^www\./, "") + " ↗";
    tooltip.hidden = false;
    position(clientX, clientY);
  }

  function hide() {
    if (tooltip) tooltip.hidden = true;
  }

  // Wires up every external link under `root` (default: the whole
  // document). Exposed on window so content inserted after this script
  // runs (e.g. a decrypted post body in encrypted-post.js) can be
  // wired up too, which running at load time would fail at.
  function wireExternalLinks(root) {
    (root || document).querySelectorAll("a[href]").forEach(function (link) {
      if (link.dataset.externalWired) return;

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
      link.dataset.externalWired = "true";

      link.addEventListener("mouseenter", function (e) { show(link, e.clientX, e.clientY); });
      link.addEventListener("mousemove", function (e) { if (tooltip && !tooltip.hidden) position(e.clientX, e.clientY); });
      link.addEventListener("mouseleave", hide);
      link.addEventListener("focus", function () {
        var linkRect = link.getBoundingClientRect();
        show(link, linkRect.left, linkRect.bottom);
      });
      link.addEventListener("blur", hide);
    });
  }

  wireExternalLinks(document);
  window.addEventListener("scroll", hide, { passive: true });

  window.wireExternalLinks = wireExternalLinks;
})();
