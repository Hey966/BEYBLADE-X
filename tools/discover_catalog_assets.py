import urllib.request, urllib.parse, re, json, pathlib
base="https://beyblade.phstudy.org/"
result={"origin":base,"sources":[],"found":[]}
def get(u):
    req=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0 (catalog research; noncommercial)"})
    with urllib.request.urlopen(req,timeout=18) as r:return r.read(5000000).decode("utf-8","replace")
try:
    html=get(base+"index.html?lang=zh-TW")
    result["length"]=len(html)
    result["found"].append({"source":"index.html","context":[html[max(0,m.start()-120):m.end()+180] for m in list(re.finditer(r'G3063-0[12]|(?:part|images|catalog).*\.json',html,re.I))[:15]]})
    paths=re.findall(r'<script\b[^>]+src=["\']([^"\']+)["\']',html,re.I)
    result["scripts"]=paths[:30]
    for p in paths[:20]:
        try:
            u=urllib.parse.urljoin(base,p)
            src=get(u)
            context=[src[max(0,m.start()-100):m.end()+200] for m in list(re.finditer(r'G3063-0[12]|parts\.json|data\/|\.json',src,re.I))[:12]]
            result["sources"].append({"path":u,"length":len(src),"context":context,"dataFilesSnippet":src[src.find("const DATA_FILES="):src.find("const DATA_FILES=")+700] if "const DATA_FILES=" in src else None})
        except Exception as e:result["sources"].append({"path":p,"error":str(e)[:100]})
except Exception as e:result["error"]=str(e)
p=pathlib.Path("data/catalog-research.json")
p.parent.mkdir(exist_ok=True)
p.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf8")
print(json.dumps(result,ensure_ascii=False)[:8000])

for q in ("data/main.json","data/main.zh-TW.json","data/hardcoded.json","data/parts.json","data/images.json"):
    try:
        u=urllib.parse.urljoin(base,q)
        body=get(u)
        matches=[]
        for needle in ("G3063-01","G3063-02","G3084-01"):
            i=body.find(needle)
            if i>=0: matches.append({"needle":needle,"offset":i,"snippet":body[max(0,i-300):i+1200]})
        result.setdefault("json_sources",[]).append({"url":u,"length":len(body),"matches":matches[:3]})
    except Exception as e:
        result.setdefault("json_sources",[]).append({"url":q,"error":str(e)[:150]})
pathlib.Path("data/catalog-research.json").write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf8")
