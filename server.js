'use strict';
// UGN Advertising Command Center — Node 22+; no third-party dependencies.
// Incoming Discord webhooks only. Never automates third-party listing-site forms.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const updater = require('./update-manager.js');
const APP_VERSION = require('./package.json').version;

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ugn-private.json');
const DEFAULT_CAMPAIGN = {
  serverName: 'Universal Gaming Network — Universal SMP',
  serverIp: 'play.universalgaming.us', javaPort: '25565', bedrockPort: '19132',
  serverDesc: 'A community-driven survival Minecraft network with Java & Bedrock crossplay. Grind, explore, build, and survive with custom furniture, plushies, armor, tools, seasonal content, an economy, jobs, and more. Play solo or with friends!',
  discord: '', website: ''
};
const DEFAULT_SCHEDULE = {
  enabled: false, mode: 'interval', every: 6, unit: 'hours',
  days: [1, 3, 5], time: '18:00', timeZone: 'America/New_York',
  nextAt: null, lastAt: null
};
const DEFAULT_STATE = {campaign: DEFAULT_CAMPAIGN, schedule: DEFAULT_SCHEDULE, channels: [], logs: [], stats: {sent: 0, failed: 0}};

function validWebhook(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'https:' && ['discord.com', 'discordapp.com'].includes(u.hostname) && !u.username && !u.password && !u.search && !u.hash && /^\/api\/webhooks\/\d{15,22}\/[A-Za-z0-9._-]{12,}$/.test(u.pathname);
  } catch { return false; }
}
function validZone(zone) {
  try { new Intl.DateTimeFormat('en-US', {timeZone: zone}).format(); return true; } catch { return false; }
}
function validateSchedule(input) {
  if (!input || !['interval', 'weekly'].includes(input.mode)) throw Error('Select interval or weekdays.');
  const out = {...DEFAULT_SCHEDULE};
  out.mode = input.mode;
  out.timeZone = String(input.timeZone || DEFAULT_SCHEDULE.timeZone).trim();
  if (!validZone(out.timeZone)) throw Error('Choose a valid IANA time zone such as America/New_York.');
  if (out.mode === 'interval') {
    out.every = Number(input.every);
    out.unit = input.unit;
    if (!Number.isInteger(out.every) || !['hours', 'days'].includes(out.unit)) throw Error('Enter a whole-number interval in hours or days.');
    if ((out.unit === 'hours' && (out.every < 6 || out.every > 720)) || (out.unit === 'days' && (out.every < 1 || out.every > 90))) throw Error('Use at least 6 hours or 1 day, and at most 720 hours or 90 days.');
  } else {
    out.days = [...new Set(Array.isArray(input.days) ? input.days.map(Number) : [])].sort();
    out.time = String(input.time || '');
    if (!out.days.length || out.days.some(n => !Number.isInteger(n) || n < 0 || n > 6)) throw Error('Select one or more weekdays.');
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(out.time)) throw Error('Enter a valid posting time.');
  }
  return out;
}
function timeParts(instant, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit', hourCycle:'h23'}).formatToParts(new Date(instant));
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function utcForLocal(y,m,d,h,min,zone) {
  const target = Date.UTC(y,m-1,d,h,min);
  let epoch = target;
  for (let i=0; i<4; i++) {
    const p = timeParts(epoch, zone);
    const offset = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute) - Math.floor(epoch/60000)*60000;
    const next = target - offset;
    if (next === epoch) break;
    epoch = next;
  }
  const p = timeParts(epoch, zone);
  return p.year===y && p.month===m && p.day===d && p.hour===h && p.minute===min ? epoch : null; // Skip nonexistent DST wall times.
}
function computeNext(sched, from = Date.now()) {
  if (sched.mode === 'interval') return new Date(from + sched.every * (sched.unit === 'days' ? 86400000 : 3600000)).toISOString();
  const nowLocal = timeParts(from, sched.timeZone);
  const hh = Number(sched.time.slice(0,2)), mm = Number(sched.time.slice(3,5));
  for (let i=0; i<15; i++) {
    const localDate = new Date(Date.UTC(nowLocal.year,nowLocal.month-1,nowLocal.day + i));
    if (!sched.days.includes(localDate.getUTCDay())) continue;
    const candidate = utcForLocal(localDate.getUTCFullYear(),localDate.getUTCMonth()+1,localDate.getUTCDate(),hh,mm,sched.timeZone);
    if (candidate !== null && candidate > from + 1000) return new Date(candidate).toISOString();
  }
  throw Error('Could not calculate the next local posting time.');
}
function formatMessage(c) {
  const msg = `🌌 **${c.serverName}** 🌌\n\n${c.serverDesc}\n\n☕ Java: ${c.serverIp}:${c.javaPort}\n🎮 Bedrock: ${c.serverIp}:${c.bedrockPort}${c.discord ? '\n💬 Discord: '+c.discord : ''}${c.website ? '\n🌐 Website: '+c.website : ''}\n\n✨ Join our Minecraft community!`;
  return msg.slice(0, 1900);
}
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {...DEFAULT_STATE, ...s, campaign:{...DEFAULT_CAMPAIGN,...s.campaign}, schedule:{...DEFAULT_SCHEDULE,...s.schedule},channels:Array.isArray(s.channels)?s.channels:[],logs:Array.isArray(s.logs)?s.logs:[],stats:{...DEFAULT_STATE.stats,...s.stats}};
  } catch(e) {
    if (e.code !== 'ENOENT') throw e;
    return structuredClone(DEFAULT_STATE);
  }
}
function persist(s) {
  fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
  const temp = DATA_FILE+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(s,null,2),{mode:0o600});
  fs.renameSync(temp,DATA_FILE);
}
function infoForClient(s, active) {
  return {campaign:s.campaign, schedule:s.schedule, channels:s.channels.map(x=>({id:x.id,name:x.name,enabled:x.enabled,masked:'Discord webhook saved ••••'+x.url.slice(-5)})),logs:s.logs.slice(-65),stats:s.stats, busy:active};
}
function createApp(options = {}) {
  const state = options.initialState ? structuredClone(options.initialState) : readState();
  let busy = false;
  let ticking = false;
  const write = options.persist || (()=>persist(state));
  const poster = options.fetch || globalThis.fetch;
  const getRelease = options.getRelease || updater.fetchRelease;
  const updateRestart = options.updateRestart || (()=>process.exit(74));
  const configDataDir = options.dataDir || DATA_DIR;
  const expectedUpdatePort = options.updatePort || PORT;
  const updateAvailableOnMachine = options.updateAvailableOnMachine ?? (process.platform === 'win32' && process.env.UGN_UPDATE_WRAPPER === '1' && (HOST==='127.0.0.1'||HOST==='localhost'||HOST==='::1'));
  let updating = false;
  function updateLocalOnly(req) {
    if (!updateAvailableOnMachine || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return false;
    const host = req.headers.host || '';
    if (![`127.0.0.1:${expectedUpdatePort}`,`localhost:${expectedUpdatePort}`,`[::1]:${expectedUpdatePort}`].includes(host)) return false;
    if(req.headers.origin && ![`http://127.0.0.1:${expectedUpdatePort}`,`http://localhost:${expectedUpdatePort}`,`http://[::1]:${expectedUpdatePort}`].includes(req.headers.origin)) return false;
    if(req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])) return false;
    return true;
  }
  function requireLocalUpdate(req) { if (!updateLocalOnly(req)) throw Error('Installation is available only on Windows when using start_windows.bat on localhost.'); }

  const appendLog = (entry) => {state.logs.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),...entry});state.logs.length=Math.min(state.logs.length,200);write();};

  async function sendOne(channel, trigger) {
    try {
      const response = await poster(channel.url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'UGN Announcements',content:(trigger==='test'?'🧪 **Test post (UGN Advertising Command Center)**\n\n':'')+formatMessage(state.campaign),allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(15000)});
      if (!response.ok) {
        if ([401,403,404].includes(response.status)) channel.enabled = false;
        state.stats.failed++;
        appendLog({channel:channel.name,trigger,result:'failed',message:`Discord HTTP ${response.status}${[401,403,404].includes(response.status)?' — channel disabled':''}`});
        return false;
      }
      state.stats.sent++;
      appendLog({channel:channel.name,trigger,result:'sent',message:'Discord accepted the post'});
      return true;
    } catch (e) {
      state.stats.failed++;
      appendLog({channel:channel.name,trigger,result:'failed',message:e.name==='TimeoutError'?'Request timed out':'Could not reach Discord'});
      return false;
    }
  }
  async function runPost(trigger, id) {
    if(busy) throw Error('A send is already in progress.');
    const channels = id ? state.channels.filter(x=>x.id===id&&x.enabled) : state.channels.filter(x=>x.enabled);
    if(!channels.length) throw Error('Connect at least one enabled Discord webhook first.');
    busy=true;
    try {
      let successes=0;
      for (const channel of channels) if(await sendOne(channel,trigger)) successes++;
      return {attempted:channels.length,sent:successes,failed:channels.length-successes};
    } finally {busy=false;write();}
  }
  async function tick() {
    if(ticking || busy || !state.schedule.enabled || !state.schedule.nextAt) return;
    const now = Date.now();
    if(new Date(state.schedule.nextAt).getTime() > now) return;
    ticking=true;
    try {
      const intervalMs = state.schedule.mode === 'interval' ? state.schedule.every*(state.schedule.unit==='days'?86400000:3600000) : 7*86400000;
      const overdueBy = now - new Date(state.schedule.nextAt).getTime();
      if (overdueBy > intervalMs) {
        state.schedule.nextAt = computeNext(state.schedule,now);
        appendLog({channel:'Scheduler',trigger:'scheduled',result:'skipped',message:'Skipped stale missed run after extended downtime'});
      } else {
        // Advance schedule before sending so process restarts do not duplicate old runs.
        state.schedule.lastAt=new Date(now).toISOString();
        state.schedule.nextAt=computeNext(state.schedule,now);
        write();
        try {await runPost('scheduled');}
        catch(e){appendLog({channel:'Scheduler',trigger:'scheduled',result:'failed',message:e.message});}
      }
    } finally {ticking=false;}
  }
  const json=(res,status,data)=>send(res,status,JSON.stringify(data),'application/json; charset=utf-8');
  function send(res,status,body,contentType) {
    res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    res.end(body);
  }
  function authorized(req) {
    if(!ADMIN_PASSWORD) return true; // Only allowed with loopback binding.
    const h=req.headers.authorization||'';
    if(!h.startsWith('Basic ')) return false;
    let provided='';
    try {provided=Buffer.from(h.slice(6),'base64').toString('utf8').split(':').slice(1).join(':');} catch {return false;}
    const a=Buffer.from(provided), b=Buffer.from(ADMIN_PASSWORD);
    return a.length===b.length && crypto.timingSafeEqual(a,b);
  }
  async function readBody(req) {
    let chunks=[],bytes=0;
    for await(const ch of req){bytes+=ch.length;if(bytes>40000)throw Error('Request too large');chunks.push(ch);}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Invalid JSON body');}
  }
  async function handler(req,res) {
    if(!authorized(req)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="UGN Admin"','Cache-Control':'no-store'});return res.end('Authentication required');}
    const route=(req.url||'/').split('?')[0];
    try {
      if(req.method==='GET' && (route==='/'||route==='/index.html')) return send(res,200,fs.readFileSync(path.join(__dirname,'index.html')),'text/html; charset=utf-8');
      if(req.method==='GET' && route==='/api/state') return json(res,200,infoForClient(state,busy));
      if(req.method==='GET' && route==='/api/update/status') {
        const repository=updater.readConfig(configDataDir);
        return json(res,200,{version:APP_VERSION,repository,canInstall:updateLocalOnly(req),isUpdating:updating,lastResult:updater.readResult(configDataDir)});
      }
      if(req.method==='PUT' && route==='/api/update/config') {
        requireLocalUpdate(req);
        const body=await readBody(req);
        const repository=updater.normalizeRepository(body.repository);
        updater.safeSaveJSON(updater.privateFile(configDataDir,'update-source.json'),{repository});
        return json(res,200,{ok:true,repository});
      }
      if(req.method==='GET' && route==='/api/update/check') {
        requireLocalUpdate(req);
        const repository=updater.readConfig(configDataDir);
        if(!repository)throw Error('Save your GitHub repository first.');
        const release=await getRelease(repository,APP_VERSION);
        return json(res,200,{repository,version:APP_VERSION,release:{version:release.version,available:release.available,releaseUrl:release.releaseUrl}});
      }
      if(req.method==='POST' && route==='/api/update/install') {
        requireLocalUpdate(req);
        if(updating) return json(res,409,{error:'An update is already starting.'});
        const body=await readBody(req);
        if(body.confirm!==true)throw Error('Confirm that you want to install a trusted update.');
        const repository=updater.readConfig(configDataDir);
        if(!repository)throw Error('Save your GitHub repository first.');
        const release=await getRelease(repository,APP_VERSION);
        if(!release.available)return json(res,409,{error:'No newer release is available.'});
        // This is the only file written before the launcher exits.
        updater.safeSaveJSON(updater.privateFile(configDataDir,'pending-update.json'),{
          repository,version:release.version,tag:release.tag,url:release.url,digest:release.digest,bytes:release.bytes
        });
        updating=true;
        json(res,202,{ok:true,message:'Update approved. The Windows launcher will install the release and restart the dashboard.'});
        setTimeout(()=>updateRestart(),650).unref();
        return;
      }

      if(req.method==='PUT' && route==='/api/campaign') {
        const body=await readBody(req);
        const c={};
        for(const k of Object.keys(DEFAULT_CAMPAIGN)) c[k]=String(body[k]??'').trim().slice(0,k==='serverDesc'?1200:250);
        if(!c.serverName||!c.serverIp||!/^[\w.-]{1,250}$/.test(c.serverIp) || !c.serverDesc || ![c.javaPort,c.bedrockPort].every(x=>/^\d{1,5}$/.test(x)&&Number(x)>0&&Number(x)<65536)) throw Error('Campaign requires server name, valid address, ports and description.');
        state.campaign=c;write();return json(res,200,{ok:true});
      }
      if(req.method==='POST' && route==='/api/channels') {
        const body=await readBody(req);
        const name=String(body.name||'').trim().slice(0,60),url=String(body.url||'').trim();
        if(body.permissionConfirmed!==true)throw Error('Confirm permission to post announcements in this channel.');
        if(!name || !validWebhook(url)) throw Error('Enter a channel name and a valid Discord incoming webhook URL.');
        if(state.channels.length>=5)throw Error('Maximum of 5 authorized channels in this starter version.');
        if(state.channels.some(x=>x.url===url))throw Error('That Discord webhook is already connected.');
        state.channels.push({id:crypto.randomUUID(),name,url,enabled:true});write();return json(res,201,{ok:true});
      }
      if(req.method==='DELETE' && route.startsWith('/api/channels/')) {
        const id=route.split('/').pop();
        const n=state.channels.length;
        state.channels=state.channels.filter(x=>x.id!==id);
        if(n===state.channels.length)return json(res,404,{error:'Channel not found.'});
        if(!state.channels.some(x=>x.enabled)){state.schedule.enabled=false;state.schedule.nextAt=null;}
        write();return json(res,200,{ok:true});
      }
      if(req.method==='PATCH' && route.startsWith('/api/channels/')) {
        const id=route.split('/').pop();
        const channel=state.channels.find(x=>x.id===id);
        if(!channel)return json(res,404,{error:'Channel not found.'});
        const body=await readBody(req);
        if(typeof body.enabled!=='boolean')throw Error('Specify whether the channel is enabled.');
        channel.enabled=body.enabled;
        if(!state.channels.some(x=>x.enabled)){state.schedule.enabled=false;state.schedule.nextAt=null;}
        write();return json(res,200,{ok:true});
      }
      if(req.method==='PUT' && route==='/api/schedule') {
        const s=validateSchedule(await readBody(req));
        state.schedule={...s,enabled:state.schedule.enabled,nextAt:state.schedule.enabled?computeNext(s):null,lastAt:state.schedule.lastAt};
        write();return json(res,200,{ok:true});
      }
      if(req.method==='POST' && route==='/api/activate') {
        const body=await readBody(req);
        if(typeof body.enabled!=='boolean')throw Error('Specify whether the schedule is enabled.');
        if(body.enabled && !state.channels.some(x=>x.enabled))throw Error('Add an authorized Discord channel before starting.');
        state.schedule.enabled=body.enabled;
        state.schedule.nextAt=body.enabled?computeNext(state.schedule):null;
        write();appendLog({channel:'Scheduler',trigger:'control',result:body.enabled?'enabled':'paused',message:body.enabled?'Schedule started':'Schedule paused'});
        return json(res,200,{ok:true});
      }
      if(req.method==='POST' && route==='/api/test') {
        const body=await readBody(req);
        if(typeof body.channelId!=='string'||!state.channels.some(x=>x.id===body.channelId&&x.enabled))throw Error('Choose a connected channel.');
        const result=await runPost('test',body.channelId);
        return json(res,200,result);
      }
      return json(res,404,{error:'Not found'});
    } catch(e) {
      const code=e.message==='A send is already in progress.'?409:400;
      return json(res,code,{error:e.message});
    }
  }
  return {handler,tick,state,runPost};
}
function start() {
  if(!Number.isInteger(PORT)||PORT<1||PORT>65535)throw Error('Invalid PORT');
  if(HOST!=='127.0.0.1' && HOST!=='localhost' && HOST!=='::1' && !ADMIN_PASSWORD)throw Error('Set ADMIN_PASSWORD before exposing this server on a network.');
  const app=createApp();
  const server=http.createServer((req,res)=>{app.handler(req,res).catch(e=>{console.error('Request error:',e);if(!res.headersSent)res.writeHead(500);res.end();});});
  server.listen(PORT,HOST,()=>console.log(`UGN Advertising Command Center running on http://${HOST}:${PORT} — keep this process running to send scheduled posts.`));
  const interval=setInterval(()=>app.tick().catch(e=>console.error('Scheduler error:',e)),15000);
  interval.unref();
  app.tick().catch(e=>console.error('Scheduler error:',e));
}
if(require.main===module)start();
module.exports={validWebhook,validateSchedule,computeNext,formatMessage,createApp,DEFAULT_STATE};
