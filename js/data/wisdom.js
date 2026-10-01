// One idea per day. Each has a source and one thing to do with it today.
// Quran and hadith are rendered as plain modern English meanings, not literal translations.
// Wisdom from beyond the Muslim world is included on purpose: truth is truth wherever it is found.

const QURAN = [
  {
    q: 'Is the reward for excellence anything but excellence?',
    by: 'Quran 55:60',
    do: 'Pick one ordinary task today and do it at your absolute best, even if nobody will ever see it.',
  },
  {
    q: 'So surely with hardship comes ease. Surely with hardship comes ease.',
    by: 'Quran 94:5–6',
    do: 'Write down one hard thing you are carrying. Next to it, write one ease that is already inside it.',
  },
  {
    q: 'Allah does not burden a soul beyond what it can bear.',
    by: 'Quran 2:286',
    do: 'Whatever is heavy today, you were built for it. Take the next step, not the whole staircase.',
  },
  {
    q: 'Allah does not change the condition of a people until they change what is in themselves.',
    by: 'Quran 13:11',
    do: 'Pick one habit you keep blaming on circumstances. Change the first five minutes of it today.',
  },
  {
    q: 'A person gets nothing except what they strive for.',
    by: 'Quran 53:39',
    do: 'Put one hour on your calendar today for the thing you keep saying matters.',
  },
  {
    q: 'So remember Me, and I will remember you.',
    by: 'Quran 2:152',
    do: 'Tie dhikr to a trigger: say Alhamdulillah every time you wait today. Queues, lifts, loading screens.',
  },
  {
    q: 'Truly, in the remembrance of Allah hearts find rest.',
    by: 'Quran 13:28',
    do: 'Next time you reach for your phone to calm down, do 33 SubhanAllah first. Notice which one actually works.',
  },
  {
    q: 'If you are grateful, I will surely give you more.',
    by: 'Quran 14:7',
    do: 'Send someone a specific thank-you today. Name exactly what they did.',
  },
  {
    q: 'Whoever puts their trust in Allah, He is enough for them.',
    by: 'Quran 65:3',
    do: 'Do your part fully on the thing that worries you. Then hand the outcome over and stop replaying it.',
  },
  {
    q: 'Perhaps you dislike something and it is good for you, and perhaps you love something and it is bad for you.',
    by: 'Quran 2:216',
    do: 'Remember one past “no” that turned out to be protection. Let it soften today’s disappointment.',
  },
  {
    q: 'Do not despair of the mercy of Allah. Allah forgives all sins.',
    by: 'Quran 39:53',
    do: 'Whatever you slipped on yesterday, today is a clean page. Say Astaghfirullah 100 times and move.',
  },
  {
    q: 'Seek help through patience and prayer.',
    by: 'Quran 2:45',
    do: 'When stress spikes today, make wudu and pray two rakʿahs before you react.',
  },
  {
    q: 'And speak to people kindly.',
    by: 'Quran 2:83',
    do: 'Rewrite one message before you send it today. Make it kinder without making it weaker.',
  },
  {
    q: 'Repel evil with what is better, and the one who was your enemy becomes like a close friend.',
    by: 'Quran 41:34',
    do: 'Answer one cold person with warmth today and watch what happens.',
  },
  {
    q: 'Avoid much suspicion. Some suspicion is a sin. And do not spy on one another.',
    by: 'Quran 49:12',
    do: 'When you assume the worst about someone today, write down three kinder explanations.',
  },
  {
    q: 'By time. Surely humanity is in loss, except those who believe, do good, and urge one another to truth and to patience.',
    by: 'Quran 103:1–3',
    do: 'Check your screen time tonight. Which of those hours will you be glad you spent?',
  },
  {
    q: 'Your Lord has not abandoned you, and He is not displeased.',
    by: 'Quran 93:3',
    do: 'If you have felt far from Allah lately, say so in your own words in sujood today.',
  },
  {
    q: 'When My servants ask you about Me, I am near. I answer the call of the one who calls on Me.',
    by: 'Quran 2:186',
    do: 'Make one specific, bold dua today. Ask like you mean it.',
  },
  {
    q: 'Eat and drink, but do not waste.',
    by: 'Quran 7:31',
    do: 'Stop at two-thirds full at one meal today. Notice your energy afterwards.',
  },
  {
    q: 'Whoever saves one life, it is as if they saved all of humanity.',
    by: 'Quran 5:32',
    do: 'Do one thing today for someone you will never meet: donate, share, or sign up.',
  },
  {
    q: 'My Lord, increase me in knowledge.',
    by: 'Quran 20:114',
    do: 'Learn one thing deeply for 20 minutes today. No skimming.',
  },
  {
    q: 'Do not let your hatred of a people lead you to injustice. Be just. That is closer to God-consciousness.',
    by: 'Quran 5:8',
    do: 'Say one fair thing about someone you disagree with today.',
  },
  {
    q: 'We have made the Quran easy to remember. So is there anyone who will remember?',
    by: 'Quran 54:17',
    do: 'Read one page of Quran today with its meaning. Just one.',
  },
  {
    q: 'Prayer keeps a person away from shameful and wrong deeds.',
    by: 'Quran 29:45',
    do: 'Pray one prayer today with full presence. Phone in another room, no rush.',
  },
  {
    q: 'He is with you wherever you are.',
    by: 'Quran 57:4',
    do: 'Act today as if you are being seen, because you are. Especially when nobody else is watching.',
  },
  {
    q: 'O you who believe, why do you say what you do not do?',
    by: 'Quran 61:2',
    do: 'Find one promise you have not kept. Keep it today, or own it honestly.',
  },
  {
    q: 'Lower to them the wing of humility out of mercy, and say: My Lord, have mercy on them as they raised me when I was small.',
    by: 'Quran 17:24',
    do: 'Call your parents today. If they have passed, make dua for them by name.',
  },
  {
    q: 'The most noble of you in the sight of Allah is the most mindful of Him.',
    by: 'Quran 49:13',
    do: 'Notice when you rank people by status today. Rank them by character instead.',
  },
];

