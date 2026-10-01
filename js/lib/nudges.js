// One contextual line per moment. Shows up only when it matters, then gets out of the way.

/**
 * @param {object} c
 * @param {{y,m,d}} c.hijriToday     hijri date for today's daytime
 * @param {{y,m,d}} c.hijriTomorrow  hijri date for tomorrow's daytime
 * @param {number} c.weekday         local weekday today, 0 = Sunday
 * @param {'dawn'|'morning'|'noon'|'afternoon'|'dusk'|'night'} c.period
 * @param {boolean} c.afterMaghrib   now is after today's Maghrib (the Islamic day has rolled over)
 * @param {boolean} c.beforeFajr     now is after midnight but before today's Fajr
 * @param {number|null} c.lastThird  start of the last third of tonight (ms)
 * @param {number} c.now
 * @param {(ms:number)=>string} c.clock
 * @returns {{text:string, ref?:string}|null}
 */
export function pickNudge(c) {
  const H = c.afterMaghrib ? c.hijriTomorrow : c.hijriToday; // the Islamic day starts at Maghrib
  const night = c.afterMaghrib || c.beforeFajr;
  const fastDay = (label, ref) => {
    if (c.afterMaghrib) return { text: `${label} is tomorrow. Set the intention and a suhoor alarm tonight.`, ref };
    if (c.beforeFajr) return { text: `${label} starts at Fajr. Eat suhoor and set the intention.`, ref };
    return { text: `${label} today. A Sunnah fasting day.`, ref };
  };

  if (H.m === 10 && H.d === 1) return { text: 'Eid Mubarak. Ghusl, your best clothes, takbir on the way to prayer. No fasting today.' };
  if (H.m === 12 && H.d === 10) return { text: 'Eid al-Adha Mubarak. Keep the takbir going after every prayer until the 13th.' };

  if (H.m === 9) {
    if (night && H.d >= 21) {
      return H.d % 2
        ? { text: 'An odd night in the last ten. Laylat al-Qadr could be tonight. Pray, give, and ask.', ref: 'Bukhari 2017' }
        : { text: 'The last ten nights of Ramadan. Give part of tonight to Allah.', ref: 'Bukhari 2024' };
    }
    const tips = [
      { text: `Ramadan, day ${H.d}. Feed someone at iftar and you share their reward.`, ref: 'Tirmidhi 807' },
      { text: `Ramadan, day ${H.d}. Fast it with faith and hope of reward, and past sins are forgiven.`, ref: 'Bukhari 38' },
      { text: `Ramadan, day ${H.d}. Guard the fast from harsh words as much as from food.`, ref: 'Bukhari 1903' },
    ];
    return tips[H.d % tips.length];
  }

  if (H.m === 12 && H.d === 9) return fastDay('The Day of Arafah', 'Muslim 1162');
  if (H.m === 12 && H.d <= 8) return { text: 'The best ten days of the year. Every good deed weighs more right now.', ref: 'Bukhari 969' };
  if (H.m === 12 && H.d >= 11 && H.d <= 13) return { text: 'The days of Tashreeq. Eat, drink, and remember Allah. No fasting.', ref: 'Muslim 1141' };
  if (H.m === 1 && H.d === 10) return fastDay('Ashura', 'Muslim 1162');
  if (H.m === 1 && H.d === 9) return fastDay('Tasuʿa, the day before Ashura,', 'Muslim 1134');

  // Jumuʿah runs from Thursday Maghrib to Friday Maghrib.
  if (c.weekday === 4 && c.afterMaghrib)
    return { text: 'The night of Jumuʿah has started. Read Surah Al-Kahf before tomorrow’s Maghrib.', ref: 'Al-Hakim · sahih' };
  if (c.weekday === 5 && !c.afterMaghrib)
    return { text: 'Jumuʿah. Read Al-Kahf, send salawat, and keep making dua in the last hour before Maghrib.', ref: 'Abu Dawud 1048' };

  if (H.m === 10 && H.d >= 2) return { text: 'Shawwal. Fast six days this month and it counts like fasting the whole year.', ref: 'Muslim 1164' };
  if (H.d >= 13 && H.d <= 15) return fastDay(H.d === 13 ? 'The first White Day' : 'A White Day', 'Tirmidhi 761');

  const tomorrowWd = (c.weekday + 1) % 7;
  if (c.afterMaghrib && (tomorrowWd === 1 || tomorrowWd === 4)) {
    const day = tomorrowWd === 1 ? 'Monday' : 'Thursday';
    return { text: `Tomorrow is ${day}, a Sunnah fast. Deeds are presented to Allah that day.`, ref: 'Tirmidhi 747' };
  }

  if (night && c.lastThird && c.now < c.lastThird)
    return { text: `The last third of the night starts at ${c.clock(c.lastThird)}. The best time to ask.`, ref: 'Bukhari 1145' };
  if (night && c.lastThird && c.now >= c.lastThird)
    return { text: 'You are in the last third of the night. Allah is asking who is calling on Him.', ref: 'Bukhari 1145' };
  if (c.period === 'morning')
    return { text: 'The Duha window is open. Two rakʿahs now count as charity for every joint in your body.', ref: 'Muslim 720' };
  return null;
}
