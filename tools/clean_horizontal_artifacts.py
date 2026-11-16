#!/usr/bin/env python3
"""Remove only confirmed thin neutral-colored extraction artifacts from Rudder Phoenix PNG.

Conservative connected component detection. Preserve saturation-rich red blade pixels.
Also imported by create_png_assets.py when the full product photo is reprocessed.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

TARGET="images/reference/own-g3393-01.png"

def clean_horizontal_line(image):
    source=np.asarray(image.convert("RGBA")).copy()
    h,w=source.shape[:2]
    rgb=source[:,:,:3].astype(np.int16)
    alpha=source[:,:,3]
    diff=rgb.max(axis=2)-rgb.min(axis=2)
    bright=rgb.mean(axis=2)
    yy=np.arange(h)[:,None]
    primary=((alpha>12)&(diff<38)&(bright>90)&(yy>=int(h*.78))).astype("uint8")
    n, labels, stats, _=cv2.connectedComponentsWithStats(primary,8)
    chosen=[]
    remove=np.zeros((h,w),dtype="uint8")
    for component in range(1,n):
        x,y,ww,hh,area=map(int,stats[component])
        if ww>=round(w*.19) and hh<=round(h*.03) and ww>=hh*10:
            chosen.append({"x":x,"y":y,"width":ww,"height":hh,"area":area})
            part=(labels==component).astype("uint8")
            remove|=cv2.dilate(part,cv2.getStructuringElement(cv2.MORPH_RECT,(5,5)),iterations=1)
    # Do not alter saturated red/orange/violet blade material.
    softly_neutral=(alpha>0)&(diff<82)&(bright>32)
    removed=(remove>0)&softly_neutral
    count=int(removed.sum())
    if not chosen:raise ValueError("Expected thin horizontal residual not found. Manual review required.")
    if count<150 or count>8000:raise ValueError(f"Unsafe removal count: {count}")
    source[:,:,3][removed]=0
    new=Image.fromarray(source,"RGBA")
    return new,{"imageSize":[w,h],"lineComponents":chosen,"removedPixels":count,
                "sourceOpaquePixels":int((alpha>0).sum()),
                "resultOpaquePixels":int((source[:,:,3]>0).sum())}

def main():
    p=Path(TARGET)
    result,report=clean_horizontal_line(Image.open(p))
    result.save(p,optimize=True)
    q=Path("data/rudder-line-repair.json")
    q.parent.mkdir(parents=True,exist_ok=True)
    q.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps(report))

if __name__=="__main__":
    main()
