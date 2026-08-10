(function () {
  "use strict";

  var overlay, img, caption, closeBtn;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.hidden = true;

    closeBtn = document.createElement("button");
    closeBtn.className = "lightbox-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";

    img = document.createElement("img");
    caption = document.createElement("p");
    caption.className = "lightbox-caption";

    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    overlay.appendChild(caption);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === img) return;
      close();
    });
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function open(src, captionText) {
    if (!overlay) buildOverlay();
    img.src = src;
    img.alt = captionText || "";
    caption.textContent = captionText || "";
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    img.src = "";
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-lightbox]");
    if (!link) return;
    e.preventDefault();
    open(link.getAttribute("href"), link.getAttribute("data-lightbox-caption"));
  });
})();
