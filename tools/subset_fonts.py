#!/usr/bin/env python3
"""
Подготовка веб-шрифтов.

Берёт установленный в системе шрифт Inter (лицензия SIL OFL 1.1),
оставляет только нужные символы (латиница + кириллица + типографика)
и сохраняет в формате WOFF — файлы получаются в 5-8 раз легче оригинала.

Запуск:
    python3 tools/subset_fonts.py [папка_с_otf] [папка_результата]
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/opentype/inter")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "assets" / "fonts")
OUT.mkdir(parents=True, exist_ok=True)

# Файл исходника -> имя результата
FONTS = {
    "Inter-Regular.otf":      "inter-400.woff",
    "Inter-Medium.otf":       "inter-500.woff",
    "Inter-SemiBold.otf":     "inter-600.woff",
    "InterDisplay-Bold.otf":  "inter-display-700.woff",
    "InterDisplay-ExtraBold.otf": "inter-display-800.woff",
}

# Диапазоны Юникода, которые реально используются на сайте
UNICODES = (
    list(range(0x0020, 0x007F))      # базовая латиница
    + list(range(0x00A0, 0x0100))    # Latin-1 (пробел-неразрывный, «», ·, ×)
    + list(range(0x0400, 0x0460))    # кириллица
    + [0x0401, 0x0451, 0x2116]       # Ё, ё, №
    + list(range(0x2010, 0x2028))    # тире, кавычки, многоточие, •
    + [0x20BD, 0x2212, 0x2013, 0x2014]  # ₽, минус, тире
    + list(range(0x2190, 0x2194))    # стрелки
    + [0x2605, 0x2713, 0x2715]       # ★ ✓ ✕
)

opts = subset.Options()
opts.flavor = "woff"
opts.layout_features = ["*"]
opts.notdef_outline = True
opts.name_IDs = ["*"]
opts.drop_tables += ["DSIG"]

for src_name, out_name in FONTS.items():
    src = SRC / src_name
    if not src.exists():
        print(f"[пропуск] нет файла {src}")
        continue
    font = TTFont(str(src))
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = "woff"
    font.save(str(OUT / out_name))
    print(f"{out_name:28s} {(OUT / out_name).stat().st_size / 1024:6.1f} КБ")
