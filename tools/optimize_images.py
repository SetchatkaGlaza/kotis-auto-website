#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
optimize_images.py — подготовка графики для сайта АвтоАтелье «КоТиС».

Что делает скрипт:
  1. Берёт исходные фото (например, из архива клиента) и выбирает лучшие.
  2. Делает для каждого две версии WebP: миниатюра (сетка) и «полный» размер (лайтбокс).
  3. Режет коллажи «до/после» на две половины для интерактивного слайдера.
  4. Готовит логотип ателье, фавиконки и OG-картинку для соцсетей.
  5. Делает логотипы студии-разработчика прозрачными (светлая и тёмная версии).
  6. Генерирует assets/js/gallery-data.js — данные для галереи.

Использование:
    pip install pillow numpy
    python tools/optimize_images.py --src ПУТЬ_К_ПАПКЕ_С_ФОТО \
        [--dev-light light.png] [--dev-dark dark.png]

Исходные файлы должны называться так же, как в архиве клиента: 1.webp, 2.webp … logo_src.webp.
Чтобы добавить фото на сайт — допишите его номер в список GALLERY ниже и запустите скрипт заново.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# --------------------------------------------------------------------------- #
#  Пути
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
OUT_THUMB = IMG / "gallery" / "thumb"
OUT_FULL = IMG / "gallery" / "full"
OUT_BA = IMG / "ba"
OUT_BRAND = IMG / "brand"
OUT_HERO = IMG / "hero"
DATA_JS = ROOT / "assets" / "js" / "gallery-data.js"

# --------------------------------------------------------------------------- #
#  Настройки качества
# --------------------------------------------------------------------------- #
THUMB_W = 560        # ширина миниатюры, px (хватает для retina в колонке ~300px)
FULL_SIDE = 1280     # максимальная сторона «большого» фото, px
THUMB_Q = 74         # качество WebP миниатюры
FULL_Q = 76          # качество WebP большого фото

# --------------------------------------------------------------------------- #
#  Категории портфолио (ключ → название на сайте)
# --------------------------------------------------------------------------- #
CATEGORIES = {
    "wheel": "Руль и КПП",
    "seats": "Сиденья и салон",
    "covers": "Авточехлы",
    "doors": "Двери и детали",
    "restore": "Реставрация кожи",
}

