(function () {
  "use strict";

  // Kramdown renders footnotes as `<sup id="fnref:x"><a href="#fn:x" class="footnote">`
  // inline, and `<li id="fn:x">` in a `.footnotes` list at the bottom of the post.
  // This just decorates that existing markup with a hover/focus tooltip.

  var tooltip;

  function buildTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "footnote-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
  }

  function show(link) {
    var targetId = (link.getAttribute("href") || "").slice(1);
    var target = targetId && document.getElementById(targetId);
    if (!target) return;

    if (!tooltip) buildTooltip();
    tooltip.innerHTML = target.innerHTML;
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

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("a.footnote").forEach(function (link) {
      link.addEventListener("mouseenter", function () { show(link); });
      link.addEventListener("mouseleave", hide);
      link.addEventListener("focus", function () { show(link); });
      link.addEventListener("blur", hide);
    });
  });

  window.addEventListener("scroll", hide, { passive: true });
})();
