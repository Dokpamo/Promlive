"""Combine our earlier drawings with the manually redrawn reference study."""
from __future__ import annotations
import argparse
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parent
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
PRIMARY = ["settings", "back", "sidebar-open", "send", "collapse", "search", "expand", "plus", "create"]
STROKE = "2.6"
by_name = {}
for source_file in [BASE.parent / "icons.svg", BASE / "redrawn.svg"]:
    source = ET.parse(source_file).getroot()
    for symbol in source.findall(f"{{{NS}}}defs/{{{NS}}}symbol"):
        by_name[symbol.attrib["id"].removeprefix("ys-")] = symbol
assert all(name in by_name for name in PRIMARY)
order = PRIMARY + [name for name in by_name if name not in PRIMARY]

sprite = ET.Element(f"{{{NS}}}svg", {"viewBox": "0 0 32 32", "fill": "none", "stroke": "currentColor", "stroke-width": STROKE, "stroke-linecap": "round", "stroke-linejoin": "round"})
defs = ET.SubElement(sprite, f"{{{NS}}}defs")
out = BASE / "svg"
out.mkdir(exist_ok=True)
manifest = []
for name in order:
    symbol = copy.deepcopy(by_name[name])
    symbol.set("data-primary", str(name in PRIMARY).lower())
    defs.append(symbol)
    icon = ET.Element(f"{{{NS}}}svg", {"width": "24", "height": "24", "viewBox": "0 0 32 32", "fill": "none", "stroke": "currentColor", "stroke-width": STROKE, "stroke-linecap": "round", "stroke-linejoin": "round", "role": "img", "aria-labelledby": f"{name}-title"})
    ET.SubElement(icon, f"{{{NS}}}title", {"id": f"{name}-title"}).text = symbol.attrib["data-label"]
    for shape in symbol:
        icon.append(copy.deepcopy(shape))
    ET.indent(icon, space="  ")
    (out / f"{name}.svg").write_text(ET.tostring(icon, encoding="unicode") + "\n", encoding="utf-8")
    manifest.append({"name": name, "label": symbol.attrib["data-label"], "primary": name in PRIMARY, "file": f"svg/{name}.svg"})
ET.indent(sprite, space="  ")
(BASE / "icons.svg").write_text(ET.tostring(sprite, encoding="unicode") + "\n", encoding="utf-8")
(BASE / "manifest.json").write_text(json.dumps({"name": "Yeobaek Round", "version": 3, "viewBox": "0 0 32 32", "strokeWidth": float(STROKE), "renderedStrokeAt24px": 1.95, "primary": PRIMARY, "icons": manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

parser = argparse.ArgumentParser()
parser.add_argument("--preview", type=Path)
args = parser.parse_args()
if args.preview:
    html = args.preview.read_text(encoding="utf-8")
    start, end = "<!-- ROUND_ICONS_START -->", "<!-- ROUND_ICONS_END -->"
    assert html.count(start) == html.count(end) == 1
    prefix, remaining = html.split(start)
    _, suffix = remaining.split(end)
    args.preview.write_text(prefix + start + "\n" + ET.tostring(defs, encoding="unicode") + "\n" + end + suffix, encoding="utf-8")
print(f"Exported {len(order)} icons, including all {len(PRIMARY)} requested controls.")
