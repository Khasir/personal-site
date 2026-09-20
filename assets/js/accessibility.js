(function () {
  "use strict";

  // Toggles accessibility mode (<html data-a11y="on">, styled by
  // assets/css/accessible.css). The initial state is set before first paint
  // by the inline script in _includes/head.html; this handles the button,
  // persistence, and the bits that depend on the mode (aria-pressed, <title>
  // casing). An explicit choice is stored as "on"/"off"; with none stored,
  // the mode follows the OS's prefers-contrast setting.

  var KEY = "a11y-mode";
  var html = document.documentElement;
  var contrastQuery = window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;

  function hasStoredChoice() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* mode still works for this page */ }
  }

  function isOn() {
    return html.getAttribute("data-a11y") === "on";
  }

  // Show entry title as written instead of lowercase
  function syncTitle() {
    var original = html.dataset.originalTitle;
    if (original) document.title = isOn() ? original : original.toLowerCase();
  }

  function sync() {
    document.querySelectorAll("[data-a11y-toggle]").forEach(function (button) {
      button.setAttribute("aria-pressed", isOn() ? "true" : "false");
    });
    syncTitle();
  }

  function setMode(on) {
    if (on) html.setAttribute("data-a11y", "on");
    else html.removeAttribute("data-a11y");
    sync();
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-a11y-toggle]")) return;
    var on = !isOn();
    store(on ? "on" : "off");
    setMode(on);
  });

  // Follow the OS setting live, unless the visitor has made their own choice.
  if (contrastQuery && contrastQuery.addEventListener) {
    contrastQuery.addEventListener("change", function (e) {
      if (!hasStoredChoice()) setMode(e.matches);
    });
  }

  sync();
})();