const HADITH = [
  {
    q: 'Ihsan is to worship Allah as though you see Him. And if you do not see Him, He sees you.',
    by: 'Prophet Muhammad ﷺ · Bukhari 50',
    do: 'Choose one prayer today and pray it as if you can see Him. That is the whole point of this app.',
  },
  {
    q: 'Actions are only by intentions, and everyone gets what they intended.',
    by: 'Prophet Muhammad ﷺ · Bukhari 1',
    do: 'Before you start work today, say your intention out loud. Why are you really doing this?',
  },
  {
    q: 'The most beloved deeds to Allah are the most consistent ones, even if they are small.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6464',
    do: 'Shrink one habit until it is impossible to skip. One page. One minute. Then never miss.',
  },
  {
    q: 'The strong one is not the one who wrestles others down. The strong one controls himself when angry.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6114',
    do: 'Next time you feel the heat rising, stay silent for ten seconds. If you are standing, sit down.',
  },
  {
    q: 'Take advantage of five before five: your youth before old age, health before sickness, wealth before poverty, free time before busyness, and life before death.',
    by: 'Prophet Muhammad ﷺ · al-Hakim, sahih',
    do: 'Which of the five do you have most of right now? Spend some of it on purpose today.',
  },
  {
    q: 'Two blessings most people are cheated out of: health and free time.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6412',
    do: 'Find your most wasted 30 minutes today and give them one job.',
  },
  {
    q: 'None of you truly believes until he loves for his brother what he loves for himself.',
    by: 'Prophet Muhammad ﷺ · Bukhari 13',
    do: 'Celebrate someone else’s win today, publicly and sincerely.',
  },
  {
    q: 'Your smile in the face of your brother is charity.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 1956',
    do: 'Smile first at three people today. Count them.',
  },
  {
    q: 'Whoever believes in Allah and the Last Day, let him say something good or stay silent.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6018',
    do: 'Before you comment or post today, ask: is it good? If not, skip it.',
  },
  {
    q: 'The strong believer is better and more beloved to Allah than the weak believer, and there is good in both. Strive for what benefits you, seek Allah’s help, and do not give up.',
    by: 'Prophet Muhammad ﷺ · Muslim 2664',
    do: 'Train your body today. Strength is part of the deen.',
  },
  {
    q: 'Be in this world as if you were a stranger or a traveller.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6416',
    do: 'Pick one thing you own and do not need. Give it away this week.',
  },
  {
    q: 'Allah loves that when one of you does a job, you do it with excellence.',
    by: 'Prophet Muhammad ﷺ · al-Bayhaqi, hasan',
    do: 'Spend ten extra minutes polishing one piece of work today. That is ihsan.',
  },
  {
    q: 'Make things easy and do not make them hard. Give good news and do not drive people away.',
    by: 'Prophet Muhammad ﷺ · Bukhari 69',
    do: 'Make someone’s day easier: reply quickly, simplify a request, or quietly cover a small task.',
  },
  {
    q: 'Part of the excellence of a person’s Islam is leaving what does not concern him.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 2317',
    do: 'Mute one account or group chat that feeds your curiosity but not your growth.',
  },
  {
    q: 'Tie your camel, then put your trust in Allah.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 2517',
    do: 'List what is in your control on today’s biggest worry. Do those. Leave the rest to Allah.',
  },
  {
    q: 'If the Hour arrives while one of you is holding a sapling, let him plant it.',
    by: 'Prophet Muhammad ﷺ · al-Adab al-Mufrad 479',
    do: 'Start something today whose benefit you may never see.',
  },
  {
    q: 'Allah does not look at your appearance or your wealth. He looks at your hearts and your deeds.',
    by: 'Prophet Muhammad ﷺ · Muslim 2564',
    do: 'Do one good deed today that nobody will ever know about.',
  },
  {
    q: 'The best of people are those most beneficial to people.',
    by: 'Prophet Muhammad ﷺ · al-Tabarani, hasan',
    do: 'Ask someone today, “What is one thing I could help you with?” Then do it.',
  },
  {
    q: 'How wonderful is the affair of the believer. If good comes, he is grateful, and that is good for him. If harm comes, he is patient, and that is good for him.',
    by: 'Prophet Muhammad ﷺ · Muslim 2999',
    do: 'Whatever happens today, label it gratitude or patience. Both are wins.',
  },
  {
    q: 'Charity never decreases wealth.',
    by: 'Prophet Muhammad ﷺ · Muslim 2588',
    do: 'Give something today, even something small. Automate it if you can.',
  },
  {
    q: 'Whoever takes a path seeking knowledge, Allah makes easy for him a path to Paradise.',
    by: 'Prophet Muhammad ﷺ · Muslim 2699',
    do: 'Swap 20 minutes of scrolling for a lecture, a book, or a course today.',
  },
  {
    q: 'The best of you are those who are best to their families.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 3895',
    do: 'Give your family your full attention for one meal today. Phones away.',
  },
  {
    q: 'Do not belittle any good deed, even meeting your brother with a cheerful face.',
    by: 'Prophet Muhammad ﷺ · Muslim 2626',
    do: 'Do three tiny good deeds today. Skip none for being too small.',
  },
  {
    q: 'Allah is beautiful and loves beauty.',
    by: 'Prophet Muhammad ﷺ · Muslim 91',
    do: 'Make one space you use every day cleaner and more beautiful.',
  },
  {
    q: 'Leave what makes you doubt for what does not make you doubt.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 2518',
    do: 'If you are unsure whether something is right, skip it today. Feel how light that is.',
  },
  {
    q: 'Whoever does not thank people has not thanked Allah.',
    by: 'Prophet Muhammad ﷺ · Abu Dawud 4811',
    do: 'Thank someone who usually goes unthanked: a cleaner, a driver, your mum.',
  },
  {
    q: 'A person’s feet will not move on the Day of Judgement until he is asked about his life and how he spent it, his knowledge and what he did with it, his wealth and how he earned and spent it, and his body and how he used it.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 2417',
    do: 'Run tonight’s review against those four questions.',
  },
  {
    q: 'Your body has a right over you.',
    by: 'Prophet Muhammad ﷺ · Bukhari 5199',
    do: 'Sleep earlier tonight. With the right intention, rest is worship.',
  },
  {
    q: 'Allah is gentle and loves gentleness in all things.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6927',
    do: 'Lower your voice in one tense conversation today.',
  },
  {
    q: 'Whoever wakes up safe in his home, healthy in his body, with food for the day, it is as if the whole world has been given to him.',
    by: 'Prophet Muhammad ﷺ · Tirmidhi 2346',
    do: 'Check the three: safe, healthy, fed. If yes, today is already a win.',
  },
  {
    q: 'Do not get angry.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6116',
    do: 'Name your usual anger trigger and decide your response now, before it happens.',
  },
  {
    q: 'Wealth is not having many possessions. Real wealth is the richness of the soul.',
    by: 'Prophet Muhammad ﷺ · Bukhari 6446',
    do: 'Skip one purchase today that you only wanted for the feeling.',
  },
];

