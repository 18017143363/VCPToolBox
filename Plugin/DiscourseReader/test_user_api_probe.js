const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-extra'));
const StealthPlugin = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-extra-plugin-stealth'));
puppeteer.use(StealthPlugin());

function loadCfg(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

(async () => {
  const cfg = loadCfg(path.join(__dirname, 'config.env'));
  const key = cfg['forum_linuxdo_api_key'];
  const cid = cfg['forum_linuxdo_client_id'];
  if (!key || !cid) {
    console.log(JSON.stringify({ ok:false, step:'precheck', error:'missing forum_linuxdo_api_key or forum_linuxdo_client_id' }, null, 2));
    process.exit(0);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const base = 'https://linux.do';

  const out = { keyPresent: !!key, cidPresent: !!cid };

  try {
    const warm = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.warmupStatus = warm ? warm.status() : null;
  } catch (e) {
    out.warmupError = e.message;
  }

  async function fetchProbe(url) {
    return await page.evaluate(async (u, k, c) => {
      try {
        const r = await fetch(u, {
          method: 'GET',
          credentials: 'omit',
          headers: {
            'Accept': 'application/json',
            'User-Api-Key': k,
            'User-Api-Client-Id': c
          }
        });
        const t = await r.text();
        return {
          status: r.status,
          ok: r.ok,
          contentType: r.headers.get('content-type'),
          bodyPreview: (t || '').slice(0, 350)
        };
      } catch (e) {
        return { error: e.message };
      }
    }, url, key, cid);
  }

  out.probe_session_current = await fetchProbe(base + '/session/current.json');
  out.probe_notifications = await fetchProbe(base + '/notifications.json');

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(0);
})().catch(async (e) => {
  console.log(JSON.stringify({ ok:false, fatal:e.message }, null, 2));
  process.exit(0);
});