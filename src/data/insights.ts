// One practical idea a day, rotating through every area of life.
// Quran and hadith are plain modern English meanings with references; other quotes have verified sources.

import type { AreaId } from '@/lib/model';

export interface Insight {
  area: AreaId;
  quote: string;
  source: string;
  action: string;
}

const LIST: Insight[] = [
  {
    area: 'faith',
    quote: 'He set up the balance, so do not upset the balance.',
    source: 'Quran 55:7–8',
    action: 'Look at your week. Which part of life got too much of you, and which got too little?',
  },
  {
    area: 'work',
    quote: 'Allah loves that when one of you does a job, you do it with excellence.',
    source: 'Prophet Muhammad ﷺ · al-Bayhaqi',
    action: 'Spend ten extra minutes polishing one piece of work before you send it.',
  },
  {
    area: 'family',
    quote: 'The best of you are those who are best to their families.',
    source: 'Prophet Muhammad ﷺ · Tirmidhi 3895',
    action: 'Phones away for one meal with your family today.',
  },
  {
    area: 'health',
    quote: 'Your body has a right over you.',
    source: 'Prophet Muhammad ﷺ · Bukhari 5199',
    action: 'Pick a bedtime tonight and set an alarm 30 minutes before it to start winding down.',
  },
  {
    area: 'growth',
    quote: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    source: 'James Clear · Atomic Habits',
    action: 'Make one good habit easier: put the book, the gym bag or the Quran where you will see it.',
  },
  {
    area: 'money',
    quote: 'Those who, when they spend, are neither wasteful nor stingy, but keep a balance between the two.',
    source: 'Quran 25:67',
    action: 'Pick one spending category to cut by a quarter this month.',
  },
  {
    area: 'work',
    quote: 'Focusing is about saying no.',
    source: 'Steve Jobs · 1997',
    action: 'Say no to one meeting or request today that does not serve your top three.',
  },
  {
    area: 'family',
    quote: 'Whoever wants their provision increased and their life extended should keep ties with their relatives.',
    source: 'Prophet Muhammad ﷺ · Bukhari 5986',
    action: 'Call one relative you have not spoken to in a month.',
  },
  {
    area: 'faith',
    quote: 'Actions are judged by intentions, and everyone gets what they intended.',
    source: 'Prophet Muhammad ﷺ · Bukhari 1',
    action: 'Before work, name the intention behind it. Earning halal for your family is worship.',
  },
  {
    area: 'health',
    quote: 'The strong believer is better and more beloved to Allah than the weak believer, and there is good in both.',
    source: 'Prophet Muhammad ﷺ · Muslim 2664',
    action: 'Move for 20 minutes today: a walk, the gym, or bodyweight at home.',
  },
  {
    area: 'growth',
    quote: 'Two blessings most people are cheated out of: health and free time.',
    source: 'Prophet Muhammad ﷺ · Bukhari 6412',
    action: 'Find your most wasted 30 minutes today and give them one job.',
  },
  {
    area: 'money',
    quote: 'Charity never decreases wealth.',
    source: 'Prophet Muhammad ﷺ · Muslim 2588',
    action: 'Set up a small automatic weekly sadaqah. Consistency beats size.',
  },
  {
    area: 'work',
    quote: 'The impediment to action advances action. What stands in the way becomes the way.',
    source: 'Marcus Aurelius · Meditations 5.20',
    action: 'Start with the task you are avoiding. Give it 25 minutes in Focus.',
  },
  {
    area: 'family',
    quote: 'The most complete believers in faith are those with the best character, and the best of you are the best to their wives.',
    source: 'Prophet Muhammad ﷺ · Tirmidhi 1162',
    action: 'Tell your spouse or a parent one specific thing you appreciate about them.',
  },
  {
    area: 'faith',
    quote: 'Truly, in the remembrance of Allah hearts find rest.',
    source: 'Quran 13:28',
    action: 'Next time you reach for your phone to calm down, do 33 SubhanAllah first.',
  },
  {
    area: 'health',
    quote: 'A third for food, a third for drink, and a third for breath.',
    source: 'Prophet Muhammad ﷺ · Tirmidhi 2380',
    action: 'Stop at two-thirds full at dinner and notice your energy afterwards.',
  },
  {
    area: 'growth',
    quote: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.',
    source: 'Will Durant, on Aristotle',
    action: 'Choose one daily action that, repeated for a year, would change your life. Add it as a habit.',
  },
  {
    area: 'money',
    quote: 'Tie your camel, then put your trust in Allah.',
    source: 'Prophet Muhammad ﷺ · Tirmidhi 2517',
    action: 'Move a fixed amount into savings the day you get paid, before you spend anything.',
  },
  {
    area: 'work',
    quote: 'It is not that we have a short time to live, but that we waste much of it.',
    source: 'Seneca · On the Shortness of Life',
    action: 'Turn off notifications for one app that interrupts your deep work.',
  },
  {
    area: 'family',
    quote: 'Lower to them the wing of humility out of mercy, and say: My Lord, have mercy on them as they raised me when I was small.',
    source: 'Quran 17:24',
    action: 'Call your parents today. If they have passed, make dua for them by name.',
  },
  {
    area: 'faith',
    quote: 'When My servants ask you about Me, I am near. I answer the call of the one who calls on Me.',
    source: 'Quran 2:186',
    action: 'Make one specific dua today about something you are working on.',
  },
  {
    area: 'health',
    quote: 'We suffer more often in imagination than in reality.',
    source: 'Seneca · Letters 13',
    action: 'Write down your biggest worry, then what you would actually do if it happened.',
  },
  {
    area: 'growth',
    quote: 'Whoever takes a path seeking knowledge, Allah makes easy for them a path to Paradise.',
    source: 'Prophet Muhammad ﷺ · Muslim 2699',
    action: 'Swap 20 minutes of scrolling for a book, a course or a lecture.',
  },
  {
    area: 'money',
    quote: 'Real wealth is not having many possessions. Real wealth is the richness of the soul.',
    source: 'Prophet Muhammad ﷺ · Bukhari 6446',
    action: 'Skip one purchase today that you only wanted for the feeling.',
  },
  {
    area: 'work',
    quote: 'Lost time is never found again.',
    source: 'Benjamin Franklin',
    action: 'Start your first real task within 30 minutes of waking.',
  },
  {
    area: 'family',
    quote: 'If you want to go fast, go alone. If you want to go far, go together.',
    source: 'Proverb',
    action: 'Plan one thing to do together this weekend and put it in your Plan.',
  },
  {
    area: 'faith',
    quote: 'So surely with hardship comes ease. Surely with hardship comes ease.',
    source: 'Quran 94:5–6',
    action: 'Write down one hard thing you are carrying, and one ease already inside it.',
  },
  {
    area: 'growth',
    quote: 'The first principle is that you must not fool yourself, and you are the easiest person to fool.',
    source: 'Richard Feynman · 1974',
    action: 'In tonight’s check-in, write the honest version, not the flattering one.',
  },
  {
    area: 'work',
    quote: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.',
    source: 'Antoine de Saint-Exupéry',
    action: 'Delete one task from your list that does not matter. Do not move it. Delete it.',
  },
  {
    area: 'family',
    quote: 'Whoever does not thank people has not thanked Allah.',
    source: 'Prophet Muhammad ﷺ · Abu Dawud 4811',
    action: 'Thank someone at home for something they do that usually goes unnoticed.',
  },
  {
    area: 'growth',
    quote: 'Everything can be taken from a man but one thing: the last of the human freedoms, to choose one’s attitude.',
    source: 'Viktor Frankl · Man’s Search for Meaning',
    action: 'Choose your attitude for the day before you open your messages.',
  },
  {
    area: 'faith',
    quote: 'The most beloved deeds to Allah are the most consistent ones, even if they are small.',
    source: 'Prophet Muhammad ﷺ · Bukhari 6464',
    action: 'Shrink one habit until it is impossible to skip. One page. One minute.',
  },
];

export const INSIGHTS = LIST;
export const insightFor = (dayNum: number) => LIST[((dayNum % LIST.length) + LIST.length) % LIST.length];
