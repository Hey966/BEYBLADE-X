'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const workflow=read('.github/workflows/import-collected-top.yml');
const marker='          script: |\n';
assert.ok(workflow.includes(marker));
const body=workflow.slice(workflow.indexOf(marker)+marker.length)
 .split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const execute=new AsyncFunction('github','context','core','require',body);
const sandbox={window:{}};vm.runInNewContext(read('collection-local.js'),sandbox);
const L=sandbox.window.BBX_LOCAL;
const bey=L.sanitizeBey({id:'LOCAL-TEST-12345',name:'Safe Test Top',system:'UX',ownMarket:'JP',
 spinDirection:'L',blade:'Test Blade',ratchet:'3-60',bit:'F'});
const fence=String.fromCharCode(96).repeat(3);
const issue={number:123,title:'[COLLECTION-SYNC] '+bey.name,
 body:'Please review\n'+fence+'bbx966-json\n'+JSON.stringify({schema:'BBX966-ADD-V2',bey,ability:null})+
 '\n'+fence};
const ctx={repo:{owner:'Hey966',repo:'BEYBLADE-X'},payload:{issue}};
const blobs=[],comments=[],prs=[];
const github={rest:{
 issues:{createComment:async arg=>{comments.push(arg);return{}}},
 git:{
  getRef:async()=>({data:{object:{sha:'HEADSHA'}}}),
  getCommit:async()=>({data:{tree:{sha:'BASESHA'}}}),
  createBlob:async arg=>{blobs.push(arg);return{data:{sha:'BLOB'+blobs.length}};},
  createTree:async arg=>({data:{sha:'TREESHA'}}),
  createCommit:async arg=>({data:{sha:'COMMITSHA'}}),
  createRef:async arg=>({data:{ref:arg.ref}})
 },
 pulls:{create:async arg=>{prs.push(arg);return{data:{html_url:'https://github.com/Hey966/BEYBLADE-X/pull/999'}}}}
}};
const core={setFailed:msg=>{throw Error(msg)}};
(async()=>{
 await execute(github,ctx,core,require);
 assert.equal(prs.length,1);
 assert.equal(blobs.length,7,'all data mirrors and pending sources should update');
 const values=blobs.map(x=>x.content);
 const collection=JSON.parse(values.find(x=>x.includes('"schemaVersion"')&&x.includes('"packages"')));
 assert.equal(collection.beys.at(-1).name,bey.name);
 assert.equal(collection.beys.at(-1).spinDirection,'L');
 assert.equal(collection.summary.beyCount,20);
 const abilities=JSON.parse(values.find(x=>x.includes('"verifiedOverridesSource"')&&x.includes('"summary"')&&x.includes('"beys"')));
 assert.deepEqual(Object.keys(abilities.beys[bey.id].parts),[],'without packaging scores there are no invented abilities');
 const status=JSON.parse(values.find(x=>x.includes('"manifestVersion"')&&x.includes('"results"')));
 assert.equal(status.results.filter(x=>x.id===bey.id).length,7);
 assert.equal(status.results.filter(x=>x.id===bey.id&&x.status==='not_applicable').length,3);
 assert.equal(comments.length,1);
 assert.ok(comments[0].body.includes('Pull Request'));
 console.log('Owner-sync Action dry run: validated new record, 7 synchronized manifests, unverified stats and review PR');
})().catch(err=>{console.error(err);process.exitCode=1});
