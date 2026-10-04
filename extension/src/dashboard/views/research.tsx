import { useEffect, useRef, useState } from 'preact/hooks';
import { formatMonthly } from '../../shared/bsr';
import * as fmt from '../../shared/format';
import { expandSeed, type ExpandedKeyword, type SuggestionAlias } from '../../shared/keywords';
import { MARKETPLACES, merchSearchUrl, productUrl, type MarketplaceId } from '../../shared/marketplaces';
import { analyzeNiche } from '../../shared/niche';
import { update } from '../../shared/storage';
import { saveSettings } from '../../shared/storage';
import type { NicheResult } from '../../shared/types';
import { Card, Empty, Notice, Seg, useToast } from '../../ui/components';
import { Bulb, Chart, Copy, External, Search, Trash } from '../../ui/icons';
import type { Data, Route } from '../data';
import { amazonImage, MarketplaceSelect, PageHead } from './common';

function scoreLabel(score: number): { text: string; kind: string } {
  if (score >= 70) return { text: 'Strong', kind: 'good' };
  if (score >= 50) return { text: 'Promising', kind: 'brand' };
  if (score >= 30) return { text: 'Crowded', kind: 'warn' };
  return { text: 'Tough', kind: 'neutral' };
}

export function Research({ data, route }: { data: Data; route: Route }) {
  const { settings } = data;
  const toast = useToast();
  const [seed, setSeed] = useState(route.params.get('q') ?? '');
  const [mp, setMp] = useState<MarketplaceId>((route.params.get('mp') as MarketplaceId) || settings.marketplace);
  const [alias, setAlias] = useState<SuggestionAlias>(settings.suggestionAlias);
  const [results, setResults] = useState<ExpandedKeyword[]>([]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState<{ keyword: string; done: number; total: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async (term = seed) => {
    if (!term.trim()) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError('');
    setResults([]);
    setProgress([0, 27]);
    try {
      const list = await expandSeed(mp, term, alias, (done, total, found) => {
        setProgress([done, total]);
        setResults(found);
      }, controller.signal);
      if (!list.length) setError('Amazon returned no suggestions. Try a shorter seed, or switch the department.');
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) setProgress(null);
    }
  };

  useEffect(() => {
    const q = route.params.get('q');
    if (q) {
      setSeed(q);
      void run(q);
    }
    return () => abort.current?.abort();
  }, [route.params.get('q')]);

  const analyze = async (keyword: string) => {
    setAnalyzing({ keyword, done: 0, total: 1 });
    try {
      const result = await analyzeNiche(keyword, mp, {
        template: settings.searchTemplates[mp],
        onProgress: (done, total) => setAnalyzing({ keyword, done, total }),
      });
      await update('niches', (list) => [result, ...list.filter((n) => !(n.keyword === keyword && n.marketplace === mp))].slice(0, 200));
      toast(`Analyzed “${keyword}”: score ${result.score}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAnalyzing(null);
    }
  };

  const max = Math.max(1, ...results.map((r) => r.hits));

  return (
    <div class="stack">
      <PageHead title="Research" sub="Find keywords Amazon shoppers type, then score each niche by demand, competition and freshness" />

      <Card>
        <form
          class="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div class="grow" style={{ minWidth: '240px' }}>
            <input class="input" placeholder="Seed keyword, e.g. pickleball" value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} aria-label="Seed keyword" />
          </div>
          <MarketplaceSelect value={mp} onChange={(v) => setMp(v as MarketplaceId)} />
          <Seg<SuggestionAlias>
            label="Department"
            value={alias}
            onChange={(a) => {
              setAlias(a);
              void saveSettings({ suggestionAlias: a });
            }}
            options={[['aps', 'All departments'], ['fashion', 'Clothing']]}
          />
          <button class="btn primary" type="submit" disabled={!seed.trim()}>
            <Search size={15} /> Find keywords
          </button>
        </form>
        {progress && (
          <div class="progress" style={{ marginTop: '12px' }} role="progressbar" aria-valuenow={progress[0]} aria-valuemax={progress[1]}>
            <div style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
          </div>
        )}
        {error && <div style={{ marginTop: '12px' }}><Notice kind="warn">{error}</Notice></div>}
      </Card>

      {analyzing && (
        <Notice>
          Analyzing <b>{analyzing.keyword}</b>: reading {analyzing.done} of {analyzing.total} top products on {MARKETPLACES[mp].domain}…
        </Notice>
      )}

      <div class="research-grid">
        <Card
          title={results.length ? `${results.length} keyword ideas` : 'Keyword ideas'}
          actions={results.length > 0 && (
            <button
              class="btn sm"
              onClick={async () => {
                await navigator.clipboard.writeText(results.map((r) => r.keyword).join('\n'));
                toast(`Copied ${results.length} keywords`);
              }}
            >
              <Copy size={13} /> Copy all
            </button>
          )}
          pad={false}
        >
          {results.length ? (
            <div class="table-wrap" style={{ maxHeight: '640px', overflowY: 'auto' }}>
              <table class="table">
                <thead>
                  <tr><th>Keyword</th><th title="How often Amazon suggested it">Popularity</th><th class="num">Actions</th></tr>
                </thead>
                <tbody>
                  {results.slice(0, 200).map((r) => (
                    <tr>
                      <td class="nowrap">{r.keyword}</td>
                      <td style={{ width: '30%' }}><div class="meter"><div style={{ width: `${(r.hits / max) * 100}%` }} /></div></td>
                      <td class="num nowrap">
                        <button class="btn sm" disabled={!!analyzing} onClick={() => void analyze(r.keyword)} title="Score this niche">
                          <Chart size={13} /> Analyze
                        </button>{' '}
                        <a class="btn sm icon" href={merchSearchUrl(mp, r.keyword, settings.searchTemplates[mp])} target="_blank" rel="noopener" title="Open Merch search on Amazon">
                          <External size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={<Bulb size={22} />} title="Start with a seed">
              <p>Loupe asks Amazon's autocomplete for the seed and every “seed + letter”, then ranks what comes back.</p>
            </Empty>
          )}
        </Card>

        <NicheList niches={data.niches} onAnalyze={(k) => void analyze(k)} busy={!!analyzing} />
      </div>
    </div>
  );
}

function NicheList({ niches, onAnalyze, busy }: { niches: NicheResult[]; onAnalyze: (k: string) => void; busy: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!niches.length) {
    return (
      <Card title="Niche scores">
        <Empty icon={<Chart size={22} />} title="No niches analyzed yet">
          <p>Click <b>Analyze</b> on a keyword. Loupe reads the top Merch results and scores the niche from 0 to 100.</p>
        </Empty>
      </Card>
    );
  }
  return (
    <Card title="Niche scores" pad={false} actions={<span class="muted small">Demand 55% · competition 30% · freshness 15%</span>}>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Niche</th><th class="num">Score</th><th class="num">Median BSR</th><th class="num">Results</th><th class="num">Avg sales</th><th class="num">Median age</th><th /></tr>
          </thead>
          <tbody>
            {niches.map((n) => {
              const key = `${n.marketplace}:${n.keyword}`;
              const label = scoreLabel(n.score);
              return (
                <>
                  <tr style={{ cursor: 'pointer' }} class={open === key ? 'expanded' : ''} onClick={() => setOpen(open === key ? null : key)}>
                    <td class="nowrap">{MARKETPLACES[n.marketplace].flag} {n.keyword}</td>
                    <td class="num"><span class={`pill ${label.kind}`}>{n.score} · {label.text}</span></td>
                    <td class="num">{fmt.bsr(n.medianBsr)}</td>
                    <td class="num">{fmt.compact(n.totalResults)}</td>
                    <td class="num">{formatMonthly(n.avgMonthlySales)}</td>
                    <td class="num">{fmt.age(n.medianAgeDays)}</td>
                    <td class="num nowrap">
                      <button class="btn sm icon ghost" title="Re-analyze" disabled={busy} onClick={(e) => { e.stopPropagation(); onAnalyze(n.keyword); }}>
                        <Chart size={13} />
                      </button>
                      <button
                        class="btn sm icon ghost"
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          void update('niches', (list) => list.filter((x) => !(x.keyword === n.keyword && x.marketplace === n.marketplace)));
                        }}
                      >
                        <Trash size={13} />
                      </button>
                    </td>
                  </tr>
                  {open === key && (
                    <tr class="expanded">
                      <td colSpan={7}>
                        <div class="muted small" style={{ marginBottom: '8px' }}>
                          {n.under100k} of {n.sampled} sampled products rank under 100k · avg {fmt.int(n.avgReviews)} reviews · analyzed {fmt.ago(n.analyzedAt)}
                        </div>
                        <div class="grid-2">
                          {n.top.map((p) => (
                            <a class="row" href={productUrl(n.marketplace, p.asin)} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
                              {p.image ? <img class="thumb" src={amazonImage(p.image)} alt="" loading="lazy" /> : <span class="thumb" />}
                              <span class="grow">
                                <span class="ellipsis" style={{ display: 'block' }}>{p.title}</span>
                                <span class="muted small num">{fmt.bsr(p.bsr)} · {fmt.day(p.firstAvailable, 'long')}</span>
                              </span>
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