const HERITAGE = [
  {
    q: 'Wasting time is worse than death. Death cuts you off from this world and its people. Wasting time cuts you off from Allah and the Hereafter.',
    by: 'Ibn al-Qayyim · al-Fawaʾid',
    do: 'Block your day around the five prayers. Give every block one job.',
  },
  {
    q: 'The heart on its journey to Allah is like a bird. Love is its head, and fear and hope are its two wings.',
    by: 'Ibn al-Qayyim · Madarij al-Salikin',
    do: 'Check your balance today. Running on fear, hope, or love? Feed the one that is low.',
  },
  {
    q: 'Son of Adam, you are nothing but a number of days. Each time a day passes, part of you is gone.',
    by: 'al-Hasan al-Basri',
    do: 'Ask tonight: what did I trade today for?',
  },
  {
    q: 'If you do not keep your soul busy with what is true, it will keep you busy with what is false.',
    by: 'Imam al-Shafiʿi',
    do: 'Plan tonight’s free hour before it arrives.',
  },
  {
    q: 'Hold yourselves to account before you are held to account.',
    by: 'ʿUmar ibn al-Khattab',
    do: 'Do tonight’s 60-second review in the Reflect tab.',
  },
  {
    q: 'Today is action without reckoning. Tomorrow is reckoning without action.',
    by: 'ʿAli ibn Abi Talib · in Sahih al-Bukhari',
    do: 'Do the thing you keep postponing for “later” today.',
  },
  {
    q: 'Knowledge without action is madness, and action without knowledge does not happen.',
    by: 'al-Ghazali · Ayyuha al-Walad',
    do: 'Take one thing you already know and actually apply it today.',
  },
  {
    q: 'What can my enemies do to me? My paradise is in my heart. It goes with me wherever I go.',
    by: 'Ibn Taymiyyah · via Ibn al-Qayyim',
    do: 'Whatever people say about you today, guard what is inside.',
  },
  {
    q: 'Dhikr is to the heart what water is to a fish. What happens to a fish when it leaves the water?',
    by: 'Ibn Taymiyyah · via Ibn al-Qayyim',
    do: 'Keep your tongue busy with dhikr on your commute today.',
  },
  {
    q: 'The past resembles the future more than one drop of water resembles another.',
    by: 'Ibn Khaldun · al-Muqaddimah',
    do: 'Look at last week. That is your forecast for next week, unless you change one thing today.',
  },
  {
    q: 'Education is our passport to the future, for tomorrow belongs to the people who prepare for it today.',
    by: 'Malcolm X · 1964',
    do: 'Spend 30 minutes today on a skill your future self will thank you for.',
  },
  {
    q: 'Knowledge is not in narrating a lot. Knowledge is a light that Allah places in the heart.',
    by: 'Imam Malik',
    do: 'Read less today and reflect more. One verse, ten minutes of thinking.',
  },
  {
    q: 'With the inkwell until the grave.',
    by: 'Imam Ahmad ibn Hanbal · attributed',
    do: 'Never finish learning. Start a new book this week.',
  },
];

