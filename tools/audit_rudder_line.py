#!/usr/bin/env python3
from PIL import Image
import numpy as np, json, pathlib, cv2
p=pathlib.Path('images/reference/own-g3393-01.png')
im=np.array(Image.open(p).convert('RGBA'))
h,w=im.shape[:2]
rgb=im[:,:,:3].astype(np.int16); alpha=im[:,:,3]
diff=rgb.max(2)-rgb.min(2)
lum=rgb.mean(2)
neutral=(alpha>12)&(diff<38)&(lum>90)
candidates=[]
for y in range(int(h*.55),int(h*.97)):
 row=neutral[y]
 count=int(row.sum())
 if count>=max(20,int(w*.04)):
  xs=np.where(row)[0]
  candidates.append(dict(y=int(y),count=count,minX=int(xs[0]),maxX=int(xs[-1]),alpha=int(alpha[y,xs].max()),span=int(xs[-1]-xs[0]+1)))
mask=neutral.astype('uint8')
total, labels, stats, centers=cv2.connectedComponentsWithStats(mask,8)
components=[]
for i in range(1,total):
 x,y,ww,hh,area=map(int,stats[i])
 if y<int(h*.55):continue
 if ww>=w*.10 or (ww>25 and hh<12):
  components.append(dict(x=x,y=y,width=ww,height=hh,area=area,aspect=round(ww/max(hh,1),1)))
result=dict(file=str(p),size=[w,h],candidateRows=sorted(candidates,key=lambda a:-a["count"])[:45],
            longestComponents=sorted(components,key=lambda x:-x["width"])[:45])
out=pathlib.Path('data/rudder-line-audit.json');out.write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result)[:5000])
