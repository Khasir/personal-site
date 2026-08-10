(function () {
  "use strict";

  var CONTEXT_LEN = 32;

  var root = document.querySelector("[data-comments]");
  if (!root) return;

  var article = document.querySelector(".entry-content");
  if (!article) return;

  var apiBase = root.getAttribute("data-api-base") || "";
  var postSlug = root.getAttribute("data-post-slug") || location.pathname;

  var popover = root.querySelector("[data-comment-popover]");
  var popoverTrigger = root.querySelector("[data-comment-trigger]");
  var formDialog = root.querySelector("[data-comment-form-dialog]");
  var form = root.querySelector("[data-comment-form]");
  var formQuote = root.querySelector("[data-comment-form-quote]");
  var formStatus = root.querySelector("[data-comment-form-status]");
  var formCancel = root.querySelector("[data-comment-form-cancel]");
  var threadPopover = root.querySelector("[data-comment-thread-popover]");
  var threadList = root.querySelector("[data-comment-thread-list]");
  var threadClose = root.querySelector("[data-comment-thread-close]");

  var pendingSelection = null; // { quote, prefix, suffix, rect }
  var commentsByKey = Object.create(null);

  // --- text-offset <-> DOM range helpers -----------------------------

  function textOffsetOf(container, node, offset) {
    var range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(node, offset);
    return range.toString().length;
  }

  function rangeFromOffsets(container, start, end) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var node, pos = 0, startNode, startOffset, endNode, endOffset;
    while ((node = walker.nextNode())) {
      var len = node.nodeValue.length;
      if (startNode === undefined && pos + len >= start) {
        startNode = node;
        startOffset = start - pos;
      }
      if (endNode === undefined && pos + len >= end) {
        endNode = node;
        endOffset = end - pos;
      }
      pos += len;
      if (startNode !== undefined && endNode !== undefined) break;
    }
    if (startNode === undefined || endNode === undefined) return null;
    var range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }

  function quoteKey(c) {
    return c.prefix + "␟" + c.quote + "␟" + c.suffix;
  }

  // --- rendering existing comments as highlights ----------------------

  function renderHighlights(comments) {
    var fullText = article.textContent;
    var withQuote = comments.filter(function (c) { return c.quote; });

    var groups = Object.create(null);
    withQuote.forEach(function (c) {
      var key = quoteKey(c);
      (groups[key] = groups[key] || []).push(c);
    });

    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      var sample = group[0];
      var needle = sample.prefix + sample.quote + sample.suffix;
      var idx = fullText.indexOf(needle);
      var start, end;
      if (idx !== -1) {
        start = idx + sample.prefix.length;
        end = start + sample.quote.length;
      } else {
        // Post content shifted since the comment was made; fall back to a
        // bare match of the quoted text so the highlight can still be found.
        var bareIdx = fullText.indexOf(sample.quote);
        if (bareIdx === -1) return; // give up silently for this group
        start = bareIdx;
        end = start + sample.quote.length;
      }

      var range = rangeFromOffsets(article, start, end);
      if (!range) return;

      var mark = document.createElement("mark");
      mark.className = "comment-highlight";
      mark.dataset.commentKey = key;
      try {
        range.surroundContents(mark);
      } catch (e) {
        var frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }

      commentsByKey[key] = group;
      // Re-measure fullText after DOM mutation for subsequent groups.
      fullText = article.textContent;
    });
  }

  // --- popovers ---------------------------------------------------------

  function positionAt(el, rect) {
    el.style.top = window.scrollY + rect.top + "px";
    el.style.left = window.scrollX + rect.left + rect.width / 2 + "px";
  }

  function hidePopover() {
    popover.hidden = true;
  }

  function hideForm() {
    formDialog.hidden = true;
    form.reset();
    formStatus.textContent = "";
    delete formStatus.dataset.state;
  }

  function hideThread() {
    threadPopover.hidden = true;
  }

  function hideAll() {
    hidePopover();
    hideForm();
    hideThread();
  }

  function showThreadFor(mark) {
    var key = mark.dataset.commentKey;
    var comments = commentsByKey[key] || [];
    threadList.innerHTML = "";
    comments.forEach(function (c) {
      var li = document.createElement("li");
      var author = document.createElement("span");
      author.className = "comment-author";
      author.textContent = c.author_name;
      var time = document.createElement("span");
      time.className = "comment-time";
      time.textContent = formatTime(c.created_at);
      var body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = c.body;
      li.appendChild(author);
      li.appendChild(time);
      li.appendChild(body);
      threadList.appendChild(li);
    });
    threadPopover.hidden = false;
    positionAt(threadPopover, mark.getBoundingClientRect());
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric"
      });
    } catch (e) {
      return "";
    }
  }

  // --- selection handling -------------------------------------------

  function currentSelectionInfo() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) return null;

    var startOffset = textOffsetOf(article, range.startContainer, range.startOffset);
    var endOffset = textOffsetOf(article, range.endContainer, range.endOffset);
    if (endOffset <= startOffset) return null;

    var fullText = article.textContent;
    var quote = fullText.slice(startOffset, endOffset).trim();
    if (!quote) return null;

    return {
      quote: quote,
      prefix: fullText.slice(Math.max(0, startOffset - CONTEXT_LEN), startOffset),
      suffix: fullText.slice(endOffset, endOffset + CONTEXT_LEN),
      rect: range.getBoundingClientRect()
    };
  }

  document.addEventListener("mouseup", function (e) {
    if (!formDialog.hidden) return; // don't interrupt an open form
    var info = currentSelectionInfo();
    if (!info) {
      hidePopover();
      return;
    }
    pendingSelection = info;
    positionAt(popover, info.rect);
    popover.hidden = false;
  });

  popoverTrigger.addEventListener("click", function () {
    if (!pendingSelection) return;
    formQuote.textContent = pendingSelection.quote;
    positionAt(formDialog, pendingSelection.rect);
    hidePopover();
    formDialog.hidden = false;
    form.querySelector("#comment-name").focus();
  });

  formCancel.addEventListener("click", hideForm);

  article.addEventListener("click", function (e) {
    var mark = e.target.closest("mark.comment-highlight");
    if (mark) {
      e.stopPropagation();
      showThreadFor(mark);
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest("mark.comment-highlight")) return;
    if (!root.contains(e.target) && !article.contains(e.target)) hideAll();
    else if (!popover.contains(e.target) && !formDialog.contains(e.target) && e.target !== popoverTrigger) {
      hidePopover();
    }
    if (!threadPopover.contains(e.target)) hideThread();
  });

  threadClose.addEventListener("click", hideThread);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!pendingSelection) return;

    var data = new FormData(form);
    var payload = {
      post_slug: postSlug,
      name: (data.get("name") || "").toString().trim(),
      body: (data.get("body") || "").toString().trim(),
      website: (data.get("website") || "").toString(), // honeypot
      quote: pendingSelection.quote,
      prefix: pendingSelection.prefix,
      suffix: pendingSelection.suffix
    };

    if (!payload.name || !payload.body) return;

    formStatus.textContent = "Posting…";
    delete formStatus.dataset.state;

    fetch(apiBase + "/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then(function () {
        formStatus.textContent = "Comment posted.";
        formStatus.dataset.state = "success";
        renderHighlights([payload]);
        window.getSelection().removeAllRanges();
        setTimeout(hideForm, 900);
      })
      .catch(function () {
        formStatus.textContent = "Something went wrong. Please try again.";
        formStatus.dataset.state = "error";
      });
  });

  // --- initial load -----------------------------------------------------

  fetch(apiBase + "/api/comments?slug=" + encodeURIComponent(postSlug))
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (comments) {
      if (Array.isArray(comments) && comments.length) renderHighlights(comments);
    })
    .catch(function () { /* comments are non-critical; fail silently */ });
})();
