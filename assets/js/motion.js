/**
 * motion.js — плавные анимации страницы.
 *   progress   тонкая полоса прокрутки сверху
 *   reveal     плавное появление блоков при прокрутке (класс .reveal)
 *   hero       заголовок появляется по словам; фото чуть смещаются при движении мыши и прокрутке
 *   count      число «10 лет» плавно набегает
 *   spotlight  мягкий блик под курсором на карточках (только на ПК)
 *   magnet     крупные кнопки чуть «притягиваются» к курсору (только на ПК)
 *   tabs       «Комфорт / Тишина / Стиль»
 *   snap       точки под каруселью услуг на телефоне
 *   header     шапка прячется при прокрутке вниз на телефоне и возвращается при прокрутке вверх
 * Анимируются только transform и opacity. При «уменьшить анимацию» всё показывается сразу.
 * Если скрипт не загрузился, блоки видны (класс .js ставится в <head> только вместе со скриптами).
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };

  /* ------------------------------------------------------------ reveal */
  function reveal() {
    var items = $$(".reveal");
    if (!items.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
    // Страховка: если что-то не успело сработать — всё показываем через 6 секунд после загрузки
    window.addEventListener("load", function () {
      setTimeout(function () { items.forEach(function (el) { el.classList.add("is-in"); }); }, 6000);
    });
  }

  /* ------------------------------------------------------ полоса прокрутки */
  var progressBar = $(".scroll-progress span");
  var lastY = 0, ticking = false, headerHidden = false;
  var header = $(".site-header");
  var heroEl = $(".hero"), heroVisual = $(".hero-visual");
  var heroY = 0;

  function onScroll() {
    var y = window.scrollY;
    var max = doc.documentElement.scrollHeight - window.innerHeight;
    if (progressBar && max > 0) progressBar.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";

    // Шапка на телефоне: вниз — прячется, вверх — возвращается
    if (header && window.innerWidth <= 920 && !doc.body.classList.contains("nav-open")) {
      var down = y > lastY + 4, up = y < lastY - 4;
      if (down && y > 240 && !headerHidden) { headerHidden = true; header.classList.add("is-hidden"); }
      else if ((up || y < 120) && headerHidden) { headerHidden = false; header.classList.remove("is-hidden"); }
    } else if (headerHidden) { headerHidden = false; header.classList.remove("is-hidden"); }
    lastY = y;

    // Лёгкий сдвиг фото главного блока при прокрутке
    if (heroVisual && !reduce && y < window.innerHeight * 1.2) {
      heroY = y;
      heroVisual.style.setProperty("--sy", (Math.min(y, 700) * 0.04).toFixed(1) + "px");
    }
    ticking = false;
  }
  function bindScroll() {
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------- hero */
  function hero() {
    var h1 = $(".hero h1");
    if (h1 && !reduce && !h1.dataset.split) {
      h1.dataset.split = "1";
      var text = h1.textContent.trim().split(/\s+/);
      h1.textContent = "";
      text.forEach(function (w, i) {
        var o = doc.createElement("span"); o.className = "w";
        var n = doc.createElement("span"); n.textContent = w; n.style.setProperty("--i", i);
        o.appendChild(n);
        h1.appendChild(o);
        if (i < text.length - 1) h1.appendChild(doc.createTextNode(" "));
      });
    }
    root.classList.add("hero-ready");

    // Движение мыши: слои фото смещаются на несколько пикселей
    if (!heroEl || !heroVisual || reduce || !fine) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, run = false;
    heroEl.addEventListener("pointermove", function (e) {
      var r = heroEl.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2;
      ty = ((e.clientY - r.top) / r.height - .5) * 2;
      if (!run) { run = true; requestAnimationFrame(loop); }
    });
    heroEl.addEventListener("pointerleave", function () { tx = 0; ty = 0; if (!run) { run = true; requestAnimationFrame(loop); } });
    function loop() {
      cx += (tx - cx) * .07; cy += (ty - cy) * .07;
      heroVisual.style.setProperty("--mx", (cx * 10).toFixed(2) + "px");
      heroVisual.style.setProperty("--my", (cy * 8).toFixed(2) + "px");
      if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) requestAnimationFrame(loop); else run = false;
    }
  }

  /* --------------------------------------------------------------- count */
  function count() {
    $$("[data-count]").forEach(function (el) {
      var to = parseFloat(el.dataset.count);
      if (reduce || !("IntersectionObserver" in window)) { el.textContent = to; return; }
      el.textContent = "0";
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now(), dur = 1400;
        (function f(now) {
          var p = Math.min((now - t0) / dur, 1);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(f);
        })(t0);
      }, { threshold: .6 });
      io.observe(el);
    });
  }

  /* ----------------------------------------------- блик и «притяжение» (ПК) */
  function pointerFx() {
    if (!fine || reduce) return;
    doc.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".spot");
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--sx", (e.clientX - r.left).toFixed(0) + "px");
      card.style.setProperty("--sy2", (e.clientY - r.top).toFixed(0) + "px");
    }, { passive: true });

    $$(".btn-primary.btn-lg, .btn-primary.magnet").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width * 10;
        var y = (e.clientY - r.top - r.height / 2) / r.height * 8;
        b.style.translate = x.toFixed(1) + "px " + y.toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  }

  /* ---------------------------------------------------------------- tabs */
  function tabs() {
    $$("[data-tabs]").forEach(function (box) {
      var tabs = $$(".trio-tab", box), panels = $$(".trio-panel", box), bar = $(".trio-bar", box);
      function place(t) {
        if (!bar) return;
        bar.style.setProperty("--bx", t.offsetLeft + "px");
        bar.style.setProperty("--by", t.offsetTop + "px");
        bar.style.setProperty("--bw", t.offsetWidth + "px");
        bar.style.setProperty("--bh", t.offsetHeight + "px");
      }
      function select(i, focus) {
        tabs.forEach(function (t, k) {
          var on = k === i;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on);
          t.tabIndex = on ? 0 : -1;
          panels[k].hidden = !on;
          panels[k].classList.toggle("is-active", on);
        });
        place(tabs[i]);
        if (focus) tabs[i].focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { select(i); });
        t.addEventListener("keydown", function (e) {
          var n = tabs.length, k = i;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") k = (i + 1) % n;
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") k = (i + n - 1) % n;
          else if (e.key === "Home") k = 0;
          else if (e.key === "End") k = n - 1;
          else return;
          e.preventDefault(); select(k, true);
        });
      });
      var cur = tabs.findIndex(function (t) { return t.classList.contains("is-active"); });
      select(Math.max(0, cur));
      window.addEventListener("resize", function () { place(tabs.filter(function (t) { return t.classList.contains("is-active"); })[0]); });
      window.addEventListener("load", function () { place(tabs.filter(function (t) { return t.classList.contains("is-active"); })[0]); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { place(tabs.filter(function (t) { return t.classList.contains("is-active"); })[0]); });
    });
  }

  /* ----------------------------------------- карусель услуг на телефоне */
  function snap() {
    $$("[data-snap]").forEach(function (box) {
      var dots = box.nextElementSibling;
      if (!dots || !dots.classList.contains("snap-dots")) return;
      var d = [].slice.call(dots.children), cards = [].slice.call(box.children), t = false;
      function upd() {
        var c = box.scrollLeft + box.clientWidth / 2, best = 0, bd = 1e9;
        cards.forEach(function (el, i) {
          var m = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c);
          if (m < bd) { bd = m; best = i; }
        });
        d.forEach(function (x, i) { x.classList.toggle("is-on", i === best); });
        t = false;
      }
      box.addEventListener("scroll", function () { if (!t) { t = true; requestAnimationFrame(upd); } }, { passive: true });
      d.forEach(function (x, i) {
        x.addEventListener("click", function () { box.scrollTo({ left: cards[i].offsetLeft - (box.clientWidth - cards[i].offsetWidth) / 2, behavior: "smooth" }); });
      });
      upd();
    });
  }

  /* ----------------------------------------------- FAQ: плавное раскрытие */
  function faq() {
    if (reduce || !doc.documentElement.animate) return;
    $$(".faq").forEach(function (d) {
      var sum = $("summary", d), anim = null;
      d.classList.add("js-faq");
      if (d.open) d.classList.add("is-open");
      function run(from, to, done) {
        d.style.overflow = "hidden";
        anim = d.animate({ height: [from + "px", to + "px"] }, { duration: 420, easing: "cubic-bezier(.22,.72,.2,1)", fill: "forwards" });
        anim.onfinish = function () { if (done) done(); anim.cancel(); anim = null; d.style.overflow = ""; };
      }
      sum.addEventListener("click", function (e) {
        e.preventDefault();
        var from = d.offsetHeight;
        if (anim) { anim.cancel(); anim = null; d.style.overflow = ""; from = d.offsetHeight; }
        if (d.open) {
          d.classList.remove("is-open");
          run(from, sum.offsetHeight, function () { d.open = false; });
        } else {
          d.open = true;
          d.classList.add("is-open");
          run(from, d.scrollHeight, null);
        }
      });
    });
  }

  function init() {
    faq(); reveal(); hero(); count(); pointerFx(); tabs(); snap(); bindScroll();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
