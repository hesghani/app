# Mizan

**Your work, family, faith and self, in balance.**

Mizan (Arabic for *balance*) is a daily planner for Muslims aged roughly 18 to 40. It runs as a native app on iPhone and Android, built from one codebase with Expo and React Native.

It isn't a religious app with productivity bolted on, or a to-do app with a prayer widget. It treats life as six areas and helps you give each its due:

| Area | What Mizan does for it |
| --- | --- |
| **Work** | Tasks, your top three, focus blocks that end at the adhan |
| **Family** | Check-in reminders for parents, spouse and siblings, one-tap call or WhatsApp, birthdays |
| **Faith** | Prayer times woven into your timeline, one-tap prayer logging, Qibla, dhikr |
| **Health** | Habits like a workout, water or sleep, plus a mood and energy check-in |
| **Growth** | Reading and learning habits, focus time, a weekly reflection |
| **Money** | Spending and saving tasks, a sadaqah habit |

## A day with Mizan

- **Morning:** a reminder to plan. Pick your **top three**, then see your day as a **timeline where prayers are fixed anchors** between your tasks. You can schedule something "after Asr" and Mizan works out the clock time for you.
- **During the day:**
  - Tap habits as you do them.
  - Run a **focus block**. It keeps the screen awake, logs the time to a life area, and every block ends when it's time to pray.
  - Mizan nudges you when it's been too long since you called your mum.
- **Evening:** a **60-second check-in** covering mood, energy, one win, one thing you're grateful for, and the first step for tomorrow.
- **Weekly:** rate each area 1 to 10. The **life balance wheel** shows how you *rated* each area next to where your time *actually went*.

## Screens

- **Today:** greeting, the next prayer with a countdown, top three, habits, a family nudge, the day's timeline, tasks for any time today, and one practical idea a day (sourced Quran, hadith and world wisdom, each with a "Try today" action).
- **Plan:** Today, Next, Someday and Done views, filtered by life area.
- **Focus:** 25, 50 or 90 minute blocks, or "until the next prayer", linked to a task, with a weekly chart split by area.
- **Family:** who to reach out to, sorted by how overdue they are, plus upcoming birthdays and notes such as gift ideas.
- **Me:** the balance wheel, weekly stats, a mood trend and tools (prayer times, Qibla compass, dhikr counter, habits, settings).

## Native features

- **Local notifications** for prayer times, the morning plan, the evening check-in, focus blocks ending and birthdays. They fire on time with the app closed, and no server is involved.
- **Location** for prayer times, with a built-in offline list of 180 cities as an alternative.
- **Compass** heading for the Qibla, with a haptic tap when you're facing it.
- **Haptics**, keep-awake during focus, and light and dark mode.
- **Private by design:** no account, no backend, no analytics. Everything is stored on the phone.

## Try it on your phone today

You need [Node.js 20+](https://nodejs.org) on a computer and the **Expo Go** app on your phone.

```bash
npm install
npx expo start
```

Scan the QR code with your phone's camera (iPhone) or with Expo Go (Android). The app opens straight away.

## Build the real apps

Builds run in Expo's cloud (EAS), so you don't need Xcode or Android Studio.

1. Create a free account at [expo.dev](https://expo.dev). Then run `npx eas-cli@latest login` and `npx eas-cli@latest init`.
2. **Android, as an installable APK you can send to anyone:**
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
   When it finishes, open the link on your Android phone and install.
3. **iPhone:** this needs an [Apple Developer account](https://developer.apple.com/programs/) ($99 a year).
   ```bash
   npx eas-cli@latest build -p ios --profile production
   npx eas-cli@latest submit -p ios     # sends it to TestFlight
   ```
4. **App stores:** use `--profile production`, then `eas submit`. Google Play has a one-time $25 fee.

**From GitHub instead:** add an `EXPO_TOKEN` repository secret (from [expo.dev access tokens](https://expo.dev/settings/access-tokens)). Then run **Actions → Build apps**, which also works from your phone. Run your *first* build from a computer as above, so EAS can set up signing keys interactively.

## Develop

```bash
npm start            # Expo dev server (press i for iOS simulator, a for Android, w for web)
npm test             # 25 unit tests: prayer engine vs. NOAA, planner rules, store
npm run typecheck
npx eslint .
```

Project layout:

```
src/app/                 screens (Expo Router)
  (tabs)/                Today, Plan, Focus, Family, Me (native tabs; _layout.web.tsx for the browser)
  task, person, habits, checkin, review, prayers, qibla, dhikr, settings, location, onboarding
src/components/          UI kit, task row, prayer card, habit chip, person row, balance wheel
src/lib/                 pure logic: prayer times, Hijri, time zones, planner rules, notifications
src/data/                daily ideas, habit presets, cities
src/store/store.ts       Zustand store persisted to device storage
__tests__/               Jest tests
```

## Accuracy

- Prayer times use the standard astronomical method, with 15 calculation methods chosen automatically by region. Hanafi Asr is the default in South Asia.
- Tests check sunrise, solar noon and sunset against an independent NOAA model. They agree within 2 minutes across 7 cities and 5 seasons.
- At high latitudes the app uses the angle-based rule. Umm al-Qura switches Isha to 120 minutes after Maghrib in Ramadan.
- Quran and hadith are given as plain English meanings with references. Other quotes were chosen for verifiable attribution.
