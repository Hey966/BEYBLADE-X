#!/usr/bin/env python3
"""Audit publicly exposed exact-release per-part asset references.
Only stores diagnostic paths; makes no license assumptions.
"""
import re,html,json,urllib.request,urllib.parse,pathlib
BASE="https://beyblade.phstudy.org/"
IDS=["HB-G3084-01-BIT","HB-G3084-01-RATCHET","HB-G3063-01-BLADE","HB-G3063-02-BLADE","HB-G3063-01-BIT","HB-G3063-02-RATCHET"]
parts={"BIT":"Bit","RATCHET":"Ratchet","BLADE":"Blade"}
all=[]
for pid in IDS:
    sub=pid.rsplit("-",1)[-1]
    url=BASE+"p/en-US/"+parts[sub]+"/"+pid+".html"
    item={"id":pid,"url":url}
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
        raw=urllib.request.urlopen(req,timeout=25).read(1200000).decode("utf8","replace")
        item["size"]=len(raw)
        item["title"]=re.findall(r'<title[^>]*>(.*?)</title>',raw,re.I|re.S)[:1]
        item["meta"]=[m[:800] for m in re.findall(r'<meta[^>]*(?:og:image|twitter:image|image_url)[^>]*>',raw,re.I)[:10]]
        imgs=re.findall(r'<img\b[^>]*>',raw,re.I|re.S)
        item["imgs"]=[i[:900] for i in imgs[:24]]
        item["urls"]=[u for u in sorted(set(re.findall(r'''(?:"|')(?:[^"']*(?:\.(?:png|webp|jpg|jpeg))(?:\?[^"']*)?)(?:"|')''',raw,re.I)))][:40]
    except Exception as e:item["error"]=str(e)
    all.append(item)
    print(pid,item.get("size"),item.get("error"))
pathlib.Path("data/photo-audit.json").write_text(json.dumps(all,ensure_ascii=False,indent=2),encoding="utf8")
