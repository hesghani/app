// The event calendar the agent plans with. Not just the big retail holidays:
// school days and spirit weeks, awareness months, profession weeks, sports
// seasons, heritage months, fun "national days" and current trends, each
// with when shoppers start buying, who buys, and what to make.
//
// Dates are US dates unless the name says otherwise. `lead` is how many days
// before the event shoppers start buying: group orders for school events
// (teachers, PTAs, teams) come 2–4 weeks ahead; gift holidays 4–8 weeks.

import { addDays } from './dates';
import type { ProductType } from './products';

export type EventKind = 'school' | 'awareness' | 'profession' | 'sports' | 'holiday' | 'heritage' | 'fun' | 'trend' | 'season';

export interface MerchEvent {
  id: string;
  name: string;
  kind: EventKind;
  /** First day of the event in a year, YYYY-MM-DD; null when unknown for that year. */
  date: (y: number) => string | null;
  /** How many days it lasts (a month, a week, a season). */
  days: number;
  /** Shoppers start buying this many days before it starts. */
  lead: number;
  /** 1 = small niche, 2 = mid, 3 = huge (everyone uploads for it). */
  size: 1 | 2 | 3;
  /** Matches design titles (lowercase, accents removed). */
  match: RegExp;
  who: string;
  ideas: string[];
  types?: ProductType[];
  /** Trademark or wording caution. */
  caution?: string;
  /** Trends fade: not planned after this date. */
  until?: string;
}

const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().slice(0, 10);
};

