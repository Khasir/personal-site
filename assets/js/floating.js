// Measure floating notes to properly align visually with paragraphs.
// CSS can't read an element's own height for a sticky offset, so it's published as --floating-h.
// CSS falls back to an approximation if JS is not available.
(function () {
  "use strict";

  var observer = null;

  function publish(inner) {
    inner.style.setProperty("--floating-h", inner.offsetHeight + "px");
    inner.setAttribute("data-floating-measured", "");
  }

  // Idempotent: safe to call again on content inserted later
  function wireFloating(root) {
    if (!window.ResizeObserver) return;
    if (!observer) {
      observer = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) publish(entries[i].target);
      });
    }
    var notes = (root || document).querySelectorAll(".floating-inner");
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].hasAttribute("data-floating-wired")) continue;
      notes[i].setAttribute("data-floating-wired", "");
      publish(notes[i]);
      observer.observe(notes[i]);
    }
  }

  window.wireFloating = wireFloating;
  wireFloating(document);
})();
