#!/usr/bin/env python3
"""Synchronize Beyblade X component attributes from release-exact public catalog entries.

Use catalog-published performance figures as attributes, never as experimental win rate.
Unknown values remain null. No invented stats or descriptions.
"""
from __future__ import annotations
import json
import pathlib
import urllib.request
import datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
MARKETS={
 "US":"https://beyblade.phstudy.org/data/hasbro.json",
 "JP":"https://beyblade.phstudy.org/data/main.json",
}
FIELDS={
 "blade":"BeybladePartsBlade",
 "ratchet":"BeybladePartsRatchet",
 "bit":"BeybladePartsBit",
 "lockChip":"BeybladePartsLockChip",
 "mainBlade":"BeybladePartsMainBlade",
 "assistBlade":"BeybladePartsAssistBlade",
}
CATEGORIES=("attack","defense","stamina","dash","burst","height","weight")

def catalog(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (personal X collection attribute synchronization)"})
 with urllib.request.urlopen(req,timeout=45) as resp:
  return json.load(resp)["data"]

def lang(value):
 if isinstance(value,dict):
  for key in ("zh-TW","en-US","ja-JP"):
   if isinstance(value.get(key),str) and value[key].strip():return value[key].strip()
 if isinstance(value,str):return value.strip()
 return ""

def numeric(value):
 return float(value) if isinstance(value,(int,float)) and not isinstance(value,bool) else None

def main():
 db=json.loads((ROOT/"data/collection.json").read_text(encoding="utf-8"))
 sources=json.loads((ROOT/"data/image-sources.json").read_text(encoding="utf-8"))
 by_id={x["id"]:(pack.get("market"),x) for pack in sources.get("packages",[]) for x in pack.get("items",[])}
 cached={}
 result={
  "schemaVersion":1,
  "generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "method":"Release-specific independent catalog numeric fields (defaultStatus); not measured winning probabilities.",
  "sources":MARKETS,
  "notes":"Printed part stats vary by kind; compare only relevant metrics. Missing stats are null. CX part ratings are not directly additive to full Blade ratings.",
  "beys":{},
  "summary":{"totalBeys":len(db["beys"]),"partRecords":0,"numericRecords":0,"missingRecords":0}
 }
 for bey in db["beys"]:
  bid=bey["id"]
  entry={"id":bid,"name":bey.get("name"),"system":bey.get("system"),"spinDirection":bey.get("spinDirection"),"parts":{}}
  pair=by_id.get(bid)
  if pair:
   market,source=pair
   if market not in cached:
    try:cached[market]=catalog(MARKETS[market])
    except Exception as exc:
     print("CATALOG UNAVAILABLE",market,str(exc))
     cached[market]={}
   for kind,group in FIELDS.items():
    s=source.get(kind)
    if not isinstance(s,dict) or not s.get("partID"):continue
    key=s["partID"]
    item=cached[market].get(group,{}).get(key)
    result["summary"]["partRecords"]+=1
    if not isinstance(item,dict):
     result["summary"]["missingRecords"]+=1
     entry["parts"][kind]={"id":key,"sourceUrl":s.get("page"),"available":False,"stats":{}}
     continue
    st=item.get("defaultStatus") or {}
    stats={k:numeric(st.get(k)) for k in CATEGORIES if numeric(st.get(k)) is not None}
    if stats:result["summary"]["numericRecords"]+=1
    entry["parts"][kind]={
      "id":key,"available":True,
      "name":lang(item.get("name")) or key,
      "type":item.get("type") if isinstance(item.get("type"),str) else None,
      "weightG":numeric(item.get("weight")) or numeric(item.get("mass")) or numeric(item.get("weight_g")),
      "stats":stats,
      "sourceUrl":s.get("page"),
      "sourceCatalog":MARKETS[market],
      "catalogRelease":item.get("set_id"),
    }
  else:
   entry["missingSource"]=True
  result["beys"][bid]=entry
 (ROOT/"data/part-abilities.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 (ROOT/"data/part-abilities.js").write_text("window.BBX_PART_STATS = "+json.dumps(result,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf8")
 print(json.dumps(result["summary"],ensure_ascii=False))
 if result["summary"]["numericRecords"]<45:
  raise RuntimeError("Too few numeric records: verify catalog schema before publishing")

if __name__=="__main__":
 main()