const WORLD = [
  {
    q: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.',
    by: 'Antoine de Saint-Exupéry',
    do: 'Remove one thing from your day that adds nothing.',
  },
  {
    q: 'The impediment to action advances action. What stands in the way becomes the way.',
    by: 'Marcus Aurelius · Meditations 5.20',
    do: 'Take today’s biggest obstacle and treat it as the actual task.',
  },
  {
    q: 'Waste no more time arguing about what a good man should be. Be one.',
    by: 'Marcus Aurelius · Meditations 10.16',
    do: 'Skip the debate today. Do the good thing quietly.',
  },
  {
    q: 'It is not that we have a short time to live, but that we waste much of it.',
    by: 'Seneca · On the Shortness of Life',
    do: 'Hide one app that eats your time, even if only for this week.',
  },
  {
    q: 'We suffer more often in imagination than in reality.',
    by: 'Seneca · Letters 13',
    do: 'Write down your worst-case worry, then what you would actually do. Watch it shrink.',
  },
  {
    q: 'Hold every hour in your grasp. Lay hold of today’s task, and you will not need to depend so much on tomorrow’s.',
    by: 'Seneca · Letters 1',
    do: 'Finish today’s task today. Do not borrow from tomorrow.',
  },
  {
    q: 'People are not disturbed by things, but by the views they take of them.',
    by: 'Epictetus · Enchiridion 5',
    do: 'Reframe one annoyance today. What is the most generous story behind it?',
  },
  {
    q: 'The noble person seeks it in himself. The small person seeks it in others.',
    by: 'Confucius · Analects 15.21',
    do: 'When something goes wrong today, ask “what was my part?” first.',
  },
  {
    q: 'A journey of a thousand miles begins beneath one’s feet.',
    by: 'Lao Tzu · Tao Te Ching 64',
    do: 'Take the first, smallest, slightly embarrassing step on something big today.',
  },
  {
    q: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.',
    by: 'Will Durant, on Aristotle',
    do: 'Choose one daily action that, repeated for a year, would change your life. Start it today.',
  },
  {
    q: 'Everything can be taken from a man but one thing: the last of the human freedoms, to choose one’s attitude in any given set of circumstances.',
    by: 'Viktor Frankl · Man’s Search for Meaning',
    do: 'Choose your attitude for the day before you open your messages.',
  },
  {
    q: 'He who has a why to live can bear almost any how.',
    by: 'Friedrich Nietzsche',
    do: 'Write your why in one sentence. Make it your lock screen.',
  },
  {
    q: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    by: 'James Clear · Atomic Habits',
    do: 'Design your space: put the Quran, the gym bag, or the book where you will trip over it.',
  },
  {
    q: 'Desire is a contract you make with yourself to be unhappy until you get what you want.',
    by: 'Naval Ravikant',
    do: 'Drop one want today. Feel the contract cancel.',
  },
  {
    q: 'Focusing is about saying no.',
    by: 'Steve Jobs · 1997',
    do: 'Say no to one good thing today to protect a great one.',
  },
  {
    q: 'Lost time is never found again.',
    by: 'Benjamin Franklin',
    do: 'Start your first real task within ten minutes of Fajr. Momentum is everything.',
  },
  {
    q: 'The first principle is that you must not fool yourself, and you are the easiest person to fool.',
    by: 'Richard Feynman · 1974',
    do: 'In tonight’s review, write the honest version, not the flattering one.',
  },
  {
    q: 'How we spend our days is, of course, how we spend our lives.',
    by: 'Annie Dillard · The Writing Life',
    do: 'Design today like you would design your life. Three priorities, maximum.',
  },
  {
    q: 'Fall seven times, stand up eight.',
    by: 'Japanese proverb',
    do: 'Restart one habit you dropped. No guilt, just restart.',
  },
  {
    q: 'Work is love made visible.',
    by: 'Kahlil Gibran · The Prophet',
    do: 'Do your work today as a gift to one specific person.',
  },
  {
    q: 'Tell me, what is it you plan to do with your one wild and precious life?',
    by: 'Mary Oliver · The Summer Day',
    do: 'Answer that question in one line tonight.',
  },
  {
    q: 'If you want to go fast, go alone. If you want to go far, go together.',
    by: 'Proverb',
    do: 'Find a partner for one good habit this week: the gym, the Quran, a Fajr wake-up call.',
  },
  {
    q: 'Do every act of your life as though it were the very last act of your life.',
    by: 'Marcus Aurelius · Meditations 2.5',
    do: 'Pray one prayer today as if it were your last. The Prophet ﷺ advised the same.',
  },
  {
    q: 'The unexamined life is not worth living.',
    by: 'Socrates · Plato’s Apology',
    do: 'Sixty seconds tonight. Win, fix, gratitude.',
  },
];

export const SOURCES = { quran: 'Quran', hadith: 'Hadith', heritage: 'Muslim heritage', world: 'World wisdom' };

// Round-robin so the source changes every day.
function interleave(groups) {
  const out = [];
  const max = Math.max(...Object.values(groups).map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const [t, list] of Object.entries(groups)) if (list[i]) out.push({ t, ...list[i] });
  }
  return out;
}

export const WISDOM = interleave({ quran: QURAN, hadith: HADITH, world: WORLD, heritage: HERITAGE });

export const wisdomFor = (dayNum) => WISDOM[((dayNum % WISDOM.length) + WISDOM.length) % WISDOM.length];