# --------------------------------------------------------------------------- #
#  Что показываем в портфолио:  (номер файла, категория, подпись/alt)
# --------------------------------------------------------------------------- #
GALLERY = [
    # Руль и КПП
    (16, "wheel", "Руль Porsche, перетянутый алькантарой"),
    (5, "wheel", "Руль BMW в алькантаре"),
    (40, "wheel", "Подушка безопасности BMW, отделанная алькантарой"),
    (54, "wheel", "Спортивный руль BMW в алькантаре"),
    (24, "wheel", "Руль Volkswagen с красной строчкой и маркером на 12 часов"),
    (39, "wheel", "Руль Skoda с красной контрастной строчкой"),
    (46, "wheel", "Руль Changan: кожа и алькантара, красная строчка"),
    (75, "wheel", "Руль Lexus в алькантаре"),
    (82, "wheel", "Руль Volvo, перетянутый кожей с красной строчкой"),
    (85, "wheel", "Руль Mercedes в алькантаре"),
    (58, "wheel", "Руль Mercedes с белой контрастной строчкой"),
    (78, "wheel", "Руль BMW после перетяжки в кожу"),
    (104, "wheel", "Руль BMW M, перетянутый кожей"),
    (90, "wheel", "Руль с медными вставками после перетяжки"),
    (109, "wheel", "Руль Kia, перфорированная кожа"),
    (32, "wheel", "Руль Mazda в перфорированной коже"),
    (56, "wheel", "Руль Toyota после перетяжки"),
    (2, "wheel", "Руль с красной строчкой"),
    (3, "wheel", "Крупный план: ручная прострочка и вставка"),
    (12, "wheel", "Перетяжка кулисы КПП в мастерской"),
    (19, "wheel", "Ручка КПП в перфорированной коже"),
    (50, "wheel", "Чехол кулисы КПП в бежевой коже"),
    (77, "wheel", "Ручка селектора АКПП"),
    # Сиденья и салон
    (1, "seats", "Салон Ford Mustang в оранжевой алькантаре"),
    (13, "seats", "Передняя панель и консоль в оранжевой отделке"),
    (31, "seats", "Оранжевая отделка торпедо и дверей"),
    (65, "seats", "Салон Mustang: оранжевые сиденья и консоль"),
    (38, "seats", "Салон в коричневой коже с белым кантом"),
    (81, "seats", "Коньячная кожа, контрастный кант"),
    (87, "seats", "Светлая кожаная перетяжка сидений"),
    (115, "seats", "Светлые сиденья после перетяжки"),
    (117, "seats", "Бежевые сиденья со стёжкой ромбом"),
    (80, "seats", "Бежевый салон со стёжкой"),
    (51, "seats", "Задний диван со стёжкой ромбом"),
    (27, "seats", "Белая кожа сидений"),
    (111, "seats", "Светлые сиденья, чистая работа"),
    (6, "seats", "Чёрные кожаные сиденья"),
    (74, "seats", "Подлокотник в бежевой коже"),
    # Авточехлы
    (17, "covers", "Каркасные авточехлы с красной строчкой"),
    (25, "covers", "Задний диван: чехлы со стёжкой ромбом"),
    (83, "covers", "Авточехлы с ромбовой стёжкой"),
    (100, "covers", "Чёрные чехлы с контрастным ромбом"),
    (95, "covers", "Авточехлы с красной строчкой"),
    (57, "covers", "Чёрные чехлы с красной строчкой"),
    (52, "covers", "Чехлы с голубой вставкой и ромбом"),
    (9, "covers", "Чехлы синий + серый"),
    (101, "covers", "Чехлы чёрный + коричневый"),
    (94, "covers", "Чехлы: экокожа и алькантара"),
    (112, "covers", "Чехлы: экокожа и алькантара, чёрные"),
    (106, "covers", "Каркасные чехлы в экокоже"),
    (116, "covers", "Задний ряд в чёрных чехлах"),
    # Двери и детали
    (7, "doors", "Дверная карта со стёжкой ромбом и красной строчкой"),
    (98, "doors", "Дверная карта с красной ромбовой строчкой"),
    (66, "doors", "Дверная карта с ромбовой стёжкой"),
    (108, "doors", "Дверная карта: серая стёжка"),
    (14, "doors", "Салон с перетянутыми дверными картами"),
    (8, "doors", "Крышка подушки безопасности в бежевой коже"),
    (18, "doors", "Подлокотник, перетянутый кожей"),
    (23, "doors", "Накладки дверей в мастерской"),
    # Реставрация
    (30, "restore", "Ручки дверей: до и после реставрации"),
    (43, "restore", "Реставрация кожаной обивки"),
]

# Сердце портфолио в шапке сайта (hero): файл → имя на выходе
HERO = {16: "hero-wheel", 1: "hero-seats", 81: "hero-leather"}
# Фото для «больших» карточек услуг
SERVICE_PHOTOS = {16: "svc-wheel", 81: "svc-seats", 100: "svc-covers"}

# --------------------------------------------------------------------------- #
#  Пары «до/после»: (номер, как резать, заголовок, описание)
#   'v'    — две панели слева/справа, зазор 16px посередине (коллаж клиента)
#   'half' — коллаж без зазора, режем строго пополам
# --------------------------------------------------------------------------- #
PAIRS = [
    (10, "v", "Сиденье: трещины и потёртости", "Восстановление и покраска кожи сиденья"),
    (41, "v", "Перфорированная кожа", "Убрали потёртости, вернули цвет и фактуру"),
    (68, "v", "Боковая поддержка сиденья", "Реставрация трещин на боковине"),
    (88, "v", "Бежевая кожа", "Реставрация и окраска сиденья в родной оттенок"),
    (48, "half", "Спинка сиденья", "Убрали сетку трещин и въевшуюся грязь"),
]


# --------------------------------------------------------------------------- #
#  Вспомогательные функции
# --------------------------------------------------------------------------- #
def save_webp(im: Image.Image, path: Path, q: int) -> None:
    """Сохраняет изображение в WebP с заданным качеством."""
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)


