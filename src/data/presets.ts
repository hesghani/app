import type { AreaId } from '@/lib/model';

export interface HabitPreset {
  title: string;
  area: AreaId;
  target: number;
  unit: string;
}

/** Starter habits offered during setup. People pick a few; everything is editable later. */
export const HABIT_PRESETS: HabitPreset[] = [
  { title: 'Deep work block', area: 'work', target: 1, unit: '' },
  { title: 'Inbox zero', area: 'work', target: 1, unit: '' },
  { title: 'Call or text a parent', area: 'family', target: 1, unit: '' },
  { title: 'Phone-free family time', area: 'family', target: 1, unit: '' },
  { title: 'Read Quran', area: 'faith', target: 2, unit: 'pages' },
  { title: 'Morning adhkar', area: 'faith', target: 1, unit: '' },
  { title: 'Workout', area: 'health', target: 1, unit: '' },
  { title: 'Water', area: 'health', target: 8, unit: 'glasses' },
  { title: 'Asleep by 11', area: 'health', target: 1, unit: '' },
  { title: 'Read', area: 'growth', target: 10, unit: 'pages' },
  { title: 'Learn something new', area: 'growth', target: 1, unit: '' },
  { title: 'No impulse buys', area: 'money', target: 1, unit: '' },
  { title: 'Give sadaqah', area: 'money', target: 1, unit: '' },
];

export const DEFAULT_PRESETS = ['Deep work block', 'Call or text a parent', 'Read Quran', 'Workout'];

export const RELATIONS = ['Mother', 'Father', 'Spouse', 'Child', 'Sibling', 'Grandparent', 'Relative', 'Friend'];

/** How often people usually want to check in, by relationship. */
export const DEFAULT_EVERY: Record<string, number> = {
  Mother: 2,
  Father: 3,
  Spouse: 1,
  Child: 1,
  Sibling: 7,
  Grandparent: 7,
  Relative: 30,
  Friend: 14,
};

export const DHIKR = [
  { id: 'subhanallah', ar: 'سُبْحَانَ اللَّهِ', tr: 'SubhanAllah', en: 'Glory be to Allah', n: 33 },
  { id: 'alhamdulillah', ar: 'الْحَمْدُ لِلَّهِ', tr: 'Alhamdulillah', en: 'All praise is for Allah', n: 33 },
  { id: 'allahuakbar', ar: 'اللَّهُ أَكْبَرُ', tr: 'Allahu Akbar', en: 'Allah is the Greatest', n: 34 },
  { id: 'astaghfirullah', ar: 'أَسْتَغْفِرُ اللَّهَ', tr: 'Astaghfirullah', en: 'I seek Allah’s forgiveness', n: 100 },
  { id: 'salawat', ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', tr: 'Allahumma salli ʿala Muhammad', en: 'O Allah, send blessings on Muhammad', n: 100 },
] as const;
