import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { IconName } from '@/theme';

// Stroke icons on a 24px grid, drawn once so they look identical on iOS, Android and web.
const PATHS: Record<IconName, (fill: string) => React.ReactNode> = {
  plus: () => <Path d="M12 5v14M5 12h14" />,
  minus: () => <Path d="M5 12h14" />,
  check: () => <Path d="M5 12.5 9.5 17 19 7.5" />,
  star: () => <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />,
  starFill: (c) => <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill={c} />,
  close: () => <Path d="M6 6l12 12M18 6 6 18" />,
  chevronRight: () => <Path d="m9 6 6 6-6 6" />,
  chevronLeft: () => <Path d="m15 6-6 6 6 6" />,
  phone: () => (
    <Path d="M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.5 5.6a2 2 0 0 1 2.1-2.1z" />
  ),
  message: () => <Path d="M4 5.5h16v10H9l-5 4z" />,
  calendar: () => (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: () => (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  sun: () => (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: () => <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  kaaba: () => (
    <>
      <Path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
      <Path d="M4 10.5 12 14l8-3.5M12 14v6" />
    </>
  ),
  trash: () => <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />,
  settings: () => (
    <>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </>
  ),
  bell: () => (
    <>
      <Path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  target: () => (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Circle cx={12} cy={12} r={4.5} />
      <Circle cx={12} cy={12} r={0.8} />
    </>
  ),
  users: () => (
    <>
      <Circle cx={9} cy={8.5} r={3.2} />
      <Path d="M3 19.5a6 6 0 0 1 12 0" />
      <Path d="M15.5 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.2a6 6 0 0 1 3.5 5.3" />
    </>
  ),
  user: () => (
    <>
      <Circle cx={12} cy={8.5} r={3.5} />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  heart: () => <Path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10z" />,
  briefcase: () => (
    <>
      <Rect x={3.5} y={7.5} width={17} height={12} rx={2.5} />
      <Path d="M9 7.5V5.5h6v2M3.5 12.5h17" />
    </>
  ),
  wallet: () => (
    <>
      <Path d="M4 7.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5H17" />
      <Path d="M16 13.5h1.5" />
    </>
  ),
  sprout: () => (
    <>
      <Path d="M12 20v-8" />
      <Path d="M12 12c0-4 3-6.5 7.5-6.5 0 4.5-3 6.5-7.5 6.5zM12 14.5C12 11 9.5 9 5 9c0 4 2.5 5.5 7 5.5z" />
    </>
  ),
  play: (c) => <Path d="M8 5.5v13l10.5-6.5z" fill={c} />,
  stop: () => <Rect x={6.5} y={6.5} width={11} height={11} rx={2} />,
  locate: () => <Path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5z" />,
  search: () => (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="m16 16 4 4" />
    </>
  ),
  flame: () => <Path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.8 3.4-5.6 3.4-9.4 2.6 1.6 4 3.6 4.2 6 .8-.6 1.4-1.6 1.6-2.8 1.8 1.6 2.8 3.8 2.8 6.2 0 3.2-2.4 5.6-6 5.6z" />,
  beads: () => (
    <>
      <Circle cx={12} cy={11} r={7} strokeDasharray="0.01 3.66" strokeWidth={3.2} />
      <Path d="M12 18.5v3" />
    </>
  ),
  chart: () => <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  gift: () => (
    <>
      <Rect x={4} y={9} width={16} height={11} rx={1.5} />
      <Path d="M3 9h18M12 9v11M12 9c-1-3-5-4.5-5.5-2S10 9 12 9zm0 0c1-3 5-4.5 5.5-2S14 9 12 9z" />
    </>
  ),
  arrowRight: () => <Path d="M5 12h14M13 6l6 6-6 6" />,
  inbox: () => (
    <>
      <Path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <Path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" />
    </>
  ),
};

export function Icon({ name, size = 20, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name](color)}
    </Svg>
  );
}
