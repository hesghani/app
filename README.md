# Ihsan

**Build your day around the five.**

Ihsan is a daily operating system for Muslims aged roughly 18 to 40. It isn't a library of everything Islamic. It is a small set of tools built around the one structure every Muslim already has: five prayers a day.

> “Ihsan is to worship Allah as though you see Him. And if you do not see Him, He sees you.” · Bukhari 50

## The thinking

Most Muslim apps try to be everything at once: a full Quran reader, a hundred duas, articles, a calendar and a mosque finder. That is a lot of features and not much changes in your day. We started from one question: what actually changes a person's day?

1. **Five fixed anchors.** The prayers are already the structure of the day, so everything else hangs off them.
2. **One intention.** Not a to-do list. The single thing that would make today a win.
3. **Deep work between anchors.** Each prayer is a natural end to a focus block, so the adhan becomes your pomodoro bell.
4. **Sixty seconds of honest review at night.** Muhasaba, the way ʿUmar described it, as a journal rather than a guilt trip.

Everything else was cut, or shows up only when it is relevant.

| Kept | Cut, or shown only in context |
| --- | --- |
| Prayer times with a live countdown | Full Quran reader (use a dedicated one; Ihsan tracks pages) |
| Tap-to-log prayers, streaks, a 15-week consistency grid | Dua libraries, articles, feeds |
| Today’s one thing | To-do lists |
| Focus blocks that end at the adhan | Pomodoro settings |
| Dhikr counter (six dhikr with the strongest evidence) | 99 names, long adhkar books |
| Nightly review: win, fix, gratitude | Mood trackers |
| One idea a day, with one action | Endless quote feeds |
| Qibla compass | Mosque finder, maps |
| **Contextual nudges** shown only when relevant: Jumuʿah and Al-Kahf, the White Days, Monday and Thursday fasts, Arafah, Ashura, Shawwal, the last ten nights, the last third of the night, Duha | Static Islamic calendar screens |

## Features

**Today**
- A **living sky** that follows the real sun through dawn, morning, noon, golden hour, dusk and night. The colours change with the prayer periods.
- A **sun arc** showing where the sun is right now, with Dhuhr and Asr marked on its path. At night it becomes a moon arc with the **last third of the night** highlighted. The current solar altitude is shown too, since every prayer time is a sun angle.
- The next prayer in large type with a live countdown, and five tap-to-log prayer pills.
- **Ramadan mode turns on automatically:** an iftar countdown during the day and a suhoor countdown at night. During Fajr you also see a "Fajr ends at sunrise" countdown.
- **The Hijri date rolls over at Maghrib**, as the Islamic day does.
- **Daily rings** in the style of Apple's activity rings: Salah 5/5, Quran pages and dhikr count.
- **Today's one thing**: one intention, checked off when it's done.
- **One idea a day** from the Quran, hadith, Muslim scholars and world wisdom, always with a "Try today" action. Shareable as a story image.

**Focus**: deep-work blocks that run until the next prayer, or 25, 50 or 90 minutes. Every block ends at the adhan, even a fixed-length one. Each block starts with Bismillah, keeps the screen awake, and logs minutes into a 7-day chart.

**Dhikr**: a large tap target with haptics. The after-salah set runs 33, 33, then 34 and advances on its own. Each dhikr shows its reference.

**Reflect**: streak, best streak, focus hours, dhikr totals, a 15-week salah grid, and a three-prompt nightly journal that saves as you type.

**Settings**
- 15 calculation methods, chosen automatically from your region. Hanafi Asr is the default in South Asia. The method screen explains the actual sun angles.
- Hijri date adjustment for moon sighting, and Quran and dhikr goals. For example, 4 pages a day finishes the Quran in 151 days.
- 12h or 24h clock, and an Auto, Light or Dark theme.
- **Calendar export**: 30 days of prayer alarms as an `.ics` file. This is the one reminder system that fires reliably on any phone with no server.
- Export and import a backup, or erase all data.

**Private by design**: no account, no server and no analytics. Prayer times are calculated on the device. City search uses a built-in list of about 180 cities, so even location lookup never leaves the phone.

## Run it

Requires Node 20 or later. There are no dependencies to install.

```bash
npm start        # http://localhost:5173
npm test         # 22 tests: prayer times checked against an independent NOAA solar model, nudges, streaks, iCal
npm run build    # dist/ihsan.html, a single self-contained file that opens straight from disk
```

### Put it on your phone

Ihsan is a Progressive Web App. Host the folder on any static host over HTTPS, such as GitHub Pages, Netlify, Vercel or Cloudflare Pages. Then open it on your phone and choose:
- **iPhone:** Share, then Add to Home Screen
- **Android:** the browser menu, then Install app

Once installed it works offline. The service worker caches the app shell and fonts.

## Accuracy

- Prayer times use the standard astronomical method (the PrayTimes.org formulas, rewritten as a pure module). Tests check sunrise, solar noon and sunset against an independent NOAA implementation. They agree within 2 minutes across 7 cities and 5 seasons.
- At high latitudes (for example Oslo in June) the app uses the angle-based rule, so Fajr and Isha always exist.
- Umm al-Qura switches Isha to 120 minutes after Maghrib during Ramadan.
- Hijri dates use the Umm al-Qura calendar built into the browser, with a tabular fallback and a manual ±2 day adjustment.
- Local mosques sometimes add a few minutes of caution. If yours differs, try another method in Settings.

## Content and sources

Quran verses and hadith are rendered as plain modern English meanings, each with its reference. Hadith are drawn from Bukhari and Muslim wherever possible, and others carry their grading. Quotes from scholars and world thinkers were chosen for verifiable attribution, and popular misattributions were left out. Please open an issue if you find an error.

## Project layout

```
index.html            app shell
css/app.css           design tokens and components (light and dark, sky per prayer period)
js/app.js             controller: rendering, actions, timers, alerts
js/core.js            the day model: prayer windows, periods, Islamic day, Ramadan, nudges
js/lib/               pure logic: praytimes, hijri, time zones, nudges, streaks, store, ics
js/data/              wisdom, cities, dhikr
js/views/             today, focus, dhikr, reflect, sheets, onboarding
js/ui/                icons, DOM helpers, share-card renderer
sw.js                 offline cache
tests/                node:test suites
scripts/              dev server and single-file build
```
