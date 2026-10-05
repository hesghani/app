import { bump, clearStore, putMany } from '../../shared/db';
import { demoCatalog, demoSales } from '../../shared/demo';
import { localDay } from '../../shared/dates';
import { merchSearchUrl } from '../../shared/marketplaces';
import { rowKey } from '../../shared/sales';
import { update } from '../../shared/storage';
import type { Settings } from '../../shared/settings';
import { useToast } from '../../ui/components';
import { Chart, Logo, Refresh, Search, Upload } from '../../ui/icons';
import { navigate } from '../data';
import { startSync } from './connect';

export async function loadDemo() {
  const today = localDay();
  const rows = demoSales(today);
  await clearStore('sales');
  await clearStore('catalog');
  await clearStore('totals');
  await putMany('sales', rows.map((r) => ({ ...r, key: rowKey(r) })));
  await putMany('catalog', demoCatalog(today));
  await update('meta', (m) => ({ ...m, demo: true, coverage: undefined }));
  await bump('sales', 'catalog', 'totals');
  void chrome.runtime.sendMessage({ type: 'badge:refresh' });
}

export function Welcome({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const toast = useToast();
  return (
    <section class="card hero">
      <div class="row" style={{ color: 'var(--brand)' }}>
        <Logo size={30} />
        <div>
          <h1>{compact ? 'No sales recorded yet' : 'Welcome to Loupe'}</h1>
          <p class="muted">Research, sales analytics, a portfolio agent and listing tools for Merch on Demand. Everything stays in your browser.</p>
        </div>
      </div>
      <div class="steps">
        <div class="card step">
          <span class="n">1</span>
          <h2>Connect your Merch account</h2>
          <p class="muted small">Loupe uses the Merch session you're already signed in with to download your sales history and full product list, then keeps it in sync.</p>
          <div class="row wrap">
            <button class="btn sm primary" onClick={() => void startSync('connect')}><Refresh size={14} /> Connect Merch account</button>
            <button class="btn sm ghost" onClick={() => navigate('settings', { section: 'data' })}><Upload size={14} /> Import CSV</button>
          </div>
        </div>
        <div class="card step">
          <span class="n">2</span>
          <h2>Research on Amazon</h2>
          <p class="muted small">Search any keyword. Every result gets its BSR, estimated sales, age and a Merch check, plus a niche score for the page.</p>
          <a class="btn sm" href={merchSearchUrl(settings.marketplace, 'pickleball dad', settings.searchTemplates[settings.marketplace])} target="_blank" rel="noopener">
            <Search size={14} /> Try “pickleball dad”
          </a>
        </div>
        <div class="card step">
          <span class="n">3</span>
          <h2>Explore with sample data</h2>
          <p class="muted small">See the dashboard and the agent with a year of realistic sales. Your real data replaces it on the first sync.</p>
          <button
            class="btn sm"
            onClick={async () => {
              await loadDemo();
              toast('Loaded sample sales and products');
              navigate('agent');
            }}
          >
            <Chart size={14} /> Load sample data
          </button>
        </div>
      </div>
    </section>
  );
}
