// Styles for UI injected into Amazon and Merch pages. Amazon has no dark
// mode, so these are light-only and tuned to sit comfortably beside its UI.

export const BASE_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.lp {
  --ink: #12141a; --ink-2: #474d5c; --muted: #767c8f; --line: #e2e4ea; --line-2: #eef0f4;
  --surface: #ffffff; --surface-2: #f6f7f9; --brand: #5546e8; --brand-2: #4334d4; --brand-soft: #efedff;
  --good: #0ca30c; --good-ink: #046b04; --warn: #fab219; --warn-ink: #7a5100; --serious: #ec835a;
  --critical: #d03b3b; --critical-ink: #a42323; --cold: #a7abb8;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink); -webkit-font-smoothing: antialiased;
}
.lp button { font: inherit; color: inherit; cursor: pointer; }
.lp a { color: var(--brand); text-decoration: none; }
.lp a:hover { text-decoration: underline; }
.num { font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.row { display: flex; align-items: center; gap: 6px; }
.wrap { flex-wrap: wrap; }
.grow { flex: 1; min-width: 0; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--line); background: var(--surface); font-weight: 500; white-space: nowrap;
  transition: background .12s, border-color .12s;
}
.btn:hover { background: var(--surface-2); border-color: #cfd3dc; }
.btn:focus-visible, .chip-btn:focus-visible, .seg button:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
.btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
.btn.primary:hover { background: var(--brand-2); }
.btn.ghost { border-color: transparent; background: transparent; }
.btn.ghost:hover { background: var(--surface-2); }
.btn.sm { height: 24px; padding: 0 8px; font-size: 12px; border-radius: 6px; }
.btn.icon { width: 28px; padding: 0; justify-content: center; }
.btn.sm.icon { width: 24px; }
.btn[aria-pressed="true"] { background: var(--brand-soft); border-color: #c9c3ff; color: var(--brand-2); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; background: var(--surface); }
.seg button { border: 0; background: transparent; height: 26px; padding: 0 9px; font-size: 12px; color: var(--ink-2); }
.seg button + button { border-left: 1px solid var(--line); }
.seg button[aria-pressed="true"] { background: var(--brand-soft); color: var(--brand-2); font-weight: 600; }
.select {
  height: 28px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); padding: 0 6px;
  font: inherit; font-size: 12px; color: var(--ink);
}
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px var(--surface); }
.heat-hot, .heat-good { background: var(--good); }
.heat-ok { background: #2a78d6; }
.heat-slow { background: var(--warn); }
.heat-cold, .heat-none { background: var(--cold); }
.pill {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 999px;
  font-size: 11px; font-weight: 600; white-space: nowrap; border: 1px solid transparent;
}
.pill.merch { background: #e8f6e8; color: var(--good-ink); }
.pill.likely { background: #fff4d6; color: var(--warn-ink); }
.pill.no { background: var(--surface-2); color: var(--muted); border-color: var(--line); }
.pill.sponsored { background: var(--surface-2); color: var(--muted); }
.pill.brand { background: var(--brand-soft); color: var(--brand-2); }
.chip-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 12px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
}
.chip-btn:hover { border-color: #c9c3ff; background: var(--brand-soft); color: var(--brand-2); }
.shimmer {
  height: 12px; border-radius: 4px; width: 100%;
  background: linear-gradient(90deg, var(--line-2) 0%, var(--line) 50%, var(--line-2) 100%);
  background-size: 200% 100%; animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483647;
  background: #12141a; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.sev-high { color: var(--critical-ink); }
.sev-medium { color: var(--warn-ink); }
`;

export const SEARCH_CSS = `
.bar {
  margin: 0 0 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
  box-shadow: 0 1px 2px rgba(18,20,26,.04); overflow: hidden;
}
.bar-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex-wrap: wrap; }
.brandmark { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--brand); letter-spacing: -.01em; }
.progress { height: 3px; background: var(--line-2); }
.progress > div { height: 100%; background: var(--brand); transition: width .3s; }
.stats { display: flex; flex-wrap: wrap; gap: 0; border-top: 1px solid var(--line-2); }
.stat { padding: 8px 14px; min-width: 104px; border-right: 1px solid var(--line-2); }
.stat:last-child { border-right: 0; }
.stat .k { font-size: 11px; color: var(--muted); }
.stat .v { font-size: 15px; font-weight: 650; margin-top: 1px; }
.stat .v small { font-size: 11px; font-weight: 500; color: var(--muted); margin-left: 3px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--line-2); background: var(--surface-2); }
.controls .label { font-size: 11px; color: var(--muted); margin-left: 4px; }
.banner { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff4d6; color: var(--warn-ink); border-top: 1px solid #f3dd9f; }
.score { display: inline-flex; align-items: baseline; gap: 2px; }
.score b { font-size: 15px; }

.badge {
  position: relative; display: block; margin: 0 0 6px; padding: 6px 30px 6px 8px; border-radius: 8px; background: var(--surface-2);
  border: 1px solid var(--line-2); font-size: 12px;
}
.badge.dim { opacity: .55; }
.badge .top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.badge .rank { font-weight: 700; font-size: 13px; }
.badge .sub { margin-top: 3px; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge .sep { color: var(--line); }
.badge .track { position: absolute; top: 4px; right: 4px; }
.badge .err { color: var(--critical-ink); }
`;

export const PANEL_CSS = `
.panel {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; width: 352px; max-height: calc(100vh - 32px);
  display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 16px 48px rgba(18,20,26,.16), 0 2px 6px rgba(18,20,26,.06); overflow: hidden;
}
.panel.collapsed { width: auto; max-height: none; border-radius: 999px; }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line-2); }
.panel.collapsed .panel-head { border-bottom: 0; padding: 6px 8px 6px 12px; }
.brandmark { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--brand); }
.panel-body { overflow: auto; padding: 12px; display: grid; gap: 14px; }
.hero { display: flex; align-items: flex-end; gap: 10px; }
.hero .big { font-size: 28px; font-weight: 750; letter-spacing: -.02em; line-height: 1; }
.hero .cat { color: var(--muted); font-size: 12px; margin-top: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cell { background: var(--surface-2); border-radius: 9px; padding: 8px 10px; }
.cell .k { font-size: 11px; color: var(--muted); }
.cell .v { font-size: 14px; font-weight: 650; margin-top: 2px; }
.cell .v small { font-weight: 500; color: var(--muted); font-size: 11px; }
.section h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 650; }
.subranks { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 12px; }
.subranks li { display: flex; gap: 6px; }
.subranks b { min-width: 64px; }
.tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tiers .cell .v { font-size: 15px; }
.tiers .cell.active { background: var(--brand-soft); }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.hits { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.hits li { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; }
.hits li svg { flex: none; margin-top: 1px; }
.ok { display: flex; gap: 6px; align-items: center; color: var(--good-ink); font-size: 12px; }
.links { display: grid; gap: 4px; font-size: 12px; }
.links .row { justify-content: space-between; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.spark { width: 100%; height: 56px; display: block; }
.note { font-size: 11px; color: var(--muted); }
`;
