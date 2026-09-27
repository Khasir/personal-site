(function () {
  "use strict";

  var overlay, img, caption, closeBtn, prevBtn, nextBtn, counter;
  // The links being browsed: every [data-lightbox] in the clicked image's
  // .gallery, or just the clicked link for a standalone figure.
  var group = [];
  var index = 0;
  var touchX = null, touchY = null;

  function makeButton(className, label, text) {
    var btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    btn.textContent = text;
    return btn;
  }

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.hidden = true;

    closeBtn = makeButton("lightbox-close", "Close", "×");
    prevBtn = makeButton("lightbox-prev", "Previous image", "‹");
    nextBtn = makeButton("lightbox-next", "Next image", "›");

    counter = document.createElement("p");
    counter.className = "lightbox-counter";

    img = document.createElement("img");
    caption = document.createElement("p");
    caption.className = "lightbox-caption";

    overlay.appendChild(closeBtn);
    overlay.appendChild(counter);
    overlay.appendChild(prevBtn);
    overlay.appendChild(img);
    overlay.appendChild(nextBtn);
    overlay.appendChild(caption);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === img || e.target === prevBtn || e.target === nextBtn) return;
      close();
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { step(-1); });
    nextBtn.addEventListener("click", function () { step(1); });
    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });

    // Horizontal swipe to step on touch screens.
    overlay.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    overlay.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      touchX = touchY = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
  }

  function show(i) {
    index = (i + group.length) % group.length;
    var link = group[index];
    var captionSrc = link.parentElement.querySelector(".lightbox-caption-src");
    img.src = link.getAttribute("href");
    img.alt = link.getAttribute("data-lightbox-alt") || "";
    caption.innerHTML = captionSrc ? captionSrc.innerHTML : "";

    var multiple = group.length > 1;
    prevBtn.hidden = nextBtn.hidden = counter.hidden = !multiple;
    counter.textContent = multiple ? (index + 1) + " / " + group.length : "";
    if (multiple) {
      // Warm the cache for the neighbours so stepping feels instant.
      [index - 1, index + 1].forEach(function (j) {
        new Image().src = group[(j + group.length) % group.length].getAttribute("href");
      });
    }
  }

  function step(delta) {
    if (group.length > 1) show(index + delta);
  }

  function open(link) {
    if (!overlay) buildOverlay();
    var gallery = link.closest(".gallery");
    group = gallery ? Array.prototype.slice.call(gallery.querySelectorAll("[data-lightbox]")) : [link];
    show(group.indexOf(link));
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    img.src = "";
    group = [];
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-lightbox]");
    if (!link) return;
    e.preventDefault();
    open(link);
  });
})();
