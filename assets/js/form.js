/**
 * form.js — форма записи.
 *
 *  • услуги — чипы с множественным выбором, строятся из карточек услуг (единый источник);
 *  • маска телефона +7 (___) ___-__-__ и проверка полей;
 *  • «предзаполнение» из других блоков (кнопки «Заказать», калькулятор) через событие
 *    document.dispatchEvent(new CustomEvent("kotis:order", {detail: {services: [...], comment: "..."}}));
 *  • отправка: если задан KOTIS_CONFIG.formEndpoint — POST (JSON) на сервис, иначе текст заявки
 *    копируется в буфер обмена и посетителю предлагается отправить его во ВКонтакте или позвонить.
 */
(function () {
  "use strict";

  var cfg = window.KOTIS_CONFIG || {};
  var form = document.getElementById("booking-form");
  if (!form) return;

  var els = {
    name: form.elements.name,
    phone: form.elements.phone,
    car: form.elements.car,
    comment: form.elements.comment,
    submit: document.getElementById("form-submit"),
    result: document.getElementById("form-result"),
    services: document.getElementById("f-services")
  };

  /* --------------------------------------------- услуги: чипы с мультивыбором */
  function fillServices() {
    [].forEach.call(document.querySelectorAll(".service[data-service]"), function (c) {
      var label = document.createElement("label");
      label.className = "chip";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "service";
      input.value = c.dataset.service;
      label.appendChild(input);
      label.appendChild(document.createTextNode(c.dataset.service));
      els.services.appendChild(label);
    });
  }
  function chosen() {
    return [].filter.call(els.services.querySelectorAll("input"), function (i) { return i.checked; })
      .map(function (i) { return i.value; });
  }
  function choose(names, replace) {
    [].forEach.call(els.services.querySelectorAll("input"), function (i) {
      if (names.indexOf(i.value) !== -1) i.checked = true;
      else if (replace) i.checked = false;
    });
  }

  /* ------------------------------------------------------- маска телефона */
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, "");
    if (!d) return "";
    // вставили номер целиком (8… или +7…) в поле, где уже стоит подставленный префикс «+7 ("
    if (d.length > 11 && d[0] === "7" && (d[1] === "7" || d[1] === "8")) d = d.slice(1);
    if (d[0] === "8") d = "7" + d.slice(1);
    if (d[0] !== "7") d = "7" + d;
    d = d.slice(0, 11);
    var out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 4) out += ")";
    if (d.length > 4) out += " " + d.slice(4, 7);
    if (d.length > 7) out += "-" + d.slice(7, 9);
    if (d.length > 9) out += "-" + d.slice(9, 11);
    return out;
  }
  els.phone.addEventListener("input", function () {
    var atEnd = els.phone.selectionStart === els.phone.value.length;
    els.phone.value = formatPhone(els.phone.value);
    if (atEnd) els.phone.setSelectionRange(els.phone.value.length, els.phone.value.length);
  });
  els.phone.addEventListener("focus", function () { if (!els.phone.value) els.phone.value = "+7 ("; });
  els.phone.addEventListener("blur", function () { if (els.phone.value.replace(/\D/g, "").length <= 1) els.phone.value = ""; });

  /* ------------------------------------------------------------ валидация */
  function setError(input, msg) {
    var field = input.closest(".field");
    if (!field) return;
    field.classList.toggle("has-error", !!msg);
    var e = field.querySelector(".field-error");
    if (e) e.textContent = msg || "";
  }
  function validate() {
    var ok = true;
    if (els.name.value.trim().length < 2) { setError(els.name, "Укажите, как к вам обращаться"); ok = false; } else setError(els.name, "");
    if (els.phone.value.replace(/\D/g, "").length !== 11) { setError(els.phone, "Введите номер полностью, например +7 (953) 000-00-00"); ok = false; } else setError(els.phone, "");
    return ok;
  }
  [els.name, els.phone].forEach(function (i) { i.addEventListener("input", function () { setError(i, ""); }); });

  /* ----------------------------------------------- предзаполнение из блоков */
  function scrollToForm() {
    document.getElementById("booking").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  document.addEventListener("kotis:order", function (e) {
    var d = e.detail || {};
    var services = d.services || [];
    choose(services, services.length > 1);          // из калькулятора выбор заменяется, из карточки — добавляется
    if (d.comment) els.comment.value = d.comment;
    scrollToForm();
    setTimeout(function () { els.name.focus({ preventScroll: true }); }, 700);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-order]");
    if (!t) return;
    var service = t.getAttribute("data-order");
    if (t.tagName === "A") { choose([service], false); return; }
    document.dispatchEvent(new CustomEvent("kotis:order", { detail: { services: [service] } }));
  });

  /* ------------------------------------------------------- текст заявки */
  function buildMessage() {
    var s = chosen();
    var lines = [
      "Заявка с сайта АвтоАтелье «КоТиС»",
      "Имя: " + els.name.value.trim(),
      "Телефон: " + els.phone.value.trim(),
      "Услуги: " + (s.length ? s.join(", ") : "консультация")
    ];
    if (els.car.value.trim()) lines.push("Автомобиль: " + els.car.value.trim());
    if (els.comment.value.trim()) lines.push("Комментарий: " + els.comment.value.trim());
    return lines.join("\n");
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {          // запасной способ для file:// и старых браузеров
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  /* ------------------------------------------------------------ результат */
  function showResult(title, text, actions, isError) {
    var box = els.result;
    box.textContent = "";
    box.classList.toggle("is-error", !!isError);
    var b = document.createElement("b"); b.textContent = title;
    var p = document.createElement("p"); p.textContent = text;
    box.appendChild(b); box.appendChild(p);
    if (actions && actions.length) {
      var row = document.createElement("div"); row.className = "result-actions";
      actions.forEach(function (a) { row.appendChild(a); });
      box.appendChild(row);
    }
    box.hidden = false;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function link(text, href, primary) {
    var a = document.createElement("a");
    a.className = "btn btn-sm " + (primary ? "btn-primary" : "btn-ghost");
    a.href = href; a.textContent = text;
    if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }

  /* ------------------------------------------------------------- отправка */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (form.elements.website && form.elements.website.value) return;     // сработала «ловушка» для ботов
    if (!validate()) {
      var bad = form.querySelector(".has-error input");
      if (bad) bad.focus();
      return;
    }
    var message = buildMessage();

    if (cfg.formEndpoint) {
      els.submit.disabled = true;
      var payload = {
        name: els.name.value.trim(), phone: els.phone.value.trim(), services: chosen(),
        car: els.car.value.trim(), comment: els.comment.value.trim(), message: message
      };
      fetch(cfg.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        form.reset();
        showResult("Заявка отправлена", "Спасибо! Мы свяжемся с вами в ближайшее время. Если вопрос срочный, позвоните.",
          [link("Позвонить", "tel:" + cfg.phone, true)]);
      }).catch(function () {
        showResult("Не удалось отправить", "Что-то пошло не так. Позвоните нам или напишите во ВКонтакте, так быстрее.",
          [link("Позвонить", "tel:" + cfg.phone, true), link("ВКонтакте", cfg.vkWriteUrl)], true);
      }).then(function () { els.submit.disabled = false; });
      return;
    }

    // Режим без сервера: копируем текст и направляем в мессенджер или на звонок
    copyText(message).then(function () {
      showResult("Заявка готова, осталось отправить",
        "Мы скопировали текст заявки. Откройте ВКонтакте и вставьте его в сообщение или просто позвоните нам.",
        [link("Написать ВКонтакте", cfg.vkWriteUrl, true), link("Позвонить", "tel:" + cfg.phone)]);
    }).catch(function () {
      showResult("Заявка готова, осталось отправить",
        "Скопируйте текст ниже и отправьте нам ВКонтакте, либо позвоните:\n\n" + message,
        [link("Написать ВКонтакте", cfg.vkWriteUrl, true), link("Позвонить", "tel:" + cfg.phone)]);
      els.result.querySelector("p").style.whiteSpace = "pre-line";
    });
  });

  fillServices();
})();
