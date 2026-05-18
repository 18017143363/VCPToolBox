const fs=require('fs');
const path=require('path');
const puppeteer=require(path.join(__dirname,'..','..','node_modules','puppeteer-extra'));
const Stealth=require(path.join(__dirname,'..','..','node_modules','puppeteer-extra-plugin-stealth'));
puppeteer.use(Stealth());

function readEnv(p){
  const out={};
  const txt=fs.readFileSync(p,'utf8');
  for(const line of txt.split(/\r?\n/)){
    const s=line.trim();
    if(!s||s.startsWith('#')) continue;
    const i=s.indexOf('=');
    if(i<1) continue;
    out[s.slice(0,i).trim()]=s.slice(i+1).trim();
  }
  return out;
}
function parseCookie(raw){
  if(!raw) return [];
  return raw.split(';').map(x=>x.trim()).filter(Boolean).map(kv=>{
    const i=kv.indexOf('=');
    const name=i>=0?kv.slice(0,i).trim():kv;
    const value=i>=0?kv.slice(i+1).trim():'';
    return {name,value,domain:'.linux.do',path:'/',secure:true,httpOnly:false};
  });
}

(async()=>{
  const cfg=readEnv(path.join(__dirname,'config.env'));
  const key=cfg['forum_linuxdo_api_key']||'';
  const cid=cfg['forum_linuxdo_client_id']||'';
  const rawCookie=cfg['forum_linuxdo_cookie']||'';

  const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  const page=await browser.newPage();

  const ck=parseCookie(rawCookie);
  if(ck.length) await page.setCookie(...ck);

  const result={hasKey:!!key,hasClientId:!!cid,cookieCount:ck.length};

  const warm=await page.goto('https://linux.do/latest',{waitUntil:'domcontentloaded',timeout:60000});
  result.warmupStatus=warm?warm.status():null;

  result.get_notifications_include=await page.evaluate(async()=>{
    try{
      const r=await fetch('https://linux.do/notifications.json',{credentials:'include'});
      const t=await r.text();
      return {status:r.status,ok:r.ok,bodyPreview:(t||'').slice(0,300)};
    }catch(e){return {error:e.message};}
  });

  result.get_notifications_userapi=await page.evaluate(async(k,c)=>{
    try{
      const r=await fetch('https://linux.do/notifications.json',{
        method:'GET',
        credentials:'omit',
        headers:{
          'Accept':'application/json',
          'User-Api-Key':k,
          'User-Api-Client-Id':c
        }
      });
      const t=await r.text();
      return {status:r.status,ok:r.ok,bodyPreview:(t||'').slice(0,300)};
    }catch(e){return {error:e.message};}
  },key,cid);

  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(e=>{
  console.log(JSON.stringify({fatal:e.message},null,2));
  process.exit(0);
});