// "Listen to this post" player (_includes/audio-player.html).
// Has play/pause, back/forward 5s, a seek bar and download,
// and a toggle for an optional description bubble.
(function () {
  "use strict";

  var SKIP = 5;

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function wireAudioPlayer(root) {
    (root || document).querySelectorAll("[data-audio-player]").forEach(function (el) {
      if (el.dataset.audioWired) return;
      el.dataset.audioWired = "true";

      var audio = el.querySelector("audio");
      var controls = el.querySelector(".audio-controls");
      var play = el.querySelector("[data-audio-play]");
      var back = el.querySelector("[data-audio-back]");
      var forward = el.querySelector("[data-audio-forward]");
      var seek = el.querySelector("[data-audio-seek]");
      var time = el.querySelector("[data-audio-time]");
      if (!audio || !controls) return;

      audio.controls = false;
      audio.hidden = true;
      controls.hidden = false;

      function duration() {
        return isFinite(audio.duration) ? audio.duration : 0;
      }

      function update() {
        var d = duration();
        seek.max = Math.floor(d);
        seek.value = Math.floor(audio.currentTime);
        time.textContent = fmt(audio.currentTime) + " / " + fmt(d);
      }

      function setPlaying(playing) {
        el.classList.toggle("is-playing", playing);
        play.setAttribute("aria-pressed", playing ? "true" : "false");
        var label = playing ? "Pause" : "Play";
        play.setAttribute("aria-label", label);
        play.title = label;
      }

      play.addEventListener("click", function () {
        if (audio.paused) {
          var p = audio.play();
          if (p && p.catch) p.catch(function () { setPlaying(false); });
        } else {
          audio.pause();
        }
      });
      back.addEventListener("click", function () {
        audio.currentTime = Math.max(0, audio.currentTime - SKIP);
        update();
      });
      forward.addEventListener("click", function () {
        var d = duration();
        audio.currentTime = d ? Math.min(d, audio.currentTime + SKIP) : audio.currentTime + SKIP;
        update();
      });
      seek.addEventListener("input", function () {
        audio.currentTime = Number(seek.value);
        update();
      });

      audio.addEventListener("play", function () { setPlaying(true); });
      audio.addEventListener("pause", function () { setPlaying(false); });
      audio.addEventListener("ended", function () { setPlaying(false); update(); });
      audio.addEventListener("timeupdate", update);
      audio.addEventListener("loadedmetadata", update);
      audio.addEventListener("durationchange", update);
      update();

      // Volume slider and description bubble: disclosure pattern, like the
      // accessibility menu (outside click / Escape close, only one open).
      var popovers = [];
      function closeOthers(except) {
        popovers.forEach(function (p) { if (p !== except) p.setOpen(false); });
      }
      function wirePopover(trigger, pop) {
        if (!trigger || !pop) return;
        var p = {
          setOpen: function (open) {
            pop.hidden = !open;
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
          },
        };
        popovers.push(p);
        trigger.addEventListener("click", function () {
          var open = pop.hidden;
          closeOthers(p);
          p.setOpen(open);
        });
        document.addEventListener("click", function (e) {
          if (pop.hidden) return;
          if (trigger.contains(e.target) || pop.contains(e.target)) return;
          p.setOpen(false);
        });
        document.addEventListener("keydown", function (e) {
          if (e.key !== "Escape" || pop.hidden) return;
          p.setOpen(false);
          trigger.focus();
        });
      }

      wirePopover(el.querySelector("[data-audio-volume-toggle]"), el.querySelector(".audio-volume-pop"));
      wirePopover(el.querySelector("[data-audio-info]"), el.querySelector(".audio-bubble"));

      var volume = el.querySelector("[data-audio-volume]");
      if (volume) {
        volume.value = Math.round(audio.volume * 100);
        volume.addEventListener("input", function () {
          audio.volume = Number(volume.value) / 100;
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () { wireAudioPlayer(document); });
  window.wireAudioPlayer = wireAudioPlayer;
})();
