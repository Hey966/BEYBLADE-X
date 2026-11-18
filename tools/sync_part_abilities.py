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

def apply_verified_overrides(result):
 """Prioritise visible Hasbro box specifications over conflicting fan catalog mirrors.

 Release-specific corrections are a separate reviewed data file. Never
 silently overwrite a changed upstream record without re-verification.
 """
 source=json.loads((ROOT/"data/part-stat-overrides.json").read_text(encoding="utf-8"))
 changed=0
 for owner,record in source["records"].items():
  bey=result["beys"].get(owner)
  if not bey:
   raise RuntimeError(f"Verified override owner is missing: {owner}")
  for kind,corrected in record["parts"].items():
   part=bey["parts"].get(kind)
   if not part or not part.get("available"):
    raise RuntimeError(f"Verified override part is not present: {owner}/{kind}")
   original=record["originalCatalog"][kind]
   for stat,value in corrected.items():
    current=part["stats"].get(stat)
    if current not in (original[stat],value):
     raise RuntimeError(
      f"Unexpected catalog change in {owner}/{kind}/{stat}: "
      f"{current}, expected {original[stat]} or {value}. Re-audit first."
     )
    part["stats"][stat]=value
   part["verification"]={
    "status":"verified-from-product-packaging",
    "evidenceGrade":record["evidenceGrade"],
    "sourcePage":record["packagePage"],
    "sourceImage":record["packageBackImage"],
    "crossReference":record["independentStats"],
    "reissueOf":record["reissueOf"],
    "originalCatalog":original,
    "reason":record["reason"],
   }
   changed+=1
 result["summary"]["verifiedPartCorrections"]=changed
 result["verifiedOverridesSource"]="data/part-stat-overrides.json"
 return changed

def main():
 db=json.loads((ROOT/"data/collection.json").read_text(encoding="utf-8"))
 sources=json.loads((ROOT/"data/image-sources.json").read_text(encoding="utf-8"))
 by_id={x["id"]:(pack.get("market"),x) for pack in sources.get("packages",[]) for x in pack.get("items",[])}
 cached={}
 old_path=ROOT/"data/part-abilities.json"
 old=json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {"beys":{}}
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
   # Preserve only explicitly marked user-supplied stats. Do not estimate.
   previous=old.get("beys",{}).get(bid,{})
   for kind,part in previous.get("parts",{}).items():
    if part.get("verification",{}).get("status")=="user-entered-unverified":
     entry["parts"][kind]=part
     result["summary"]["partRecords"]+=1
     if all(isinstance(part.get("stats",{}).get(key),(int,float)) for key in ("attack","defense","stamina")):
      result["summary"]["numericRecords"]+=1
   expected=6 if bey.get("system")=="CX" else 3
   result["summary"]["missingRecords"]+=max(0,expected-len(entry["parts"]))
  result["beys"][bid]=entry
 # Validate the upstream extract BEFORE writing. Keep last known-good files
 # intact when the remote catalog cannot be read or its structure changes.
 if result["summary"]["numericRecords"]<45:
  raise RuntimeError("Too few numeric records: verify catalog schema before publishing")
 count=apply_verified_overrides(result)
 print(f"Applied {count} Hasbro packaging-backed part corrections")
 (ROOT/"data/part-abilities.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 (ROOT/"data/part-abilities.js").write_text("window.BBX_PART_STATS = "+json.dumps(result,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf8")
 print(json.dumps(result["summary"],ensure_ascii=False))

if __name__=="__main__":
 main()
