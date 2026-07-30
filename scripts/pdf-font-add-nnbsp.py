"""Rüstet einem Font ein Glyph für U+202F nach (schmales geschütztes Leerzeichen).

Das Geist-Latin-Subset enthält kein U+202F. react-pdf hat keinen
Font-Fallback: Ein Zeichen ohne Glyph rendert im PDF mit Nullbreite, die
Nachbarzeichen kleben zusammen ("70%" statt "70 %"). Deshalb bekommt der
Font ein leeres Glyph mit halber Leerzeichen-Vorschubbreite (ca. 1/8
Geviert, übliche NNBSP-Breite) samt cmap-Eintrag.

Aufruf: python pdf-font-add-nnbsp.py <eingabe.woff> <ausgabe.woff>
Enthält der Font U+202F bereits, wird er unverändert kopiert.
"""

import sys

from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

NNBSP = 0x202F
GLYPH_NAME = "uni202F"

source_path, target_path = sys.argv[1], sys.argv[2]

font = TTFont(source_path)
cmap = font.getBestCmap()
if NNBSP in cmap:
    font.save(target_path)
    sys.exit(0)

space_advance, _ = font["hmtx"][cmap[0x20]]
narrow_advance = round(space_advance / 2)

if "glyf" in font:
    from fontTools.ttLib.tables._g_l_y_f import Glyph

    # Tabellen vor dem Erweitern der Glyph-Reihenfolge dekomprimieren
    glyf_table = font["glyf"]
    hmtx_table = font["hmtx"]
    font.setGlyphOrder(font.getGlyphOrder() + [GLYPH_NAME])
    glyf_table[GLYPH_NAME] = Glyph()
    hmtx_table[GLYPH_NAME] = (narrow_advance, 0)
elif "CFF " in font:
    cff_font = font["CFF "].cff
    top_dict = cff_font.topDictIndex[0]
    char_strings = top_dict.CharStrings
    pen = T2CharStringPen(narrow_advance, None)
    charstring = pen.getCharString(
        private=top_dict.Private, globalSubrs=cff_font.GlobalSubrs
    )
    font.setGlyphOrder(font.getGlyphOrder() + [GLYPH_NAME])
    char_strings.charStringsIndex.append(charstring)
    char_strings.charStrings[GLYPH_NAME] = len(char_strings.charStringsIndex) - 1
    top_dict.charset.append(GLYPH_NAME)
    font["maxp"].numGlyphs += 1
    font["hmtx"][GLYPH_NAME] = (narrow_advance, 0)
else:
    sys.exit("Weder glyf- noch CFF-Tabelle im Font gefunden")

for subtable in font["cmap"].tables:
    if subtable.isUnicode():
        subtable.cmap[NNBSP] = GLYPH_NAME

font.save(target_path)
