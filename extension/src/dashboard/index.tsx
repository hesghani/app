import { render, type ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import * as fmt from '../shared/format';
import { ToastProvider } from '../ui/components';
import { Box, Chart, Coins, Eye, Logo, Pen, Search, Settings as SettingsIcon, Shield, Wand } from '../ui/icons';
import { Agent } from './views/agent';
import { useData, useRoute } from './data';
import { Listings } from './views/listings';
import { Overview } from './views/overview';
import { Products } from './views/products';
import { Research } from './views/research';
import { Royalties } from './views/royalties';
import { Settings } from './views/settings';
import { Trademarks } from './views/trademarks';
import { Watchlist } from './views/watchlist';
import { Welcome } from './views/welcome';

const NAV: Array<[string, string, ComponentChildren]> = [
  ['agent', 'Agent', <Wand size={17} />],
  ['overview', 'Sales', <Chart size={17} />],
  ['products', 'Designs', <Box size={17} />],
  ['research', 'Research', <Search size={17} />],
  ['watchlist', 'Watchlist', <Eye size={17} />],
  ['trademarks', 'Trademarks', <Shield size={17} />],
  ['listings', 'Listings', <Pen size={17} />],
  ['royalties', 'Royalties', <Coins size={17} />],
  ['settings', 'Settings', <SettingsIcon size={17} />],
];

function App() {
  const data = useData();
  const route = useRoute();
  const page = route.page === 'welcome' ? 'welcome' : NAV.some(([id]) => id === route.page) ? route.page : 'agent';

  useEffect(() => {
    const label = NAV.find(([id]) => id === page)?.[1] ?? 'Welcome';
    document.title = `${label} · Loupe`;
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <div class="shell">
      <aside class="side">
        <div class="logo">
          <Logo size={28} />
          <div><b>Loupe</b><span>for Merch on Demand</span></div>
        </div>
        <nav class="nav" aria-label="Sections">
          {NAV.map(([id, label, icon]) => (
            <a href={`#${id}`} aria-current={page === id ? 'page' : undefined}>{icon}{label}</a>
          ))}
        </nav>
        {data && (
          <div class="side-foot">
            <span>
              {data.syncState.status === 'running' ? 'Syncing…' : data.meta.demo ? 'Showing sample data' : data.meta.lastCaptureAt ? `Last sync ${fmt.ago(data.meta.lastCaptureAt)}` : 'Not connected yet'}
            </span>
            <a href="https://merch.amazon.com/" target="_blank" rel="noopener">Open Merch on Demand ↗</a>
          </div>
        )}
      </aside>
      <main class="main" id="main">
        {!data ? null : page === 'welcome' ? (
          <Welcome settings={data.settings} />
        ) : page === 'agent' ? (
          <Agent data={data} />
        ) : page === 'overview' ? (
          <Overview data={data} />
        ) : page === 'products' ? (
          <Products data={data} />
        ) : page === 'research' ? (
          <Research data={data} route={route} />
        ) : page === 'watchlist' ? (
          <Watchlist data={data} route={route} />
        ) : page === 'trademarks' ? (
          <Trademarks data={data} route={route} />
        ) : page === 'listings' ? (
          <Listings data={data} />
        ) : page === 'royalties' ? (
          <Royalties data={data} />
        ) : (
          <Settings data={data} route={route} />
        )}
      </main>
    </div>
  );
}

render(
  <ToastProvider>
    <App />
  </ToastProvider>,
  document.getElementById('app')!,
);
