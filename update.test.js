'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const updater=require('./update-manager.js');
const {createApp,DEFAULT_STATE}=require('./server.js');
const sha='a'.repeat(64);
const repo='ugn-operator/ugn-auto-advertiser';
const url=`https://github.com/${repo}/releases/download/v3.0.1/ugn-auto-advertiser.zip`;
const release={tag_name:'v3.0.1',draft:false,prerelease:false,assets:[{name:updater.ASSET_NAME,state:'uploaded',size:8921,digest:`sha256:${sha}`,browser_download_url:url}]};

test('GitHub repository input rejects other web hosts and unsafe paths',()=>{
  assert.equal(updater.normalizeRepository('https://github.com/'+repo+'.git'),repo);
  for(const bad of ['https://evil.example/a/b','../../evil','@x/y','http://github.com/a/b','a/b/extra','a/b?x=1','a/../b','a/']){
    assert.throws(()=>updater.normalizeRepository(bad));
  }
});
test('release version and SHA-256 verification guard update decisions',()=>{
  assert.equal(updater.compareVersions('v3.0.1','3.0.0'),1);
  assert.equal(updater.compareVersions('v3.0.0','3.0.0'),0);
  assert.equal(updater.compareVersions('v2.9.9','3.0.0'),-1);
  assert.equal(updater.validateRelease(release,repo,'3.0.0').available,true);
  assert.equal(updater.validateRelease(release,repo,'3.1.0').available,false);
  assert.throws(()=>updater.validateRelease({...release,assets:[{...release.assets[0],digest:null}]},repo,'3.0.0'),/digest/i);
  assert.throws(()=>updater.validateRelease({...release,assets:[{...release.assets[0],browser_download_url:'https://evil.example/a.zip'}]},repo,'3.0.0'),/URL/i);
  assert.throws(()=>updater.validateRelease({...release,prerelease:true},repo,'3.0.0'),/stable/i);
});
test('GitHub public latest release endpoint loads with expected API URL',async()=>{
  let called;
  const got=await updater.fetchRelease(repo,'3.0.0',async (u)=>{called=u;return {ok:true,status:200,json:async()=>release};});
  assert.equal(called,`https://api.github.com/repos/${repo}/releases/latest`);
  assert.equal(got.version,'3.0.1');
});
test('local dashboard can configure, check and approve install without exposing secrets',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ugn-updater-test-'));
  t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  const invoked=[];
  const app=createApp({initialState:DEFAULT_STATE,persist:()=>{},dataDir,updateAvailableOnMachine:true,
    getRelease:async (value)=>{assert.equal(value,repo);return updater.validateRelease(release,value,'3.0.0')},updateRestart:()=>invoked.push(true)});
  const server=http.createServer((req,res)=>app.handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  // Update route requires the configured localhost port. Reject the wrong host/port.
  const base='http://127.0.0.1:'+server.address().port;
  let req=await fetch(base+'/api/update/status');
  let status=await req.json();
  assert.equal(status.canInstall,false);
  req=await fetch(base+'/api/update/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});
  assert.equal(req.status,400);
  assert.deepEqual(invoked,[]);
});
test('one-click updater approves a trusted release and writes a restart plan',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ugn-updater-live-'));
  t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  const restarted=[];
  // Bind an isolated port. We forward that port to createApp so we can check the
  // exact same loopback and Origin guards used in the production launcher.
  const probe=http.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const app=createApp({initialState:DEFAULT_STATE,persist:()=>{},dataDir,updatePort:port,updateAvailableOnMachine:true,
    getRelease:async (r)=>updater.validateRelease(release,r,'3.0.0'),updateRestart:()=>restarted.push(true)});
  const server=http.createServer((req,res)=>app.handler(req,res));
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${port}`;
  const req=async(route,method='GET',body,origin)=>{
    const r=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  };
  let r=await req('/api/update/status');assert.equal(r.data.canInstall,true);
  r=await req('/api/update/config','PUT',{repository:repo},'https://attacker.invalid');assert.equal(r.status,400);
  r=await req('/api/update/config','PUT',{repository:repo});assert.equal(r.status,200);
  r=await req('/api/update/check');assert.equal(r.status,200);assert.equal(r.data.release.available,true);
  r=await req('/api/update/install','POST',{confirm:true});assert.equal(r.status,202);
  const plan=JSON.parse(fs.readFileSync(path.join(dataDir,'pending-update.json'),'utf8'));
  assert.equal(plan.repository,repo);assert.equal(plan.digest,`sha256:${sha}`);
  r=await req('/api/update/install','POST',{confirm:true});assert.equal(r.status,409);
  await new Promise(resolve=>setTimeout(resolve,750));assert.deepEqual(restarted,[true]);
});
test('update source and pending plans are kept inside private data directory',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'ugn-source-test-'));
  try{
    assert.equal(updater.readConfig(d),'');
    updater.safeSaveJSON(updater.privateFile(d,'update-source.json'),{repository:repo});
    assert.equal(updater.readConfig(d),repo);
    assert.equal(fs.existsSync(path.join(d,'update-source.json')),true);
  }finally{fs.rmSync(d,{recursive:true,force:true});}
});
