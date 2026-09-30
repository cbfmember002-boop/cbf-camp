/**
 * RESETS and seeds the database with realistic sample data.
 *
 * `pnpm db:seed` is destructive by design: it truncates every application table and
 * recreates the dataset deterministically, all in one transaction. Running it twice gives
 * the same database, never duplicates. The migrations journal is left untouched.
 *
 * Two things this seed does deliberately, both of which matter when you build the UI:
 *
 * 1. REALISTIC VOLUME (NFR-PERF-02). 400 songs and 180 people, because a songbook that
 *    looks fine with 10 rows is what produced the legacy `?limit=5000` fetch-everything
 *    pattern (L-10). If your list page is slow here, it will be unusable at camp.
 *
 * 2. AWKWARD FIXTURES. The camp is FOUR days, not three, because the legacy app
 *    hardcoded three (L-03). There is an empty day, an event crossing midnight, rooms
 *    named A9/A10, and names with apostrophes and non-ASCII characters. If your UI only
 *    works on the tidy rows, these will catch it.
 *
 * No real personal data (DATA-SEED-02) — every name, phone and email here is invented.
 * The data is deterministic, so everyone sees identical results and bug reports match.
 */
// Must stay first: config/env reads process.env at import time.
import 'dotenv/config';

import { basename } from 'node:path';

import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../config/env';
import { campTimeToInstant } from '../lib/camp-time';
import { hashSecret } from '../lib/password';
import { roomSortKey } from '../lib/sort-key';
import * as schema from './schema';

const TZ = 'Asia/Kolkata';

/**
 * Seeded pseudo-random generator (mulberry32).
 *
 * Math.random() would make the seed different on every run, so a screenshot or bug
 * report would not reproduce. Same seed in, same database out.
 */
function makeRandom(seed: number) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260524);

const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
const FIRST_NAMES = [
  'Aaron', 'Abigail', 'Ananya', 'Arjun', 'Beulah', 'Caleb', 'Chloe', 'Daniel',
  'Deborah', 'Elijah', 'Esther', 'Ezra', 'Grace', 'Hannah', 'Isaac', 'Jemima',
  'Joel', 'Joshua', 'Keziah', 'Levi', 'Lydia', 'Malachi', 'Mariam', 'Micah',
  'Naomi', 'Nathan', 'Noah', 'Priya', 'Rachel', 'Reuben', 'Ruth', 'Samuel',
  'Sarah', 'Seth', 'Silas', 'Simeon', 'Tabitha', 'Thomas', 'Timothy', 'Zipporah',
  // Deliberately awkward: non-ASCII and an accented character.
  'Zoë', 'José', 'Aíne',
];

const LAST_NAMES = [
  'Abraham', 'Alexander', 'Benjamin', 'Chacko', 'Cherian', 'Daniel', 'David',
  'Fernandes', 'George', 'Isaac', 'Jacob', 'James', 'John', 'Joseph', 'Kurian',
  'Mathew', 'Ninan', 'Oommen', 'Philip', 'Samuel', 'Thomas', 'Varghese', 'Zachariah',
  // Deliberately awkward: an apostrophe, which breaks naive string concatenation
  // and unescaped rendering.
  "O'Brien", "D'Souza",
];

// Accepts a transaction as well as a top-level connection.
type SeedDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Empties every table defined in the schema and restarts their ID sequences, so the
 * seed produces identical IDs on every run. CASCADE covers the foreign keys.
 */
