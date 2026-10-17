/**
 * calculator.js — ориентировочный калькулятор стоимости.
 *
 * Единый источник цен — карточки услуг в index.html:
 *   <article class="service" data-service="Название" data-price="5000">
 * Калькулятор сам строит список из этих карточек, поэтому, меняя цену в
 * разметке, вы автоматически меняете и расчёт. Никаких «придуманных»
 * коэффициентов нет — считается сумма базовых цен «от».
 */
(function () {
  "use strict";

  var list = document.getElementById("calc-list");
  var sumEl = document.getElementById("calc-sum");
  var hint = document.getElementById("calc-hint");
  var send = document.getElementById("calc-send");
  var cards = document.querySelectorAll(".service[data-price]");
  if (!list || !cards.length) return;

  var fmt = function (n) { return Math.round(n).toLocaleString("ru-RU"); };
  var shown = 0, raf = null;

  /** Склонение: 1 услуга, 2 услуги, 5 услуг */
  function plural(n, forms) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  /** Плавная смена суммы */
  function animateTo(target) {
    cancelAnimationFrame(raf);
    var from = shown, start = performance.now(), dur = 450;
    (function frame(now) {
      var p = Math.min((now - start) / dur, 1);
      shown = from + (target - from) * (1 - Math.pow(1 - p, 3));
      sumEl.textContent = fmt(shown);
      if (p < 1) raf = requestAnimationFrame(frame);
    })(start);
  }

  /* Строим список чекбоксов */
  [].forEach.call(cards, function (card, i) {
    var li = document.createElement("li");
    var label = document.createElement("label");
    label.className = "calc-item";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.className = "check";
    input.value = card.dataset.price;
    input.dataset.name = card.dataset.service;
    input.id = "calc-" + i;

    var name = document.createElement("span");
    name.className = "calc-name";
    name.textContent = card.dataset.service;

    var price = document.createElement("span");
    price.className = "calc-price";
    var small = document.createElement("small"); small.textContent = "от";
    price.appendChild(small);
    price.appendChild(document.createTextNode(" " + fmt(card.dataset.price) + " ₽"));

    label.appendChild(input); label.appendChild(name); label.appendChild(price);
    li.appendChild(label);
    list.appendChild(li);
  });

  function selected() {
    return [].filter.call(list.querySelectorAll("input"), function (i) { return i.checked; });
  }

  function update() {
    var items = selected();
    var total = items.reduce(function (s, i) { return s + parseFloat(i.value); }, 0);
    animateTo(total);
    var box = sumEl.closest(".calc-total");
    if (box) { box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump"); }
    send.disabled = !items.length;
    hint.textContent = items.length
      ? "Выбрано: " + items.length + " " + plural(items.length, ["услуга", "услуги", "услуг"]) + ". Точную цену назовём после осмотра."
      : "Выберите хотя бы одну услугу";
  }
  list.addEventListener("change", update);

  /* Отправка расчёта в форму записи (обрабатывает form.js) */
  send.addEventListener("click", function () {
    var items = selected();
    var total = items.reduce(function (s, i) { return s + parseFloat(i.value); }, 0);
    var names = items.map(function (i) { return i.dataset.name; });
    document.dispatchEvent(new CustomEvent("kotis:order", {
      detail: {
        services: names,
        comment: "Расчёт с сайта: " + names.join(", ") + ". Ориентировочно от " + fmt(total) + " ₽."
      }
    }));
  });

  update();
})();
