#!/usr/bin/env python3
"""
Сборка графических ресурсов сайта из исходных фотографий.

Что делает скрипт:
  1. Галерея  — для каждого выбранного фото делает превью (thumb) и
     полноразмерную версию (full) в WebP, а также генерирует
     assets/js/gallery-data.js с подписями и размерами.
  2. Hero      — готовит крупные кадры для первого экрана и CTA-блока.
  3. До/после  — разрезает «склеенные» фото реставрации пополам.
  4. Логотипы  — логотип ателье (+ favicon, OG-картинка) и логотипы веб-студии
     (светлая версия очищается от «шахматного» фона, тёмная — обрезается).

Запуск:
    python3 tools/build_assets.py <папка_с_исходными_фото> <логотип_студии_светлый.png> <логотип_студии_тёмный.png>

Зависимости: Pillow  (pip install pillow)
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"

# ----------------------------------------------------------------------------
# МАНИФЕСТ ГАЛЕРЕИ: номер файла -> (категория, подпись)
# Порядок = порядок показа внутри категории. Подписи используются как alt-текст
# (SEO + доступность) и в лайтбоксе.
# ----------------------------------------------------------------------------
CATEGORIES = {
    "wheel":   "Рули",
    "seats":   "Сиденья и салон",
    "covers":  "Авточехлы",
    "doors":   "Дверные карты",
    "details": "КПП и детали",
}

GALLERY = {
    "wheel": {
        5:   "Руль BMW: кожа и алькантара",
        16:  "Руль Porsche в алькантаре",
        54:  "Руль BMW M в алькантаре",
        2:   "Руль в гладкой коже с красной строчкой",
        75:  "Руль Lexus в серой алькантаре",
        39:  "Руль Škoda с красной строчкой",
        58:  "Руль Mercedes-Benz, перетяжка кожей",
        82:  "Руль Volvo с красной строчкой",
        24:  "Руль Volkswagen с красной строчкой",
        85:  "Руль Mercedes-Benz: кожа и алькантара",
        36:  "Руль Lexus: дерево и кожа",
        44:  "Руль Škoda в алькантаре",
        46:  "Спортивный руль с красной прострочкой",
        62:  "Руль Lexus со вставками под дерево",
        78:  "Руль BMW, перетяжка кожей",
        92:  "Руль Mercedes-Benz с перфорацией",
        99:  "Руль Toyota, перетяжка кожей",
        104: "Руль BMW, перетяжка кожей",
        110: "Руль Hyundai после перетяжки",
        114: "Руль Kia, перетяжка кожей",
        67:  "Руль Infiniti, перетяжка кожей",
        32:  "Руль Mazda, перетяжка кожей",
        69:  "Руль после перетяжки",
    },
    "seats": {
        13:  "Салон в оранжевой алькантаре и коже",
        55:  "Оранжевые сиденья: кожа и алькантара",
        22:  "Подлокотник и сиденья в оранжевой алькантаре",
        31:  "Панель и двери в оранжевой алькантаре",
        65:  "Консоль и сиденья в оранжевом цвете",
        1:   "Спортивные сиденья в оранжевой коже",
        38:  "Салон в коньячной коже с контрастной строчкой",
        81:  "Коньячная кожа со стёганым рисунком",
        20:  "Светлый салон: перетяжка кожей",
        27:  "Белые сиденья, перетяжка кожей",
        80:  "Светлые сиденья с ромбовой прострочкой",
        87:  "Бежевые сиденья в новой коже",
        111: "Светлая кожа салона",
        115: "Светлые сиденья после перетяжки",
        117: "Ромбовая прострочка на бежевой коже",
        51:  "Задний диван со стёжкой «ромб»",
        47:  "Сиденья: кожа и алькантара",
        72:  "Задний ряд: экокожа и алькантара",
        86:  "Серая алькантара на сиденьях",
        94:  "Кожа и коричневая алькантара",
    },
    "covers": {
        6:   "Каркасные авточехлы из чёрной экокожи",
        100: "Каркасные чехлы с белой строчкой",
        17:  "Чехлы с красной строчкой и ромбами",
        25:  "Чёрные чехлы с ромбовой строчкой",
        83:  "Ромбовая прострочка, чёрные чехлы",
        52:  "Чехлы с голубыми вставками",
        9:   "Авточехлы с синими вставками",
        95:  "Чехлы с красными акцентами",
        57:  "Задний диван с красной прострочкой",
        101: "Экокожа в двух тонах",
        106: "Чехлы из чёрной экокожи",
        112: "Чехол: кожа и алькантара",
        113: "Чехлы на задний ряд",
        116: "Чехлы на задний ряд с красным кантом",
    },
    "doors": {
        7:   "Дверная карта с красной ромбовой строчкой",
        14:  "Двери: чёрная кожа, красная строчка",
        98:  "Дверная карта с красной строчкой",
        66:  "Дверная карта со стёжкой «ромб»",
        108: "Серая дверная карта со стёжкой",
        37:  "Дверная карта в светлой коже",
        23:  "Накладка блока стеклоподъёмников",
    },
    "details": {
        3:   "Деревянная вставка и кожа, ручная строчка",
        50:  "Чехол кулисы КПП с ручной строчкой",
        19:  "Ручка КПП в перфорированной коже",
        60:  "Перетяжка селектора АКПП",
        77:  "Рычаг КПП со вставкой под дерево",
        18:  "Подлокотник с новой обтяжкой",
        74:  "Подлокотник в светлой коже",
        28:  "Накладка подушки безопасности в алькантаре",
        40:  "Крышка подушки безопасности в алькантаре",
    },
}

# Пары «до/после»: исходник склеен из двух половин (слева «до», справа «после»)
COMPARE_IDS = [10, 41, 68, 88, 48]

THUMB_LONG_SIDE = 560   # превью в сетке
FULL_LONG_SIDE = 1100   # лайтбокс


def load(src_dir: Path, name: int) -> Image.Image:
    im = Image.open(src_dir / f"{name}.webp")
    return ImageOps.exif_transpose(im).convert("RGB")


def save_webp(im: Image.Image, path: Path, long_side: int, quality: int) -> tuple[int, int]:
    im = im.copy()
    im.thumbnail((long_side, long_side), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def build_gallery(src_dir: Path) -> None:
    items = []
    for cat, files in GALLERY.items():
        for n, caption in files.items():
            im = load(src_dir, n)
            tw, th = save_webp(im, IMG / "gallery" / "thumb" / f"{n}.webp", THUMB_LONG_SIDE, 70)
            save_webp(im, IMG / "gallery" / "full" / f"{n}.webp", FULL_LONG_SIDE, 78)
            items.append({"id": n, "cat": cat, "w": tw, "h": th, "alt": caption})
    # Перемешиваем категории так, чтобы вкладка «Все» выглядела разнообразно:
    # берём по одному фото из каждой категории по кругу.
    by_cat = {c: [i for i in items if i["cat"] == c] for c in GALLERY}
    mixed, idx = [], 0
    while any(idx < len(v) for v in by_cat.values()):
        for c in GALLERY:
            if idx < len(by_cat[c]):
                mixed.append(by_cat[c][idx])
        idx += 1
    js = (
        "/**\n * Данные галереи. Файл генерируется скриптом tools/build_assets.py —\n"
        " * вручную править не нужно (подписи меняются в манифесте скрипта).\n */\n"
        "window.KOTIS_GALLERY = " + json.dumps(
            {"categories": CATEGORIES, "items": mixed}, ensure_ascii=False, indent=1) + ";\n"
    )
    (ROOT / "assets" / "js" / "gallery-data.js").write_text(js, encoding="utf-8")
    print(f"Галерея: {len(items)} фото")


def build_hero(src_dir: Path) -> None:
    out = IMG / "hero"
    save_webp(load(src_dir, 13), out / "hero-main.webp", 1000, 76)
    save_webp(load(src_dir, 5), out / "hero-wheel.webp", 640, 76)
    save_webp(load(src_dir, 81), out / "hero-seat.webp", 640, 76)
    save_webp(load(src_dir, 55), out / "cta-bg.webp", 1400, 70)
    save_webp(load(src_dir, 38), out / "materials.webp", 900, 74)
    print("Hero: готово")


def split_compare(src_dir: Path) -> None:
    """Находит светлую вертикальную полосу-разделитель и режет изображение на «до» и «после»."""
    out = IMG / "compare"
    out.mkdir(parents=True, exist_ok=True)
    for i, n in enumerate(COMPARE_IDS, 1):
        im = load(src_dir, n)
        g = im.convert("L")
        w, h = g.size
        px = g.load()
        # средняя яркость каждого столбца
        col = [sum(px[x, y] for y in range(0, h, 4)) / len(range(0, h, 4)) for x in range(w)]
        # ищем самую широкую светлую полосу ближе к центру
        best = None
        x = int(w * 0.35)
        while x < int(w * 0.65):
            if col[x] > 243:
                s = x
                while x < w and col[x] > 243:
                    x += 1
                if best is None or (x - s) > (best[1] - best[0]):
                    best = (s, x)
            x += 1
        gap = best or (w // 2 - 2, w // 2 + 2)
        left, right = im.crop((0, 0, gap[0], h)), im.crop((gap[1], 0, w, h))
        for tag, part in (("before", left), ("after", right)):
            # приводим к пропорции 3:4 по центру
            part = ImageOps.fit(part, (720, 960), Image.LANCZOS, centering=(0.5, 0.5))
            part.save(out / f"pair-{i}-{tag}.webp", "WEBP", quality=78, method=6)
        print(f"  пара {i}: файл {n}, разделитель {gap}")


def build_brand(src_dir: Path) -> None:
    out = IMG / "brand"
    out.mkdir(parents=True, exist_ok=True)
    logo = Image.open(src_dir / "логотип.webp").convert("RGB") if (src_dir / "логотип.webp").exists() else None
    if logo is None:  # имя файла может быть закодировано при распаковке
        cand = [p for p in src_dir.iterdir() if p.suffix == ".webp" and not p.stem.isdigit()]
        logo = Image.open(cand[0]).convert("RGB")
    logo.resize((192, 192), Image.LANCZOS).save(out / "logo-192.webp", "WEBP", quality=90)
    logo.resize((512, 512), Image.LANCZOS).save(out / "logo-512.png")
    logo.resize((180, 180), Image.LANCZOS).save(out / "apple-touch-icon.png")
    logo.resize((32, 32), Image.LANCZOS).save(out / "favicon-32.png")
    logo.save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Бренд: логотип и favicon готовы")


def build_og(src_dir: Path) -> None:
    """Картинка для превью ссылки в соцсетях и мессенджерах (1200×630)."""
    W, H = 1200, 630
    bg = ImageOps.fit(load(src_dir, 13), (W, H), Image.LANCZOS, centering=(0.5, 0.45))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    for x in range(W):  # градиент слева направо
        a = int(235 * max(0.0, 1 - x / (W * 0.95)) ** 0.8) + 20
        d.line([(x, 0), (x, H)], fill=(10, 10, 12, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), shade)
    fnt_dir = Path("/usr/share/fonts/opentype/inter")
    big = ImageFont.truetype(str(fnt_dir / "InterDisplay-ExtraBold.otf"), 76)
    mid = ImageFont.truetype(str(fnt_dir / "Inter-Medium.otf"), 32)
    small = ImageFont.truetype(str(fnt_dir / "Inter-SemiBold.otf"), 26)
    d = ImageDraw.Draw(bg)
    logo = Image.open(IMG / "brand" / "logo-512.png").resize((110, 110), Image.LANCZOS)
    bg.paste(logo, (70, 70))
    d.text((70, 215), "АвтоАтелье", font=big, fill=(242, 239, 233))
    d.text((70, 300), "«КоТиС»", font=big, fill=(240, 144, 47))
    d.text((70, 415), "Перетяжка салона, руля, потолка · авточехлы", font=mid, fill=(220, 214, 204))
    d.text((70, 462), "Реставрация кожи · шумоизоляция · Вологда", font=mid, fill=(220, 214, 204))
    d.text((70, 548), "★ 5,0 на Яндекс Картах  ·  Гагарина, 83А", font=small, fill=(240, 144, 47))
    bg.convert("RGB").save(IMG / "brand" / "og-image.jpg", quality=86)
    print("OG-картинка готова")


def build_dev_logos(light_png: Path, dark_png: Path) -> None:
    """Логотипы веб-студии для подвала.

    Светлый вариант: у исходника «запечён» шахматный фон — превращаем яркость
    в прозрачность, получаем чистый чёрный логотип на прозрачном фоне.
    Тёмный вариант: логотип с свечением на чёрном — на сайте показывается через
    mix-blend-mode: screen, поэтому чёрный фон «растворяется».
    """
    out = IMG / "dev"
    out.mkdir(parents=True, exist_ok=True)

    # --- светлый ---
    im = Image.open(light_png).convert("L")
    alpha = im.point(lambda v: 0 if v > 215 else min(255, int((215 - v) * 255 / 120)))
    black = Image.new("RGBA", im.size, (14, 14, 16, 0))
    black.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    pad = 24
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))
    black = black.crop(bbox)
    black.thumbnail((1000, 1000), Image.LANCZOS)
    black.save(out / "setchatkaglaza-light.png", optimize=True)

    # --- тёмный ---
    dk = Image.open(dark_png).convert("RGB")
    g = dk.convert("L").point(lambda v: 255 if v > 150 else 0)
    bb = g.getbbox()
    pad = 150  # оставляем место под свечение
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(dk.width, bb[2] + pad), min(dk.height, bb[3] + pad))
    dk = dk.crop(bb)
    dk.thumbnail((1000, 1000), Image.LANCZOS)
    dk.save(out / "setchatkaglaza-dark.webp", "WEBP", quality=88, method=6)
    print("Логотипы студии готовы:", black.size, dk.size)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    build_gallery(src)
    build_hero(src)
    # split_compare(src)   # блок «до/после» убран с сайта (этап 2); функция оставлена на случай возврата
    build_brand(src)
    build_og(src)
    build_dev_logos(Path(sys.argv[2]), Path(sys.argv[3]))
