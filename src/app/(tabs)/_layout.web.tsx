// Web preview only: a conventional bottom tab bar, so the browser build looks like the phone app.
import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { useTheme, type IconName } from '@/theme';

const TABS: [string, string, IconName][] = [
  ['index', 'Today', 'sun'],
  ['plan', 'Plan', 'inbox'],
  ['focus', 'Focus', 'target'],
  ['family', 'Family', 'users'],
  ['me', 'Me', 'user'],
];

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
      }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} size={22} color={String(color)} /> }} />
      ))}
    </Tabs>
  );
}