/** The n-th weekday (0 = Sunday) of a month. */
export function nth(y: number, m: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

/** The last weekday (0 = Sunday) of a month. */
export function last(y: number, m: number, weekday: number): string {
  const end = new Date(Date.UTC(y, m, 0));
  const back = (end.getUTCDay() - weekday + 7) % 7;
  return iso(y, m, end.getUTCDate() - back);
}

/** Western Easter Sunday. */
export function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return iso(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}

/** Monday of the first full week (Mon–Fri) of a month. */
function firstFullWeek(y: number, m: number): string {
  return nth(y, m, 1, 1);
}

/** Unity Day: Wednesday of the third full week of October (weeks starting Sunday). */
function unityDay(y: number): string {
  const firstSunday = nth(y, 10, 0, 1);
  return addDays(firstSunday, 14 + 3);
}

const fixed = (m: number, d: number) => (y: number) => iso(y, m, d);
const table = (dates: Record<number, string>) => (y: number) => dates[y] ?? null;

const SCHOOL_TYPES: ProductType[] = ['STANDARD_TSHIRT', 'LONG_SLEEVE', 'SWEATSHIRT', 'RAGLAN'];
const COZY: ProductType[] = ['SWEATSHIRT', 'HOODIE', 'LONG_SLEEVE'];
const TEE: ProductType[] = ['STANDARD_TSHIRT', 'PREMIUM_TSHIRT', 'VALUE_TSHIRT'];

export const EVENTS: MerchEvent[] = [
  // ---------- school ----------
  { id: 'back-to-school', name: 'Back to School / First Day', kind: 'school', date: fixed(8, 1), days: 40, lead: 21, size: 2,
    match: /\b(?:back to school|first day of (?:school|kinder\w*|pre ?k|\w+ grade)|new school year|hello (?:kinder\w*|\w+ grade))\b/,
    who: 'Teachers, parents of kids starting a grade, school staff', ideas: ['Hello 1st grade', 'Teacher first day squad', 'Ready to crush kindergarten', 'Back to school teacher team'], types: SCHOOL_TYPES },
  { id: 'dot-day', name: 'International Dot Day', kind: 'school', date: fixed(9, 15), days: 1, lead: 28, size: 1,
    match: /\b(?:dot day|make your mark|polka dots? day|happy dot)\b/,
    who: 'Elementary teachers and art teachers ordering class shirts', ideas: ['Make your mark Dot Day teacher', 'Dot Day 2027 polka dots', 'Dot Day art teacher', 'Just dot it Dot Day kids'], types: SCHOOL_TYPES,
    caution: '"The Dot" is a book title: use Dot Day and polka dots, not the book’s art or characters.' },
  { id: 'orange-shirt-day', name: 'Orange Shirt Day (Canada, Sept 30)', kind: 'awareness', date: fixed(9, 30), days: 1, lead: 28, size: 1,
    match: /\b(?:orange shirt day|every child matters|truth and reconciliation)\b/,
    who: 'Canadian schools and staff (sell on Amazon.com and Amazon.ca shoppers)', ideas: ['Every child matters orange', 'Orange shirt day feather', 'Truth and reconciliation day'], types: ['STANDARD_TSHIRT', 'LONG_SLEEVE'],
    caution: 'Respectful designs only: this day honors residential school survivors.' },
  { id: 'unity-day', name: 'Unity Day (wear orange, anti-bullying)', kind: 'school', date: unityDay, days: 1, lead: 28, size: 1,
    match: /\b(?:unity day|anti bullying|stop bullying|choose kind(?:ness)?|be kind|kindness (?:matters|club)|bully prevention)\b/,
    who: 'Schools, counselors and PTAs ordering orange shirts for Bullying Prevention Month', ideas: ['Unity Day orange together against bullying', 'Choose kind unity', 'Kindness is my superpower orange', 'Counselor unity day'], types: SCHOOL_TYPES },
  { id: 'red-ribbon', name: 'Red Ribbon Week', kind: 'school', date: fixed(10, 23), days: 9, lead: 28, size: 1,
    match: /\b(?:red ribbon|drug free|say no to drugs|i choose to be drug free)\b/,
    who: 'Schools and counselors (Oct 23–31)', ideas: ['Red Ribbon Week 2027', 'Drug free and loving it', 'Life is my natural high', 'Team red ribbon teacher'], types: SCHOOL_TYPES },
  { id: 'pink-out', name: 'Pink Out games (Breast Cancer Awareness)', kind: 'sports', date: fixed(10, 1), days: 31, lead: 30, size: 2,
    match: /\b(?:pink out|breast cancer|pink ribbon|tackle (?:breast )?cancer|in october we wear pink|fight like a girl|survivor)\b/,
    who: 'High school teams, cheer squads, booster clubs and fans in October', ideas: ['In October we wear pink football', 'Tackle breast cancer volleyball', 'Pink out game day mom', 'Cheer for the cure'], types: ['STANDARD_TSHIRT', 'LONG_SLEEVE', 'HOODIE', 'SWEATSHIRT'] },
  { id: 'homecoming', name: 'Homecoming & Spirit Week', kind: 'school', date: fixed(9, 15), days: 50, lead: 21, size: 2,
    match: /\b(?:homecoming|spirit week|spirit day|school spirit|go team|class of 20\d\d|senior(?:s)? 20\d\d)\b/,
    who: 'Students, alumni, parents; spirit week themes like twin day, decades day, pajama day', ideas: ['Twin day twinning', 'Decades day 80s', 'Senior 2027', 'Homecoming spirit week squad'], types: SCHOOL_TYPES },
  { id: 'game-day', name: 'Football Game Day season', kind: 'sports', date: fixed(8, 20), days: 105, lead: 21, size: 2,
    match: /\b(?:game day|football (?:mom|dad|season|grandma|sister)|friday night lights|touchdown|gridiron|tailgat\w*|cheer mom|band mom|marching band)\b/,
    who: 'Football moms and dads, cheer and band families, tailgaters (Aug–Nov, plus playoffs)', ideas: ['Game day vibes football', 'Loud proud football mom', 'Friday night lights band mom', 'Cheer mom game day'], types: ['STANDARD_TSHIRT', 'LONG_SLEEVE', 'HOODIE', 'SWEATSHIRT', 'TRUCKER_HAT'] },
  { id: 'volleyball', name: 'Volleyball season', kind: 'sports', date: fixed(8, 15), days: 100, lead: 14, size: 1,
    match: /\b(?:volleyball|setter|libero|dig it|spike)\b/, who: 'Players, volleyball moms, coaches (Aug–Nov)', ideas: ['Volleyball mom', 'Libero life', 'Just a girl who loves volleyball'] },
  { id: 'wrestling', name: 'Wrestling season', kind: 'sports', date: fixed(11, 10), days: 110, lead: 14, size: 1,
    match: /\b(?:wrestl\w*|takedown|singlet)\b/, who: 'Wrestlers and wrestling moms (Nov–Feb)', ideas: ['Wrestling mom', 'Takedown season', 'Proud wrestling grandma'], types: COZY },
  { id: 'basketball', name: 'Basketball season', kind: 'sports', date: fixed(11, 15), days: 120, lead: 14, size: 2,
    match: /\b(?:basketball|hoops|ballin|hooper)\b/, who: 'Players, basketball moms and dads (Nov–Mar)', ideas: ['Basketball mom', 'Hooper era', 'Ball is life'] },
  { id: 'soccer', name: 'Soccer season', kind: 'sports', date: fixed(8, 20), days: 90, lead: 14, size: 1,
    match: /\b(?:soccer|futbol|goalie|goalkeeper)\b/, who: 'Players and soccer parents (fall and spring)', ideas: ['Soccer mom', 'Goalie life', 'Soccer is my therapy'] },
  { id: 'softball-baseball', name: 'Baseball & Softball season', kind: 'sports', date: fixed(3, 1), days: 110, lead: 21, size: 2,
    match: /\b(?:baseball|softball|t ?ball|tee ball|dugout|home run)\b/, who: 'Ball moms, dads and grandparents (Mar–Jun)', ideas: ['Baseball mom', 'Softball grandma', 'Dirt bows and bases'], types: ['STANDARD_TSHIRT', 'TRUCKER_HAT', 'RAGLAN'] },
  { id: 'hundredth-day', name: '100th Day of School', kind: 'school', date: fixed(1, 28), days: 18, lead: 21, size: 2,
    match: /\b(?:100(?:th)? days?(?: of school)?|100 days (?:smarter|brighter|of)|one hundred days)\b/,
    who: 'Teachers and parents (late Jan–mid Feb, depends on the district)', ideas: ['100 days smarter', '100 days of school teacher', 'Happy 100th day', '100 days brighter'], types: SCHOOL_TYPES },
  { id: 'read-across', name: 'Read Across America (Mar 2)', kind: 'school', date: fixed(3, 2), days: 1, lead: 28, size: 1,
    match: /\b(?:read across america|reading is (?:my|a)|bookworm|book lover teacher|reading teacher)\b/,
    who: 'Teachers and librarians during National Reading Month', ideas: ['Read across America teacher', 'Reading is my superpower', 'Librarian reading month'], types: SCHOOL_TYPES,
    caution: 'Avoid Dr. Seuss names, quotes and characters (trademarked).' },
  { id: 'pi-day', name: 'Pi Day (Mar 14)', kind: 'school', date: fixed(3, 14), days: 1, lead: 21, size: 1,
    match: /\b(?:pi day|3\.14|pi symbol|math teacher)\b/, who: 'Math teachers, STEM students', ideas: ['Pi day math teacher', 'Happy pi day 3.14', 'Easy as pi'] },
  { id: 'testing', name: 'Testing season', kind: 'school', date: fixed(4, 10), days: 35, lead: 21, size: 1,
    match: /\b(?:test day|testing (?:season|day)|rock the test|state test(?:ing)?|staar|show what you know)\b/,
    who: 'Teachers and students during state testing (Apr–May)', ideas: ['Rock the test', 'Test day vibes teacher', 'Show what you know', 'Proctor squad'], types: SCHOOL_TYPES },
  { id: 'field-day', name: 'Field Day', kind: 'school', date: fixed(5, 10), days: 30, lead: 21, size: 1,
    match: /\b(?:field day)\b/, who: 'PE teachers, classes and PTAs (May–June)', ideas: ['Field day 2027', 'PE teacher field day crew', 'Field day squad'], types: ['STANDARD_TSHIRT', 'TANK', 'VALUE_TSHIRT'] },
  { id: 'last-day', name: 'Last Day of School', kind: 'school', date: fixed(5, 22), days: 25, lead: 21, size: 2,
    match: /\b(?:last day of school|schools out|school's out|summer break|bye bruh|peace out \w+ grade|so long \w+ grade)\b/,
    who: 'Teachers and kids (late May–June)', ideas: ["Peace out 2nd grade", 'Bye bruh last day of school', "Schools out for summer teacher"], types: TEE },
  { id: 'kinder-grad', name: 'Kindergarten & Pre-K graduation', kind: 'school', date: fixed(5, 20), days: 25, lead: 28, size: 1,
    match: /\b(?:kindergarten graduat\w*|kinder grad|pre ?k grad\w*|preschool grad\w*)\b/, who: 'Parents and grandparents', ideas: ['Kindergarten grad 2027', 'Pre-K graduate', 'Proud mom of a kindergarten graduate'] },
  { id: 'graduation', name: 'Graduation (high school, college, nursing)', kind: 'school', date: fixed(5, 15), days: 35, lead: 35, size: 3,
    match: /\b(?:graduat\w*|class of 20\d\d|senior 20\d\d|grad 20\d\d)\b/, who: 'Families of graduates', ideas: ['Proud dad of a 2027 graduate', 'Senior 2027', 'Nurse grad 2027'] },

  // ---------- profession weeks ----------
  { id: 'teacher-week', name: 'Teacher Appreciation Week', kind: 'profession', date: (y) => firstFullWeek(y, 5), days: 5, lead: 30, size: 2,
    match: /\b(?:teachers?|teaching|educators?|para(?:professional)?|kindergarten teacher|\w+ grade teacher)\b/, who: 'Teachers, parents buying gifts, PTAs', ideas: ['Teach love inspire', 'Teacher off duty', 'In my teacher era'], types: SCHOOL_TYPES },
  { id: 'nurses-week', name: 'Nurses Week (May 6–12)', kind: 'profession', date: fixed(5, 6), days: 7, lead: 30, size: 2,
    match: /\b(?:nurses?|nursing|rn|cna|lpn|icu|er nurse|nicu|l&d|labor and delivery|nurse practitioner)\b/, who: 'Nurses, hospital units ordering team shirts', ideas: ['ICU nurse crew', 'NICU nurse', 'Nurse week 2027 squad'], types: ['STANDARD_TSHIRT', 'LONG_SLEEVE', 'SWEATSHIRT'] },
  { id: 'school-nurse', name: 'School Nurse Day', kind: 'profession', date: (y) => addDays(fixed(5, 6)(y), (10 - new Date(`${fixed(5, 6)(y)}T00:00:00Z`).getUTCDay()) % 7), days: 1, lead: 21, size: 1,
    match: /\b(?:school nurse)\b/, who: 'School nurses and districts', ideas: ['School nurse squad', 'Ice packs and band aids school nurse'] },
  { id: 'para-day', name: 'Paraprofessional Appreciation Day', kind: 'profession', date: (y) => nth(y, 4, 3, 1), days: 1, lead: 21, size: 1,
    match: /\b(?:para(?:professional|educator)?s?|teacher aide|teacher assistant|sped para)\b/, who: 'Paras and special-ed teams', ideas: ['Para squad', 'Paraprofessional appreciation', 'SPED para crew'] },
  { id: 'bus-driver', name: 'School Bus Driver Appreciation Day', kind: 'profession', date: (y) => nth(y, 4, 2, 4), days: 1, lead: 21, size: 1,
    match: /\b(?:bus driver|school bus)\b/, who: 'Drivers and transportation departments', ideas: ['School bus driver crew', 'Wheels on the bus driver'] },
  { id: 'lunch-hero', name: 'School Lunch Hero Day', kind: 'profession', date: (y) => nth(y, 5, 5, 1), days: 1, lead: 21, size: 1,
    match: /\b(?:lunch lady|lunch hero|cafeteria|lunch crew)\b/, who: 'Cafeteria staff', ideas: ['Lunch lady squad', 'School lunch hero'] },
  { id: 'counselor-week', name: 'School Counseling Week', kind: 'profession', date: (y) => firstFullWeek(y, 2), days: 5, lead: 21, size: 1,
    match: /\b(?:counselors?|school counsel\w*|counseling)\b/, who: 'School counselors', ideas: ['School counselor squad', "It's okay not to be okay counselor"] },
  { id: 'custodian', name: 'Custodian Appreciation Day (Oct 2)', kind: 'profession', date: fixed(10, 2), days: 1, lead: 21, size: 1,
    match: /\b(?:custodians?|janitors?|custodial crew)\b/, who: 'School custodial crews', ideas: ['Custodian crew', 'School custodian appreciation'] },
  { id: 'boss-day', name: "Boss's Day (Oct 16)", kind: 'profession', date: fixed(10, 16), days: 1, lead: 21, size: 1,
    match: /\b(?:boss(?:es)?(?: day| lady| babe)?|best boss)\b/, who: 'Teams buying gifts', ideas: ['Best boss ever', 'Boss lady'] },
  { id: 'admin-day', name: 'Administrative Professionals Day', kind: 'profession', date: (y) => addDays(last(y, 4, 6), -3), days: 1, lead: 21, size: 1,
    match: /\b(?:admin(?:istrative)? (?:assistant|professional)s?|secretary|school secretary|front office)\b/, who: 'Offices and schools', ideas: ['School secretary', 'Front office squad'] },
  { id: 'principal-day', name: "Principals' Day (May 1)", kind: 'profession', date: fixed(5, 1), days: 1, lead: 21, size: 1,
    match: /\b(?:principal|assistant principal|vice principal)\b/, who: 'Staff gifting principals', ideas: ['Principal life', 'Assistant principal crew'] },
  { id: 'ems-week', name: 'EMS Week', kind: 'profession', date: (y) => nth(y, 5, 0, 3), days: 7, lead: 21, size: 1,
    match: /\b(?:ems|emt|paramedic|first responder)\b/, who: 'EMTs, paramedics', ideas: ['EMS week crew', 'Paramedic life'] },
  { id: 'police-week', name: 'Police Week', kind: 'profession', date: (y) => addDays(fixed(5, 15)(y), -((new Date(`${fixed(5, 15)(y)}T00:00:00Z`).getUTCDay() + 6) % 7)), days: 7, lead: 21, size: 1,
    match: /\b(?:police|deputy|dispatcher|law enforcement)\b/, who: 'Officers, dispatchers, families', ideas: ['Dispatcher crew', 'Police wife'] },
  { id: 'social-work', name: 'Social Work Month (March)', kind: 'profession', date: fixed(3, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:social work(?:er)?s?|lcsw|msw)\b/, who: 'Social workers', ideas: ['Social worker squad', 'Social work month 2027'] },
  { id: 'ot-month', name: 'Occupational Therapy Month (April)', kind: 'profession', date: fixed(4, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:occupational therap\w*|\bota?\b|ot life)\b/, who: 'OTs and OTAs', ideas: ['OT life', 'Occupational therapy month'] },
  { id: 'slp-month', name: 'Better Hearing & Speech Month (May)', kind: 'profession', date: fixed(5, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:speech (?:therap\w*|language)|slp|audiolog\w*)\b/, who: 'SLPs and audiologists', ideas: ['SLP squad', 'Speech therapy crew'] },
  { id: 'pt-month', name: 'Physical Therapy Month (October)', kind: 'profession', date: fixed(10, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:physical therap\w*|\bpta?\b|physio)\b/, who: 'PTs and PTAs', ideas: ['Physical therapy month', 'PT crew'] },
  { id: 'rt-week', name: 'Respiratory Care Week', kind: 'profession', date: (y) => nth(y, 10, 0, 4), days: 7, lead: 21, size: 1,
    match: /\b(?:respiratory therap\w*|\brt\b)\b/, who: 'Respiratory therapists', ideas: ['Respiratory therapist crew'] },
  { id: 'lab-week', name: 'Lab Week (April)', kind: 'profession', date: (y) => addDays(last(y, 4, 6), -6), days: 7, lead: 21, size: 1,
    match: /\b(?:lab (?:tech|week|rat)|phlebotom\w*|medical lab|mls)\b/, who: 'Lab techs, phlebotomists', ideas: ['Lab week 2027', 'Phlebotomy crew'] },
  { id: 'rad-tech', name: 'Radiologic Technology Week (Nov 8)', kind: 'profession', date: fixed(11, 8), days: 7, lead: 21, size: 1,
    match: /\b(?:rad(?:iology)? tech|x ?ray tech|radiograph\w*|sonograph\w*|mri tech)\b/, who: 'Rad techs', ideas: ['Rad tech week', 'X-ray tech crew'] },
  { id: 'np-week', name: 'Nurse Practitioner Week (November)', kind: 'profession', date: (y) => nth(y, 11, 0, 2), days: 7, lead: 21, size: 1,
    match: /\b(?:nurse practitioner|\bnp\b|fnp)\b/, who: 'NPs', ideas: ['Nurse practitioner week'] },
  { id: 'dental', name: 'Dental Hygiene Month (October)', kind: 'profession', date: fixed(10, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:dental|hygienist|dentist|tooth|teeth)\b/, who: 'Dental offices', ideas: ['Dental hygienist squad', 'Dental crew Halloween'] },
  { id: 'vet-tech', name: 'Vet Tech Week (October)', kind: 'profession', date: (y) => nth(y, 10, 0, 3), days: 7, lead: 21, size: 1,
    match: /\b(?:vet tech|veterinar\w*|vet nurse)\b/, who: 'Vet techs and clinics', ideas: ['Vet tech week', 'Vet tech crew'] },
  { id: 'cna-week', name: 'CNA Week (June)', kind: 'profession', date: (y) => nth(y, 6, 4, 2), days: 7, lead: 21, size: 1,
    match: /\b(?:cna|nursing assistant)\b/, who: 'CNAs and nursing homes', ideas: ['CNA week 2027'] },
  { id: 'firefighter', name: "International Firefighters' Day (May 4)", kind: 'profession', date: fixed(5, 4), days: 1, lead: 21, size: 1,
    match: /\b(?:firefighters?|fire ?fighter|fire department|fireman)\b/, who: 'Firefighters and families', ideas: ['Firefighter wife', 'Firefighter crew'] },

  // ---------- awareness ----------
  { id: 'autism', name: 'Autism Acceptance Month (April)', kind: 'awareness', date: fixed(4, 1), days: 30, lead: 30, size: 2,
    match: /\b(?:autism|autistic|neurodivers\w*|asd|spectrum)\b/, who: 'Families, SPED teachers, therapists', ideas: ['Autism acceptance teacher', 'Neurodiversity infinity', 'SPED teacher autism acceptance'], types: SCHOOL_TYPES },
  { id: 'down-syndrome-day', name: 'World Down Syndrome Day (Mar 21, rock your socks)', kind: 'awareness', date: fixed(3, 21), days: 1, lead: 28, size: 1,
    match: /\b(?:down syndrome|t21|trisomy|extra chromosome|rock your socks)\b/, who: 'Families and schools', ideas: ['Rock your socks 3 21', 'Extra chromosome extra love'] },
  { id: 'down-syndrome-month', name: 'Down Syndrome Awareness Month (October)', kind: 'awareness', date: fixed(10, 1), days: 31, lead: 30, size: 1,
    match: /\b(?:down syndrome|t21|trisomy 21|extra chromosome)\b/, who: 'Families, buddy walks', ideas: ['Buddy walk team', 'Down syndrome awareness'] },
  { id: 'breast-cancer', name: 'Breast Cancer Awareness Month', kind: 'awareness', date: fixed(10, 1), days: 31, lead: 35, size: 2,
    match: /\b(?:breast cancer|pink ribbon|survivor|fight like a girl|in october we wear pink)\b/, who: 'Survivors, families, walk teams, workplaces', ideas: ['Her fight is our fight', 'Breast cancer walk team', 'Survivor pink ribbon'] },
  { id: 'adhd', name: 'ADHD Awareness Month (October)', kind: 'awareness', date: fixed(10, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:adhd|add brain)\b/, who: 'People with ADHD, parents', ideas: ['ADHD brain', 'ADHD awareness'] },
  { id: 'dyslexia', name: 'Dyslexia Awareness Month (October)', kind: 'awareness', date: fixed(10, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:dyslexi\w*)\b/, who: 'Reading specialists, families', ideas: ['Dyslexia teacher', 'Dyslexia awareness'] },
  { id: 'dv', name: 'Domestic Violence Awareness Month (October, purple)', kind: 'awareness', date: fixed(10, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:domestic violence|purple ribbon)\b/, who: 'Advocates, shelters', ideas: ['Domestic violence awareness purple ribbon'] },
  { id: 'pregnancy-loss', name: 'Pregnancy & Infant Loss Awareness (Oct 15)', kind: 'awareness', date: fixed(10, 15), days: 1, lead: 21, size: 1,
    match: /\b(?:infant loss|pregnancy loss|angel baby|miscarriage)\b/, who: 'Families', ideas: ['Wave of light'] },
  { id: 'childhood-cancer', name: 'Childhood Cancer Awareness Month (September, gold)', kind: 'awareness', date: fixed(9, 1), days: 30, lead: 28, size: 1,
    match: /\b(?:childhood cancer|gold ribbon|go gold)\b/, who: 'Families, schools, teams', ideas: ['Go gold childhood cancer', 'In September we wear gold'] },
  { id: 'suicide-prevention', name: 'Suicide Prevention Month (September)', kind: 'awareness', date: fixed(9, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:suicide prevention|you matter|stay here|semicolon)\b/, who: 'Schools, walk teams', ideas: ['You matter', 'Stay', 'Suicide prevention walk team'] },
  { id: 'diabetes', name: 'Diabetes Awareness Month (November)', kind: 'awareness', date: fixed(11, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:diabet\w*|t1d|type 1|insulin)\b/, who: 'T1D families, walk teams', ideas: ['T1D awareness', 'Type one fighter'] },
  { id: 'alzheimers', name: "Alzheimer's Awareness Month (November)", kind: 'awareness', date: fixed(11, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:alzheimer\w*|dementia|purple ribbon)\b/, who: 'Families, walk teams', ideas: ["Walk to end Alzheimer's team", 'I wear purple for my grandma'] },
  { id: 'prematurity', name: 'World Prematurity Day (Nov 17)', kind: 'awareness', date: fixed(11, 17), days: 1, lead: 21, size: 1,
    match: /\b(?:preemie|nicu|prematurity)\b/, who: 'NICU nurses, preemie families', ideas: ['NICU graduate', 'Preemie strong'] },
  { id: 'epilepsy', name: 'Epilepsy Awareness Month (November, purple)', kind: 'awareness', date: fixed(11, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:epilep\w*|seizure)\b/, who: 'Families', ideas: ['Epilepsy warrior'] },
  { id: 'heart-month', name: 'Heart Month & Wear Red Day', kind: 'awareness', date: (y) => nth(y, 2, 5, 1), days: 1, lead: 21, size: 1,
    match: /\b(?:heart (?:month|warrior|disease)|chd|wear red|go red)\b/, who: 'Heart warriors, workplaces', ideas: ['CHD warrior', 'Wear red day'] },
  { id: 'colorectal', name: 'Colorectal Cancer Awareness (March, blue)', kind: 'awareness', date: fixed(3, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:colon cancer|colorectal)\b/, who: 'Survivors and families', ideas: ['Colon cancer awareness blue'] },
  { id: 'ms', name: 'MS Awareness Month (March, orange)', kind: 'awareness', date: fixed(3, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:multiple sclerosis|\bms warrior)\b/, who: 'MS warriors', ideas: ['MS warrior orange'] },
  { id: 'mental-health', name: 'Mental Health Awareness Month (May)', kind: 'awareness', date: fixed(5, 1), days: 31, lead: 28, size: 2,
    match: /\b(?:mental health|anxiety|therapy|it'?s okay not to be okay|green ribbon)\b/, who: 'Schools, counselors, therapists', ideas: ['Mental health matters', 'Counselor mental health month'] },
  { id: 'lupus', name: 'Lupus Awareness Month (May, purple)', kind: 'awareness', date: fixed(5, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:lupus)\b/, who: 'Lupus warriors', ideas: ['Lupus warrior butterfly'] },
  { id: 'als', name: 'ALS Awareness Month (May)', kind: 'awareness', date: fixed(5, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:\bals\b|lou gehrig)\b/, who: 'Walk teams', ideas: ['ALS awareness'] },
  { id: 'pride', name: 'Pride Month (June)', kind: 'heritage', date: fixed(6, 1), days: 30, lead: 30, size: 2,
    match: /\b(?:pride|lgbtq?\+?|rainbow|ally|gay|lesbian|trans)\b/, who: 'LGBTQ+ community and allies', ideas: ['Ally teacher', 'Love is love'] },
  { id: 'alz-june', name: "Alzheimer's & Brain Awareness Month (June)", kind: 'awareness', date: fixed(6, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:alzheimer\w*|dementia)\b/, who: 'Families', ideas: ['Longest day team'] },
  { id: 'kindness-day', name: 'World Kindness Day (Nov 13)', kind: 'school', date: fixed(11, 13), days: 1, lead: 21, size: 1,
    match: /\b(?:kindness|be kind|choose kind|kind (?:club|heart))\b/, who: 'Teachers and counselors', ideas: ['Kindness matters teacher', 'Be kind world kindness day'], types: SCHOOL_TYPES },
  { id: 'pink-shirt-day', name: 'Pink Shirt Day (anti-bullying, last Wed of Feb)', kind: 'school', date: (y) => last(y, 2, 3), days: 1, lead: 21, size: 1,
    match: /\b(?:pink shirt day|anti bullying|stop bullying)\b/, who: 'Schools (Canada and US)', ideas: ['Pink shirt day be kind', 'Kindness is free pink shirt day'], types: SCHOOL_TYPES },

  // ---------- heritage ----------
  { id: 'black-history', name: 'Black History Month (February)', kind: 'heritage', date: fixed(2, 1), days: 28, lead: 30, size: 2,
    match: /\b(?:black history|melanin|black excellence|hbcu|juneteenth)\b/, who: 'Teachers, students, families', ideas: ['Black history teacher', 'Black excellence', 'Black history month 2027'] },
  { id: 'womens-history', name: "Women's History Month (March)", kind: 'heritage', date: fixed(3, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:women'?s history|feminis\w*|girl power|future is female)\b/, who: 'Teachers, workplaces', ideas: ["Women's history teacher"] },
  { id: 'hispanic-heritage', name: 'Hispanic Heritage Month (Sep 15–Oct 15)', kind: 'heritage', date: fixed(9, 15), days: 31, lead: 28, size: 1,
    match: /\b(?:hispanic heritage|latin[ao]|latinx|orgullo|hispanic)\b/, who: 'Teachers, students, families', ideas: ['Hispanic heritage month teacher', 'Latina orgullo'] },
  { id: 'juneteenth', name: 'Juneteenth (June 19)', kind: 'heritage', date: fixed(6, 19), days: 1, lead: 30, size: 2,
    match: /\b(?:juneteenth|1865)\b/, who: 'Families, communities', ideas: ['Juneteenth 1865'] },
  { id: 'aapi', name: 'AAPI Heritage Month (May)', kind: 'heritage', date: fixed(5, 1), days: 31, lead: 21, size: 1,
    match: /\b(?:aapi|asian american)\b/, who: 'Students, communities', ideas: ['AAPI heritage month'] },
  { id: 'native-heritage', name: 'Native American Heritage Month (November)', kind: 'heritage', date: fixed(11, 1), days: 30, lead: 21, size: 1,
    match: /\b(?:native american|indigenous)\b/, who: 'Communities, teachers', ideas: ['Indigenous heritage'] },
  { id: 'lunar-new-year', name: 'Lunar New Year', kind: 'heritage', date: table({ 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26' }), days: 1, lead: 30, size: 1,
    match: /\b(?:lunar new year|chinese new year|year of the (?:horse|goat|sheep|monkey))\b/, who: 'Families', ideas: ['Year of the goat 2027', 'Lunar new year 2027'] },
  { id: 'diwali', name: 'Diwali', kind: 'heritage', date: table({ 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17' }), days: 1, lead: 30, size: 1,
    match: /\b(?:diwali|deepavali|festival of lights)\b/, who: 'Families', ideas: ['Happy Diwali'] },
  { id: 'ramadan-eid', name: 'Ramadan & Eid al-Fitr', kind: 'heritage', date: table({ 2026: '2026-02-18', 2027: '2027-02-08', 2028: '2028-01-28' }), days: 31, lead: 30, size: 1,
    match: /\b(?:ramadan|eid|mubarak)\b/, who: 'Families', ideas: ['Ramadan mubarak', 'Eid mubarak'] },
  { id: 'hanukkah', name: 'Hanukkah', kind: 'heritage', date: table({ 2026: '2026-12-04', 2027: '2027-12-24', 2028: '2028-12-12' }), days: 8, lead: 35, size: 1,
    match: /\b(?:hanukkah|chanukah|menorah|dreidel|latke)\b/, who: 'Families', ideas: ['Dreidel squad', 'Hanukkah family'] },
  { id: 'kwanzaa', name: 'Kwanzaa (Dec 26)', kind: 'heritage', date: fixed(12, 26), days: 7, lead: 30, size: 1,
    match: /\b(?:kwanzaa)\b/, who: 'Families', ideas: ['Kwanzaa family'] },

  // ---------- holidays ----------
  { id: 'new-year', name: "New Year's", kind: 'holiday', date: fixed(12, 31), days: 2, lead: 21, size: 2, match: /\b(?:new year|nye|20\d\d goals|hello 20\d\d)\b/, who: 'Party goers', ideas: ['Hello 2027'] },
  { id: 'mlk', name: 'MLK Day', kind: 'heritage', date: (y) => nth(y, 1, 1, 3), days: 1, lead: 21, size: 1, match: /\b(?:mlk|martin luther king|i have a dream)\b/, who: 'Schools, communities', ideas: ['MLK day of service'] },
  { id: 'galentines', name: "Galentine's Day (Feb 13)", kind: 'fun', date: fixed(2, 13), days: 1, lead: 28, size: 1, match: /\b(?:galentine\w*|gal pals?|besties?)\b/, who: 'Friend groups', ideas: ["Galentine's squad"] },
  { id: 'valentine', name: "Valentine's Day", kind: 'holiday', date: fixed(2, 14), days: 1, lead: 35, size: 3, match: /\b(?:valentines?|cupid|be mine|xoxo)\b/, who: 'Couples, teachers (class parties)', ideas: ['Teacher valentine', 'Cupid squad'] },
  { id: 'super-bowl', name: 'Super Bowl Sunday', kind: 'sports', date: (y) => nth(y, 2, 0, 2), days: 1, lead: 21, size: 2, match: /\b(?:football sunday|big game|super bowl)\b/, who: 'Party hosts and fans', ideas: ['Here for the snacks', 'Football Sunday'], caution: '"Super Bowl" and team names are trademarks: say "big game" and "football Sunday".' },
  { id: 'mardi-gras', name: 'Mardi Gras', kind: 'holiday', date: (y) => addDays(easter(y), -47), days: 1, lead: 30, size: 2, match: /\b(?:mardi gras|fat tuesday|nola|beads|king cake)\b/, who: 'Parade goers, Gulf Coast', ideas: ['King cake season', 'Mardi gras teacher'] },
  { id: 'st-patricks', name: "St. Patrick's Day", kind: 'holiday', date: fixed(3, 17), days: 1, lead: 35, size: 3, match: /\b(?:st patricks?|patricks? day|shamrocks?|irish|leprechauns?|lucky)\b/, who: 'Everyone, teachers (lucky to teach)', ideas: ['One lucky teacher', 'Shamrock squad'] },
  { id: 'easter', name: 'Easter', kind: 'holiday', date: easter, days: 1, lead: 35, size: 3, match: /\b(?:easter|bunny|bunnies|egg hunt|he is risen)\b/, who: 'Families', ideas: ['Egg hunt squad', 'He is risen'] },
  { id: 'earth-day', name: 'Earth Day (Apr 22)', kind: 'school', date: fixed(4, 22), days: 1, lead: 21, size: 1, match: /\b(?:earth day|planet|recycl\w*|go green)\b/, who: 'Teachers, students', ideas: ['Earth day every day teacher'] },
  { id: 'cinco', name: 'Cinco de Mayo', kind: 'holiday', date: fixed(5, 5), days: 1, lead: 28, size: 2, match: /\b(?:cinco de mayo|fiesta|taco|nacho|margarita)\b/, who: 'Party goers', ideas: ['Let’s fiesta teacher'] },
  { id: 'mothers-day', name: "Mother's Day", kind: 'holiday', date: (y) => nth(y, 5, 0, 2), days: 1, lead: 40, size: 3, match: /\b(?:mothers?|moms?|mama|mommy|grandma|nana|mimi|gigi)\b/, who: 'Gift buyers', ideas: ['Mama era', 'Gigi'] },
  { id: 'memorial', name: 'Memorial Day', kind: 'holiday', date: (y) => last(y, 5, 1), days: 1, lead: 21, size: 2, match: /\b(?:memorial day|remember (?:the )?fallen|veteran\w*)\b/, who: 'Families, veterans', ideas: ['Remember the fallen'] },
  { id: 'fathers-day', name: "Father's Day", kind: 'holiday', date: (y) => nth(y, 6, 0, 3), days: 1, lead: 40, size: 3, match: /\b(?:fathers?|dads?|daddy|papa|grandpa|pops)\b/, who: 'Gift buyers', ideas: ['Dad joke loading'] },
  { id: 'july-4', name: '4th of July', kind: 'holiday', date: fixed(7, 4), days: 1, lead: 35, size: 3, match: /\b(?:4th of july|fourth of july|independence day|america|usa|patriot\w*|merica)\b/, who: 'Families, cookouts', ideas: ['Party in the USA'] },
  { id: 'labor-day', name: 'Labor Day', kind: 'holiday', date: (y) => nth(y, 9, 1, 1), days: 1, lead: 14, size: 1, match: /\b(?:labor day)\b/, who: 'Workers', ideas: [] },
  { id: 'grandparents', name: 'Grandparents Day', kind: 'holiday', date: (y) => addDays(nth(y, 9, 1, 1), 6), days: 1, lead: 30, size: 2, match: /\b(?:grand(?:ma|pa|parents?|kids?)|nana|papa|gigi|mimi|abuela)\b/, who: 'Grandkids and parents; schools host grandparent days', ideas: ['Grandparents day at school', 'Blessed grandma'] },
  { id: 'oktoberfest', name: 'Oktoberfest (DE, mid-Sep–early Oct)', kind: 'holiday', date: (y) => addDays(nth(y, 10, 0, 1), -15), days: 16, lead: 30, size: 2, match: /\b(?:oktoberfest|bier|beer|prost|lederhosen|dirndl)\b/, who: 'Germany and US beer fans', ideas: ['Prost', 'Oktoberfest squad'] },
  { id: 'halloween', name: 'Halloween', kind: 'holiday', date: fixed(10, 31), days: 1, lead: 50, size: 3, match: /\b(?:halloween|spooky|witch\w*|pumpkins?|ghosts?|skeletons?|zombies?|vampires?|boo|trick or treat|costume)\b/, who: 'Everyone, teachers (spooky teacher)', ideas: ['Spooky teacher', 'Lazy costume'] },
  { id: 'dia-muertos', name: 'Día de los Muertos', kind: 'heritage', date: fixed(11, 1), days: 2, lead: 30, size: 1, match: /\b(?:dia de (?:los )?muertos|day of the dead|calavera|sugar skull)\b/, who: 'Families, teachers', ideas: ['Calavera teacher'] },
  { id: 'veterans', name: 'Veterans Day', kind: 'holiday', date: fixed(11, 11), days: 1, lead: 28, size: 2, match: /\b(?:veteran\w*|military|army|navy|marine|air force|soldier)\b/, who: 'Veterans and families; school assemblies', ideas: ['Proud army mom', 'Veteran daughter'] },
  { id: 'election', name: 'Election Day', kind: 'holiday', date: table({ 2026: '2026-11-03', 2028: '2028-11-07' }), days: 1, lead: 30, size: 1, match: /\b(?:vote|voter|election|ballot)\b/, who: 'Voters (keep it non-partisan)', ideas: ['I voted', 'Poll worker crew'], caution: 'Stay away from candidate names and likenesses.' },
  { id: 'thanksgiving', name: 'Thanksgiving', kind: 'holiday', date: (y) => nth(y, 11, 4, 4), days: 1, lead: 35, size: 3, match: /\b(?:thanksgiving|turkey|thankful|grateful|gobble|pilgrims?)\b/, who: 'Families, teachers', ideas: ['Thankful teacher', 'Turkey trot'] },
  { id: 'turkey-trot', name: 'Turkey Trot runs', kind: 'sports', date: (y) => nth(y, 11, 4, 4), days: 1, lead: 30, size: 1, match: /\b(?:turkey trot|gobble wobble)\b/, who: 'Runners and families', ideas: ['Turkey trot squad'] },
  { id: 'christmas', name: 'Christmas', kind: 'holiday', date: fixed(12, 25), days: 1, lead: 60, size: 3, match: /\b(?:christmas|xmas|santa|elf|elves|reindeer|ugly sweater|holiday|naughty|jingle|snowman|merry)\b/, who: 'Everyone; teachers and nurses love Christmas squad shirts', ideas: ['Christmas teacher squad', 'Nurse Christmas crew'], types: COZY },
  { id: 'bonfire', name: 'Bonfire Night (UK, Nov 5)', kind: 'holiday', date: fixed(11, 5), days: 1, lead: 21, size: 1, match: /\b(?:bonfire night|guy fawkes|remember remember)\b/, who: 'UK shoppers', ideas: ['Remember remember'] },
  { id: 'karneval', name: 'Karneval / Fasching (DE)', kind: 'holiday', date: (y) => addDays(easter(y), -52), days: 6, lead: 35, size: 2, match: /\b(?:karneval|fasching|fastnacht|helau|alaaf)\b/, who: 'German carnival goers', ideas: ['Helau', 'Alaaf kostüm'] },
  { id: 'vatertag', name: 'Vatertag (DE, Ascension Day)', kind: 'holiday', date: (y) => addDays(easter(y), 39), days: 1, lead: 30, size: 2, match: /\b(?:vatertag|papa|vater|herrentag)\b/, who: 'German dads and friend groups', ideas: ['Vatertag Bollerwagen crew'] },
  { id: 'nikolaus', name: 'Nikolaus (DE, Dec 6)', kind: 'holiday', date: fixed(12, 6), days: 1, lead: 30, size: 1, match: /\b(?:nikolaus|krampus)\b/, who: 'German families', ideas: ['Krampus'] },

  // ---------- fun days ----------
  { id: 'coffee-day', name: 'National Coffee Day (Sep 29)', kind: 'fun', date: fixed(9, 29), days: 1, lead: 21, size: 1, match: /\b(?:coffee|caffeine|latte|espresso)\b/, who: 'Coffee lovers; pair with professions (coffee teacher)', ideas: ['Teachers run on coffee', 'Nurse fueled by coffee'] },
  { id: 'taco-day', name: 'National Taco Day (Oct 4)', kind: 'fun', date: fixed(10, 4), days: 1, lead: 21, size: 1, match: /\b(?:taco|tacos)\b/, who: 'Taco lovers', ideas: ['Taco Tuesday'] },
  { id: 'pizza-day', name: 'National Pizza Day (Feb 9)', kind: 'fun', date: fixed(2, 9), days: 1, lead: 21, size: 1, match: /\b(?:pizza)\b/, who: 'Pizza lovers', ideas: [] },
  { id: 'donut-day', name: 'National Donut Day (1st Fri of June)', kind: 'fun', date: (y) => nth(y, 6, 5, 1), days: 1, lead: 21, size: 1, match: /\b(?:donut|doughnut)\b/, who: 'Donut lovers', ideas: ['Donut stress'] },
  { id: 'pirate-day', name: 'Talk Like a Pirate Day (Sep 19)', kind: 'fun', date: fixed(9, 19), days: 1, lead: 21, size: 1, match: /\b(?:pirate|arrr|ahoy)\b/, who: 'Teachers love it for class themes', ideas: ['Talk like a pirate teacher'] },
  { id: 'siblings-day', name: 'National Siblings Day (Apr 10)', kind: 'fun', date: fixed(4, 10), days: 1, lead: 21, size: 1, match: /\b(?:sibling|big sister|little brother|big brother|little sister)\b/, who: 'Families', ideas: ['Big sister little brother matching'] },
  { id: 'cat-day', name: 'International Cat Day (Aug 8)', kind: 'fun', date: fixed(8, 8), days: 1, lead: 21, size: 1, match: /\b(?:cats?|kitty|kitten|meow)\b/, who: 'Cat people', ideas: [] },
  { id: 'dog-day', name: 'National Dog Day (Aug 26)', kind: 'fun', date: fixed(8, 26), days: 1, lead: 21, size: 1, match: /\b(?:dogs?|puppy|pup|doggo|paw)\b/, who: 'Dog people', ideas: [] },
  { id: 'friday-13', name: 'Friday the 13th', kind: 'fun', date: (y) => {
      for (let m = 1; m <= 12; m++) if (new Date(Date.UTC(y, m - 1, 13)).getUTCDay() === 5) return iso(y, m, 13);
      return null;
    }, days: 1, lead: 14, size: 1, match: /\b(?:friday the 13th|unlucky|black cat)\b/, who: 'Spooky-fun fans', ideas: [] },

  // ---------- seasons ----------
  { id: 'deer-season', name: 'Deer hunting season', kind: 'season', date: fixed(11, 1), days: 60, lead: 30, size: 2, match: /\b(?:deer|hunt\w*|buck|antler|camo)\b/, who: 'Hunters and their families', ideas: ['Hunting season dad'], types: COZY },
  { id: 'fishing-season', name: 'Fishing season opener', kind: 'season', date: fixed(4, 15), days: 60, lead: 30, size: 2, match: /\b(?:fishing|fish|bass|lure|angler|reel)\b/, who: 'Anglers', ideas: ['Reel cool dad'] },
  { id: 'camping', name: 'Camping & summer camp', kind: 'season', date: fixed(6, 1), days: 75, lead: 28, size: 1, match: /\b(?:camp(?:ing|er|fire)?|happy camper|summer camp)\b/, who: 'Families, camp counselors', ideas: ['Camp counselor crew', 'Happy camper'] },
  { id: 'cruise', name: 'Cruise season', kind: 'season', date: fixed(1, 15), days: 120, lead: 30, size: 1, match: /\b(?:cruise|cruising|ship happens)\b/, who: 'Family and friends cruise groups', ideas: ['Family cruise 2027', 'Cruise squad'] },
  { id: 'family-reunion', name: 'Family reunions', kind: 'season', date: fixed(6, 15), days: 75, lead: 30, size: 1, match: /\b(?:family reunion)\b/, who: 'Families ordering matching shirts', ideas: ['Family reunion 2027'] },

  // ---------- trends: check demand and trademarks before uploading ----------
  { id: 'six-seven', name: 'The "6 7" (six seven) meme', kind: 'trend', date: fixed(1, 1), days: 365, lead: 0, size: 1, until: '2027-06-30',
    match: /\b(?:six seven|6 ?7|67)\b/, who: 'Kids, tweens and the teachers who hear it all day', ideas: ['6 7 teacher', 'Math teacher 6 7', 'Please stop saying 6 7', '67 field day'],
    caution: 'Trends burn out fast: upload a few, watch sales, stop when they fade. Check for registered marks on the phrase.' },
  { id: 'brainrot', name: 'Brainrot slang (rizz, delulu, aura)', kind: 'trend', date: fixed(1, 1), days: 365, lead: 0, size: 1, until: '2027-06-30',
    match: /\b(?:brain ?rot|rizz|delulu|aura|sigma|gyatt|no cap|slay|it'?s giving)\b/, who: 'Teens, and teachers joking about them', ideas: ['Teacher rizz', 'Delulu is the solulu', 'Aura points teacher'],
    caution: 'Avoid "Skibidi" (a registered mark) and character names.' },
  { id: 'era', name: '"In my ___ era"', kind: 'trend', date: fixed(1, 1), days: 365, lead: 0, size: 2, until: '2027-12-31',
    match: /\bin my .{2,25} era\b/, who: 'Every profession and life stage', ideas: ['In my teacher era', 'In my retirement era', 'In my nurse era'],
    caution: 'Generic phrase; no singer names, lyrics or album art.' },
];

export interface EventDate {
  event: MerchEvent;
  start: string;
  end: string;
  sellFrom: string;
  /** Live by this day so the listing is indexed when shoppers start. */
  uploadBy: string;
  daysUntil: number;
}

const between = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Events still ahead or under way, nearest first, within `horizon` days. */
export function eventDates(today: string, horizon = 120): EventDate[] {
  const year = Number(today.slice(0, 4));
  const out: EventDate[] = [];
  for (const event of EVENTS) {
    if (event.until && today > event.until) continue;
    for (const y of [year - 1, year, year + 1]) {
      const start = event.date(y);
      if (!start) continue;
      const end = addDays(start, event.days - 1);
      if (end < today) continue;
      const daysUntil = between(today, start);
      if (daysUntil - event.lead > horizon) break;
      const sellFrom = addDays(start, -event.lead);
      out.push({ event, start, end, sellFrom, uploadBy: addDays(sellFrom, -10), daysUntil });
      break;
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** The same event a year earlier, for last year's results. */
export function previousOccurrence(e: EventDate): { from: string; to: string } | null {
  const y = Number(e.start.slice(0, 4)) - 1;
  const start = e.event.date(y);
  if (!start) return null;
  return { from: addDays(start, -e.event.lead), to: addDays(start, e.event.days - 1) };
}

export const KIND_LABEL: Record<EventKind, string> = {
  school: 'School', awareness: 'Awareness', profession: 'Profession', sports: 'Sports', holiday: 'Holiday', heritage: 'Heritage', fun: 'Fun day', trend: 'Trend', season: 'Season',
};
