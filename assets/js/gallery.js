/**
 * gallery.js — «Наши работы»: подборка на странице, окно «Все работы» с фильтрами и просмотр фото.
 *
 * Данные: window.KOTIS_GALLERY (gallery-data.js, генерируется tools/build_assets.py).
 *   thumb: assets/img/gallery/thumb/<id>.webp   (сетка)
 *   full:  assets/img/gallery/full/<id>.webp    (просмотр)
 * Какие фото показаны на странице — KOTIS_CONFIG.galleryFeatured (config.js).
 */
(function () {
  "use strict";

  var data = window.KOTIS_GALLERY;
  var cfg = window.KOTIS_CONFIG || {};
  var grid = document.getElementById("gallery-grid");
  var openBtn = document.getElementById("gallery-open");
  var modal = document.getElementById("works-modal");
  var all = document.getElementById("gallery-all");
  var filtersBox = document.getElementById("gallery-filters");
  var body = document.getElementById("works-body");
  if (!data || !grid || !modal) return;

  var byId = {};
  data.items.forEach(function (it) { byId[it.id] = it; });

  function tile(item, index) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "gallery-item";
    b.dataset.index = index;
    b.setAttribute("aria-label", "Открыть фото: " + item.alt);
    b.style.setProperty("--i", index % 8);
    var img = document.createElement("img");
    img.src = "assets/img/gallery/thumb/" + item.id + ".webp";
    img.alt = item.alt;
    img.width = item.w; img.height = item.h;
    img.loading = "lazy"; img.decoding = "async";
    b.appendChild(img);
    return b;
  }
  function fill(box, list) {
    var frag = document.createDocumentFragment();
    list.forEach(function (it, i) { frag.appendChild(tile(it, i)); });
    box.textContent = "";
    box.appendChild(frag);
  }

  /* ---------------------------------------------------- подборка на странице */
  var featured = (cfg.galleryFeatured || []).map(function (id) { return byId[id]; }).filter(Boolean);
  if (!featured.length) featured = data.items.slice(0, 8);
  fill(grid, featured);
  [].forEach.call(grid.children, function (t) { t.classList.add("reveal"); });
  grid.addEventListener("click", function (e) {
    var t = e.target.closest(".gallery-item");
    if (t) Lightbox.open(featured, +t.dataset.index, t);
  });

  /* ------------------------------------------------------ окно «Все работы» */
  var current = data.items.slice();
  var modalOpener = null;
  var countEl = document.getElementById("works-count");
  function setCount() { if (countEl) countEl.textContent = current.length + " фото"; }

  /** Закрытие с анимацией; без анимации (reduce) — сразу */
  function hideAnimated(el, done) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.hidden = true; done(); return; }
    el.classList.add("is-closing");
    var finished = false;
    function end() {
      if (finished) return; finished = true;
      el.hidden = true; el.classList.remove("is-closing"); done();
    }
    el.addEventListener("animationend", function h(e) { if (e.target !== el) return; el.removeEventListener("animationend", h); end(); });
    setTimeout(end, 320);
  }

  function buildFilters() {
    var cats = [["all", "Все работы"]];
    Object.keys(data.categories).forEach(function (k) {
      if (data.items.some(function (it) { return it.cat === k; })) cats.push([k, data.categories[k]]);
    });
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (c[0] === "all" ? " is-active" : "");
      b.dataset.cat = c[0];
      b.setAttribute("aria-pressed", c[0] === "all");
      b.textContent = c[1];
      filtersBox.appendChild(b);
    });
    filtersBox.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      [].forEach.call(filtersBox.children, function (c) {
        c.classList.toggle("is-active", c === b);
        c.setAttribute("aria-pressed", c === b);
      });
      current = b.dataset.cat === "all" ? data.items.slice() : data.items.filter(function (it) { return it.cat === b.dataset.cat; });
      fill(all, current);
      setCount();
      body.scrollTop = 0;
      b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }

  function openModal() {
    modalOpener = document.activeElement;
    if (!all.children.length) { buildFilters(); fill(all, current); }
    setCount();
    modal.hidden = false;
    window.KotisLock(true);
    document.getElementById("works-close").focus();
  }
  function closeModal() {
    if (modal.hidden || modal.classList.contains("is-closing")) return;
    hideAnimated(modal, function () {
      window.KotisLock(false);
      if (modalOpener) modalOpener.focus({ preventScroll: true });
    });
  }
  openBtn.addEventListener("click", openModal);
  document.getElementById("works-close").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  all.addEventListener("click", function (e) {
    var t = e.target.closest(".gallery-item");
    if (t) Lightbox.open(current, +t.dataset.index, t);
  });

  /* --------------------------------------------------------------- просмотр */
  var Lightbox = (function () {
    var box = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    var cap = document.getElementById("lightbox-caption");
    var list = [], idx = 0, opener = null, startX = null;

    function src(it) { return "assets/img/gallery/full/" + it.id + ".webp"; }
    var countBox = document.getElementById("lightbox-count");
    function show(i, dir) {
      idx = (i + list.length) % list.length;
      img.classList.remove("is-in-next", "is-in-prev");
      if (dir) { void img.offsetWidth; img.classList.add(dir > 0 ? "is-in-next" : "is-in-prev"); }
      countBox.textContent = (idx + 1) + " / " + list.length;
      img.src = src(list[idx]);
      img.alt = list[idx].alt;
      cap.textContent = list[idx].alt;
      [idx + 1, idx - 1].forEach(function (n) { new Image().src = src(list[(n + list.length) % list.length]); });
    }
    function open(items, i, from) {
      list = items; opener = from;
      box.hidden = false;
      window.KotisLock(true);
      show(i, 0);
      box.querySelector(".lightbox-close").focus();
    }
    function close() {
      if (box.hidden || box.classList.contains("is-closing")) return;
      hideAnimated(box, function () {
        window.KotisLock(false);
        if (opener) opener.focus({ preventScroll: true });
      });
    }

    box.querySelector(".lightbox-close").addEventListener("click", close);
    box.querySelector(".lightbox-prev").addEventListener("click", function () { show(idx - 1, -1); });
    box.querySelector(".lightbox-next").addEventListener("click", function () { show(idx + 1, 1); });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lightbox-figure") || e.target.classList.contains("lightbox-stage")) close(); });

    document.addEventListener("keydown", function (e) {
      if (!box.hidden) {
        if (e.key === "Escape") close();
        else if (e.key === "ArrowLeft") show(idx - 1, -1);
        else if (e.key === "ArrowRight") show(idx + 1, 1);
        else if (e.key === "Tab") trap(e, box);
        return;
      }
      if (!modal.hidden) {
        if (e.key === "Escape") closeModal();
        else if (e.key === "Tab") trap(e, modal);
      }
    });
    function trap(e, scope) {      // фокус не уходит за пределы окна
      var f = scope.querySelectorAll("button");
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    box.addEventListener("touchstart", function (e) { startX = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      startX = null;
    });
    return { open: open };
  })();
})();
