(function () {
  "use strict";

  var root = document.querySelector("[data-guestbook]");
  if (!root) return;

  var apiBase = root.getAttribute("data-api-base") || "";
  var form = root.querySelector("[data-guestbook-form]");
  var status = root.querySelector("[data-guestbook-status]");
  var list = root.querySelector("[data-guestbook-entries]");

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric"
      });
    } catch (e) {
      return "";
    }
  }

  function renderEntries(entries) {
    list.innerHTML = "";
    if (!entries.length) {
      var empty = document.createElement("li");
      empty.className = "loading";
      empty.textContent = "No entries yet. You can be the difference. Yes, you. Sign your name now.";
      list.appendChild(empty);
      return;
    }
    entries.forEach(function (entry) {
      var li = document.createElement("li");
      var author = document.createElement("span");
      author.className = "comment-author";
      author.textContent = entry.author_name;
      li.appendChild(author);

      if (entry.author_email) {
        var email = document.createElement("a");
        email.className = "guestbook-email";
        email.href = "mailto:" + entry.author_email;
        email.textContent = entry.author_email;
        li.appendChild(email);
      }

      var time = document.createElement("span");
      time.className = "comment-time";
      time.textContent = formatTime(entry.created_at);
      li.appendChild(time);

      if (entry.body) {
        var body = document.createElement("p");
        body.className = "comment-body";
        body.textContent = entry.body;
        li.appendChild(body);
      }

      list.appendChild(li);
    });
  }

  function loadEntries() {
    fetch(apiBase + "/api/guestbook")
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(renderEntries)
      .catch(function () {
        list.innerHTML = "";
        var err = document.createElement("li");
        err.className = "loading";
        err.textContent = "Couldn't load entries just now.";
        list.appendChild(err);
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var payload = {
      name: (data.get("name") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      body: (data.get("message") || "").toString().trim(),
      website: (data.get("website") || "").toString() // honeypot
    };
    if (!payload.name) return;

    status.textContent = "Posting…";
    delete status.dataset.state;

    fetch(apiBase + "/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then(function () {
        status.textContent = "Thanks for signing!";
        status.dataset.state = "success";
        form.reset();
        loadEntries();
      })
      .catch(function () {
        status.textContent = "Something went wrong. Please try again.";
        status.dataset.state = "error";
      });
  });

  loadEntries();
})();
