/**
 * reviews.js — бегущая лента отзывов.
 *   • На широком экране — две ленты, едут в разные стороны; на телефоне — одна лента.
 *   • Каждый набор карточек дублируется один раз, лента ездит по кругу без стыка.
 *   • При наведении (и при касании на телефоне) лента останавливается.
 *   • Скорость постоянная: время оборота считается от ширины ленты.
 *   • При включённом «уменьшить анимацию» лента не двигается и листается вручную.
 */
(function () {
  "use strict";

  var wrap = document.getElementById("reviews-ticker");
  if (!wrap) return;
  var firstTrack = wrap.querySelector(".reviews-track");
  var firstSet = firstTrack && firstTrack.querySelector(".reviews-set");
  if (!firstSet) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cards = [].slice.call(firstSet.children);          // исходные карточки
  var SPEED = 38;                                         // пикселей в секунду
  var wide = window.matchMedia("(min-width: 900px)");

  function makeTrack(list, reverse) {
    var track = document.createElement("div");
    track.className = "reviews-track" + (reverse ? " is-reverse" : "");
    var set = document.createElement("div");
    set.className = "reviews-set";
    list.forEach(function (c) { set.appendChild(c); });
    track.appendChild(set);

    var clone = set.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    [].forEach.call(clone.querySelectorAll("blockquote"), function (b) { b.setAttribute("tabindex", "-1"); });
    track.appendChild(clone);
    return track;
  }

  function tune() {
    [].forEach.call(wrap.querySelectorAll(".reviews-track"), function (t) {
      var w = t.firstChild.getBoundingClientRect().width;
      if (w) t.style.setProperty("--dur", Math.round(w / SPEED) + "s");
    });
  }

  function build() {
    wrap.textContent = "";
    if (wide.matches && cards.length > 5) {
      var half = Math.ceil(cards.length / 2);
      wrap.appendChild(makeTrack(cards.slice(0, half), false));
      wrap.appendChild(makeTrack(cards.slice(half), true));
    } else {
      wrap.appendChild(makeTrack(cards, false));
    }
    tune();
  }

  build();
  if (wide.addEventListener) wide.addEventListener("change", build);
  window.addEventListener("resize", tune);
  window.addEventListener("load", tune);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(tune);

  // Касание на телефоне: пауза на время касания и ещё пару секунд после
  var timer = null;
  wrap.addEventListener("touchstart", function () { clearTimeout(timer); wrap.classList.add("is-paused"); }, { passive: true });
  wrap.addEventListener("touchend", function () { timer = setTimeout(function () { wrap.classList.remove("is-paused"); }, 2500); }, { passive: true });
  wrap.addEventListener("touchcancel", function () { wrap.classList.remove("is-paused"); }, { passive: true });
})();
