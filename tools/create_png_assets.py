#!/usr/bin/env python3
"""Import independently sourced Beyblade component photos and remove pale backgrounds.

Output files are transparent PNGs. Never substitutes an image from another release.
Requires: pillow, numpy, opencv-python-headless.
"""
from __future__ import annotations
import io, json, pathlib, urllib.request
import numpy as np
import cv2
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "image-sources.json"
STATUS = ROOT / "data" / "image-status.json"

def transparent_png(raw: bytes) -> Image.Image:
    picture = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGBA")
    if picture.width < 175 or picture.height < 175:
        raise ValueError("source image is too small")
    picture.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    rgba = np.array(picture)
    rgb = rgba[:, :, :3]
    h, w = rgb.shape[:2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    pale = (mn >= 218) & ((mx.astype(np.int16) - mn.astype(np.int16)) < 37)
    labels_count, labels = cv2.connectedComponents(pale.astype("uint8"), 8)
    border = np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    border_counts = np.bincount(border, minlength=labels_count)
    bg_labels = set(np.flatnonzero(border_counts > 2)) - {0}
    exterior = np.isin(labels, list(bg_labels))
    if exterior.sum() < (w * h * 0.08):
        raise ValueError("background not reliably pale; manual masking required")
    alpha = rgba[:, :, 3].copy()
    alpha[exterior] = 0
    # Smooth only the mask boundary, avoiding color/shape changes to the item.
    edge = cv2.GaussianBlur(alpha, (3, 3), 0.65)
    alpha = np.minimum(alpha, edge)
    if np.count_nonzero(alpha > 24) < 900:
        raise ValueError("no visible subject after background removal")
    rgba[:, :, 3] = alpha
    output = Image.fromarray(rgba, "RGBA")
    bbox = output.getbbox()
    if not bbox:
        raise ValueError("empty image")
    output = output.crop(bbox)
    output.thumbnail((720, 720), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
    canvas.alpha_composite(output, ((800 - output.width)//2,(800 - output.height)//2))
    return canvas

def download(url: str) -> bytes:
    if not url.startswith("https://"):
        raise ValueError("only HTTPS source images permitted")
    req=urllib.request.Request(url, headers={
      "User-Agent":"Mozilla/5.0 (compatible; BEYBLADE-X personal catalog image archival)",
      "Accept":"image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8"
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise ValueError("source exceeds 8MB limit")
    return data

def run():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    outcomes=[]
    for pkg in data["packages"]:
        for bey in pkg["items"]:
            for layer in ("blade","ratchet","bit","lockChip","mainBlade","assistBlade"):
                spec = bey.get(layer)
                if not spec:
                    outcomes.append({"id":bey["id"],"part":layer,"status":"awaiting_verified_photo"})
                    continue
                relative_path = pathlib.PurePosixPath(spec["output"])
                if relative_path.is_absolute() or ".." in relative_path.parts or not str(relative_path).startswith("images/reference/") or relative_path.suffix.lower() != ".png":
                    raise ValueError(f"invalid destination {relative_path}")
                destination=ROOT/relative_path
                try:
                    raw=download(spec["url"])
                    png=transparent_png(raw)
                    destination.parent.mkdir(parents=True,exist_ok=True)
                    png.save(destination,format="PNG",optimize=True)
                    outcomes.append({"id":bey["id"],"part":layer,"status":"ready","png":str(relative_path),"source":spec["page"]})
                    print("OK",bey["id"],layer,destination.name)
                except (Exception) as exc:
                    outcomes.append({"id":bey["id"],"part":layer,"status":"needs_manual_review","error":str(exc)[:250],"source":spec["page"]})
                    print("SKIP",bey["id"],layer,str(exc)[:150])
    STATUS.write_text(json.dumps({"manifestVersion":data["version"],"results":outcomes},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Finished:",sum(x["status"]=="ready" for x in outcomes),"PNG files generated")

if __name__=="__main__":
    run()