def fit_width(im: Image.Image, w: int) -> Image.Image:
    """Уменьшает до ширины w (не увеличивает)."""
    if im.width <= w:
        return im.copy()
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def fit_side(im: Image.Image, side: int) -> Image.Image:
    """Уменьшает так, чтобы большая сторона была не больше side."""
    k = side / max(im.size)
    if k >= 1:
        return im.copy()
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def trim_white(im: Image.Image, thr: int = 246) -> Image.Image:
    """Обрезает белые поля вокруг панели коллажа."""
    a = np.array(im.convert("RGB"))
    m = a.min(axis=2) < thr
    ys = np.where(m.mean(axis=1) > 0.15)[0]
    xs = np.where(m.mean(axis=0) > 0.15)[0]
    return im.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


def alpha_trim(im: Image.Image, pad: int = 20, thr: int = 8) -> Image.Image:
    """Обрезает прозрачные поля по каналу alpha и добавляет отступ."""
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > thr)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
           min(xs.max() + pad, im.width), min(ys.max() + pad, im.height))
    return im.crop(box)


# --------------------------------------------------------------------------- #
#  Основные шаги
# --------------------------------------------------------------------------- #
def build_gallery(src: Path) -> list[dict]:
    items = []
    for num, cat, alt in GALLERY:
        im = Image.open(src / f"{num}.webp").convert("RGB")
        thumb = fit_width(im, THUMB_W)
        save_webp(thumb, OUT_THUMB / f"{num}.webp", THUMB_Q)
        save_webp(fit_side(im, FULL_SIDE), OUT_FULL / f"{num}.webp", FULL_Q)
        items.append({"id": num, "cat": cat, "alt": alt, "w": thumb.width, "h": thumb.height})
    print(f"  галерея: {len(items)} фото")
    return items


def build_hero(src: Path) -> None:
    for table, width in ((HERO, 900), (SERVICE_PHOTOS, 800)):
        for num, name in table.items():
            im = Image.open(src / f"{num}.webp").convert("RGB")
            save_webp(fit_width(im, width), OUT_HERO / f"{name}.webp", 78)
    print("  hero и карточки услуг готовы")


def build_pairs(src: Path) -> list[dict]:
    pairs = []
    for num, mode, title, desc in PAIRS:
        im = Image.open(src / f"{num}.webp").convert("RGB")
        w, h = im.size
        if mode == "v":
            left, right = im.crop((0, 0, 632, h)), im.crop((648, 0, w, h))
            left, right = trim_white(left), trim_white(right)
        else:
            left, right = im.crop((0, 0, w // 2, h)), im.crop((w // 2, 0, w, h))
        # приводим обе половины к одному размеру, чтобы слайдер совпадал
        cw, ch = min(left.width, right.width), min(left.height, right.height)
        left, right = left.crop((0, 0, cw, ch)), right.crop((0, 0, cw, ch))
        save_webp(fit_side(left, 1100), OUT_BA / f"{num}-before.webp", 80)
        save_webp(fit_side(right, 1100), OUT_BA / f"{num}-after.webp", 80)
        pairs.append({"id": num, "title": title, "desc": desc, "w": cw, "h": ch})
    print(f"  до/после: {len(pairs)} пар")
    return pairs


def build_brand(src: Path, dev_light: Path | None, dev_dark: Path | None) -> None:
    OUT_BRAND.mkdir(parents=True, exist_ok=True)
    # --- логотип ателье
    logo = alpha_trim(Image.open(src / "logo_src.webp").convert("RGBA"), pad=6)
    logo.save(OUT_BRAND / "logo.png", optimize=True)
    save_webp(fit_side(logo, 480), OUT_BRAND / "logo.webp", 90)
    # --- фавиконки (квадрат с логотипом на тёмном фоне)
    for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        canvas = Image.new("RGBA", (size, size), (20, 22, 28, 255))
        t = fit_side(logo, int(size * 0.84))
        canvas.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2))
        canvas.convert("RGB").save(OUT_BRAND / name, optimize=True)
    # --- логотипы студии-разработчика
    if dev_light:
        # исходник — чёрный логотип на светлом «шахматном» фоне → делаем прозрачность по яркости
        g = np.array(Image.open(dev_light).convert("L")).astype(float)
        alpha = np.clip((232 - g) / (232 - 70), 0, 1) * 255
        rgba = np.zeros((*g.shape, 4), dtype=np.uint8)
        rgba[..., 3] = alpha.astype(np.uint8)
        light = alpha_trim(Image.fromarray(rgba, "RGBA"), pad=10, thr=40)
        save_webp(fit_width(light, 720), OUT_BRAND / "dev-logo-light.webp", 92)
    if dev_dark:
        dark = alpha_trim(Image.open(dev_dark).convert("RGBA"), pad=10, thr=6)
        save_webp(fit_width(dark, 900), OUT_BRAND / "dev-logo-dark.webp", 92)
    print("  бренд-ассеты готовы")


