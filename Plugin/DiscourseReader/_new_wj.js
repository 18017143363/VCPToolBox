async function writeJSON(method, url, body, cfg) {
  const apiKey = matchByDomain(url, cfg.apiKeys);
  const cookie = matchByDomain(url, cfg.cookies);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (cookie) {
      const domain = new URL(url).hostname;
      const parsed = parseCookies(cookie, domain);
      if (parsed.length > 0) await page.setCookie(...parsed);
    }
    if (apiKey) await page.setExtraHTTPHeaders({ 'User-Api-Key': apiKey });

    // Warmup: pass CF challenge
    const base = new URL(url).origin;
    await page.goto(base + '/categories.json', { waitUntil: 'networkidle2', timeout: 45000 });

    // Enable request interception to strip Origin/Referer from write requests
    // Critical: Discourse skips CSRF check ONLY when no Origin header is present
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.method() === 'POST' || req.method() === 'PUT' || req.method() === 'DELETE') {
        const headers = req.headers();
        delete headers['origin'];
        delete headers['referer'];
        req.continue({ headers });
      } else {
        req.continue();
      }
    });

    // Execute write request via fetch (credentials:'omit' to skip cookies)
    const result = await page.evaluate(async (fetchUrl, fetchMethod, fetchBody, fetchApiKey) => {
      try {
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (fetchApiKey) headers['User-Api-Key'] = fetchApiKey;
        const opts = { method: fetchMethod, headers, credentials: 'omit' };
        if (fetchBody && fetchMethod !== 'DELETE') opts.body = JSON.stringify(fetchBody);
        const resp = await fetch(fetchUrl, opts);
        const text = await resp.text();
        return { status: resp.status, ok: resp.ok, body: text };
      } catch (e) {
        return { status: 0, ok: false, body: 'fetch error: ' + e.message };
      }
    }, url, method, body, apiKey || '');

    if (!result.ok) {
      let errMsg = method + ' ' + result.status;
      try {
        const j = JSON.parse(result.body);
        const errs = j.errors || j.error_type || j.message || j;
        errMsg += ': ' + (Array.isArray(errs) ? errs.join(', ') : JSON.stringify(errs));
      } catch (e) { errMsg += ': ' + (result.body || '').substring(0, 300); }
      throw new Error(errMsg);
    }
    try { return JSON.parse(result.body); } catch (e) { return { raw: result.body }; }
  } finally {
    await page.close();
  }
}