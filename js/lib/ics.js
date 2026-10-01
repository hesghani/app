// Calendar export: the one reminder system that fires reliably on every phone,
// with no server and no background process.

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const text = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/**
 * @param {{start:number, title:string, minutes?:number}[]} events
 * @param {{name?:string, now?:number}} [opts]
 */
export function buildICS(events, { name = 'Prayer times · Ihsan', now = Date.now() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ihsan//Prayer Times//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.start}-${e.title.toLowerCase().replace(/[^a-z]/g, '')}@ihsan.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.start + (e.minutes ?? 15) * 60000)}`,
      `SUMMARY:${text(e.title)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${text(e.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
