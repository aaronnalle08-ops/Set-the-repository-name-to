'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const read=relative=>fs.readFileSync(path.join(__dirname,relative),'utf8');

test('production cannot start with weak or placeholder credentials',()=>{
  for(const env of [
    {ADMIN_PASSWORD:'short',PUBLIC_ORIGIN:'https://admin.test.invalid'},
    {ADMIN_PASSWORD:'abcdefghijklmnopqrstuvwxyz0123456789',PUBLIC_ORIGIN:'https://admin.example.com'},
    {ADMIN_PASSWORD:'replace_with_random_unique_32_plus_character_password',PUBLIC_ORIGIN:'https://admin.test.invalid'}
  ]){
    const result=spawnSync(process.execPath,['server.js'],{
      cwd:__dirname,encoding:'utf8',timeout:4000,
      env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3000',...env}
    });
    assert.notEqual(result.status,0,'Production must reject invalid startup values');
    assert.match(result.stderr,/Production requires|Replace all example/i);
  }
});

test('hosted API refuses cross-site modifications but allows exact configured HTTPS origin',()=>{
  const code=`
    const http=require('node:http');
    const {createApp,DEFAULT_STATE}=require('./server.js');
    (async()=>{
      const app=createApp({initialState:DEFAULT_STATE,persist:()=>{}});
      const srv=http.createServer((req,res)=>app.handler(req,res));
      await new Promise(r=>srv.listen(0,'127.0.0.1',r));
      try {
        const base='http://127.0.0.1:'+srv.address().port;
        const send=origin=>fetch(base+'/api/analytics/manual',{
          method:'POST',headers:{'Content-Type':'application/json',Origin:origin},
          body:JSON.stringify({metric:'manualClicks',value:7})
        });
        const bad=await send('https://untrusted.example.invalid');
        const good=await send('https://admin.test.invalid');
        if(bad.status!==400||good.status!==200||app.state.analytics.universal.manualClicks!==7)process.exitCode=1;
      } finally {await new Promise(r=>srv.close(r))}
    })().catch(e=>{console.error(e);process.exitCode=1});
  `;
  const result=spawnSync(process.execPath,['-e',code],{cwd:__dirname,encoding:'utf8',timeout:7000,
    env:{...process.env,NODE_ENV:'',PUBLIC_ORIGIN:'https://admin.test.invalid',ADMIN_PASSWORD:'',HOST:'127.0.0.1'}});
  assert.equal(result.status,0,result.stderr);
});

test('production deployment keeps private dashboard behind an unpublished port and public landing separate',()=>{
  const compose=read('deploy/website/compose.yaml');
  assert.match(compose,/PUBLIC_ORIGIN:/);
  assert.match(compose,/ADMIN_PASSWORD:/);
  assert.match(compose,/CLOUDFLARE_TUNNEL_TOKEN:/);
  assert.doesNotMatch(compose,/\n\s+ports:/,'No container may bind a public host port');
  assert.match(compose,/ugn_private:\/app\/data/);
  assert.match(compose,/cloudflared:/);
  const publicPage=read('deploy/website/public/index.html');
  assert.match(publicPage,/Shattered Crown/);
  assert.match(publicPage,/In development/);
  assert.doesNotMatch(publicPage,/api\/update|Discord webhook URL|ADMIN_PASSWORD/);
  const ignore=read('.dockerignore');
  assert.match(ignore,/\bdata\b/);
  assert.match(ignore,/\.env/);
});
