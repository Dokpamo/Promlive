"""Export the hand-authored symbol source as individual, self-contained SVGs."""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parent
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
source = ET.parse(BASE / "icons.svg").getroot()
symbols = source.findall(f"{{{NS}}}defs/{{{NS}}}symbol")
assert len(symbols) == 36, f"Expected 36 icons, got {len(symbols)}"
assert len({s.attrib["id"] for s in symbols}) == len(symbols)

out = BASE / "svg"
out.mkdir(exist_ok=True)
manifest = []
for symbol in symbols:
    name = symbol.attrib["id"].removeprefix("ys-")
    label = symbol.attrib["data-label"]
    icon = ET.Element(f"{{{NS}}}svg", {
        "width": "24", "height": "24", "viewBox": "0 0 32 32",
        "fill": "none", "stroke": "currentColor", "stroke-width": "2.2",
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "role": "img", "aria-labelledby": f"{name}-title",
    })
    ET.SubElement(icon, f"{{{NS}}}title", {"id": f"{name}-title"}).text = label
    for shape in symbol:
        icon.append(copy.deepcopy(shape))
    ET.indent(icon, space="  ")
    (out / f"{name}.svg").write_text(ET.tostring(icon, encoding="unicode") + "\n", encoding="utf-8")
    manifest.append({"name": name, "label": label, "file": f"svg/{name}.svg"})

(BASE / "manifest.json").write_text(json.dumps({
    "name": "Yeobaek Soft", "version": 1, "viewBox": "0 0 32 32",
    "strokeWidth": 2.2, "renderedStrokeAt24px": 1.65,
    "source": "icons.svg", "icons": manifest,
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

parser = argparse.ArgumentParser()
parser.add_argument("--preview", type=Path, help="Refresh symbol definitions in an existing mockup fragment")
args = parser.parse_args()
if args.preview:
    fragment = args.preview.read_text(encoding="utf-8")
    begin = "<!-- ORIGINAL_ICONS_START -->"
    end = "<!-- ORIGINAL_ICONS_END -->"
    if fragment.count(begin) != 1 or fragment.count(end) != 1:
        raise ValueError("Preview needs exactly one pair of definition markers")
    definitions = ET.tostring(source.find(f"{{{NS}}}defs"), encoding="unicode")
    prefix, remainder = fragment.split(begin)
    _, suffix = remainder.split(end)
    args.preview.write_text(prefix + begin + "\n" + definitions + "\n" + end + suffix, encoding="utf-8")

print(f"Exported {len(symbols)} icons to {out}")
