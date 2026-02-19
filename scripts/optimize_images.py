#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path


try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None

try:
    from PIL import Image, ImageOps  # type: ignore
except Exception:  # pragma: no cover
    Image = None
    ImageOps = None


ROOT = Path(__file__).resolve().parents[1]
ASSETS_IMG_DIR = ROOT / "assets" / "img"

TEXT_FILE_SUFFIXES = {
    ".md",
    ".html",
    ".yml",
    ".yaml",
    ".scss",
    ".css",
    ".js",
    ".json",
    ".xml",
}

RASTER_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
EXCLUDED_DIR_NAMES = {
    ".git",
    ".jekyll-cache",
    "_site",
    "build",
    "node_modules",
    "vendor",
}


@dataclass(frozen=True)
class ResizePolicy:
    max_width: int
    max_height: int


def _rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _site_path(path: Path) -> str:
    return "/" + _rel(path)


def iter_files(root: Path) -> list[Path]:
    results: list[Path] = []
    for p in root.rglob("*"):
        if any(part in EXCLUDED_DIR_NAMES for part in p.parts):
            continue
        if p.is_file():
            results.append(p)
    return results


def iter_images() -> list[Path]:
    if not ASSETS_IMG_DIR.exists():
        return []
    images: list[Path] = []
    for p in ASSETS_IMG_DIR.rglob("*"):
        if any(part in EXCLUDED_DIR_NAMES for part in p.parts):
            continue
        if not p.is_file():
            continue
        if p.suffix.lower() in RASTER_SUFFIXES:
            images.append(p)
    return images


def resize_policy_for(path: Path) -> ResizePolicy:
    rel = _rel(path)

    if rel.startswith("assets/img/authors/"):
        return ResizePolicy(max_width=512, max_height=512)

    if rel.startswith("assets/img/gallery/"):
        if rel.endswith("-thumbnail.jpg") or rel.endswith("-thumbnail.jpeg") or rel.endswith(
            "-thumbnail.png"
        ) or rel.endswith("-thumbnail.webp"):
            return ResizePolicy(max_width=900, max_height=900)
        return ResizePolicy(max_width=2400, max_height=2400)

    if rel.startswith("assets/img/posts/"):
        return ResizePolicy(max_width=1600, max_height=1600)

    return ResizePolicy(max_width=2400, max_height=2400)


def to_webp_path(src: Path) -> Path:
    return src.with_suffix(".webp")


def is_raster_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in RASTER_SUFFIXES


def load_yaml(path: Path):
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install with: pip install pyyaml")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def dump_yaml(path: Path, data) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install with: pip install pyyaml")
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
        newline="\n",
    )


def convert_image(
    src: Path,
    dst: Path,
    *,
    policy: ResizePolicy,
    force: bool,
) -> bool:
    if Image is None or ImageOps is None:
        raise RuntimeError("Pillow is required. Install with: pip install pillow")

    if dst.exists() and not force:
        return False

    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)

        has_alpha = "A" in im.getbands()
        if has_alpha:
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")

        im.thumbnail((policy.max_width, policy.max_height), Image.Resampling.LANCZOS)

        src_suffix = src.suffix.lower()
        save_kwargs: dict = {"format": "WEBP", "method": 6}

        # Heuristic:
        # - PNGs are often UI screenshots/logos, so prefer lossless; fall back to lossy if it gets bigger.
        # - JPEGs are typically photos, use lossy with a sane default.
        if src_suffix == ".png":
            save_kwargs.update({"lossless": True})
        else:
            save_kwargs.update({"quality": 82})

        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_suffix(".webp.tmp")
        im.save(tmp, **save_kwargs)

        if src_suffix == ".png":
            try:
                if tmp.stat().st_size > src.stat().st_size:
                    # Lossless WebP larger than PNG can happen; try a high-quality lossy encode instead.
                    tmp.unlink(missing_ok=True)
                    im.save(tmp, format="WEBP", method=6, quality=90)
            except FileNotFoundError:
                pass
        else:
            # If the WebP is bigger than the JPEG, try lowering quality a bit.
            for q in (78, 74, 70, 66):
                try:
                    if tmp.stat().st_size <= src.stat().st_size:
                        break
                except FileNotFoundError:
                    break
                tmp.unlink(missing_ok=True)
                im.save(tmp, format="WEBP", method=6, quality=q)

        tmp.replace(dst)
        return True


def update_text_references(files: list[Path], replacements: dict[str, str]) -> int:
    changed = 0
    for path in files:
        if path.suffix.lower() not in TEXT_FILE_SUFFIXES:
            continue
        try:
            original = path.read_text(encoding="utf-8")
        except Exception:
            continue

        updated = original
        for old, new in replacements.items():
            updated = updated.replace(old, new)

        if updated != original:
            path.write_text(updated, encoding="utf-8", newline="\n")
            changed += 1
    return changed


def _walk_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_strings(v)


