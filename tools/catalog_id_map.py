#!/usr/bin/env python3
"""Read official-code keyed records from an independent catalog (diagnostics only)."""
import json, urllib.request, pathlib
def read(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
sources={"TT":read("https://beyblade.phstudy.org/data/main.json"),"Hasbro":read("https://beyblade.phstudy.org/data/hasbro.json")}
wanted=["CX-08-06","BXG-70","BXG-57-01","BXG-57-02","BXG-57-03","CX-06-01","UX-08","G3084","G3393","G2734","G3063-01","G3063-02"]
out={"sources":{},"targets":wanted}
for market,d in sources.items():
    out["sources"][market]={"topKeys":list(d.keys()),"types":{k:list(v.keys())[:8] if isinstance(v,dict) else type(v).__name__ for k,v in d.items()}}
    groups=(d.get("data") or d)
    if not isinstance(groups,dict):continue
    found=[]
    for grp,items in groups.items():
        if not isinstance(items,dict):continue
        for id,v in items.items():
            if not isinstance(v,dict):continue
            ids=[str(v.get("set_id","")),str(v.get("base_set_id","")),str(v.get("id","")),str(id)]
            if any(any(s==w or s.startswith(w+"-") or (w.startswith(s+"-") and len(s)>3) for s in ids) for w in wanted):
                found.append({"group":grp,"id":id,"set_id":v.get("set_id"),"base_set_id":v.get("base_set_id"),"name":v.get("name",{}).get("en-US") if isinstance(v.get("name"),dict) else v.get("name"),"blade_id":v.get("blade_id"),"ratchet_id":v.get("ratchet_id"),"bit_id":v.get("bit_id"),"lock_chip_id":v.get("lock_chip_id"),"main_blade_id":v.get("main_blade_id"),"assist_blade_id":v.get("assist_blade_id")})
    out["sources"][market]["matches"]=found[:250]
    print(market,len(found))
pathlib.Path("data/catalog-id-map.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
