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

  function renderInline(text) {
    var html = escapeHtml(text.trim()).replace(/\n/g, "<br>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, url) {
      if (!/^(https?:\/\/|\/|#)/.test(url)) return match;
      return '<a href="' + url.replace(/"/g, "&quot;") + '" rel="noopener">' + label + "</a>";
    });
    return html;
  }

  // "- item", "* item", "+ item", "1. item" or "1) item", with the leading
  // indent measured in spaces (a tab counts as 4).
  function parseListItem(line) {
    var m = line.match(/^([ \t]*)(?:([-*+])|(\d{1,9})[.)])[ \t]+(.*)$/);
    if (!m) return null;
    return {
      indent: m[1].replace(/\t/g, "    ").length,
      type: m[2] ? "ul" : "ol",
      start: m[3] ? parseInt(m[3], 10) : 1,
      text: m[4],
    };
  }

  function renderList(list) {
    var start = list.type === "ol" && list.start !== 1 ? ' start="' + list.start + '"' : "";
    return "<" + list.type + start + ">" + list.items.map(function (item) {
      return "<li>" + renderInline(item.text) + item.children.map(renderList).join("") + "</li>";
    }).join("") + "</" + list.type + ">";
  }

  // Supports:
  // - **bold text**
  // - *italics*
  // - [text](links)
  // 1. bullets and numbered lists (nested too)
  // - <!-- HTML comments -->
  function renderSubsetMarkdown(text) {
    var out = []; // "<p>...</p>" strings and top-level list objects, in order
    var para = [];
    var stack = []; // currently open lists, outermost first
    var afterBlank = false;

    function flushPara() {
      if (para.length) out.push("<p>" + renderInline(para.join("\n")) + "</p>");
      para = [];
    }

    function addItem(item) {
      while (stack.length && stack[stack.length - 1].indent > item.indent) stack.pop();
      var top = stack[stack.length - 1];
      var entry = { text: item.text, children: [] };
      if (top && top.indent === item.indent && top.type === item.type) {
        top.items.push(entry);
        return;
      }
      if (top && top.indent === item.indent) {
        stack.pop();
        top = stack[stack.length - 1];
      }
      var list = { type: item.type, indent: item.indent, start: item.start, items: [entry] };
      if (top) top.items[top.items.length - 1].children.push(list);
      else out.push(list);
      stack.push(list);
    }

    text
      .replace(/\r\n?/g, "\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      .split("\n")
      .forEach(function (line) {
        if (line.trim() === "") {
          flushPara();
          afterBlank = stack.length > 0;
          return;
        }

        var item = parseListItem(line);
        if (item && !(item.type === "ol" && item.start !== 1 && para.length)) {
          flushPara();
          addItem(item);
          afterBlank = false;
          return;
        }

        if (stack.length && !(afterBlank && !/^[ \t]/.test(line))) {
          var last = stack[stack.length - 1].items;
          last[last.length - 1].text += (afterBlank ? "\n\n" : "\n") + line.trim();
          afterBlank = false;
          return;
        }

        stack = [];
        afterBlank = false;
        para.push(line);
      });
    flushPara();

    return out.map(function (node) {
      return typeof node === "string" ? node : renderList(node);
    }).join("\n");
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
