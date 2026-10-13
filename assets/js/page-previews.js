(function () {
  "use strict";

  // Hover/focus preview for links to other pages on this site:
  // - title,
  // - subtitle,
  // - part of the first line.
  // The target page is fetched on first hover and parsed, so nothing extra is emitted at build time.
  // Only entries are wired up.

  var tooltip;
  var current; // link the tooltip is (or is about to be) shown for
  var cache = {}; // pathname -> Promise<{title, subtitle, excerpt} | null>

  function buildTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "page-preview-tooltip hover-tooltip";
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

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  // Pulls the preview fields out of a fetched page, or null if it isn't an
  // entry (e.g. a list page, which has no `.entry-heading`).
  function extract(doc) {
    var heading = doc.querySelector(".entry-heading h1");
    if (!heading) return null;

    // Respect that encrypted post subtitles are `hidden`
    var subtitleEl = doc.querySelector(".entry-subtitle");
    var subtitle = subtitleEl && !subtitleEl.hidden ? clean(subtitleEl.textContent) : "";

    // First direct-child paragraph with text -- skips figures, galleries,
    // quotes and details. Footnote markers would otherwise leave stray digits.
    var excerpt = "";
    var paragraphs = doc.querySelectorAll(".entry-content > p");
    for (var i = 0; i < paragraphs.length && !excerpt; i++) {
      var copy = paragraphs[i].cloneNode(true);
      copy.querySelectorAll("sup").forEach(function (sup) { sup.remove(); });
      excerpt = clean(copy.textContent);
    }

    // Encrypted entries carry the shared lock icon in a <template> (entry.html).
    var lockTemplate = doc.querySelector("template[data-lock-icon]");
    var lock = lockTemplate ? document.importNode(lockTemplate.content, true).firstElementChild : null;
    if (lock) lock.removeAttribute("title"); // no tooltip inside a tooltip

    return { title: clean(heading.textContent), subtitle: subtitle, excerpt: excerpt, lock: lock };
  }

  function load(url) {
    if (!cache[url.pathname]) {
      cache[url.pathname] = fetch(url.pathname, { headers: { Accept: "text/html" } })
        .then(function (res) {
          if (!res.ok) return null;
          return res.text().then(function (html) {
            return extract(new DOMParser().parseFromString(html, "text/html"));
          });
        })
        .catch(function () { return null; });
    }
    return cache[url.pathname];
  }

  function render(data) {
    tooltip.textContent = "";

    function add(className, text, prefix) {
      if (!text) return;
      var el = document.createElement("p");
      el.className = className;
      if (prefix) {
        el.appendChild(prefix);
        el.appendChild(document.createTextNode(" "));
      }
      el.appendChild(document.createTextNode(text));
      tooltip.appendChild(el);
    }

    // The lock sits outside the lowercased text, like in the list views.
    var lock = data.lock ? data.lock.cloneNode(true) : null;
    add("page-preview-title", data.title, lock);
    add("page-preview-subtitle", data.subtitle);
    add("page-preview-excerpt", data.excerpt);
  }

  function show(link, url, clientX, clientY) {
    current = link;
    load(url).then(function (data) {
      // Skip if the pointer has since left, or moved to another link.
      if (!data || current !== link) return;
      if (!tooltip) buildTooltip();
      render(data);
      tooltip.hidden = false;
      position(clientX, clientY);
    });
  }

  function hide() {
    current = null;
    if (tooltip) tooltip.hidden = true;
  }

  // Returns the parsed URL if `link` is an internal link to another HTML page, otherwise null.
  function previewUrl(link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || link.hasAttribute("download")) return null;

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (e) {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname !== window.location.hostname) return null;
    if (url.pathname === window.location.pathname) return null;

    // Skip images, feed.xml, etc. - keep only extensionless paths or .html.
    var last = url.pathname.split("/").pop();
    if (/\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last)) return null;

    return url;
  }

  // Wires up every internal link under `root`. Exposed on window so content
  // inserted after load can be wired up too (eg. decrypted posts).
  function wirePagePreviews(root) {
    // Touch devices: mouseenter fires on tap, and a fetch there is just waste.
    var hoverCapable = !window.matchMedia("(hover: none)").matches;

    (root || document).querySelectorAll("a[href]").forEach(function (link) {
      if (link.dataset.pagePreviewWired) return;
      if (!link.closest(".entry-content")) return;
      if (link.matches("a.footnote, a.reversefootnote, a[data-lightbox]")) return;

      var url = previewUrl(link);
      if (!url) return;
      link.dataset.pagePreviewWired = "true";

      if (hoverCapable) {
        link.addEventListener("mouseenter", function (e) { show(link, url, e.clientX, e.clientY); });
        link.addEventListener("mousemove", function (e) {
          if (tooltip && !tooltip.hidden && current === link) position(e.clientX, e.clientY);
        });
        link.addEventListener("mouseleave", hide);
      }
      link.addEventListener("focus", function () {
        var linkRect = link.getBoundingClientRect();
        show(link, url, linkRect.left, linkRect.bottom);
      });
      link.addEventListener("blur", hide);
    });
  }

  wirePagePreviews(document);
  window.addEventListener("scroll", hide, { passive: true });

  window.wirePagePreviews = wirePagePreviews;
})();
