(function () {
  "use strict";

  // Kramdown renders footnotes as `<sup id="fnref:x"><a href="#fn:x" class="footnote">`
  // inline, and `<li id="fn:x">` in a `.footnotes` list at the bottom of the post.
  // This just decorates that existing markup with a hover/focus tooltip.

  var tooltip;

  function buildTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "footnote-tooltip hover-tooltip";
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

    // Keep it on-screen vertically -- flip below the cursor if there's no room above.
    var minTop = window.scrollY + 8;
    if (top < minTop) {
      top = window.scrollY + clientY + OFFSET;
    }

    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
  }

  function show(link, clientX, clientY) {
    var targetId = (link.getAttribute("href") || "").slice(1);
    var target = targetId && document.getElementById(targetId);
    if (!target) return;

    if (!tooltip) buildTooltip();
    tooltip.innerHTML = target.innerHTML;
    tooltip.hidden = false;
    position(clientX, clientY);
  }

  function hide() {
    if (tooltip) tooltip.hidden = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("a.footnote").forEach(function (link) {
      link.addEventListener("mouseenter", function (e) { show(link, e.clientX, e.clientY); });
      link.addEventListener("mousemove", function (e) { if (tooltip && !tooltip.hidden) position(e.clientX, e.clientY); });
      link.addEventListener("mouseleave", hide);
      link.addEventListener("focus", function () {
        var linkRect = link.getBoundingClientRect();
        show(link, linkRect.left, linkRect.bottom);
      });
      link.addEventListener("blur", hide);
    });
  });

  window.addEventListener("scroll", hide, { passive: true });
})();
