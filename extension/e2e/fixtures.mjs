// Stand-in pages for amazon.com and merch.amazon.com, shaped like the real
// markup Loupe reads. The e2e run serves these through request interception.

const DESIGNS = [
  ['Retro Pickleball Legend Funny Paddle T-Shirt', 18_400, '2025-11-02', 412],
  ['Pickleball Dad Like A Regular Dad But Cooler T-Shirt', 64_200, '2024-06-14', 1290],
  ['Dink Responsibly Pickleball Player Gift Premium T-Shirt', 141_000, '2026-03-21', 37],
  ['Vintage Pickleball Sunset Paddle Pullover Hoodie', 233_500, '2025-08-09', 88],
  ['Kitchen Is For Dinking Pickleball Lover T-Shirt', 512_000, '2023-04-30', 210],
  ['Funny Pickleball Grandma Floral Sweatshirt', 890_000, '2026-07-12', 4],
  ['Pickleball Queen Leopard Print T-Shirt', 1_740_000, '2022-09-18', 61],
  ['Blank Heavy Cotton Tee 6-Pack', 3_400, '2019-02-01', 52000],
];

export const ASINS = DESIGNS.map((_, i) => `B0TEST${String(i).padStart(4, '0')}`);

const art = (i) => {
  const hues = [255, 200, 20, 330, 150, 40, 280, 0];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hues[i]},45%,92%)"/><path d="M90 70h120l40 40-30 25-15-15v130H95V120l-15 15-30-25z" fill="hsl(${hues[i]},40%,28%)"/><circle cx="150" cy="150" r="28" fill="hsl(${hues[i]},80%,65%)"/></svg>`)}`;
};

