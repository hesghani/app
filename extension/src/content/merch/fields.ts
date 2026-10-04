// Finds the listing fields on Merch on Demand's create/edit page without
// relying on its markup: each visible text field is described by its id,
// name, placeholder, ARIA and label text, and classified from that.

export type FieldKind = 'brand' | 'title' | 'bullet' | 'description';

export interface ListingField {
  kind: FieldKind;
  el: HTMLInputElement | HTMLTextAreaElement;
}

function textOf(id: string, doc: Document): string {
  return id
    .split(/\s+/)
    .map((part) => doc.getElementById(part)?.textContent ?? '')
    .join(' ');
}

export function describeField(el: HTMLInputElement | HTMLTextAreaElement): string {
  const doc = el.ownerDocument;
  const parts = [
    el.id,
    el.getAttribute('name'),
    el.getAttribute('placeholder'),
    el.getAttribute('aria-label'),
    el.getAttribute('formcontrolname'),
    el.getAttribute('data-test-id'),
    el.getAttribute('data-testid'),
    el.getAttribute('aria-labelledby') ? textOf(el.getAttribute('aria-labelledby')!, doc) : '',
    Array.from(el.labels ?? []).map((l) => l.textContent).join(' '),
  ];
  if (!el.labels?.length) {
    const group = el.closest('mat-form-field, .form-group, .a-section, label, [class*="field"], [class*="Field"]');
    parts.push(group?.querySelector('label, .a-form-label, [class*="label"]')?.textContent ?? '');
  }
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').toLowerCase();
}

export function classifyField(description: string): FieldKind | null {
  if (/search|price|royalt|color|colour|size|email|password|filter/.test(description)) return null;
  if (/brand|marke|marque|marca/.test(description)) return 'brand';
  if (/description|beschreibung/.test(description)) return 'description';
  if (/bullet|feature|key product|highlight|aufzählung/.test(description)) return 'bullet';
  if (/title|titel|titre|titolo|título/.test(description) && !/subtitle/.test(description)) return 'title';
  return null;
}

function visible(el: HTMLElement): boolean {
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return el.getClientRects().length > 0;
}

export function findListingFields(root: ParentNode = document, includeHidden = false): ListingField[] {
  const fields: ListingField[] = [];
  const candidates = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type="text"], input[type="search"]',
  );
  for (const el of Array.from(candidates)) {
    if (el.disabled || el.readOnly) continue;
    if (!includeHidden && !visible(el)) continue;
    const kind = classifyField(describeField(el));
    if (kind) fields.push({ kind, el });
  }
  return fields;
}

/** Sets a value so that React and Angular both notice the change. */
export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

export interface DraftValues {
  brand: string;
  title: string;
  bullet1: string;
  bullet2: string;
  description: string;
}

/**
 * Fills every visible listing (Merch shows one per language). Bullets are
 * assigned in order within each listing: the first and second bullet field
 * after each title field.
 */
export function fillListing(fields: ListingField[], draft: DraftValues, overwrite = true): number {
  let filled = 0;
  let bulletIndex = 0;
  for (const { kind, el } of fields) {
    let value = '';
    if (kind === 'brand') value = draft.brand;
    else if (kind === 'title') {
      value = draft.title;
      bulletIndex = 0;
    } else if (kind === 'bullet') {
      value = bulletIndex === 0 ? draft.bullet1 : bulletIndex === 1 ? draft.bullet2 : '';
      bulletIndex += 1;
    } else value = draft.description;
    if (!value || (!overwrite && el.value.trim())) continue;
    setFieldValue(el, value);
    filled += 1;
  }
  return filled;
}

/** Snap's "copy bullets into description": joins the bullets before each description field. */
export function bulletsToDescription(fields: ListingField[]): number {
  let bullets: string[] = [];
  let filled = 0;
  for (const { kind, el } of fields) {
    if (kind === 'title') bullets = [];
    const text = el.value.trim();
    if (kind === 'bullet' && text) bullets.push(/[.!?]$/.test(text) ? text : `${text}.`);
    if (kind === 'description' && bullets.length) {
      setFieldValue(el, bullets.join(' '));
      filled += 1;
      bullets = [];
    }
  }
  return filled;
}

export function findAndReplace(fields: ListingField[], find: string, replace: string, caseSensitive = false): number {
  if (!find) return 0;
  const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
  let changed = 0;
  for (const { el } of fields) {
    const next = el.value.replace(pattern, replace);
    if (next !== el.value) {
      setFieldValue(el, next);
      changed += 1;
    }
  }
  return changed;
}
