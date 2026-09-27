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

  // The decrypted plaintext is JSON from scripts/lib/encrypted-post-payload.js:
  // { v: 2, markdown, html }, with the HTML already rendered by kramdown when
  // the post was encrypted. Only the HTML is used here.
  function payloadHtml(text) {
    var payload = JSON.parse(text);
    if (!payload || payload.v !== 2 || typeof payload.html !== "string") {
      throw new Error("unsupported encrypted post format");
    }
    return payload.html;
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
          output.innerHTML = payloadHtml(text);
          output.hidden = false;
          form.hidden = true;
          if (window.wireExternalLinks) window.wireExternalLinks(output);
          if (window.wireFootnotes) window.wireFootnotes(output);
          if (window.refreshCommentHighlights) window.refreshCommentHighlights();
        })
        .catch(function () {
          if (error) error.hidden = false;
        });
    });
  });
})();