export async function reset(db: SeedDb) {
  const tableNames = Object.values(schema as Record<string, unknown>)
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => `"${getTableName(table)}"`);

  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`));
}

/**
 * Inserts the sample dataset into an EMPTY database. Exported so tests can run it against
 * a throwaway database — seed data that has never actually been inserted is not seed data.
 */
export async function seed(db: SeedDb) {
  console.log('Seeding...');

  // --- Camp -------------------------------------------------------------
  // FOUR days on purpose (L-03). The 24th is a Sunday arrival, the 27th departure.
  const [camp] = await db
    .insert(schema.camp)
    .values({
      name: 'Annual Camp 2026',
      timezone: TZ,
      accessCodeHash: await hashSecret('camp2026'),
      isActive: true,
    })
    .returning();

  const campId = camp!.id;

  const dayDates = ['2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27'];

  const days = await db
    .insert(schema.campDay)
    .values(
      dayDates.map((date, i) => ({
        campId,
        date,
        dayNumber: i + 1,
        label: ['Arrival', 'Day Two', 'Day Three', 'Departure'][i]!,
        // No pairing on arrival or departure day. Revealed at 06:00 camp time.
        twoByTwoRevealAt:
          i === 1 || i === 2 ? campTimeToInstant(date, '06:00', TZ) : null,
      })),
    )
    .returning();

  // --- Sessions ---------------------------------------------------------
  const sessions = await db
    .insert(schema.session)
    .values(
      [
        ['Called Out', 'Ps. Mathew Varghese', '1 Peter 2:9'],
        ['Walking Worthy', 'Ps. Mathew Varghese', 'Ephesians 4:1-6'],
        ['The Cost of Following', 'Dr. Anita George', 'Luke 14:25-33'],
        ['Sent Together', 'Dr. Anita George', 'Mark 6:7-13'],
        ['Finishing Well', 'Ps. Mathew Varghese', '2 Timothy 4:6-8'],
      ].map(([topic, speaker, reference], i) => ({
        campId,
        topic: topic!,
        speaker: speaker!,
        reference: reference!,
        outline: `Outline for "${topic}" — to be filled in by the speaker.`,
        sortOrder: i,
      })),
    )
    .returning();

  // --- Events -----------------------------------------------------------
  // Day 4 (index 3) is left EMPTY on purpose: departure day has no scheduled
  // programme yet. Your schedule UI must render an empty day gracefully rather
  // than crash or show a blank screen with no explanation.
  const eventPlan: Array<{
    day: number;
    start: string;
    end: string;
    title: string;
    category: (typeof schema.eventCategory.enumValues)[number];
    session?: number;
  }> = [
    { day: 0, start: '14:00', end: '16:00', title: 'Registration & Check-in', category: 'other' },
    { day: 0, start: '16:30', end: '17:30', title: 'Tea & Fellowship', category: 'fellowship' },
    { day: 0, start: '19:00', end: '20:00', title: 'Dinner', category: 'meal' },
    { day: 0, start: '20:30', end: '22:00', title: 'Opening Session', category: 'session', session: 0 },

    { day: 1, start: '06:30', end: '07:15', title: 'Morning Prayer', category: 'prayer' },
    { day: 1, start: '08:00', end: '09:00', title: 'Breakfast', category: 'meal' },
    { day: 1, start: '09:30', end: '11:00', title: 'Session 2', category: 'session', session: 1 },
    { day: 1, start: '13:00', end: '14:00', title: 'Lunch', category: 'meal' },
    { day: 1, start: '16:00', end: '18:00', title: 'Team Games', category: 'games' },
    { day: 1, start: '19:00', end: '20:00', title: 'Dinner', category: 'meal' },
    { day: 1, start: '20:30', end: '22:00', title: 'Session 3', category: 'session', session: 2 },
    // CROSSES MIDNIGHT (23:00 -> 00:30 the next day). A schedule grouped by
    // "which day does starts_at fall on" will place this on day 2 and it will
    // appear to end before it begins unless you handle it.
    { day: 1, start: '23:00', end: '24:30', title: 'Late Night Worship', category: 'worship' },

    // STARTS AT 00:00 ON DAY 3 — not a midnight-crossing event (that is Late Night
    // Worship above). It exists to test the 12am/12pm boundary the legacy parser got
    // wrong: it must render as 12:00 am, first on Day 3, and overlaps the tail of
    // Late Night Worship (ends 00:30).
    { day: 2, start: '00:00', end: '00:45', title: 'Midnight Prayer Watch', category: 'prayer' },
    { day: 2, start: '06:30', end: '07:15', title: 'Morning Prayer', category: 'prayer' },
    { day: 2, start: '08:00', end: '09:00', title: 'Breakfast', category: 'meal' },
    { day: 2, start: '09:30', end: '11:00', title: 'Session 4', category: 'session', session: 3 },
    { day: 2, start: '11:30', end: '13:00', title: 'Two by Two Walk', category: 'fellowship' },
    { day: 2, start: '13:00', end: '14:00', title: 'Lunch', category: 'meal' },
    { day: 2, start: '15:00', end: '17:00', title: 'Free Time', category: 'free_time' },
    { day: 2, start: '19:00', end: '20:00', title: 'Dinner', category: 'meal' },
    { day: 2, start: '20:30', end: '22:30', title: 'Closing Session', category: 'session', session: 4 },
  ];

  await db.insert(schema.event).values(
    eventPlan.map((e) => {
      const day = days[e.day]!;

      // "24:30" means 00:30 on the following calendar day. Resolving it here keeps
      // the stored value an unambiguous instant.
      const endsAt =
        Number(e.end.split(':')[0]) >= 24
          ? campTimeToInstant(
              dayDates[e.day + 1] ?? dayDates[e.day]!,
              `${String(Number(e.end.split(':')[0]) - 24).padStart(2, '0')}:${e.end.split(':')[1]}`,
              TZ,
            )
          : campTimeToInstant(day.date, e.end, TZ);

      return {
        campDayId: day.id,
        title: e.title,
        category: e.category,
        startsAt: campTimeToInstant(day.date, e.start, TZ),
        endsAt,
        sessionId: e.session === undefined ? null : sessions[e.session]!.id,
      };
    }),
  );

  // --- Rooms ------------------------------------------------------------
  // A9 and A10 exist specifically so that text ordering visibly breaks
  // (DATA-ROOM-02). sortKey is derived on write, never typed by hand.
  const roomDescriptions = [
    ...Array.from({ length: 12 }, (_, i) => `A${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `B${i + 1}`),
    'Dorm 1',
    'Dorm 2',
    'Dorm 10',
    'Annexe',
  ];

  const rooms = await db
    .insert(schema.room)
    .values(
      roomDescriptions.map((description) => ({
        campId,
        description,
        location: description.startsWith('B') ? 'Block B, first floor' : 'Block A, ground floor',
        sortKey: roomSortKey(description),
      })),
    )
    .returning();

  // --- Teams ------------------------------------------------------------
  const teams = await db
    .insert(schema.team)
    .values(
      ['Bethel', 'Carmel', 'Horeb', 'Zion'].map((name, i) => ({
        campId,
        name,
        contactPhone: `+91 90000 0000${i + 1}`,
        sortOrder: i,
      })),
    )
    .returning();

  // --- People -----------------------------------------------------------
  const usedNames = new Set<string>();
  const peopleValues: Array<typeof schema.person.$inferInsert> = [];

  while (peopleValues.length < 180) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const index = peopleValues.length;

    peopleValues.push({
      campId,
      name,
      gender: index % 2 === 0 ? 'male' : 'female',
      // Fictional numbers, and only on some rows — the UI must handle missing
      // contact details rather than rendering "undefined".
      phone: index % 3 === 0 ? `+91 98${String(100000 + index).slice(0, 6)}` : null,
      email: index % 5 === 0 ? `person${index}@example.invalid` : null,
      teamId: teams[index % teams.length]!.id,
      // Some people are unassigned on purpose (late registrations).
      roomId: index % 11 === 0 ? null : rooms[index % rooms.length]!.id,
    });
  }

  const people = await db.insert(schema.person).values(peopleValues).returning();

  // --- Team leaders -----------------------------------------------------
  await db.insert(schema.teamLeader).values(
    teams.flatMap((team, i) => [
      { teamId: team.id, personId: people[i * 4]!.id, role: 'captain' as const },
      { teamId: team.id, personId: people[i * 4 + 1]!.id, role: 'vice_captain' as const },
      { teamId: team.id, personId: people[i * 4 + 2]!.id, role: 'spoc' as const },
    ]),
  );

  // --- Two by Two -------------------------------------------------------
  // Pairings for days 2 and 3. With an odd number of participants one group has
  // three members — the schema models a pairing as a group of partners rather than
  // two columns precisely so this is representable (FR-2X2-04).
  for (const dayIndex of [1, 2]) {
    const shuffled = [...people];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    // 61 participants — deliberately odd, so the last group is a three.
    const participants = shuffled.slice(0, 61);

    for (let i = 0; i < participants.length; i += 2) {
      const isLastOddOne = i === participants.length - 3;
      const members = isLastOddOne ? participants.slice(i, i + 3) : participants.slice(i, i + 2);

      if (members.length < 2) break;

      const [pairing] = await db
        .insert(schema.twoByTwo)
        .values({ campDayId: days[dayIndex]!.id })
        .returning();

      await db.insert(schema.twoByTwoPartner).values(
        members.map((person) => ({ twoByTwoId: pairing!.id, personId: person.id })),
      );

      if (isLastOddOne) break;
    }
  }

  // --- Songs ------------------------------------------------------------
  // 400 songs: enough that rendering or searching them all client-side is
  // noticeably wrong (FR-SONG-02, NFR-PERF-02).
  const songWords = [
    'Amazing', 'Blessed', 'Holy', 'Eternal', 'Faithful', 'Glorious', 'Gracious',
    'Living', 'Mighty', 'Precious', 'Risen', 'Sacred', 'Steadfast', 'Wondrous',
  ];
  const songNouns = [
    'Assurance', 'Grace', 'Hope', 'Love', 'Mercy', 'Name', 'Peace', 'Redeemer',
    'Refuge', 'Rock', 'Saviour', 'Shepherd', 'Song', 'Strength',
  ];

  await db.insert(schema.song).values(
    Array.from({ length: 400 }, (_, i) => {
      const title = `${pick(songWords)} ${pick(songNouns)} ${i + 1}`;
      const firstLine = `${pick(songWords)} is the ${pick(songNouns).toLowerCase()} of my soul`;

      return {
        campId,
        number: i + 1,
        title,
        firstLine,
        lyrics: [
          firstLine + ',',
          `${pick(songWords)} and ${pick(songWords).toLowerCase()} evermore;`,
          `In the ${pick(songNouns).toLowerCase()} of the Lord I stand,`,
          `Singing of His ${pick(songNouns).toLowerCase()} forevermore.`,
          '',
          'Chorus:',
          `O the ${pick(songNouns).toLowerCase()} that never fails,`,
          `${pick(songWords)} love that still prevails.`,
        ].join('\n'),
      };
    }),
  );

  // --- Content pages ----------------------------------------------------
  const pageDefs: Array<{
    key: (typeof schema.contentPageKey.enumValues)[number];
    title: string;
    sections: Array<[string, string]>;
  }> = [
    {
      key: 'camp_guidelines',
      title: 'Camp Guidelines',
      sections: [
        ['Timings', 'Please be seated five minutes before each session begins.'],
        ['Phones', 'Kindly keep phones on silent during sessions.'],
        ['Dress code', 'Modest and comfortable clothing is requested for all sessions.'],
      ],
    },
    {
      key: 'prayer_wall',
      title: 'Prayer Wall',
      sections: [
        ['How it works', 'Prayer requests are collected each morning and prayed over at the evening session.'],
      ],
    },
    {
      key: 'two_by_two_guidelines',
      title: 'Two by Two Guidelines',
      sections: [
        ['Purpose', 'Spend thirty minutes with your partner sharing what God has been teaching you.'],
        ['When', 'Pairings are revealed at 6:00 am each day and the walk follows the morning session.'],
      ],
    },
    {
      key: 'quiz_rules',
      title: 'Quiz Rules',
      sections: [['Format', 'Four rounds of ten questions. Teams answer on paper; no phones.']],
    },
    {
      key: 'game_rules',
      title: 'Game Rules',
      sections: [['Safety first', 'Report any injury to your team SPOC immediately.']],
    },
    {
      key: 'venue',
      title: 'Venue',
      sections: [
        ['Getting there', 'The retreat centre is a 10-minute drive from Munnar town. Buses leave the town stand every hour.'],
        ['On site', 'Block A houses the main hall and dining room; Block B is accommodation only.'],
      ],
    },
  ];

  for (const def of pageDefs) {
    const [page] = await db
      .insert(schema.contentPage)
      .values({ campId, key: def.key, title: def.title })
      .returning();

    await db.insert(schema.contentSection).values(
      def.sections.map(([heading, body], i) => ({
        pageId: page!.id,
        heading,
        body,
        sortOrder: i,
      })),
    );
  }

  // --- Contacts ---------------------------------------------------------
  const contactGroups: Array<[string, Array<[string, string]>]> = [
    ['Camp Leadership', [['Ps. Mathew Varghese', 'Camp Director'], ['Dr. Anita George', 'Associate Speaker']]],
    ['Medical', [['Dr. Susan Philip', 'Camp Doctor'], ['Nurse Mary John', 'First Aid']]],
    ['Logistics', [['Thomas Kurian', 'Transport'], ['Grace Ninan', 'Kitchen']]],
  ];

  for (const [categoryIndex, [categoryName, entries]] of contactGroups.entries()) {
    const [category] = await db
      .insert(schema.contactCategory)
      .values({ campId, name: categoryName, sortOrder: categoryIndex })
      .returning();

    await db.insert(schema.contact).values(
      entries.map(([name, role], i) => ({
        categoryId: category!.id,
        name,
        role,
        phone: `+91 98765 4${String(3210 + i).slice(0, 4)}`,
        sortOrder: i,
      })),
    );
  }

  // --- Venues -----------------------------------------------------------
  await db.insert(schema.venue).values([
    {
      campId,
      kind: 'camp',
      name: 'Hebron Retreat Centre',
      address: 'Hebron Road, Munnar, Kerala 685612',
      latitude: '10.0889',
      longitude: '77.0595',
      phone: '+91 4865 230000',
      sortOrder: 0,
    },
    {
      campId,
      kind: 'hospital',
      name: 'Tata General Hospital',
      address: 'Munnar, Kerala 685612',
      latitude: '10.0872',
      longitude: '77.0603',
      phone: '+91 4865 230270',
      sortOrder: 1,
    },
  ]);

  // --- Links ------------------------------------------------------------
  await db.insert(schema.link).values([
    { campId, title: 'Camp Photo Album', url: 'https://example.invalid/photos', category: 'Media', sortOrder: 0 },
    { campId, title: 'Feedback Form', url: 'https://example.invalid/feedback', category: 'Forms', sortOrder: 1 },
    { campId, title: 'Daily Devotional', url: 'https://example.invalid/devotional', category: 'Resources', sortOrder: 2 },
  ]);

  // --- Admin ------------------------------------------------------------
  // Development credentials only, and the password is hashed even here so that
  // nothing in this codebase ever demonstrates storing one in plaintext (L-09).
  await db.insert(schema.admin).values({
    username: 'admin',
    passwordHash: await hashSecret('development-only-password'),
    role: 'super_admin',
  });

  console.log('Seed complete.');
  console.log('  Camp access code: camp2026');
  console.log('  Admin login:      admin / development-only-password');
}

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('db:seed refuses to run with NODE_ENV=production.');
  }

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  console.log(`Resetting ALL data in ${new URL(env.DATABASE_URL).host} ...`);

  try {
    // One transaction: a failed seed rolls back and leaves the previous data intact.
    await db.transaction(async (tx) => {
      await reset(tx);
      await seed(tx);
    });
  } finally {
    await client.end();
  }
}

// Only run when invoked directly (`npm run db:seed`), not when imported by a test.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}
