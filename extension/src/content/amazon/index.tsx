// Entry point for every Amazon storefront page. Decides whether this is a
// search page or a product page and starts the matching overlay.

import { marketplaceFromHost } from '../../shared/marketplaces';
import { parseAsinFromUrl } from '../../shared/parse-product';
import { getSettings } from '../../shared/storage';
import { startProductPanel } from './product';
import { isSearchPage, startSearchOverlay } from './search';

async function boot() {
  const mp = marketplaceFromHost(location.hostname);
  if (!mp || window.top !== window) return;
  const settings = await getSettings();
  if (!settings.overlayEnabled) return;
  if (isSearchPage()) startSearchOverlay(mp, settings);
  else if (settings.productPanel && parseAsinFromUrl(location.href)) startProductPanel(mp, settings);
}

void boot();
