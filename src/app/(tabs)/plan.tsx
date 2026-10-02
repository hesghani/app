import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { TaskRow } from '@/components/task-row';
import { Card, Chip, Divider, Empty, IconButton, Screen, Section, Segmented } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { someday, tasksForToday, upcoming } from '@/lib/logic';
import { AREAS, type AreaId, type Task } from '@/lib/model';
import { addDaysKey, formatKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, useTheme } from '@/theme';

type View_ = 'today' | 'upcoming' | 'someday' | 'done';

function groupByDate(tasks: Task[], today: string) {
  const groups: { key: string; label: string; tasks: Task[] }[] = [];
  for (const t of tasks) {
    const key = t.date ?? 'someday';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label = key === addDaysKey(today, 1) ? 'Tomorrow' : formatKey(key, { weekday: 'long', day: 'numeric', month: 'short' });
      groups.push((g = { key, label, tasks: [] }));
    }
    g.tasks.push(t);
  }
  return groups;
}

export default function Plan() {
  const c = useTheme();
  const day = useDay(60000);
  const tasks = useStore(useShallow((s) => s.tasks));
  const [view, setView] = useState<View_>('today');
  const [area, setArea] = useState<AreaId | null>(null);

  const filter = (list: Task[]) => (area ? list.filter((t) => t.area === area) : list);
  const counts = {
    today: tasksForToday(tasks, day.today).filter((t) => !t.done).length,
    upcoming: upcoming(tasks, day.today).length,
    someday: someday(tasks).length,
  };

  let body: React.ReactNode;
  if (view === 'upcoming') {
    const groups = groupByDate(filter(upcoming(tasks, day.today)), day.today);
    body = groups.length ? (
      groups.map((g) => (
        <Section key={g.key} label={g.label}>
          <List tasks={g.tasks} today={day.today} h12={day.h12} />
        </Section>
      ))
    ) : (
      <Empty icon="calendar" title="Nothing coming up" body="Give a task a date and it shows here, grouped by day." action="Add a task" onAction={() => router.push('/task')} />
    );
  } else if (view === 'someday') {
    const list = filter(someday(tasks));
    body = list.length ? (
      <List tasks={list} today={day.today} h12={day.h12} />
    ) : (
      <Empty icon="inbox" title="Someday is empty" body="Ideas without a date live here until you are ready for them." action="Add an idea" onAction={() => router.push({ pathname: '/task', params: { someday: '1' } })} />
    );
  } else if (view === 'done') {
    const list = filter(tasks.filter((t) => t.done)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 50);
    body = list.length ? (
      <List tasks={list} today={day.today} h12={day.h12} showDate />
    ) : (
      <Empty icon="check" title="Nothing finished yet" body="Completed tasks collect here. The first one is the hardest." />
    );
  } else {
    const list = filter(tasksForToday(tasks, day.today)).sort(
      (a, b) => Number(a.done) - Number(b.done) || Number(b.top) - Number(a.top) || (a.time ?? '99').localeCompare(b.time ?? '99'),
    );
    body = list.length ? (
      <List tasks={list} today={day.today} h12={day.h12} />
    ) : (
      <Empty icon="sun" title="A clear day" body="Add what matters today. Star up to three as your top priorities." action="Add a task" onAction={() => router.push('/task')} />
    );
  }

  return (
    <Screen
      title="Plan"
      subtitle="Everything on your plate, across every part of life."
      right={<IconButton icon="plus" label="Add a task" filled size={44} onPress={() => router.push(view === 'someday' ? { pathname: '/task', params: { someday: '1' } } : '/task')} />}>
      <Segmented<View_>
        value={view}
        onChange={setView}
        options={[
          ['today', counts.today ? `Today ${counts.today}` : 'Today'],
          ['upcoming', counts.upcoming ? `Next ${counts.upcoming}` : 'Next'],
          ['someday', 'Someday'],
          ['done', 'Done'],
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={styles.filters}>
        <Chip label="All" selected={area == null} onPress={() => setArea(null)} />
        {AREAS.map((a) => (
          <Chip key={a} label={AREA_META[a].label} icon={AREA_META[a].icon} color={c.area[a]} selected={area === a} onPress={() => setArea(area === a ? null : a)} />
        ))}
      </ScrollView>
      {body}
    </Screen>
  );
}

function List({ tasks, today, h12, showDate }: { tasks: Task[]; today: string; h12: boolean; showDate?: boolean }) {
  return (
    <Card padded={false} style={{ paddingHorizontal: 16 }}>
      {tasks.map((t, i) => (
        <Fragment key={t.id}>
          {i > 0 ? <Divider /> : null}
          <TaskRow task={t} today={today} h12={h12} showDate={showDate} />
        </Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8, paddingHorizontal: 20 },
});
