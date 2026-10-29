const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {validWebhook,validateSchedule,computeNext,createApp,DEFAULT_STATE} = require('./server.js');

const WEBHOOK='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz';
test('only properly shaped Discord HTTPS webhooks are accepted',()=>{
  assert.equal(validWebhook(WEBHOOK),true);
  assert.equal(validWebhook('http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz'),false);
  assert.equal(validWebhook('https://discord.com.evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz'),false);
  assert.equal(validWebhook('https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz?wait=true'),false);
});
test('interval schedules validate and calculate precise next post',()=>{
  const schedule=validateSchedule({mode:'interval',every:3,unit:'days',timeZone:'America/New_York'});
  assert.equal(computeNext(schedule,Date.UTC(2026,9,29,12,0)),new Date(Date.UTC(2026,10,1,12,0)).toISOString());
  assert.throws(()=>validateSchedule({mode:'interval',every:1,unit:'hours'}),/at least 6 hours/i);
});
test('weekly schedule calculates New York local time through DST',()=>{
  const s=validateSchedule({mode:'weekly',days:[0],time:'18:00',timeZone:'America/New_York'});
  assert.equal(computeNext(s,Date.parse('2026-10-31T12:00:00Z')),'2026-11-01T23:00:00.000Z');
  const s2=validateSchedule({mode:'weekly',days:[0],time:'02:30',timeZone:'America/New_York'});
  // DST spring jump on 2027-03-14: 2:30 local never happens. The next Sunday is used.
  assert.equal(computeNext(s2,Date.parse('2027-03-14T05:00:00Z')),'2027-03-21T06:30:00.000Z');
});
test('public API never returns webhook secret; scheduled send uses allowed_mentions empty',async(t)=>{
  const posts=[];
  const app=createApp({initialState:DEFAULT_STATE,persist:()=>{},fetch:async (url,init)=>{posts.push({url,init});return {ok:true,status:204}}});
  const server=http.createServer((req,res)=>app.handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  const api=async(route,method='GET',obj)=>{const r=await fetch(url+route,{method,headers:{'Content-Type':'application/json'},body:obj?JSON.stringify(obj):undefined});return {status:r.status,json:await r.json()}};
  let r=await api('/api/channels','POST',{name:'Our permitted channel',url:WEBHOOK,permissionConfirmed:true});
  assert.equal(r.status,201);
  r=await api('/api/state');assert.equal(JSON.stringify(r.json).includes(WEBHOOK),false);
  assert.equal(r.json.channels.length,1);
  r=await api('/api/schedule','PUT',{mode:'interval',every:6,unit:'hours',timeZone:'America/New_York'});
  assert.equal(r.status,200);
  r=await api('/api/activate','POST',{enabled:true});
  assert.equal(r.status,200);
  assert.ok(app.state.schedule.nextAt);
  app.state.schedule.nextAt=new Date(Date.now()-1000).toISOString();
  await app.tick();
  assert.equal(posts.length,1);
  const payload=JSON.parse(posts[0].init.body);
  assert.deepEqual(payload.allowed_mentions,{parse:[]});
  assert.match(payload.content,/play\.universalgaming\.us/);
  assert.equal(app.state.stats.sent,1);
  assert.ok(Date.parse(app.state.schedule.nextAt)>Date.now());
  await app.tick(); assert.equal(posts.length,1);
  r=await api('/api/test','POST',{channelId:r.json.channelId});
  assert.equal(r.status,400); // invalid channel IDs should not post
});
