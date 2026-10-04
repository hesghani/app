import { useEffect, useMemo, useState } from 'preact/hooks';
import { extractKeywords } from '../../shared/keywords';
import { update } from '../../shared/storage';
import { scanText } from '../../shared/trademark';
import type { ListingDraft } from '../../shared/types';
import { Card, Counter, Empty, Notice, useToast } from '../../ui/components';
import { Alert, Copy, Pen, Plus, Shield, Trash, Wand } from '../../ui/icons';
import type { Data } from '../data';
import { PageHead } from './common';

// Merch on Demand's field limits.
const LIMITS = {
  brand: { min: 3, max: 50 },
  title: { min: 3, max: 60 },
  bullet1: { min: 0, max: 256 },
  bullet2: { min: 0, max: 256 },
  description: { min: 75, max: 2000 },
} as const;

function blank(): ListingDraft {
  return { id: crypto.randomUUID(), name: '', brand: '', title: '', bullet1: '', bullet2: '', description: '', keywords: '', updatedAt: Date.now() };
}

export function Listings({ data }: { data: Data }) {
  const toast = useToast();
  const drafts = useMemo(() => [...data.drafts].sort((a, b) => b.updatedAt - a.updatedAt), [data.drafts]);
  const [currentId, setCurrentId] = useState<string | null>(drafts[0]?.id ?? null);
  const [draft, setDraft] = useState<ListingDraft | null>(drafts[0] ?? null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    const found = drafts.find((d) => d.id === currentId) ?? drafts[0] ?? null;
    setDraft(found);
    if (found && found.id !== currentId) setCurrentId(found.id);
  }, [drafts, currentId]);

  // Autosave half a second after typing stops.
  useEffect(() => {
    if (!dirty || !draft) return;
    const t = setTimeout(async () => {
      const saved = { ...draft, updatedAt: Date.now() };
      await update('drafts', (list) => [saved, ...list.filter((d) => d.id !== saved.id)]);
      setDirty(false);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  const edit = (patch: Partial<ListingDraft>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };

  const create = async (from?: ListingDraft) => {
    const next = from ? { ...from, id: crypto.randomUUID(), name: `${from.name || from.title || 'Draft'} (copy)`, updatedAt: Date.now() } : blank();
    await update('drafts', (list) => [next, ...list]);
    setDirty(false);
    setCurrentId(next.id);
    setDraft(next);
  };

  const hits = useMemo(
    () =>
      draft
        ? scanText(
            { brand: draft.brand, title: draft.title, 'bullet 1': draft.bullet1, 'bullet 2': draft.bullet2, description: draft.description },
            { custom: data.settings.customTerms, ignore: data.settings.ignoredTerms },
          )
        : [],
    [draft, data.settings.customTerms, data.settings.ignoredTerms],
  );
  const keywords = useMemo(
    () => (draft ? extractKeywords([{ text: draft.title, weight: 3 }, { text: `${draft.bullet1} ${draft.bullet2}`, weight: 1 }, { text: draft.description, weight: 1 }], 12) : []),
    [draft?.title, draft?.bullet1, draft?.bullet2, draft?.description],
  );

  const fill = async () => {
    if (!draft) return;
    const tabs = await chrome.tabs.query({ url: 'https://merch.amazon.com/*' });
    if (!tabs.length) {
      toast('Open the Merch on Demand create page first');
      return;
    }
    let filled = 0;
    for (const tab of tabs) {
      if (!tab.id) continue;
      const res = (await chrome.tabs.sendMessage(tab.id, { type: 'listing:fill', draft, overwrite: true }).catch(() => null)) as { filled?: number } | null;
      filled += res?.filled ?? 0;
    }
    toast(filled ? `Filled ${filled} fields on Merch` : 'No listing form found. Open the create or edit page on Merch.');
  };

  const field = (key: keyof typeof LIMITS, label: string, multiline = false, hint?: string) => {
    if (!draft) return null;
    const value = draft[key];
    return (
      <label class="field">
        <span class="row"><span>{label}</span><span class="right"><Counter length={value.length} min={LIMITS[key].min} max={LIMITS[key].max} /></span></span>
        {multiline ? (
          <textarea class="textarea" value={value} rows={key === 'description' ? 5 : 3} onInput={(e) => edit({ [key]: (e.target as HTMLTextAreaElement).value })} />
        ) : (
          <input class="input" value={value} onInput={(e) => edit({ [key]: (e.target as HTMLInputElement).value })} />
        )}
        {hint && <span class="hint">{hint}</span>}
      </label>
    );
  };

  return (
    <div class="stack">
      <PageHead title="Listings" sub="Write listings with Merch's limits and a live trademark check, then fill them into Merch in one click">
        <button class="btn primary" onClick={() => void create()}><Plus size={15} /> New draft</button>
      </PageHead>

      {!draft ? (
        <Card>
          <Empty icon={<Pen size={22} />} title="No drafts yet">
            <p>Drafts autosave as you type. On Merch's create page, use the Loupe dock or the button here to fill them in.</p>
            <button class="btn primary" onClick={() => void create()}><Plus size={15} /> New draft</button>
          </Empty>
        </Card>
      ) : (
        <div class="studio">
          <Card pad={false}>
            <div class="draft-list" role="list">
              {drafts.map((d) => (
                <button
                  role="listitem"
                  aria-current={d.id === draft.id ? 'true' : 'false'}
                  onClick={() => {
                    setDirty(false);
                    setCurrentId(d.id);
                  }}
                >
                  <span class="ellipsis" style={{ fontWeight: 600 }}>{d.name || d.title || 'Untitled draft'}</span>
                  <span class="muted tiny ellipsis">{d.brand || 'No brand'} · {new Date(d.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={<input class="input" style={{ fontWeight: 650, maxWidth: '360px' }} placeholder="Draft name (only you see this)" value={draft.name} onInput={(e) => edit({ name: (e.target as HTMLInputElement).value })} aria-label="Draft name" />}
            actions={
              <>
                <span class="muted tiny">{dirty ? 'Saving…' : 'Saved'}</span>
                <button class="btn sm icon ghost" title="Duplicate" onClick={() => void create(draft)}><Copy size={14} /></button>
                <button
                  class="btn sm icon ghost danger"
                  title="Delete draft"
                  onClick={async () => {
                    if (!confirm('Delete this draft?')) return;
                    await update('drafts', (list) => list.filter((d) => d.id !== draft.id));
                    setDirty(false);
                    setCurrentId(null);
                  }}
                >
                  <Trash size={14} />
                </button>
              </>
            }
          >
            <div class="stack">
              {field('brand', 'Brand name')}
              {field('title', 'Product title')}
              {field('bullet1', 'Bullet point 1', true, 'Optional, but bullets help shoppers and search.')}
              {field('bullet2', 'Bullet point 2', true)}
              {field('description', 'Product description', true, 'Optional on Merch. If you add one it needs at least 75 characters.')}
              <label class="field">
                <span>Notes and keywords</span>
                <input class="input" value={draft.keywords} onInput={(e) => edit({ keywords: (e.target as HTMLInputElement).value })} placeholder="Not uploaded. For your own research notes." />
              </label>
              <div class="row wrap">
                <button class="btn primary" onClick={() => void fill()}><Wand size={15} /> Fill on Merch</button>
                <button
                  class="btn"
                  onClick={() => {
                    const description = [draft.bullet1, draft.bullet2].map((b) => b.trim()).filter(Boolean).map((b) => (/[.!?]$/.test(b) ? b : `${b}.`)).join(' ');
                    edit({ description });
                  }}
                >
                  Bullets → description
                </button>
              </div>
            </div>
          </Card>

          <div class="stack">
            <Card title="Trademark & policy">
              {hits.length ? (
                <ul class="hits">
                  {hits.map((h) => (
                    <li class={`sev-${h.severity}`}>
                      <Alert size={15} />
                      <span><b>{h.term}</b> in {h.field}<br /><span class="muted small">{h.reason}</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div class="row" style={{ color: 'var(--good-ink)' }}><Shield size={16} /> Nothing flagged</div>
              )}
            </Card>
            <Card title="Top phrases">
              {keywords.length ? (
                <div class="chips">{keywords.map((k) => <span class="chip">{k.phrase}</span>)}</div>
              ) : (
                <p class="muted small">Phrases from your title and bullets appear here so you can see what the listing emphasizes.</p>
              )}
            </Card>
            <Notice>Merch rejects listings that mention shipping, prices, reviews or other brands. The checker above catches the common ones.</Notice>
          </div>
        </div>
      )}
    </div>
  );
}
