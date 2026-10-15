(function () {
  "use strict";

  // The accessibility menu: two independent options, each an attribute on
  // <html> styled by assets/css/accessible.css:
  //   font -> data-a11y-font="on" (readable font + contrast/underline bundle)
  //   size -> data-a11y-size="on" (larger root font size)
  // The initial state is set before first paint by the inline script in
  // _includes/head.html; this handles the menu, persistence, and the bits that
  // depend on the options (aria-pressed, <title> casing). An explicit choice
  // is stored per option as "on"/"off"; with none stored, an option follows
  // the legacy single-switch "a11y-mode" value (until the first click migrates
  // it), then the OS's prefers-contrast setting.

  var OPTIONS = {
    font: { attr: "data-a11y-font", key: "a11y-font" },
    size: { attr: "data-a11y-size", key: "a11y-size" }
  };
  var LEGACY_KEY = "a11y-mode";
  var html = document.documentElement;
  var contrastQuery = window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function hasStoredChoice(name) {
    return !!(read(OPTIONS[name].key) || read(LEGACY_KEY));
  }

  function store(name, value) {
    try { localStorage.setItem(OPTIONS[name].key, value); } catch (e) { /* still works for this page */ }
  }

  // The old single switch becomes both options, then goes away.
  function migrateLegacy() {
    var legacy = read(LEGACY_KEY);
    if (!legacy) return;
    Object.keys(OPTIONS).forEach(function (name) {
      if (!read(OPTIONS[name].key)) store(name, legacy);
    });
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  }

  function isOn(name) {
    return html.getAttribute(OPTIONS[name].attr) === "on";
  }

  // Show entry title as written instead of lowercase
  function syncTitle() {
    var original = html.dataset.originalTitle;
    if (original) document.title = isOn("font") ? original : original.toLowerCase();
  }

  function sync() {
    document.querySelectorAll("[data-a11y-option]").forEach(function (button) {
      button.setAttribute("aria-pressed", isOn(button.dataset.a11yOption) ? "true" : "false");
    });
    syncTitle();
  }

  function setOption(name, on) {
    if (on) html.setAttribute(OPTIONS[name].attr, "on");
    else html.removeAttribute(OPTIONS[name].attr);
    sync();
  }

  function triggerFor(menu) {
    return document.querySelector('[data-a11y-toggle][aria-controls="' + menu.id + '"]');
  }

  function setMenuOpen(menu, open) {
    menu.hidden = !open;
    var trigger = triggerFor(menu);
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // Closes every menu; returns the trigger of one that was open (for focus).
  function closeMenus(except) {
    var openTrigger = null;
    document.querySelectorAll(".a11y-menu").forEach(function (menu) {
      if (menu === except || menu.hidden) return;
      setMenuOpen(menu, false);
      openTrigger = triggerFor(menu);
    });
    return openTrigger;
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-a11y-toggle]");
    if (trigger) {
      var menu = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!menu) return;
      closeMenus(menu);
      setMenuOpen(menu, menu.hidden);
      return;
    }

    var option = e.target.closest("[data-a11y-option]");
    if (option) {
      var name = option.dataset.a11yOption;
      if (!OPTIONS[name]) return;
      var on = !isOn(name);
      migrateLegacy();
      store(name, on ? "on" : "off");
      setOption(name, on);
      return;
    }

    if (!e.target.closest(".a11y-menu")) closeMenus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var trigger = closeMenus();
    if (trigger) trigger.focus();
  });

  // Follow the OS setting live, for options the visitor hasn't chosen.
  if (contrastQuery && contrastQuery.addEventListener) {
    contrastQuery.addEventListener("change", function (e) {
      Object.keys(OPTIONS).forEach(function (name) {
        if (!hasStoredChoice(name)) setOption(name, e.matches);
      });
    });
  }

  sync();
})();