def update_gallery_yaml(galleries_dir: Path, filename_map: dict[str, str]) -> int:
    if not galleries_dir.exists():
        return 0
    changed = 0
    for yml in sorted(galleries_dir.glob("*.yml")):
        data = load_yaml(yml) or {}
        before = list(_walk_strings(data))

        def rewrite(obj):
            if isinstance(obj, str):
                return filename_map.get(obj, obj)
            if isinstance(obj, dict):
                return {k: rewrite(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [rewrite(v) for v in obj]
            return obj

        data2 = rewrite(data)
        after = list(_walk_strings(data2))
        if before != after:
            dump_yaml(yml, data2)
            changed += 1
    return changed


def build_replacements(image_map: dict[Path, Path]) -> dict[str, str]:
    replacements: dict[str, str] = {}
    for src, dst in image_map.items():
        src_rel = _rel(src)
        dst_rel = _rel(dst)
        replacements["/" + src_rel] = "/" + dst_rel
        replacements[src_rel] = dst_rel
        # Some YAML/config references use basenames only (e.g. "profile.png").
        # Avoid adding numeric-only basenames like "1.jpg" here; those are handled
        # via YAML parsing for galleries to prevent accidental substring matches.
        if re.search(r"[A-Za-z]", src.name):
            replacements[src.name] = dst.name
    return replacements


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Convert site images to WebP, resize to sane maximums, and update references."
    )
    parser.add_argument("--check", action="store_true", help="Check only; do not modify files.")
    parser.add_argument("--write", action="store_true", help="Write changes (convert/resize/update refs).")
    parser.add_argument(
        "--delete-originals",
        action="store_true",
        help="Delete original non-WebP images after references are updated.",
    )
    parser.add_argument("--force", action="store_true", help="Re-encode even if .webp already exists.")
    parser.add_argument(
        "--optimize-existing-webp",
        action="store_true",
        help="Resize oversized existing .webp images according to directory policies.",
    )
    args = parser.parse_args(argv)

    if args.check == args.write:
        print("Specify exactly one of --check or --write.", file=sys.stderr)
        return 2

    if args.write and (yaml is None or Image is None):
        print(
            "Missing dependencies. Install with: pip install pillow pyyaml",
            file=sys.stderr,
        )
        return 2

    images = iter_images()
    non_webp = [p for p in images if p.suffix.lower() != ".webp"]

    if args.check:
        offenders = []
        for p in non_webp:
            offenders.append(_rel(p))
        if offenders:
            print("Found non-WebP images under assets/img:")
            for o in offenders:
                print(f"- {o}")
            print("Run: python scripts/optimize_images.py --write --delete-originals")
            return 1
        return 0

    # --write
    image_map: dict[Path, Path] = {}
    converted: list[Path] = []

    for src in sorted(non_webp):
        dst = to_webp_path(src)
        policy = resize_policy_for(src)
        changed = convert_image(src, dst, policy=policy, force=args.force)
        image_map[src] = dst
        if changed:
            converted.append(dst)

    # Optionally resize oversized existing .webp files (without changing references).
    optimized_webp = 0
    if args.optimize_existing_webp:
        webps = [p for p in images if p.suffix.lower() == ".webp"]
        for webp in sorted(webps):
            policy = resize_policy_for(webp)
            with Image.open(webp) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
                if w <= policy.max_width and h <= policy.max_height:
                    continue
                has_alpha = "A" in im.getbands()
                if has_alpha:
                    im = im.convert("RGBA")
                    save_kwargs = {"format": "WEBP", "method": 6, "lossless": True}
                else:
                    im = im.convert("RGB")
                    save_kwargs = {"format": "WEBP", "method": 6, "quality": 82}
                im.thumbnail((policy.max_width, policy.max_height), Image.Resampling.LANCZOS)
                tmp = webp.with_suffix(".webp.tmp")
                im.save(tmp, **save_kwargs)
                tmp.replace(webp)
                optimized_webp += 1

    # Update gallery YAML (uses bare filenames like "1.jpg").
    filename_map = {src.name: dst.name for src, dst in image_map.items()}
    galleries_changed = update_gallery_yaml(ROOT / "_data" / "galleries", filename_map)

    # Update all other text references via exact replacements.
    replacements = build_replacements(image_map)
    text_files = iter_files(ROOT)
    files_changed = update_text_references(text_files, replacements)

    if args.delete_originals:
        for src in sorted(non_webp):
            try:
                src.unlink()
            except FileNotFoundError:
                pass

    # Summary
    print(f"Converted to WebP: {len(converted)}")
    if args.optimize_existing_webp:
        print(f"Optimized existing WebP: {optimized_webp}")
    print(f"Updated gallery YAML: {galleries_changed}")
    print(f"Updated text files: {files_changed}")

    # Verify nothing non-webp remains under assets/img (except allowed formats like .ico/.svg/.gif).
    remaining = [p for p in iter_images() if p.suffix.lower() != ".webp"]
    if remaining:
        print("WARNING: non-WebP images remain under assets/img:", file=sys.stderr)
        for p in remaining:
            print(f"- {_rel(p)}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
