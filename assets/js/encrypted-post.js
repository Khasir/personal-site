(function () {
  "use strict";

  // Must match scripts/lib/encrypted-post-crypto.js -- there's no bundler
  // here to share the module between Node and the browser.
  var PBKDF2_ITERATIONS = 600000;

  var containers = document.querySelectorAll("[data-encrypted-post]");
  if (!containers.length) return;

  function base64ToBytes(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Supports **bold**, *italic*, and [text](url) links -- deliberately not
  // full markdown. The real body never goes through Jekyll/kramdown (only
  // its ciphertext does), so there's no build-time renderer to lean on here.
  function renderSubsetMarkdown(text) {
    return text
      .split(/\n\s*\n/)
      .map(function (para) {
        var html = escapeHtml(para.trim()).replace(/\n/g, "<br>");
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, url) {
          if (!/^(https?:\/\/|\/|#)/.test(url)) return match;
          return '<a href="' + url.replace(/"/g, "&quot;") + '" rel="noopener">' + label + "</a>";
        });
        return "<p>" + html + "</p>";
      })
      .filter(function (p) { return p !== "<p></p>"; })
      .join("\n");
  }

  function deriveKey(password, salt) {
    return crypto.subtle
      .importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (keyMaterial) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      });
  }

  containers.forEach(function (container) {
    var form = container.querySelector("[data-encrypted-form]");
    var input = container.querySelector("[data-encrypted-password]");
    var error = container.querySelector("[data-encrypted-error]");
    var output = container.querySelector("[data-encrypted-content]");
    if (!form || !input || !output) return;

    var salt = base64ToBytes(container.getAttribute("data-salt"));
    var iv = base64ToBytes(container.getAttribute("data-iv"));
    var ciphertext = base64ToBytes(container.getAttribute("data-ciphertext"));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (error) error.hidden = true;

      deriveKey(input.value, salt)
        .then(function (key) {
          return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
        })
        .then(function (plaintextBuf) {
          var text = new TextDecoder().decode(plaintextBuf);
          output.innerHTML = renderSubsetMarkdown(text);
          output.hidden = false;
          form.hidden = true;
          if (window.wireExternalLinks) window.wireExternalLinks(output);
          if (window.refreshCommentHighlights) window.refreshCommentHighlights();
        })
        .catch(function () {
          if (error) error.hidden = false;
        });
    });
  });
})();
