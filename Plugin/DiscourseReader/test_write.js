const path = require('path');
const puppeteerExtra = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-extra'));
const StealthPlugin = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer-extra-plugin-stealth'));
puppeteerExtra.use(StealthPlugin());

const API_KEY = '4996153ee3be11c617abaf227d5c20b5';
const CLIENT_ID = 'CnTRAEh_Y48ZCZyQuFp2641Aq_vllv13o0rVJZ7w5BE';
const BASE = 'https://linux.do';
const POST_ID = 13985832;

(async () => {
  const browser = await puppeteerExtra.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    // Warmup
    console.log('[1] Warmup...');
    await page.goto(BASE + '/categories.json', { waitUntil: 'networkidle2', timeout: 45000 });
    console.log('[1] Warmup OK');

    // Test A: credentials omit + both headers + NO interception
    console.log('[A] omit + Key + ClientId, no interception...');
    const rA = await page.evaluate(async (base, key, cid, pid) => {
      const r = await fetch(base + '/post_actions.json', {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type':'application/json', 'Accept':'application/json', 'User-Api-Key':key, 'User-Api-Client-Id':cid },
        body: JSON.stringify({ id: pid, post_action_type_id: 2 })
      });
      return { status: r.status, body: (await r.text()).substring(0, 500) };
    }, BASE, API_KEY, CLIENT_ID, POST_ID);
    console.log('[A]', JSON.stringify(rA));

    // Test B: credentials include + CSRF token
    console.log('[B] Getting CSRF token...');
    const csrf = await page.evaluate(async (base) => {
      const r = await fetch(base + '/session/csrf.json', { credentials: 'include' });
      const j = await r.json();
      return j.csrf;
    }, BASE);
    console.log('[B] CSRF:', csrf);
    if (csrf) {
      const rB = await page.evaluate(async (base, token, pid) => {
        const r = await fetch(base + '/post_actions.json', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type':'application/json', 'Accept':'application/json', 'X-CSRF-Token':token },
          body: JSON.stringify({ id: pid, post_action_type_id: 2 })
        });
        return { status: r.status, body: (await r.text()).substring(0, 500) };
      }, BASE, csrf, POST_ID);
      console.log('[B]', JSON.stringify(rB));
    }

    // Test C: API Key + CSRF token combo
    console.log('[C] Key + ClientId + CSRF...');
    if (csrf) {
      const rC = await page.evaluate(async (base, key, cid, token, pid) => {
        const r = await fetch(base + '/post_actions.json', {
          method: 'POST', credentials: 'omit',
          headers: { 'Content-Type':'application/json', 'Accept':'application/json', 'User-Api-Key':key, 'User-Api-Client-Id':cid, 'X-CSRF-Token':token },
          body: JSON.stringify({ id: pid, post_action_type_id: 2 })
        });
        return { status: r.status, body: (await r.text()).substring(0, 500) };
      }, BASE, API_KEY, CLIENT_ID, csrf, POST_ID);
      console.log('[C]', JSON.stringify(rC));
    }
  } catch (e) { console.error('ERR:', e.message); }
  await browser.close();
  process.exit(0);
})();