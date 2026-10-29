'use strict';
// Safe GitHub Releases metadata reader. No credentials or arbitrary URL support.
const fs = require('node:fs');
const path = require('node:path');

const ASSET_NAME = 'ugn-auto-advertiser.zip';
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const RELEASE_TIMEOUT_MS = 12000;

function normalizeRepository(value) {
  let input = String(value || '').trim();
  input = input.replace(/^https:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/$/,'');
  if (!/^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?\/[A-Za-z\d_.-]{1,100}$/.test(input) || input.includes('..')) {
    throw Error('Enter a valid public GitHub repository, such as yourname/ugn-advertiser.');
  }
  return input;
}
function parseVersion(value) {
  const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
  if (!m || m.slice(1).some(x=>!Number.isSafeInteger(Number(x)))) throw Error('Releases must use a version tag such as v3.0.1.');
  return m.slice(1).map(Number);
}
function compareVersions(a,b) {
  const aa=parseVersion(a), bb=parseVersion(b);
  for(let i=0;i<3;i++) if(aa[i]!==bb[i]) return aa[i]>bb[i]?1:-1;
  return 0;
}
function validateRelease(data,repo,currentVersion) {
  const tag = String(data?.tag_name || '');
  parseVersion(tag);
  if(!tag.startsWith('v')) throw Error('GitHub release tags must start with v, e.g. v3.0.1.');
  if(data?.draft || data?.prerelease) throw Error('Only published stable releases can be installed.');
  const asset = (Array.isArray(data.assets) ? data.assets : []).find(a => a.name===ASSET_NAME && a.state==='uploaded');
  if(!asset) throw Error(`Release ${tag} does not have ${ASSET_NAME} yet. Wait for the GitHub release workflow to finish.`);
  if(!/^sha256:[a-f\d]{64}$/i.test(String(asset.digest||''))) throw Error('Release is missing a valid GitHub SHA-256 asset digest.');
  if(!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>MAX_ASSET_BYTES) throw Error('Release package must be smaller than 15 MB.');
  const expected = `https://github.com/${repo}/releases/download/${tag}/${ASSET_NAME}`;
  if(asset.browser_download_url !== expected) throw Error('Unexpected GitHub release download URL.');
  return {
    tag, version:tag.slice(tag.startsWith('v')?1:0),
    available:compareVersions(tag,currentVersion)>0,
    url:expected, digest:asset.digest.toLowerCase(), bytes:asset.size,
    releaseUrl:`https://github.com/${repo}/releases/tag/${tag}`
  };
}
async function fetchRelease(repo,currentVersion,fetchFn=globalThis.fetch) {
  repo=normalizeRepository(repo);
  const response=await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`,{
    headers:{'Accept':'application/vnd.github+json','User-Agent':'UGN-Advertising-Updater','X-GitHub-Api-Version':'2026-03-10'},
    signal:AbortSignal.timeout(RELEASE_TIMEOUT_MS)
  });
  if(response.status===404) throw Error('No published GitHub release found. Upload your project, then publish a release.');
  if(!response.ok) throw Error(`GitHub could not be reached (HTTP ${response.status}).`);
  return validateRelease(await response.json(),repo,currentVersion);
}
function privateFile(dataDir,name) {return path.join(dataDir,name);}
function readConfig(dataDir) {
  try { return normalizeRepository(JSON.parse(fs.readFileSync(privateFile(dataDir,'update-source.json'),'utf8')).repository); }
  catch(e) { if(e.code==='ENOENT')return ''; throw e; }
}
function safeSaveJSON(filepath,obj) {
  fs.mkdirSync(path.dirname(filepath),{recursive:true,mode:0o700});
  const temp=filepath+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(obj,null,2),{mode:0o600});
  fs.renameSync(temp,filepath);
}
function readResult(dataDir) {
  try {const o=JSON.parse(fs.readFileSync(privateFile(dataDir,'update-result.json'),'utf8'));return {success:!!o.success,message:String(o.message||'').slice(0,500),at:String(o.at||'')};}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
module.exports={ASSET_NAME,MAX_ASSET_BYTES,normalizeRepository,parseVersion,compareVersions,validateRelease,fetchRelease,readConfig,readResult,safeSaveJSON,privateFile};