export function searchPage(keyword) {
  const cards = DESIGNS.map(([title, , , reviews], i) => `
    <div data-component-type="s-search-result" data-asin="${ASINS[i]}" class="s-result-item ${i === 3 ? 'AdHolder' : ''}">
      <div class="s-card-container">
        <img class="s-image" src="${art(i)}" alt="">
        ${i === 3 ? '<span class="puis-sponsored-label-text">Sponsored</span>' : ''}
        <h2><a class="a-link-normal" href="/dp/${ASINS[i]}"><span>${title}</span></a></h2>
        <i class="a-icon a-icon-star-small"><span class="a-icon-alt">4.${(i % 5) + 4} out of 5 stars</span></i>
        <span aria-label="${reviews.toLocaleString('en-US')} ratings"><span class="s-underline-text">${reviews.toLocaleString('en-US')}</span></span>
        <div class="a-price-row"><span class="a-price"><span class="a-offscreen">$${i === 3 ? '34.99' : '19.99'}</span><span aria-hidden="true">$${i === 3 ? '34.99' : '19.99'}</span></span></div>
      </div>
    </div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Amazon.com : ${keyword}</title>
<style>
  body { font: 14px Arial, sans-serif; margin: 0; background: #fff; color: #0f1111; }
  header { background: #131921; color: #fff; padding: 12px 20px; font-weight: bold; }
  #search { max-width: 1240px; margin: 0 auto; padding: 16px 20px; }
  .s-main-slot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .s-card-container { border: 1px solid #e7e7e7; border-radius: 8px; padding: 12px; }
  .s-image { width: 100%; aspect-ratio: 1; border-radius: 4px; display: block; }
  h2 { font-size: 15px; font-weight: 400; margin: 8px 0 4px; } h2 a { color: #0f1111; text-decoration: none; }
  .a-price { font-size: 20px; display: block; margin-top: 4px; } .a-offscreen { position: absolute; left: -9999px; }
  .a-icon-alt { position: absolute; left: -9999px; } .puis-sponsored-label-text { font-size: 12px; color: #565959; }
</style></head><body>
<header>amazon</header>
<div id="search">
  <span data-component-type="s-result-info-bar"><h1 style="font-size:14px;font-weight:400"><div><span>1-48 of over 2,000 results for</span> <span style="color:#c45500">"${keyword}"</span></div></h1></span>
  <div class="s-main-slot s-result-list">${cards}
    <div class="s-pagination" style="grid-column:1/-1;text-align:center;padding:20px">1 2 3 Next</div>
  </div>
</div></body></html>`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function productPage(asin) {
  const i = ASINS.indexOf(asin);
  const [title, bsr, date, reviews] = DESIGNS[Math.max(0, i)];
  const [y, m, d] = date.split('-').map(Number);
  const merch = i !== DESIGNS.length - 1;
  const bullets = merch
    ? ['Solid colors: 100% Cotton; Heather Grey: 90% Cotton, 10% Polyester; All Other Heathers: 50% Cotton, 50% Polyester', 'Imported', 'Machine Wash', 'Pickleball lovers will smile at this design. Great gift for paddle players.', 'Lightweight, Classic fit, Double-needle sleeve and bottom hem']
    : ['100% cotton', 'Pack of 6 blank tees', 'Seamless twin needle collar'];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Amazon.com: ${title}</title>
<style>body{font:14px Arial,sans-serif;margin:0;color:#0f1111}header{background:#131921;color:#fff;padding:12px 20px;font-weight:bold}
#ppd{display:grid;grid-template-columns:420px 1fr;gap:32px;max-width:1200px;margin:24px auto;padding:0 20px}#landingImage{width:420px;border-radius:6px}
#productTitle{font-size:24px;font-weight:400;line-height:1.3}.a-offscreen{position:absolute;left:-9999px}.a-price{font-size:28px}</style></head><body>
<header>amazon</header>
<input type="hidden" id="ASIN" value="${asin}">
<div id="ppd">
  <div><img id="landingImage" src="${art(Math.max(0, i))}" data-old-hires="${art(Math.max(0, i))}"></div>
  <div>
    <h1 id="title"><span id="productTitle">${title}</span></h1>
    <a id="bylineInfo" href="#">Visit the Dinkworthy Store</a>
    <div><span id="acrPopover" title="4.6 out of 5 stars">★★★★½</span> <span id="acrCustomerReviewText">${reviews.toLocaleString('en-US')} ratings</span></div>
    <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">$19.99</span><span aria-hidden="true">$19.99</span></span></div>
    <div id="merchantInfoFeature_feature_div">Ships from Amazon.com · Sold by Amazon.com</div>
    <div id="feature-bullets"><ul>${bullets.map((b) => `<li><span class="a-list-item">${b}</span></li>`).join('')}</ul></div>
    <div id="detailBulletsWrapper_feature_div"><div id="detailBullets_feature_div"><ul>
      <li><span class="a-list-item"><span class="a-text-bold">Date First Available &rlm; : &lrm;</span><span>${MONTHS[m - 1]} ${d}, ${y}</span></span></li>
      <li><span class="a-list-item"><span class="a-text-bold">ASIN &rlm; : &lrm;</span><span>${asin}</span></span></li>
    </ul>
    <ul><li><span class="a-list-item"><span class="a-text-bold">Best Sellers Rank:</span> #${bsr.toLocaleString('en-US')} in Clothing, Shoes &amp; Jewelry (<a>See Top 100 in Clothing, Shoes &amp; Jewelry</a>)
      <ul><li><span class="a-list-item">#${Math.max(1, Math.round(bsr / 180)).toLocaleString('en-US')} in <a>Men's Novelty T-Shirts</a></span></li></ul></span></li></ul></div></div>
  </div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// A stand-in Merch on Demand site. Two API styles exercise the learning sync:
//   A: sales via GET with epoch-ms range and per-record dates (XHR);
//      catalog via POST with next-page tokens.
//   B: sales via POST with ISO dates, per-ASIN totals in a columnar table
//      (no per-day dates); catalog via GET with page numbers.
// Every API call needs the anti-forgery header the page sets.

const TZ = 'America/Los_Angeles';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const zonedDay = (ms) => dayFmt.format(new Date(ms));
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
function zonedMidnight(day) {
  // Find the instant that is 00:00 in Los Angeles on `day`.
  let guess = Date.parse(`${day}T08:00:00Z`);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const h = Number(parts.find((p) => p.type === 'hour').value);
    const m = Number(parts.find((p) => p.type === 'minute').value);
    if (h === 0 && m === 0 && zonedDay(guess) === day) return guess;
    guess -= (h * 60 + m) * 60000;
    if (zonedDay(guess) !== day) guess += 86400000;
  }
  return guess;
}

const TOKEN = 'a2z-csrf-91f3';
const MIDS = { US: 'ATVPDKIKX0DER', DE: 'A1PA6795UKMFR9', UK: 'A1F83G8C2ARO7P' };

export function createMerch(style = 'A') {
  const today = zonedDay(Date.now());
  const designs = [
    ...['Retro Pickleball Legend', 'Pickleball Dad Energy', 'Dink Responsibly Pickleball', 'Pickleball Queen Leopard'].map((n, i) => ({ name: n, profile: 'winner', age: 500, types: i === 0 ? ['STANDARD_TSHIRT', 'HOODIE'] : ['STANDARD_TSHIRT'], mps: i === 0 ? ['US', 'DE'] : ['US'] })),
    ...['Cat Nap Club', 'Plant Mom Era', 'Coffee Then Chaos'].map((n) => ({ name: n, profile: 'steady', age: 480, types: ['STANDARD_TSHIRT'], mps: ['US'] })),
    ...['Night Shift Nurse Coffee', 'ER Nurse Life'].map((n) => ({ name: n, profile: 'rising', age: 45, types: ['STANDARD_TSHIRT'], mps: ['US'] })),
    { name: 'Bigfoot Hiking Club', profile: 'fading', age: 400, types: ['STANDARD_TSHIRT'], mps: ['US'] },
    ...['Spooky Ghost Coffee Halloween', 'Witch Please Halloween'].map((n) => ({ name: n, profile: 'halloween', age: 420, types: ['STANDARD_TSHIRT'], mps: ['US'] })),
    ...Array.from({ length: 12 }, (_, k) => ({ name: `Fishing Lure Pattern ${k + 1}`, profile: 'dead', age: 300 + k * 20, types: ['STANDARD_TSHIRT'], mps: ['US'] })),
    { name: 'Rejected Thing', profile: 'dead', age: 600, types: ['STANDARD_TSHIRT'], mps: ['US'], status: 'REJECTED' },
  ];
  const typeLabel = { STANDARD_TSHIRT: 'T-Shirt', HOODIE: 'Pullover Hoodie' };
  const products = [];
  let n = 0;
  designs.forEach((d, di) => {
    for (const type of d.types) {
      const listings = d.mps.map((mp) => ({ mp, asin: `B0E2E${String(n++).padStart(5, '0')}` }));
      products.push({ id: `prod-${di}-${type}`, designId: `design-${di}`, title: `${d.name} ${typeLabel[type]}`, type, profile: d.profile, created: addDays(today, -d.age), status: d.status ?? 'LIVE', listings });
    }
  });
  const listings = products.flatMap((p) => p.listings.map((l) => ({ ...l, product: p })));
  const state = { extraToday: 0, apiCalls: 0, forbidden: 0 };

  function units(product, mp, day) {
    const ago = daysBetween(day, today);
    if (ago < 0 || day < product.created) return 0;
    let u = 0;
    switch (product.profile) {
      case 'winner': u = ago % 2 === 0 ? 2 : 1; break;
      case 'steady': u = ago % 5 === 0 ? 1 : 0; break;
      case 'rising': u = ago < 30 ? (ago % 2 === 0 ? 1 : 0) : ago === 40 ? 1 : 0; break;
      case 'fading': u = ago >= 31 && ago < 90 && ago % 3 === 0 ? 1 : 0; break;
      case 'halloween': u = day.slice(5, 7) === '10' && ago > 300 && ago % 2 === 0 ? 1 : 0; break;
      default: u = 0;
    }
    if (mp === 'DE') u = ago % 4 === 0 ? 1 : 0;
    if (ago === 0 && product.title === 'Retro Pickleball Legend T-Shirt' && mp === 'US') u += state.extraToday;
    return u;
  }

  function salesFor(mp, from, to) {
    const rows = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      for (const l of listings) {
        if (l.mp !== mp || l.product.status !== 'LIVE') continue;
        const u = units(l.product, mp, day);
        if (u) rows.push({ day, l, u });
      }
    }
    return rows;
  }

  const royalty = (mp, u) => (mp === 'DE' ? { value: +(1.8 * u).toFixed(2), currencyCode: 'EUR' } : { value: +(2.44 * u).toFixed(2), currencyCode: 'USD' });

  const nav = `<nav style="display:flex;gap:16px;padding:12px 20px;background:#fff;border-bottom:1px solid #ddd">
    <a href="/dashboard">Dashboard</a><a href="/designs/create">Create</a><a href="/manage/products">Manage</a><a href="/analyze/sales">Analyze</a><a href="/advertising">Advertise</a></nav>`;
  const shell = (title, body, script = '') => `<!doctype html><html><head><meta charset="utf-8"><title>Merch on Demand - ${title}</title>
<style>body{font:14px Arial,sans-serif;margin:0;background:#f7f8f8}header{background:#232f3e;color:#fff;padding:14px 20px;font-weight:bold}
main{max-width:900px;margin:24px auto;background:#fff;padding:24px;border-radius:8px;display:grid;gap:14px}
label{display:grid;gap:4px;font-weight:bold;font-size:13px}input,textarea{font:inherit;padding:8px;border:1px solid #aaa;border-radius:4px}textarea{min-height:60px}</style></head>
<body><header>amazon merch on demand</header>${nav}<main>${body}</main><script>const TOKEN='${TOKEN}';${script}</script></body></html>`;

  const pages = {
    '/dashboard': () => shell('Dashboard', '<h1>Dashboard</h1><div id="out">Loading…</div>', `
      fetch('/api/account/summary', { headers: { 'anti-csrftoken-a2z': TOKEN } }).then((r) => r.json()).then((j) => { document.getElementById('out').textContent = 'Tier ' + j.account.tier; });`),
    '/analyze/sales': () => shell('Analyze', '<h1>Sales</h1><div id="out">Loading…</div>', style === 'A' ? `
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/reporting/purchases/records?marketplaceId=ATVPDKIKX0DER&fromDate=' + window.FROM + '&toDate=' + window.TO);
      xhr.setRequestHeader('anti-csrftoken-a2z', TOKEN);
      xhr.responseType = 'json';
      xhr.onload = () => { document.getElementById('out').textContent = xhr.response.records.length + ' records'; };
      xhr.send();` : `
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      fetch('/api/sales/report', { method: 'POST', headers: { 'content-type': 'application/json', 'anti-csrftoken-a2z': TOKEN }, body: JSON.stringify({ startDate: day, endDate: day, marketplaces: ['US'], groupBy: 'ASIN' }) })
        .then((r) => r.json()).then((j) => { document.getElementById('out').textContent = j.report.rows.length + ' products'; });`),
    '/manage/products': () => shell('Manage', '<h1>Products</h1><div id="out">Loading…</div>', style === 'A' ? `
      fetch('/api/products/search', { method: 'POST', headers: { 'content-type': 'application/json', 'anti-csrftoken-a2z': TOKEN }, body: JSON.stringify({ pageSize: 8, filters: { status: ['LIVE', 'REJECTED'] } }) })
        .then((r) => r.json()).then((j) => { document.getElementById('out').textContent = j.products.length + ' shown'; });` : `
      fetch('/api/manage/listings?page=1&pageSize=10', { headers: { 'anti-csrftoken-a2z': TOKEN } })
        .then((r) => r.json()).then((j) => { document.getElementById('out').textContent = j.items.length + ' shown'; });`),
    '/designs/create': () => shell('Create', `
      <div class="form-group"><label for="brand">Brand name<input id="brand" formcontrolname="brandName"></label></div>
      <div class="form-group"><label for="title">Product title<input id="title" formcontrolname="title"></label></div>
      <label>Key product features (optional)<textarea aria-label="Feature bullet 1" id="b1"></textarea></label>
      <label>Key product features (optional)<textarea aria-label="Feature bullet 2" id="b2"></textarea></label>
      <label>Product description (optional)<textarea id="desc" placeholder="Product description"></textarea></label>
      <label>List price<input id="price" value="19.99"></label>`),
  };

  function api(method, url, body, headers) {
    state.apiCalls += 1;
    if (headers['anti-csrftoken-a2z'] !== TOKEN) {
      state.forbidden += 1;
      return { status: 403, json: { message: 'Forbidden' } };
    }
    const path = url.pathname;
    if (path === '/api/account/summary') return { json: { account: { tier: 1000, dailyPublishLimit: 100, publishedToday: 4 } } };
    if (path === '/api/reporting/purchases/records') {
      const mp = Object.keys(MIDS).find((k) => MIDS[k] === url.searchParams.get('marketplaceId'));
      const from = zonedDay(Number(url.searchParams.get('fromDate')));
      const to = zonedDay(Number(url.searchParams.get('toDate')));
      const records = mp ? salesFor(mp, from, to).map(({ day, l, u }) => ({
        date: zonedMidnight(day), asin: l.asin, productType: l.product.type, title: l.product.title, unitsSold: u, unitsCancelled: 0, unitsReturned: 0, royalty: royalty(mp, u),
      })) : [];
      return { json: { records } };
    }
    if (path === '/api/sales/report') {
      const b = JSON.parse(body);
      const mp = b.marketplaces[0];
      const totals = new Map();
      for (const { l, u } of salesFor(mp, b.startDate, b.endDate)) totals.set(l.asin, { l, u: (totals.get(l.asin)?.u ?? 0) + u });
      return { json: { report: { columns: ['asin', 'title', 'purchased', 'cancelled', 'returned', 'royalties', 'marketplace'], rows: Array.from(totals.values()).map(({ l, u }) => [l.asin, l.product.title, u, 0, 0, royalty(mp, u).value, mp]) } } };
    }
    if (path === '/api/products/search') {
      const b = JSON.parse(body);
      const start = b.nextToken ? Number(b.nextToken.slice(1)) : 0;
      const page = products.slice(start, start + b.pageSize);
      const next = start + b.pageSize < products.length ? `t${start + b.pageSize}` : null;
      return {
        json: {
          products: page.map((p) => ({
            id: p.id, designId: p.designId, title: p.title, brand: 'Dinkworthy', productType: p.type, createdDate: `${p.created}T10:00:00Z`,
            listings: p.listings.map((l) => ({ marketplaceId: MIDS[l.mp], asin: l.asin, status: p.status, price: { amount: l.mp === 'DE' ? 17.99 : 19.99, currencyCode: l.mp === 'DE' ? 'EUR' : 'USD' } })),
          })),
          nextToken: next,
        },
      };
    }
    if (path === '/api/manage/listings') {
      const page = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('pageSize'));
      const slice = listings.slice((page - 1) * size, page * size);
      return { json: { totalCount: listings.length, items: slice.map((l) => ({ asin: l.asin, title: l.product.title, status: l.product.status === 'LIVE' ? 'Live' : 'Rejected', marketplace: `amazon.${l.mp === 'DE' ? 'de' : 'com'}`, productType: l.product.type, created: zonedMidnight(l.product.created) })) } };
    }
    return { status: 404, json: { message: 'Not found' } };
  }

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/')) {
      const res = api(req.method(), url, req.postData(), await req.allHeaders());
      return route.fulfill({ status: res.status ?? 200, contentType: 'application/json;charset=UTF-8', body: JSON.stringify(res.json) });
    }
    const page = pages[url.pathname] ?? pages['/dashboard'];
    let html = page();
    if (style === 'A') {
      const from = zonedMidnight(addDays(today, -6));
      const to = zonedMidnight(addDays(today, 1)) - 1;
      html = html.replace('<script>', `<script>window.FROM=${from};window.TO=${to};`);
    }
    return route.fulfill({ contentType: 'text/html', body: html });
  }

  return { handle, state, today, listings, products, designs };
}
