#!/usr/bin/env python3
"""Import independently sourced Beyblade component photos and remove pale backgrounds.

Output files are transparent PNGs. Never substitutes an image from another release.
Requires: pillow, numpy, opencv-python-headless.
"""
from __future__ import annotations
import io, json, pathlib, urllib.request
from concurrent.futures import ThreadPoolExecutor
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
    if (rgba[:, :, 3] < 240).sum() >= (rgba.shape[0] * rgba.shape[1] * 0.08):
        # Preserve real transparency from an already-clean independent product photo.
        output=Image.fromarray(rgba,'RGBA')
        bbox=output.getbbox()
        if not bbox: raise ValueError('empty transparent source')
        output=output.crop(bbox)
        output.thumbnail((720,720), Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(800,800),(0,0,0,0))
        canvas.alpha_composite(output,((800-output.width)//2,(800-output.height)//2))
        return canvas
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

def process_task(task):
    bey, layer, spec, system = task
    if not spec:
        if system in ("BX", "UX") and layer in ("lockChip", "mainBlade", "assistBlade"):
            return {"id":bey["id"], "part":layer, "status":"not_applicable", "reason":"BX/UX does not contain CX-only subcomponents"}
        return {"id":bey["id"],"part":layer,"status":"awaiting_verified_photo"}
    relative_path=pathlib.PurePosixPath(spec["output"])
    if relative_path.is_absolute() or ".." in relative_path.parts or not str(relative_path).startswith("images/reference/") or relative_path.suffix.lower()!=".png":
        return {"id":bey["id"],"part":layer,"status":"needs_manual_review","error":"Invalid destination"}
    destination=ROOT/relative_path
    try:
        raw=download(spec["url"])
        png=transparent_png(raw)
        if bey["id"]=="OWN-G3393-01" and layer=="whole":
            # The online Rudder Phoenix photo contains a thin neutral scan line
            # beneath the red blade. Remove only the detected strip.
            from clean_horizontal_artifacts import clean_horizontal_line
            png,_=clean_horizontal_line(png)
        destination.parent.mkdir(parents=True,exist_ok=True)
        png.save(destination,format="PNG",optimize=True)
        print("OK",bey["id"],layer,destination.name,flush=True)
        return {"id":bey["id"],"part":layer,"status":"ready","png":str(relative_path),"source":spec["page"]}
    except Exception as exc:
        if destination.exists():
            print("REUSE",bey["id"],layer,str(exc)[:110],flush=True)
            return {"id":bey["id"],"part":layer,"status":"ready","png":str(relative_path),"source":spec["page"],"note":"Previously verified PNG retained; new download unavailable"}
        print("NEEDS_REVIEW",bey["id"],layer,str(exc)[:110],flush=True)
        return {"id":bey["id"],"part":layer,"status":"needs_manual_review","source":spec["page"],"error":str(exc)[:250]}

def run():
    data=json.loads(MANIFEST.read_text(encoding="utf-8"))
    layers=("whole","blade","ratchet","bit","lockChip","mainBlade","assistBlade")
    collection = json.loads((ROOT/"data"/"collection.json").read_text(encoding="utf-8"))
    systems = {b["id"]:b["system"] for b in collection["beys"]}
    tasks=[(bey,layer,bey.get(layer),systems[bey["id"]]) for pkg in data["packages"] for bey in pkg["items"] for layer in layers]
    with ThreadPoolExecutor(max_workers=6) as pool:
        outcomes=list(pool.map(process_task,tasks))
    # User-synced items are not in the verified-image source manifest yet.
    # Keep all seven status slots, even after the asset generator is rerun.
    manifest_ids={task[0]["id"] for task in tasks}
    for user_bey in collection["beys"]:
        if user_bey["id"] in manifest_ids:
            continue
        for part in layers:
            not_applicable=user_bey["system"]!="CX" and part in ("lockChip","mainBlade","assistBlade")
            outcomes.append({"id":user_bey["id"],"part":part,
                "status":"not_applicable" if not_applicable else "awaiting_verified_photo",
                "reason":"BX/UX does not contain CX modules" if not_applicable else "User-submitted release requires verified photo"})
    # The collection card image represents the ASSEMBLED top ("whole").
    # In the detail dialog, "blade" is a genuinely separate top blade.
    dbpath=ROOT/"data"/"collection.json"
    if dbpath.exists():
        collection=json.loads(dbpath.read_text(encoding="utf8"))
        successful={(x["id"],x["part"]):x["png"] for x in outcomes if x["status"]=="ready" and "png" in x}
        for owned in collection.get("beys",[]):
            own=owned.get("id")
            whole=successful.get((own,"whole"))
            if whole:
                owned["displayImagePath"]=whole
                owned["imageStatus"]="verified_png"
            elif successful.get((own,"blade")):
                # An authentic release-specific BLADE top view is an honest visual
                # fallback. Never label it as a complete assembled Bey.
                owned["displayImagePath"]=successful[(own,"blade")]
                owned["imageStatus"]="blade_only_exact_photo"
            elif not owned.get("displayImagePath") or not (ROOT/owned["displayImagePath"]).exists():
                owned["displayImagePath"]=None
                owned["imageStatus"]="awaiting_verified_png"
            owned["partImages"]={layer:successful[(own,layer)] for layer in ("blade","ratchet","bit","lockChip","mainBlade","assistBlade") if (own,layer) in successful}
        dbpath.write_text(json.dumps(collection,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        (ROOT/"data.js").write_text("window.BBX_SEED = "+json.dumps(collection,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf8")
    STATUS.write_text(json.dumps({"manifestVersion":data["version"],"results":outcomes},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Finished:",sum(x["status"]=="ready" for x in outcomes),"PNG files generated")

if __name__=="__main__":
    run()
