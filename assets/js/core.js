/**
 * core.js — общее поведение страницы.
 *   theme     переключатель светлой/тёмной темы (запоминает выбор)
 *   header    шапка, мобильное меню, подсветка текущего раздела
 *   floating  кнопка «наверх» и плавающая кнопка «Позвонить» на телефонах
 *   map       карта включается нажатием (чтобы страница не «залипала» на ней)
 * Все обработчики прокрутки пассивные и работают через requestAnimationFrame.
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement;

  /** Блокировка прокрутки страницы (для меню и окон). Считает вложенные вызовы. */
  var locks = 0;
  window.KotisLock = function (on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    doc.body.classList.toggle("is-locked", locks > 0);
  };

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* localStorage недоступен */ }
    return null;
  }

  function theme() {
    var btn = doc.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.classList.add("theme-anim");                    // плавная смена цветов на ~0,5 с
      root.setAttribute("data-theme", next);
      setTimeout(function () { root.classList.remove("theme-anim"); }, 500);
      storage("kotis-theme", next);
    });
  }

  function header() {
    var bar = doc.querySelector(".site-header");
    var burger = doc.querySelector(".burger");
    var nav = doc.getElementById("main-nav");
    if (!bar) return;
    var open = false;

    function setMenu(state) {
      if (state === open) return;
      open = state;
      doc.body.classList.toggle("nav-open", open);
      window.KotisLock(open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    }
    if (burger && nav) {
      burger.addEventListener("click", function () { setMenu(!open); });
      nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
      window.matchMedia("(min-width: 921px)").addEventListener("change", function (e) { if (e.matches) setMenu(false); });
    }

    // Подсветка пункта меню для раздела на экране
    var links = [].slice.call(doc.querySelectorAll(".main-nav ul a"));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.remove("is-current"); });
          if (map[en.target.id]) map[en.target.id].classList.add("is-current");
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      [].forEach.call(doc.querySelectorAll("main > section[id]"), function (s) { io.observe(s); });   // разделы без пункта меню сбрасывают подсветку
    }

    var ticking = false;
    function update() {
      var y = window.scrollY;
      bar.classList.toggle("is-scrolled", y > 8);
      if (y < 200) links.forEach(function (a) { a.classList.remove("is-current"); });
      var top = doc.querySelector(".to-top"), call = doc.querySelector(".mobile-bar-call");
      if (top) top.classList.toggle("is-visible", y > 700);
      if (call) call.classList.toggle("is-visible", y > 500);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    var top = doc.querySelector(".to-top");
    if (top) top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  function mapCover() {
    var map = doc.getElementById("map"), cover = doc.getElementById("map-cover");
    if (!map || !cover) return;
    cover.addEventListener("click", function () { map.classList.add("is-active"); });
    // Вне карты управление снова отключается (на телефонах — чтобы не мешать прокрутке)
    doc.addEventListener("pointerdown", function (e) { if (!map.contains(e.target)) map.classList.remove("is-active"); });
  }

  function init() {
    theme(); header(); mapCover();
    var y = doc.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})();
