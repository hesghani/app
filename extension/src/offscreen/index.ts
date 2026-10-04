// Offscreen document: service workers have no DOMParser, so the background
// worker asks this page to fetch and parse product pages.

import type { MarketplaceId } from '../shared/marketplaces';
import { CaptchaError, fetchProduct } from '../shared/research';

chrome.runtime.onMessage.addListener(
  (message: { target?: string; type?: string; mp?: MarketplaceId; asin?: string }, _sender, respond) => {
    if (message.target !== 'offscreen' || message.type !== 'fetch-product' || !message.mp || !message.asin) return false;
    fetchProduct(message.mp, message.asin)
      .then((data) => respond({ data }))
      .catch((error: Error) => respond({ error: error.message, captcha: error instanceof CaptchaError }));
    return true;
  },
);
