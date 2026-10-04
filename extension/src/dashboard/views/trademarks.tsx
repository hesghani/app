import { useMemo, useState } from 'preact/hooks';
import { saveSettings } from '../../shared/storage';
import { BUILT_IN_TERM_COUNT, phrasesToCheck, scanText, tmviewUrl, usptoUrl } from '../../shared/trademark';
import { Card, Notice, useToast } from '../../ui/components';
import { Alert, External, Shield } from '../../ui/icons';
import type { Data, Route } from '../data';
import { PageHead } from './common';

export function Trademarks({ data, route }: { data: Data; route: Route }) {
  const { settings } = data;
  const toast = useToast();
  const [brand, setBrand] = useState('');
  const [title, setTitle] = useState(route.params.get('q') ?? '');
  const [bullets, setBullets] = useState('');
  const [custom, setCustom] = useState(settings.customTerms.join('\n'));
  const [ignored, setIgnored] = useState(settings.ignoredTerms.join('\n'));

  const hits = useMemo(
    () => scanText({ brand, title, bullets }, { custom: settings.customTerms, ignore: settings.ignoredTerms }),
    [brand, title, bullets, settings.customTerms, settings.ignoredTerms],
  );
  const phrases = useMemo(() => phrasesToCheck(brand, title, 8), [brand, title]);
  const empty = !brand.trim() && !title.trim() && !bullets.trim();

  return (
    <div class="stack">
      <PageHead title="Trademarks" sub={`Checks your text against ${BUILT_IN_TERM_COUNT} famous marks, protected terms and Merch content-policy phrases, then links each phrase to the official registers`} />

      <div class="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Your listing">
          <div class="stack">
            <label class="field"><span>Brand</span><input class="input" value={brand} onInput={(e) => setBrand((e.target as HTMLInputElement).value)} /></label>
            <label class="field"><span>Title or phrase</span><input class="input" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="e.g. Retro Pickleball Legend" /></label>
            <label class="field"><span>Bullets and description</span><textarea class="textarea" value={bullets} onInput={(e) => setBullets((e.target as HTMLTextAreaElement).value)} /></label>
          </div>
        </Card>

        <div class="stack">
          <Card title="Results">
            {empty ? (
              <p class="muted">Type or paste your listing to check it.</p>
            ) : hits.length ? (
              <ul class="hits">
                {hits.map((h) => (
                  <li class={`sev-${h.severity}`}>
                    <Alert size={15} />
                    <span>
                      <b>{h.term}</b> in {h.field}
                      <span class={`pill ${h.severity === 'high' ? 'bad' : 'warn'}`} style={{ marginLeft: '6px' }}>{h.severity === 'high' ? 'High risk' : 'Policy'}</span>
                      <br />
                      <span class="muted small">{h.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div class="row" style={{ color: 'var(--good-ink)' }}><Shield size={16} /> No known risky terms found.</div>
            )}
          </Card>

          <Card title="Check each phrase">
            {phrases.length ? (
              <div class="table-wrap">
                <table class="table">
                  <tbody>
                    {phrases.map((p) => (
                      <tr>
                        <td>“{p}”</td>
                        <td class="num nowrap">
                          <a class="btn sm" href={usptoUrl(p)} target="_blank" rel="noopener">USPTO <External size={12} /></a>{' '}
                          <a class="btn sm" href={tmviewUrl(p)} target="_blank" rel="noopener">TMview (EU/UK) <External size={12} /></a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p class="muted small">Phrases from your brand and title appear here with links to search them.</p>
            )}
            <div style={{ marginTop: '12px' }}>
              <Notice>
                Look for <b>live</b> registrations in <b>class 25</b> (clothing). This check is a first pass, not legal advice.
              </Notice>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Your term lists">
        <div class="grid-2">
          <label class="field">
            <span>Always flag (one per line)</span>
            <textarea class="textarea" value={custom} onInput={(e) => setCustom((e.target as HTMLTextAreaElement).value)} placeholder="Phrases you found registered" />
            <span class="hint">Flagged everywhere Loupe checks text, including the Merch create page.</span>
          </label>
          <label class="field">
            <span>Never flag (one per line)</span>
            <textarea class="textarea" value={ignored} onInput={(e) => setIgnored((e.target as HTMLTextAreaElement).value)} placeholder="Built-in terms you've cleared" />
            <span class="hint">Silences built-in terms, e.g. “official” if you use it safely.</span>
          </label>
        </div>
        <div class="row" style={{ marginTop: '12px' }}>
          <button
            class="btn primary"
            onClick={async () => {
              const split = (s: string) => Array.from(new Set(s.split('\n').map((x) => x.trim()).filter(Boolean)));
              await saveSettings({ customTerms: split(custom), ignoredTerms: split(ignored) });
              toast('Saved term lists');
            }}
          >
            Save lists
          </button>
        </div>
      </Card>
    </div>
  );
}
