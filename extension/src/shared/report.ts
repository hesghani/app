// The sync report: everything needed to debug a sync against a Merch account,
// with no personal data. Requests and responses are described by parameter
// names and value kinds only (never values, titles or header contents).

import { describeRequest, type Template } from './learn';
import type { CaptureLogEntry, SyncState } from './types';

export interface ReportInput {
  version: string;
  userAgent: string;
  templates: Template[];
  captureLog: CaptureLogEntry[];
  syncState: SyncState;
  counts: { sales: number; catalog: number; totals: number };
  coverage: unknown;
  accountKeys: string[];
}

export function syncReport(r: ReportInput): string {
  const lines: string[] = [];
  lines.push(`Loupe sync report · v${r.version} · ${new Date().toISOString().slice(0, 16)}Z`);
  lines.push(`Browser: ${r.userAgent.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()}`);
  lines.push(`Sync: ${r.syncState.status} · ${r.syncState.mode} · ${r.syncState.phase}${r.syncState.error ? ` · error: ${r.syncState.error}` : ''}`);
  if (r.syncState.stats) lines.push(`Last run: ${JSON.stringify(r.syncState.stats)}`);
  lines.push(`Stored: ${r.counts.sales} sales rows, ${r.counts.catalog} catalog items, ${r.counts.totals} range totals · coverage ${JSON.stringify(r.coverage ?? {})}`);
  if (r.accountKeys.length) lines.push(`Account fields seen: ${r.accountKeys.join(', ')}`);
  lines.push('');
  lines.push(`Learned templates (${r.templates.length}):`);
  for (const t of r.templates) {
    lines.push(`- ${t.kind}${t.dated ? ' dated' : ''}: ${describeRequest(t.method, t.url, t.body)}`);
    lines.push(`  dates ${t.dates.map((d) => `${d.role}:${d.format}@${d.loc.in === 'body' ? d.loc.path.join('.') : d.loc.key}`).join(', ') || 'none'} · window ${t.window ? `${t.window.from}..${t.window.to}` : 'none'}`);
    lines.push(`  markets ${t.allMarkets ? 'all' : t.markets.map((m) => `${m.format}@${m.loc.in === 'body' ? m.loc.path.join('.') : m.loc.key}`).join(', ') || 'none'} · pages ${t.pages.map((p) => `${p.role}@${p.loc.in === 'body' ? p.loc.path.join('.') : p.loc.key}`).join(', ') || 'none'}${t.tokenKey ? ` · token ${t.tokenKey}` : ''} · rows ${t.rows}`);
    lines.push(`  header names: ${Object.keys(t.headers).join(', ') || 'none'}`);
  }
  lines.push('');
  lines.push(`Responses seen on merch.amazon.com (${r.captureLog.length}, newest first):`);
  for (const e of r.captureLog) {
    lines.push(`- [${e.status}] ${e.request ?? e.path} → ${e.kind ?? '?'} rows=${e.rows} items=${e.items ?? 0}${e.template ? ' (template)' : ''}`);
    for (const k of e.keys.slice(0, 30)) lines.push(`    ${k}`);
  }
  return lines.join('\n');
}
