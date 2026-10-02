// Design tokens. Quiet ink-on-paper surfaces; each life area owns one colour, and that colour
// is the only thing that varies across the app, so you can read a screen by its dots.

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AreaId } from '@/lib/model';

const light = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surface2: '#ECEEF2',
  line: '#E1E4EA',
  text: '#0E1420',
  muted: '#5B6474',
  faint: '#9AA2B0',
  ink: '#0E1420',
  onInk: '#FFFFFF',
  accent: '#2F6BFF',
  danger: '#C2410C',
  success: '#15803D',
  scrim: 'rgba(8,12,20,0.45)',
};

const dark: typeof light = {
  bg: '#0B0E14',
  surface: '#141923',
  surface2: '#1C2230',
  line: '#262D3C',
  text: '#EDF0F5',
  muted: '#9AA3B4',
  faint: '#646D80',
  ink: '#EDF0F5',
  onInk: '#0B0E14',
  accent: '#7AA0FF',
  danger: '#FB8C5C',
  success: '#4ADE80',
  scrim: 'rgba(0,0,0,0.6)',
};

const areaLight: Record<AreaId, string> = {
  work: '#2F6BFF',
  family: '#E5534B',
  faith: '#0E9384',
  health: '#2E9E4F',
  growth: '#7C5CF5',
  money: '#C98A0E',
};

const areaDark: Record<AreaId, string> = {
  work: '#7AA0FF',
  family: '#FF8A82',
  faith: '#3CCFB8',
  health: '#5AD07A',
  growth: '#AE95FF',
  money: '#F2C14E',
};

export type Palette = typeof light & { area: Record<AreaId, string>; dark: boolean };

export function useTheme(): Palette {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { ...(isDark ? dark : light), area: isDark ? areaDark : areaLight, dark: isDark };
}

export const AREA_META: Record<AreaId, { label: string; icon: IconName; blurb: string }> = {
  work: { label: 'Work', icon: 'briefcase', blurb: 'Career, study, craft' },
  family: { label: 'Family', icon: 'users', blurb: 'Parents, spouse, kids, kin' },
  faith: { label: 'Faith', icon: 'moon', blurb: 'Salah, Quran, remembrance' },
  health: { label: 'Health', icon: 'heart', blurb: 'Body, sleep, food' },
  growth: { label: 'Growth', icon: 'sprout', blurb: 'Learning, reading, skills' },
  money: { label: 'Money', icon: 'wallet', blurb: 'Saving, spending, giving' },
};

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const gutter = 20;

/** Sky colours per time of day, used only on the prayer card. */
export const SKY: Record<'dawn' | 'day' | 'golden' | 'dusk' | 'night', [string, string]> = {
  dawn: ['#3B3A7A', '#C46F86'],
  day: ['#1B5FB4', '#4E9BE0'],
  golden: ['#38558F', '#D88A4A'],
  dusk: ['#3A2358', '#C2564B'],
  night: ['#0B1230', '#24305F'],
};

export type IconName =
  | 'plus'
  | 'minus'
  | 'check'
  | 'star'
  | 'starFill'
  | 'close'
  | 'chevronRight'
  | 'chevronLeft'
  | 'phone'
  | 'message'
  | 'calendar'
  | 'clock'
  | 'sun'
  | 'moon'
  | 'kaaba'
  | 'trash'
  | 'settings'
  | 'bell'
  | 'target'
  | 'users'
  | 'user'
  | 'heart'
  | 'briefcase'
  | 'wallet'
  | 'sprout'
  | 'play'
  | 'stop'
  | 'locate'
  | 'search'
  | 'flame'
  | 'beads'
  | 'chart'
  | 'gift'
  | 'arrowRight'
  | 'inbox';
