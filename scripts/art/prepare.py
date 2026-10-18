"""Inspect generated art and encode WebP; never redraw, crop or overwrite source PNGs.

Pillow is used only to read pixels/measure geometry and compare alpha. cwebp performs format encoding.
Existing encoded files are reused; new image revisions require a new filename in layout.json.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

try:
    from PIL import Image, ImageChops
except ImportError:
    raise SystemExit("Art maintenance requires Pillow. Playing/verifying the committed game assets does not.")

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design/b"
PUBLIC = ROOT / "public/assets/b"
CONFIG = json.loads((DESIGN / "layout.json").read_text())
RECORDS = json.loads((DESIGN / "generation-records.json").read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rectangle(box):
    return {"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]}


def measure(path):
    with Image.open(path) as source:
        image = source.convert("RGBA")
    alpha = image.getchannel("A")
    visible = alpha.point(lambda value: 255 if value >= 16 else 0)
    bbox = visible.getbbox()
    if bbox is None:
        raise ValueError(f"Empty art: {path}")
    return image, alpha, visible, {"width": image.width, "height": image.height,
        "alpha": {"min": alpha.getextrema()[0], "max": alpha.getextrema()[1],
                  "transparentFraction": alpha.histogram()[0] / (image.width * image.height)},
        "visibleBounds": rectangle(bbox)}


if not shutil.which("cwebp"):
    raise SystemExit("Art maintenance requires cwebp. Source PNGs and committed WebP remain intact.")
PUBLIC.mkdir(parents=True, exist_ok=True)
runtime = {"schemaVersion": 1, "direction": "B", "version": CONFIG["version"],
           "palette": CONFIG["palette"], "stage": CONFIG["stage"], "assets": []}
manifest = {"task": "T07", "tool": "image_gen.imagegen", "mode": "built-in",
            "model": "not exposed by tool", "reference": "design/concepts/main-b-v3.png",
            "referenceSha256": sha(ROOT / "design/concepts/main-b-v3.png"),
            "encoding": {"tool": subprocess.check_output(["cwebp", "-version"], text=True).strip(),
                         "arguments": ["-q", "90", "-m", "6", "-alpha_q", "100", "-exact"],
                         "purpose": "format/size export only; no creative image edits"},
            "images": [], "runtime": runtime}

for record in RECORDS:
    folder = "boards" if record["kind"] == "board" else "originals"
    original = DESIGN / folder / f'{record["name"]}.png'
    source = Path(record["source"])
    if source.exists() and sha(source) != sha(original):
        raise ValueError(f"Source/copy mismatch: {original}")
    _, _, _, info = measure(original)
    prompt = DESIGN / "prompts" / f'{record["name"]}.md'
    manifest["images"].append({**record, **info, "path": str(original.relative_to(ROOT)),
        "bytes": original.stat().st_size, "sha256": sha(original),
        "prompt": str(prompt.relative_to(ROOT)), "promptSha256": sha(prompt),
        "references": record.get("references", [str(ROOT / "design/concepts/main-b-v3.png")]),
        "selected": record["name"] not in CONFIG["superseded"]})

for asset in CONFIG["assets"]:
    original = DESIGN / "originals" / f'{asset["name"]}.png'
    exported = PUBLIC / f'{asset["name"]}.webp'
    if not exported.exists():
        subprocess.run(["cwebp", "-quiet", "-q", "90", "-m", "6", "-alpha_q", "100", "-exact",
                        str(original), "-o", str(exported)], check=True)
    image, alpha, visible, info = measure(original)
    encoded, encoded_alpha, _, encoded_info = measure(exported)
    if encoded.size != image.size or ImageChops.difference(alpha, encoded_alpha).getbbox():
        raise ValueError(f"Encoded alpha/dimensions changed: {exported}")
    if asset["kind"] != "background" and (info["alpha"]["min"] != 0 or info["alpha"]["transparentFraction"] < 0.25):
        raise ValueError(f"Missing genuine transparency: {original}")
    entry = {**asset, "src": f'/assets/b/{exported.name}', "width": image.width, "height": image.height,
        "bytes": exported.stat().st_size, "sha256": sha(exported), "visibleBounds": info["visibleBounds"],
        "alpha": encoded_info["alpha"], "alphaMatchesOriginal": True}
    if asset["kind"] == "atlas":
        # Actual imagegen rows are not equally spaced. Split in measured empty gaps, never through visible artwork.
        occupied = [visible.crop((0, y, image.width, y + 1)).getbbox() is not None for y in range(image.height)]
        bands = []
        for y, used in enumerate(occupied):
            if used and (y == 0 or not occupied[y - 1]):
                bands.append([y, y + 1])
            elif used:
                bands[-1][1] = y + 1
        if len(bands) != 4:
            raise ValueError(f"Expected four independent rows: {original}: {bands}")
        cuts = [0] + [(bands[row][1] + bands[row + 1][0]) // 2 for row in range(3)] + [image.height]
        frames = []
        for tier in range(8):
            col, row = tier % 2, tier // 2
            box = (col * image.width // 2, cuts[row], (col + 1) * image.width // 2, cuts[row + 1])
            mask = visible.crop(box)
            bbox = mask.getbbox()
            if not bbox or min(bbox[0], bbox[1], mask.width - bbox[2], mask.height - bbox[3]) < 2:
                raise ValueError(f"Visible frame clipped: {original}/{tier}")
            frames.append({"tier": tier, "sourceRect": rectangle(box), "visibleBounds": rectangle(bbox),
                "anchor": {"x": (bbox[0] + bbox[2]) / 2 / mask.width, "y": bbox[3] / mask.height}})
        entry["frames"] = frames
        entry["measuredRowBands"] = bands
    runtime["assets"].append(entry)

manifest["totalRuntimeImageBytes"] = sum(asset["bytes"] for asset in runtime["assets"])
if manifest["totalRuntimeImageBytes"] > 3 * 1024 * 1024:
    raise ValueError("Runtime artwork exceeds the complete first-screen image budget of 3MiB")
(DESIGN / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
(PUBLIC / "manifest.json").write_text(json.dumps(runtime, indent=2, ensure_ascii=False) + "\n")
tokens = [":root {"] + [f'  --{key}: {value};' for key, value in CONFIG["palette"].items()] + [
    '  --font-title: "Noto Serif SC", "Songti SC", "STSong", serif;',
    '  --font-body: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;',
    "  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;",
    "}", ""]
(PUBLIC / "tokens.css").write_text("\n".join(tokens))
print(json.dumps({"originalsAndBoards": len(RECORDS), "runtimeImages": len(runtime["assets"]),
                  "materialFrames": sum(len(asset.get("frames", [])) for asset in runtime["assets"]),
                  "runtimeImageBytes": manifest["totalRuntimeImageBytes"], "allAlphaPreserved": True}))
