#!/usr/bin/env python3
"""One-time, reproducible ambientCG CC0 sand import for Pixel-Games.

Source: https://ambientcg.com/a/Ground027 (dry white beach sand)
        https://ambientcg.com/a/Ground059 (wet beach sand)
Download official 1K JPG archives, downsample to 504-pixel seamless tiles,
pack dry/wet horizontally into one colour atlas and one GL-normal+roughness
atlas, and register the exact output SHA256 in assets/manifest.json.

No CDN requests are made by the running game.
Requires: python3 -m pip install Pillow
"""
from __future__ import annotations

import hashlib
import io
import json
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "materials"
MANIFEST = ROOT / "assets" / "manifest.json"
SIZE, GUTTER, CORE = 512, 4, 504
SOURCES = (("Ground027", "dry"), ("Ground059", "wet"))
URL = "https://ambientcg.com/get?file={id}_1K-JPG.zip"
HEADERS = {"User-Agent": "Pixel-Games-CC0-Asset-Import/1.0 (personal noncommercial GitHub game; ambientCG)"}


def official_archive(asset_id: str) -> zipfile.ZipFile:
    url = URL.format(id=asset_id)
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as response:
                payload = response.read(25_000_001)
            if len(payload) > 25_000_000:
                raise ValueError(f"{asset_id}: archive exceeded 25 MB cap")
            z = zipfile.ZipFile(io.BytesIO(payload), "r")
            if z.testzip() is not None:
                raise ValueError(f"{asset_id}: corrupt ZIP")
            print(f"{asset_id}: downloaded {len(payload):,} B, zip SHA256={hashlib.sha256(payload).hexdigest()}")
            return z
        except (urllib.error.URLError, TimeoutError, zipfile.BadZipFile, ValueError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Cannot retrieve licensed asset {asset_id} from {url}") from last_error


def select_image(archive: zipfile.ZipFile, asset_id: str, suffix: str, mode: str) -> Image.Image:
    expected = f"{asset_id}_1K-JPG_{suffix}.jpg"
    matches = [name for name in archive.namelist() if Path(name).name.lower() == expected.lower()]
    if len(matches) != 1:
        raise ValueError(f"{asset_id}: missing or ambiguous official {expected}: {matches}")
    with archive.open(matches[0]) as member:
        encoded = member.read(12_000_001)
    if len(encoded) > 12_000_000:
        raise ValueError(f"{asset_id}: JPG too large")
    with Image.open(io.BytesIO(encoded)) as photo:
        if photo.width < 512 or photo.height < 512:
            raise ValueError(f"{asset_id}: unexpectedly low resolution {photo.size}")
        return ImageOps.fit(photo.convert(mode), (CORE, CORE), method=Image.Resampling.LANCZOS)


def repeat_gutter(core: Image.Image) -> Image.Image:
    """Fill a 4px gutter from opposite edges for correct tiled bilinear sampling."""
    tile = Image.new(core.mode, (SIZE, SIZE))
    for sx in (-CORE, 0, CORE):
        for sy in (-CORE, 0, CORE):
            tile.paste(core, (GUTTER + sx, GUTTER + sy))
    return tile


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    albedo = Image.new("RGB", (SIZE * 2, SIZE))
    packed = Image.new("RGBA", (SIZE * 2, SIZE))
    for slot, (asset_id, role) in enumerate(SOURCES):
        with official_archive(asset_id) as archive:
            c = select_image(archive, asset_id, "Color", "RGB")
            n = select_image(archive, asset_id, "NormalGL", "RGB")
            r = select_image(archive, asset_id, "Roughness", "L")
        normal_and_roughness = Image.merge("RGBA", (*n.split(), r))
        albedo.paste(repeat_gutter(c), (slot * SIZE, 0))
        packed.paste(repeat_gutter(normal_and_roughness), (slot * SIZE, 0))
        print(f"{asset_id}: {role} sand, maps=Color + NormalGL + Roughness")
    color_path = OUT / "ambientcg-sand-albedo.webp"
    normal_path = OUT / "ambientcg-sand-normal-roughness.png"
    albedo.save(color_path, "WEBP", quality=88, method=6)
    packed.save(normal_path, "PNG", optimize=True, compress_level=9)
    materials = [
        (color_path, "ambientcg-beach-dry-wet-albedo", "Dry Ground027 and wet Ground059 colour maps; 2 x 512-pixel seam-safe tiles."),
        (normal_path, "ambientcg-beach-dry-wet-normal-roughness", "OpenGL tangent normals RGB and per-pixel roughness alpha, dry/wet atlas."),
    ]
    data = json.loads(MANIFEST.read_text("utf-8"))
    for path, asset_id, notes in materials:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        asset = {
            "id": asset_id,
            "path": path.relative_to(ROOT).as_posix(),
            "author": "ambientCG",
            "license": "CC0-1.0",
            "source": "https://ambientcg.com/a/Ground027",
            "sha256": digest,
            "notes": notes + " Source: https://ambientcg.com/a/Ground027 and https://ambientcg.com/a/Ground059; downsampled from original 1K-JPG releases.",
        }
        data["assets"] = [item for item in data["assets"] if item["id"] != asset_id]
        data["assets"].append(asset)
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} B SHA256={digest}")
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")


if __name__ == "__main__":
    main()
