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
  var allComments = []; // every comment loaded/posted for this page
  var commentsById = Object.create(null);

  // --- text-offset <-> DOM range helpers -----------------------------

  function textOffsetOf(container, node, offset) {
    var range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(node, offset);
    return range.toString().length;
  }

  function rangeFromOffsets(container, start, end) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);

    var pos = 0, startNode, startOffset, endNode, endOffset;
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].nodeValue.length;
      var nodeStart = pos, nodeEnd = pos + len;

      if (startNode === undefined) {
        // When the target sits exactly on the boundary between two nodes,
        // prefer the start of the next node over the end of this one --
        // otherwise, if this node is inside a previously-wrapped <mark>
        // (from an adjacent, already-rendered comment highlight), the
        // range's start ends up nested inside that mark instead of just
        // after it.
        if (start < nodeEnd || (start === nodeEnd && i === nodes.length - 1)) {
          startNode = nodes[i];
          startOffset = start - nodeStart;
        }
      }
      if (endNode === undefined && end <= nodeEnd) {
        endNode = nodes[i];
        endOffset = end - nodeStart;
      }
      pos = nodeEnd;
      if (startNode !== undefined && endNode !== undefined) break;
    }
    if (startNode === undefined || endNode === undefined) return null;
    var range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }

  // Locates a comment's anchor text in the current article text, preferring
  // an exact prefix+quote+suffix match and falling back to a bare match of
  // the quote alone if the surrounding text has since changed.
  function resolveAnchor(fullText, c) {
    if (!c.quote) return null;
    var needle = (c.prefix || "") + c.quote + (c.suffix || "");
    var idx = fullText.indexOf(needle);
    if (idx !== -1) {
      var start = idx + (c.prefix || "").length;
      return { start: start, end: start + c.quote.length };
    }
    var bareIdx = fullText.indexOf(c.quote);
    if (bareIdx === -1) return null;
    return { start: bareIdx, end: bareIdx + c.quote.length };
  }

  // --- rendering comments as highlights -------------------------------
  //
  // Comments can have overlapping anchors (two people highlighting
  // overlapping or identical passages). To render that without corrupting
  // the article markup, the article is fully unwrapped back to plain text
  // and then re-partitioned into non-overlapping segments based on the
  // union of every comment's start/end offsets. Each segment becomes a
  // single <mark>, tagged with every comment that covers it -- so clicking
  // anywhere in an overlap shows every comment anchored there.

  function renderAll() {
    article.querySelectorAll("mark.comment-highlight").forEach(function (mark) {
      var parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    article.normalize();

    commentsById = Object.create(null);
    allComments.forEach(function (c) { commentsById[c.id] = c; });

    var fullText = article.textContent;
    var anchored = [];
    allComments.forEach(function (c) {
      var pos = resolveAnchor(fullText, c);
      if (pos) anchored.push({ comment: c, start: pos.start, end: pos.end });
    });
    if (!anchored.length) return;

    var bounds = [];
    anchored.forEach(function (a) { bounds.push(a.start, a.end); });
    bounds = Array.from(new Set(bounds)).sort(function (a, b) { return a - b; });

    for (var i = 0; i < bounds.length - 1; i++) {
      var segStart = bounds[i];
      var segEnd = bounds[i + 1];
      if (segStart >= segEnd) continue;

      var covering = anchored.filter(function (a) {
        return a.start <= segStart && a.end >= segEnd;
      });
      if (!covering.length) continue;

      var range = rangeFromOffsets(article, segStart, segEnd);
      if (!range) continue;

      var mark = document.createElement("mark");
      mark.className = "comment-highlight";
      mark.dataset.commentIds = covering.map(function (a) { return a.comment.id; }).join(",");
      try {
        range.surroundContents(mark);
      } catch (e) {
        // Segments are non-overlapping by construction, so this shouldn't
        // normally trigger; kept as a safety net.
        var frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
    }
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
    var ids = (mark.dataset.commentIds || "").split(",").filter(Boolean);
    var comments = ids.map(function (id) { return commentsById[id]; }).filter(Boolean);
    comments.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

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
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
    var rawQuote = fullText.slice(startOffset, endOffset);
    var quote = rawQuote.trim();
    if (!quote) return null;

    // Keep offsets in sync with the trimmed quote so prefix/suffix line up
    // exactly with it when re-anchoring later.
    startOffset += rawQuote.indexOf(quote);
    endOffset = startOffset + quote.length;

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

    // A left-click text selection ends with a native "click" event fired on
    // mouseup's target; without this check that click immediately dismisses
    // the popover this same interaction just opened.
    var sel = window.getSelection();
    var hasActiveSelection = sel && !sel.isCollapsed && article.contains(sel.anchorNode);

    if (!root.contains(e.target) && !article.contains(e.target)) {
      hideAll();
    } else if (!hasActiveSelection && !popover.contains(e.target) && !formDialog.contains(e.target) && e.target !== popoverTrigger) {
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
      .then(function (created) {
        formStatus.textContent = "Comment posted.";
        formStatus.dataset.state = "success";
        allComments.push(created);
        renderAll();
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
      if (Array.isArray(comments) && comments.length) {
        allComments = allComments.concat(comments);
        renderAll();
      }
    })
    .catch(function () { /* comments are non-critical; fail silently */ });
})();
