import { demoSales } from '../../shared/demo';
import { localDay } from '../../shared/dates';
import { merchSearchUrl } from '../../shared/marketplaces';
import { rowKey } from '../../shared/sales';
import { get, set } from '../../shared/storage';
import type { Settings } from '../../shared/settings';
import { useToast } from '../../ui/components';
import { Chart, Logo, Search, Upload } from '../../ui/icons';
import { navigate } from '../data';

export async function loadDemo() {
  const rows = demoSales(localDay());
  const store: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) store[rowKey(r)] = r;
  await set('sales', store);
  await set('meta', { ...(await get('meta')), demo: true });
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
          <p class="muted">Research, sales analytics and listing tools for Merch on Demand. Everything stays in your browser.</p>
        </div>
      </div>
      <div class="steps">
        <div class="card step">
          <span class="n">1</span>
          <h2>Research on Amazon</h2>
          <p class="muted small">Search any keyword. Every result gets its BSR, estimated sales, age and a Merch check, plus a niche score for the page.</p>
          <a class="btn sm" href={merchSearchUrl(settings.marketplace, 'pickleball dad', settings.searchTemplates[settings.marketplace])} target="_blank" rel="noopener">
            <Search size={14} /> Try “pickleball dad”
          </a>
        </div>
        <div class="card step">
          <span class="n">2</span>
          <h2>Sync your sales</h2>
          <p class="muted small">Open your Merch on Demand sales report. Loupe records what the dashboard loads, then notifies you of new sales.</p>
          <div class="row wrap">
            <a class="btn sm" href="https://merch.amazon.com/" target="_blank" rel="noopener">Open Merch on Demand</a>
            <button class="btn sm ghost" onClick={() => navigate('settings', { section: 'data' })}><Upload size={14} /> Import CSV</button>
          </div>
        </div>
        <div class="card step">
          <span class="n">3</span>
          <h2>Explore with sample data</h2>
          <p class="muted small">See the dashboard with a year of realistic sales. Your real data replaces it on the first sync.</p>
          <button
            class="btn sm primary"
            onClick={async () => {
              await loadDemo();
              toast('Loaded sample sales');
              navigate('overview');
            }}
          >
            <Chart size={14} /> Load sample data
          </button>
        </div>
      </div>
    </section>
  );
}
