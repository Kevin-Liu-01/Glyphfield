"""Make the files in public/og/ that Glyphfield's social preview cards use.

Run from the repository root with Python 3, fontTools and Pillow:

    python3 scripts/generate-og-assets.py

Fonts. next/og (Satori, which parses fonts with opentype.js) fails on Inter Variable's fvar
table, so this script instances public/fonts/inter-variable-latin.ttf into the static cuts the
cards set: Inter Display SemiBold (opsz 32, wght 600) for headlines and Inter Text Regular and
Medium (opsz 14) for running text. opentype.js only reads GPOS pair kerning that is not wrapped
in an Extension lookup, and Inter's is, so the script evaluates Inter's GPOS kerning for every
pair in the cards' character set the way HarfBuzz applies it and stores the result as a legacy
`kern` table. Each cut gets a JSON file of advance widths and kerning pairs (keyed by character)
that src/components/BrandOpenGraphImage.tsx typesets with. Inter is licensed under the SIL Open
Font License 1.1 (public/fonts/inter-OFL.txt).

Studio capture. studio-design-lab.jpg is a crop of public/screenshots/
studio-gt-design-lab-dark-2026.webp (shader library and canvas) at 0.8 scale.
"""
import json
import os

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
from fontTools.varLib import instancer
from PIL import Image

SOURCE_FONT = 'public/fonts/inter-variable-latin.ttf'
SOURCE_SCREENSHOT = 'public/screenshots/studio-gt-design-lab-dark-2026.webp'
OUTPUT = 'public/og'
CUTS = (
    ('inter-display-600', {'opsz': 32, 'wght': 600}),
    ('inter-text-400', {'opsz': 14, 'wght': 400}),
    ('inter-text-500', {'opsz': 14, 'wght': 500}),
)
CODEPOINTS = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + list(range(0x2010, 0x2028))
    + [0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2197, 0x2212, 0x2248, 0x2260, 0x2264, 0x2265]
)
# Pairs smaller than this (in font units of 2048 per em) move a glyph by less than 0.4 px at 100 px.
MINIMUM_PAIR = 8
SCREENSHOT_BOX = (216, 103)
SCREENSHOT_SCALE = 0.8
SCREENSHOT_SIZE = (392, 498)


def kerning_lookups(gpos):
    """The PairPos subtables of every lookup the kern feature uses, in lookup order."""
    indices = set()
    for record in gpos.FeatureList.FeatureRecord:
        if record.FeatureTag == 'kern':
            indices.update(record.Feature.LookupListIndex)
    lookups = []
    for index in sorted(indices):
        lookup = gpos.LookupList.Lookup[index]
        subtables = []
        for subtable in lookup.SubTable:
            if lookup.LookupType == 9:
                if subtable.ExtensionLookupType != 2:
                    break
                subtable = subtable.ExtSubTable
            elif lookup.LookupType != 2:
                break
            subtable.coverage_index = {glyph: i for i, glyph in enumerate(subtable.Coverage.glyphs)}
            subtables.append(subtable)
        else:
            lookups.append(subtables)
    return lookups


def pair_value(subtables, left, right):
    """HarfBuzz order: the first subtable that covers the left glyph and has the pair applies."""
    for subtable in subtables:
        if left not in subtable.coverage_index:
            continue
        if subtable.Format == 1:
            for record in subtable.PairSet[subtable.coverage_index[left]].PairValueRecord:
                if record.SecondGlyph == right:
                    return getattr(record.Value1, 'XAdvance', 0) or 0
            continue
        class1 = subtable.ClassDef1.classDefs.get(left, 0)
        class2 = subtable.ClassDef2.classDefs.get(right, 0)
        return getattr(subtable.Class1Record[class1].Class2Record[class2].Value1, 'XAdvance', 0) or 0
    return 0


def make_cut(name, location):
    font = instancer.instantiateVariableFont(TTFont(SOURCE_FONT), location, updateFontNames=True)
    cmap = font.getBestCmap()
    characters = {codepoint: cmap[codepoint] for codepoint in CODEPOINTS if codepoint in cmap}
    glyphs = sorted(set(characters.values()))
    lookups = kerning_lookups(font['GPOS'].table)
    pairs = {}
    for left in glyphs:
        for right in glyphs:
            value = round(sum(pair_value(subtables, left, right) for subtables in lookups))
            if value:
                pairs[(left, right)] = value

    options = Options()
    options.layout_features = []
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.drop_tables += ['GPOS', 'GSUB', 'GDEF', 'STAT', 'MVAR', 'HVAR', 'avar']
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=list(characters))
    subsetter.subset(font)

    table = KernTable_format_0()
    table.version = 0
    table.coverage = 1
    table.format = 0
    table.kernTable = pairs
    font['kern'] = newTable('kern')
    font['kern'].version = 0
    font['kern'].kernTables = [table]
    font.save(os.path.join(OUTPUT, f'{name}.ttf'))

    by_glyph = {}
    for codepoint, glyph in characters.items():
        by_glyph.setdefault(glyph, []).append(chr(codepoint))
    kerning = {}
    for (left, right), value in sorted(pairs.items()):
        if abs(value) < MINIMUM_PAIR:
            continue
        for left_character in by_glyph[left]:
            for right_character in by_glyph[right]:
                kerning.setdefault(left_character, {})[right_character] = value
    metrics = {
        'advances': {chr(codepoint): font['hmtx'].metrics[glyph][0] for codepoint, glyph in sorted(characters.items())},
        'kerning': kerning,
        'unitsPerEm': font['head'].unitsPerEm,
    }
    with open(os.path.join(OUTPUT, f'{name}.json'), 'w', encoding='utf-8') as handle:
        json.dump(metrics, handle, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f'{name}: {len(glyphs)} glyphs, {len(pairs)} kerning pairs')


def make_screenshot():
    width, height = SCREENSHOT_SIZE
    left, top = SCREENSHOT_BOX
    box = (left, top, left + round(width / SCREENSHOT_SCALE), top + round(height / SCREENSHOT_SCALE))
    image = Image.open(SOURCE_SCREENSHOT).convert('RGB').crop(box).resize(SCREENSHOT_SIZE, Image.LANCZOS)
    image.save(os.path.join(OUTPUT, 'studio-design-lab.jpg'), quality=88, optimize=True)
    print(f'studio-design-lab.jpg: {width} x {height} from {box}')


if __name__ == '__main__':
    os.makedirs(OUTPUT, exist_ok=True)
    for cut_name, cut_location in CUTS:
        make_cut(cut_name, cut_location)
    make_screenshot()
