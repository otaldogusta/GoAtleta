#!/usr/bin/env python3
"""Build the local UI evidence hub from a curated catalogue, without network access.

Screenshots and QA data stay in the ignored audit directory. This command checks
every referenced local asset before replacing either public entry point. It never
changes the product checklist or the app.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct
from urllib.parse import unquote, urlsplit


REPO = Path(__file__).resolve().parents[1]
MARKER = "go-atleta-inventory-hub"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def local_asset(root, value):
    """Resolve only existing files inside the chosen audit directory."""
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path:
        raise ValueError(f"Expected a local asset: {value}")
    candidate = (root / unquote(parsed.path)).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError(f"Missing or out-of-scope asset: {value}")
    return candidate


def image(root, value):
    if not value:
        return None
    result = {"src": value} if isinstance(value, str) else copy.deepcopy(value)
    asset = local_asset(root, result["src"])
    with asset.open("rb") as stream:
        head = stream.read(24)
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        result["width"], result["height"] = struct.unpack(">II", head[16:24])
    return result


def validate_link(root, value):
    if not value:
        return
    parsed = urlsplit(value)
    if parsed.scheme:
        if parsed.scheme not in {"http", "https"}:
            raise ValueError(f"Unsupported link scheme: {value}")
    elif parsed.netloc:
        raise ValueError(f"Protocol-relative link is not allowed: {value}")
    elif parsed.path:
        local_asset(root, value)


def prepare(root, catalogue):
    data = copy.deepcopy(catalogue)
    data.setdefault("title", "Inventário de interface")
    data.setdefault("subtitle", "O app, área por área. Compare as revisões e consulte as evidências.")
    data.setdefault("scopeNote", "Capturas locais com dados fictícios. A cobertura é por estado observado; não certifica o app inteiro.")
    data.setdefault("updatedAt", "14 nov 2026")
    data.setdefault("archive", data.pop("pages", []))
    area_ids, item_ids = set(), set()
    image_paths = set()
    for area in data["areas"]:
        if area["id"] in area_ids:
            raise ValueError(f"Duplicate area: {area['id']}")
        area_ids.add(area["id"])
        validate_link(root, area.get("preview", {}).get("url"))
        for item in area["items"]:
            key = (area["id"], item["id"])
            if key in item_ids:
                raise ValueError(f"Duplicate item: {key}")
            item_ids.add(key)
            for state in [item, *item.get("variants", [])]:
                for side in ("before", "after"):
                    if state.get(side):
                        state[side] = image(root, state[side])
                        image_paths.add(state[side]["src"])
                state["extraImages"] = [image(root, x) for x in state.get("extraImages", [])]
                image_paths.update(x["src"] for x in state["extraImages"])
            source = item.get("source")
            validate_link(root, source.get("url") if isinstance(source, dict) else source)
            validate_link(root, item.get("preview", {}).get("url"))
    for entry in data["archive"]:
        if entry.get("url") == "index.html":
            entry["url"] = "index-editorial.html"
        # The original entry point is preserved only after all other inputs pass.
        if entry.get("url") != "index-editorial.html":
            validate_link(root, entry.get("url"))
    for entry in data.get("references", []):
        validate_link(root, entry.get("url"))
    for row in data.get("coverage", {}).get("rows", []):
        source = row.get("source")
        url = source.get("url") if isinstance(source, dict) else source
        if url and urlsplit(url).path not in {"inventario.html", "index.html"}:
            validate_link(root, url)
    stats = {
        "areas": len(area_ids), "recortes": len(item_ids),
        "comparativos": sum(bool(x.get("before") and x.get("after"))
                            for a in data["areas"] for x in a["items"]),
        "arquivos_html": len(data["archive"]), "imagens_referenciadas": len(image_paths),
    }
    return data, stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="Existing ignored audit directory")
    parser.add_argument("--catalog", type=Path, required=True, help="Curated hub data JSON")
    parser.add_argument("--template", type=Path,
                        default=REPO / "docs/ui/inventory/hub-template.html")
    args = parser.parse_args()
    root = args.root.resolve(strict=True)
    template = args.template.read_text(encoding="utf-8")
    if template.count("__INVENTORY_DATA__") != 1:
        raise ValueError("The template must contain exactly one data placeholder")
    data, stats = prepare(root, read_json(args.catalog))
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # A caption containing </script> must remain data, never executable markup.
    for character, escaped in (("&", "\\u0026"), ("<", "\\u003c"), (">", "\\u003e"),
                               ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        encoded = encoded.replace(character, escaped)
    document = template.replace("__INVENTORY_DATA__", encoded)
    if MARKER not in document:
        document = document.replace("<head>", f'<head><meta name="{MARKER}" content="1">', 1)
    if MARKER not in document:
        raise ValueError("Cannot mark generated document")
    previous = root / "index.html"
    archive = root / "index-editorial.html"
    if previous.exists() and MARKER not in previous.read_text(encoding="utf-8"):
        if archive.exists() and archive.read_bytes() != previous.read_bytes():
            raise ValueError("A different archived entry point already exists; preserve both manually")
        archive.write_bytes(previous.read_bytes())
    if any(x.get("url") == "index-editorial.html" for x in data["archive"]) and not archive.exists():
        raise ValueError("Archived entry point was not found")
    (root / "inventario.html").write_text(document, encoding="utf-8")
    previous.write_text(document, encoding="utf-8")
    receipt = {
        "stats": stats, "catalog": str(args.catalog),
        "template_sha256": hashlib.sha256(template.encode()).hexdigest(),
        "html_sha256": hashlib.sha256(document.encode()).hexdigest(),
        "limits": "Asset integrity only; browser and UI/UX review are recorded separately.",
    }
    (root / "lote-10/hub-build.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
