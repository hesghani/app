import * as fmt from '../../shared/format';
import type { Message } from '../../shared/messages';
import { syncReport } from '../../shared/report';
import type { SyncMode } from '../../shared/types';
import { Notice, useToast } from '../../ui/components';
import { Copy, Logo, Refresh } from '../../ui/icons';
import type { Data } from '../data';

export function isConnected(data: Data): boolean {
  if (data.templates.length > 0) return true;
  return !data.meta.demo && (data.catalog.length > 0 || data.sales.length > 0);
}

export async function startSync(mode: SyncMode, interactive = true) {
  return chrome.runtime.sendMessage({ type: 'sync:start', mode, interactive } satisfies Message);
}

export function reportText(data: Data): string {
  return syncReport({
    version: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    templates: data.templates,
    captureLog: data.captureLog,
    syncState: data.syncState,
    counts: { sales: data.sales.length, catalog: data.catalog.length, totals: data.totals.length },
    coverage: data.meta.coverage,
    accountKeys: Object.keys(data.account?.facts ?? {}),
  });
}

export function CopyReport({ data, label = 'Copy sync report' }: { data: Data; label?: string }) {
  const toast = useToast();
  return (
    <button
      class="btn sm"
      onClick={async () => {
        await navigator.clipboard.writeText(reportText(data));
        toast('Sync report copied. It contains no titles, prices or personal data.');
      }}
    >
      <Copy size={13} /> {label}
    </button>
  );
}

/** Connect / sync status card, used on Overview, Agent and Settings. */
export function ConnectCard({ data, compact = false }: { data: Data; compact?: boolean }) {
  const s = data.syncState;
  const connected = isConnected(data);
  const running = s.status === 'running';
  const pct = s.progress && s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : null;
  const last = data.meta.lastCaptureAt;

  if (connected && compact && !running && s.status !== 'error' && s.status !== 'signin') {
    return (
      <div class="row wrap small muted">
        <span>
          Synced {fmt.ago(last)} · {fmt.int(data.sales.length)} sales rows · {fmt.int(data.catalog.length)} products
        </span>
        <button class="btn sm" onClick={() => void startSync('full')}><Refresh size={13} /> Sync now</button>
      </div>
    );
  }

  return (
    <section class="card connect">
      <div class="card-body stack" style={{ gap: '12px' }}>
        <div class="row top">
          <span style={{ color: 'var(--brand)' }}><Logo size={30} /></span>
          <div class="grow">
            <h2>{connected ? 'Your Merch account' : 'Connect your Merch on Demand account'}</h2>
            <p class="muted small" style={{ marginTop: '4px' }}>
              {connected
                ? `Last synced ${fmt.ago(last)} · ${fmt.int(data.sales.length)} daily sales rows · ${fmt.int(data.catalog.length)} products${data.meta.coverage?.salesFrom ? ` · history from ${fmt.day(data.meta.coverage.salesFrom, 'long')}` : ''}`
                : 'Loupe uses the Merch session you are already signed in with. It opens Merch in a tab, learns how your sales report and product list load, then downloads your full history. Nothing leaves your browser.'}
            </p>
          </div>
          {!running && (
            <button class="btn primary" onClick={() => void startSync(connected ? 'full' : 'connect')}>
              <Refresh size={15} /> {connected ? 'Sync now' : 'Connect Merch account'}
            </button>
          )}
        </div>

        {running && (
          <div class="stack" style={{ gap: '6px' }}>
            <div class="row small"><b>Syncing…</b><span class="muted">{s.phase}</span><span class="right muted num">{pct !== null ? `${pct}%` : ''}</span></div>
            <div class="progress"><div style={{ width: `${pct ?? 15}%` }} /></div>
            <span class="hint">Keep the Merch tab Loupe opened. You can keep working elsewhere.</span>
          </div>
        )}

        {s.status === 'signin' && <Notice kind="warn">{s.phase} <a href="https://merch.amazon.com/" target="_blank" rel="noopener">Open Merch</a></Notice>}
        {s.status === 'partial' && <Notice kind="warn">{s.phase}</Notice>}
        {s.status === 'error' && (
          <Notice kind="bad">
            <b>{s.phase}</b> {s.error ?? ''}
            <div class="row wrap" style={{ marginTop: '8px' }}>
              <button class="btn sm" onClick={() => void startSync('connect')}>Try again</button>
              <CopyReport data={data} />
            </div>
            <div class="small" style={{ marginTop: '6px' }}>
              The report lists which requests Merch made and their shapes (no titles, prices or personal data). Send it to the developer and the sync can be fixed for your account.
            </div>
          </Notice>
        )}
        {s.status === 'done' && s.stats && !compact && (
          <span class="small muted">Last run: {fmt.int(s.stats.salesRows)} sales rows and {fmt.int(s.stats.catalogItems)} products in {fmt.int(s.stats.requests)} requests.</span>
        )}
      </div>
    </section>
  );
}