def build_og(src: Path) -> None:
    """Открытка 1200×630 для соцсетей (Open Graph)."""
    W, H = 1200, 630
    bg = Image.new("RGB", (W, H), (14, 15, 19))
    # красное свечение слева
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-250, -150, 700, 800), fill=(110, 18, 24))
    from PIL import ImageFilter
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    bg = Image.blend(bg, Image.fromarray(np.maximum(np.array(bg), np.array(glow))), 1)
    # фото справа с плавным «растворением» к тексту
    PW = 480
    ph = Image.open(src / "1.webp").convert("RGB")
    ph = ph.crop((0, 120, ph.width, 120 + int(ph.width * H / PW)))
    ph = ph.resize((PW, H), Image.LANCZOS)
    ramp = np.clip(np.linspace(0, 1, PW) / 0.4, 0, 1)            # 0 → 1 на первых 40% ширины
    mask = Image.fromarray((np.tile(ramp, (H, 1)) * 255).astype(np.uint8), "L")
    bg.paste(ph, (W - PW, 0), mask)
    # логотип и текст
    logo = Image.open(OUT_BRAND / "logo.png").convert("RGBA")
    logo = fit_side(logo, 190)
    bg.paste(logo, (70, 70), logo)
    d = ImageDraw.Draw(bg)
    fdir = Path("/usr/share/fonts/opentype/inter")
    try:
        f_big = ImageFont.truetype(str(fdir / "InterDisplay-ExtraBold.otf"), 60)
        f_mid = ImageFont.truetype(str(fdir / "Inter-Medium.otf"), 30)
        f_sm = ImageFont.truetype(str(fdir / "Inter-SemiBold.otf"), 26)
    except OSError:  # нет Inter в системе — берём шрифт по умолчанию
        f_big = f_mid = f_sm = ImageFont.load_default()
    d.text((70, 300), "Перетяжка и\nреставрация салона", font=f_big, fill=(246, 241, 234), spacing=8)
    d.text((70, 468), "АвтоАтелье «КоТиС» · Вологда", font=f_mid, fill=(229, 57, 58))
    d.text((70, 520), "Руль · сиденья · потолок · шумоизоляция", font=f_sm, fill=(190, 186, 180))
    bg.save(OUT_BRAND / "og-image.jpg", quality=88, optimize=True)
    print("  OG-картинка готова")


def write_data(items: list[dict], pairs: list[dict]) -> None:
    """Пишет assets/js/gallery-data.js — данные подхватывает gallery.js."""
    payload = {
        "categories": CATEGORIES,
        "items": items,
        "pairs": pairs,
    }
    text = (
        "/* ЭТОТ ФАЙЛ СОЗДАЁТСЯ АВТОМАТИЧЕСКИ — tools/optimize_images.py. Не правьте вручную. */\n"
        "window.KOTIS_GALLERY = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    )
    DATA_JS.write_text(text, encoding="utf-8")
    print(f"  данные галереи → {DATA_JS.relative_to(ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Подготовка графики для сайта КоТиС")
    ap.add_argument("--src", required=True, type=Path, help="папка с исходными фото")
    ap.add_argument("--dev-light", type=Path, help="логотип разработчика (чёрный на светлом)")
    ap.add_argument("--dev-dark", type=Path, help="логотип разработчика (белый на прозрачном)")
    args = ap.parse_args()

    print("Готовлю графику…")
    items = build_gallery(args.src)
    build_hero(args.src)
    pairs = build_pairs(args.src)
    build_brand(args.src, args.dev_light, args.dev_dark)
    build_og(args.src)
    write_data(items, pairs)
    print("Готово.")


if __name__ == "__main__":
    main()
