document.addEventListener("DOMContentLoaded", function () {
  /* ---------- 1. Mobile navigation ---------- */
  var navToggle = document.getElementById("navToggle");
  var navbar = document.getElementById("mainNav");
  if (navToggle && navbar) {
    var setNav = function (open) {
      navbar.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    };
    navToggle.addEventListener("click", function () { setNav(!navbar.classList.contains("open")); });
    navbar.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  }

  /* ---------- 2. Gallery lightbox (one photo set per project) ---------- */
  var lightbox = document.getElementById("lightbox");
  var grids = document.querySelectorAll("[data-gallery]");
  if (lightbox && grids.length) {
    var img = document.getElementById("lightboxImg");
    var count = document.getElementById("lightboxCount");
    var thumbs = [];
    var current = 0;
    var lastFocus = null;

    var show = function (i) {
      current = (i + thumbs.length) % thumbs.length;
      img.src = thumbs[current].currentSrc || thumbs[current].src;
      img.alt = thumbs[current].alt;
      count.textContent = (current + 1) + " / " + thumbs.length;
    };
    var open = function (set, i) {
      thumbs = set;
      lastFocus = document.activeElement;
      show(i);
      lightbox.hidden = false;
      lightbox.classList.add("open");
      document.body.classList.add("lightbox-open");
      lightbox.querySelector(".lightbox-close").focus();
    };
    var close = function () {
      lightbox.classList.remove("open");
      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      img.src = "";
      if (lastFocus) lastFocus.focus();
    };

    grids.forEach(function (grid) {
      var set = Array.prototype.slice.call(grid.querySelectorAll("img"));

// Show only the first PREVIEW photos; the rest open in the viewer
var PREVIEW = 4;
if (set.length > PREVIEW) {
  set.forEach(function (t, i) { if (i >= PREVIEW) t.closest("button").classList.add("is-extra"); });
  var last = set[PREVIEW - 1].closest("button");
  last.classList.add("has-more");
  var more = document.createElement("span");
  more.className = "photo-more";
  more.textContent = "+" + (set.length - PREVIEW) + " more";
  last.appendChild(more);
}

      set.forEach(function (t, i) { t.closest("button").addEventListener("click", function () { open(set, i); }); });
    });
    lightbox.querySelector(".lightbox-close").addEventListener("click", close);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", function (e) { e.stopPropagation(); show(current - 1); });
    lightbox.querySelector(".lightbox-next").addEventListener("click", function (e) { e.stopPropagation(); show(current + 1); });
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(current + 1);
      if (e.key === "ArrowLeft") show(current - 1);
    });

    var startX = null;
    lightbox.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
  }

  /* ---------- 3. Contact form ---------- */
  var form = document.getElementById("gajanandEnquiryForm");
  if (form) {
    var btn = document.getElementById("formSubmitBtn");
    var box = document.getElementById("formResponseMessage");
    var message = function (type, text) {
      if (!box) return;
      box.className = "message-box " + type;
      box.textContent = text;
      box.setAttribute("role", type === "error" ? "alert" : "status");
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var label = btn.textContent;
      btn.textContent = "Sending enquiry...";
      btn.disabled = true;
      box.className = "message-box";

      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });

      fetch("/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (r) {
          if (!r.ok || r.data.result !== "success") throw new Error(r.data.error || "Unable to send enquiry.");
          message("success", "Thank you! Your enquiry has been sent. We will contact you soon.");
          form.reset();
        })
        .catch(function (err) {
          message("error", (err && err.message ? err.message : "Something went wrong.") + " You can also call or WhatsApp us on +91 98219 43101.");
        })
        .finally(function () { btn.textContent = label; btn.disabled = false; });
    });
  }
});
