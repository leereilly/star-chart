#!/usr/bin/env python3
"""Generate a tiny fallback font that supplies the star glyphs (U+2605 ★ and
U+2606 ☆) missing from Roboto, so the GIF rasteriser (resvg + bundled fonts)
renders the header total and logo instead of tofu.

The outlines are simple, self-authored five-pointed stars. The resulting font
is released into the public domain (CC0); see assets/fonts/LICENSE-StarChartSymbols.txt.
"""
import math
import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
ASCENT = 800
DESCENT = -200
CENTER_Y = 340
OUTER = 300
INNER = round(OUTER * 0.382)
CENTER_X = 310
ADVANCE = 620


def star_points(filled: bool):
    """Ten alternating outer/inner vertices of a five-pointed star (point up)."""
    pts = []
    for i in range(10):
        angle = math.radians(-90 + i * 36)
        radius = OUTER if i % 2 == 0 else INNER
        x = CENTER_X + radius * math.cos(angle)
        y = CENTER_Y + radius * math.sin(angle)
        pts.append((round(x), round(y)))
    return pts


def draw_filled(pen):
    pts = star_points(True)
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()


def draw_outline(pen):
    # Outer contour (clockwise) plus a scaled inner contour (counter-clockwise)
    # to leave a hollow centre for ☆.
    outer = star_points(True)
    pen.moveTo(outer[0])
    for p in outer[1:]:
        pen.lineTo(p)
    pen.closePath()
    scale = 0.62
    inner = []
    for i in range(10):
        angle = math.radians(-90 + i * 36)
        radius = (OUTER if i % 2 == 0 else INNER) * scale
        x = CENTER_X + radius * math.cos(angle)
        y = CENTER_Y + radius * math.sin(angle)
        inner.append((round(x), round(y)))
    inner.reverse()
    pen.moveTo(inner[0])
    for p in inner[1:]:
        pen.lineTo(p)
    pen.closePath()


def build():
    glyph_order = [".notdef", "space", "blackstar", "whitestar"]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap({0x20: "space", 0x2605: "blackstar", 0x2606: "whitestar"})

    pens = {}
    notdef = TTGlyphPen(None)
    pens[".notdef"] = notdef.glyph()

    space = TTGlyphPen(None)
    pens["space"] = space.glyph()

    black = TTGlyphPen(None)
    draw_filled(black)
    pens["blackstar"] = black.glyph()

    white = TTGlyphPen(None)
    draw_outline(white)
    pens["whitestar"] = white.glyph()

    fb.setupGlyf(pens)

    metrics = {
        ".notdef": (ADVANCE, 0),
        "space": (ADVANCE, 0),
        "blackstar": (ADVANCE, 25),
        "whitestar": (ADVANCE, 25),
    }
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupNameTable(
        {
            "familyName": "StarChartSymbols",
            "styleName": "Regular",
            "uniqueFontIdentifier": "StarChartSymbols-Regular",
            "fullName": "StarChartSymbols Regular",
            "psName": "StarChartSymbols-Regular",
            "version": "Version 1.000",
            "manufacturer": "star-chart",
            "designer": "star-chart",
            "licenseDescription": "Public domain (CC0 1.0).",
        }
    )
    fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, usWinAscent=ASCENT, usWinDescent=-DESCENT)
    fb.setupPost()

    here = os.path.dirname(os.path.abspath(__file__)) or os.getcwd()
    out = os.path.normpath(
        os.path.join(here, "..", "assets", "fonts", "StarChartSymbols-Regular.ttf")
    )
    fb.save(out)
    print("wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    build()
