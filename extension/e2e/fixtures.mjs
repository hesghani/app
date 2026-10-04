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

/** A tiny Merch dashboard: loads a sales report through fetch and XHR, like the real one. */
export function merchPage(kind) {
  if (kind === 'create') {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Merch on Demand - Create</title>
<style>body{font:14px Arial,sans-serif;margin:0;background:#f7f8f8}header{background:#232f3e;color:#fff;padding:14px 20px;font-weight:bold}
main{max-width:760px;margin:24px auto;background:#fff;padding:24px;border-radius:8px;display:grid;gap:14px}label{display:grid;gap:4px;font-weight:bold;font-size:13px}
input,textarea{font:inherit;padding:8px;border:1px solid #aaa;border-radius:4px}textarea{min-height:60px}</style></head><body>
<header>Merch on Demand</header>
<main>
  <div class="form-group"><label for="brand">Brand name<input id="brand" formcontrolname="brandName"></label></div>
  <div class="form-group"><label for="title">Product title<input id="title" formcontrolname="title"></label></div>
  <label>Key product features (optional)<textarea aria-label="Feature bullet 1" id="b1"></textarea></label>
  <label>Key product features (optional)<textarea aria-label="Feature bullet 2" id="b2"></textarea></label>
  <label>Product description (optional)<textarea id="desc" placeholder="Product description"></textarea></label>
  <label>List price<input id="price" value="19.99"></label>
</main></body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Merch on Demand - Analyze</title></head>
<body style="font:14px Arial,sans-serif"><h1>Sales</h1><div id="out">Loading…</div>
<script>
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  fetch('/api/reporting/purchases?fromDate=' + today + '&toDate=' + today + '&marketplaceId=ATVPDKIKX0DER', { headers: { 'x-requested-with': 'XMLHttpRequest' } })
    .then((r) => r.json()).then((j) => { document.getElementById('out').textContent = j.records.length + ' records'; });
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/reporting/summary?period=month');
  xhr.responseType = 'json';
  xhr.send();
</script></body></html>`;
}

let units = 3;
export function merchApi(path) {
  if (path.startsWith('/api/reporting/purchases')) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const body = {
      records: [
        { asin: ASINS[0], productType: 'STANDARD_TSHIRT', title: 'Retro Pickleball Legend', unitsSold: units, unitsCancelled: 0, royalty: { amount: 2.44 * units, currencyCode: 'USD' }, date: today },
        { asin: ASINS[1], productType: 'STANDARD_TSHIRT', title: 'Pickleball Dad', unitsSold: 1, unitsCancelled: 0, royalty: { amount: 2.44, currencyCode: 'USD' }, date: today },
      ],
    };
    units += 2;
    return body;
  }
  return { summary: { units: 4, royalty: 9.76 } };
}
