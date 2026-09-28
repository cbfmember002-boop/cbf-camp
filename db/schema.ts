/**
 * Database schema.
 *
 * Read this alongside docs/SPEC.md §6 (the DATA-* requirements) and docs/LEGACY.md,
 * which explains why several things here differ deliberately from the legacy
 * Sails/Waterline schema.
 *
 * Conventions:
 *   - Table names are singular (`song`, not `songs`).
 *   - Timestamps are `timestamptz`, never a display string (DATA-EVENT-01, L-07).
 *   - Every relationship has a real foreign key with explicit onDelete (DATA-INT-01, L-11).
 *   - `sortOrder` columns give admins explicit control over display order.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Every table carries these. */
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/* ========================================================================== */
/* Camp                                                                        */
/* ========================================================================== */

/**
 * One row per camp. SPEC §9 says one camp per deployment, but making it a row gives the
 * timezone, name and access code a natural home, and makes a future camp year new data
 * rather than a new deployment.
 *
 * The access code is stored HASHED (FR-AUTH-07); the plaintext never reaches the
 * database or the client bundle (FR-AUTH-02).
 */
export const camp = pgTable('camp', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** IANA timezone — the authority for every camp-time calculation (FR-SCHED-09). */
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  accessCodeHash: text('access_code_hash'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

/* ========================================================================== */
/* Camp days (DATA-DAY-01)                                                     */
/* ========================================================================== */

/**
 * Camp days are DATA, not a constant.
 *
 * The legacy UI hardcoded three days and indexed [0], [1], [2] directly, crashing on any
 * other count (L-03). Nothing here may assume a day count — FR-SCHED-02 requires 1, 2, 3
 * and 5+ days to all work.
 *
 * `date` is a calendar date in the camp timezone, stored as ISO `YYYY-MM-DD` text. It is
 * deliberately NOT a timestamp: "the second day of camp" is a calendar concept, and
 * combining it with the camp timezone is how real instants are derived.
 *
 * `twoByTwoRevealAt` is the absolute instant a day's pairings become visible
 * (FR-2X2-03, DATA-2X2-01). Storing it rather than computing it lets organisers reveal
 * early or stagger reveals, and makes the gating rule explicit in the data.
 */
export const campDay = pgTable(
  'camp_day',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    /** ISO YYYY-MM-DD, interpreted in the camp timezone. */
    date: text('date').notNull(),
    /** 1-based position; drives tab order without relying on date parsing. */
    dayNumber: integer('day_number').notNull(),
    label: text('label'),
    twoByTwoRevealAt: timestamp('two_by_two_reveal_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('camp_day_camp_date_idx').on(t.campId, t.date),
    uniqueIndex('camp_day_camp_number_idx').on(t.campId, t.dayNumber),
    check('camp_day_number_positive', sql`${t.dayNumber} > 0`),
    check('camp_day_date_iso', sql`${t.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  ],
);

/* ========================================================================== */
/* Schedule (FR-SCHED)                                                         */
/* ========================================================================== */

/**
 * Event categories (DATA-EVENT-03).
 *
 * The legacy schema used an unvalidated `categoryId` float, mapped to icons by a
 * hardcoded object in the controller. A constrained enum means an invalid category
 * cannot be stored, and the icon mapping has a fixed set to cover.
 */
export const eventCategory = pgEnum('event_category', [
  'session',
  'worship',
  'meal',
  'games',
  'prayer',
  'fellowship',
  'free_time',
  'travel',
  'other',
]);

/**
 * A scheduled event.
 *
 * `startsAt` / `endsAt` are absolute instants (DATA-EVENT-01). This is the single most
 * important departure from the legacy schema, which stored free text like "7:30pm" and
 * parsed it in the browser with a regex, in the DEVICE's timezone (L-07). That made
 * correct reminders impossible (FR-PUSH-06) and showed different times to travellers.
 *
 * A check constraint enforces end-after-start (DATA-EVENT-02), so the bug cannot be
 * introduced by an admin form, an import, or a future query.
 */
export const event = pgTable(
  'event',
  {
    id: serial('id').primaryKey(),
    campDayId: integer('camp_day_id')
      .notNull()
      .references(() => campDay.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    category: eventCategory('category').notNull().default('other'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** Optional link to the session this event hosts. */
    sessionId: integer('session_id').references(() => session.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('event_camp_day_idx').on(t.campDayId),
    index('event_starts_at_idx').on(t.startsAt),
    check('event_ends_after_start', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/* ========================================================================== */
/* Sessions (FR-SESS)                                                          */
/* ========================================================================== */

export const session = pgTable(
  'session',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    speaker: text('speaker'),
    /** Bible reference, e.g. "Romans 8:1-17". */
    reference: text('reference'),
    /** Rich text, sanitised on save (ADM-06) and on render (FR-SESS-04). */
    outline: text('outline'),
    reflections: text('reflections'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('session_camp_idx').on(t.campId)],
);

/* ========================================================================== */
/* Song book (FR-SONG)                                                         */
/* ========================================================================== */

/**
 * `lyrics` holds the full text with line and verse breaks preserved (FR-SONG-04).
 * FR-SONG-02 requires search across BOTH title and lyrics; the GIN index below backs
 * that with Postgres full-text search rather than shipping the whole book to the browser
 * to filter client-side (L-10, NFR-PERF-03).
 */
export const song = pgTable(
  'song',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    firstLine: text('first_line'),
    lyrics: text('lyrics'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('song_camp_number_idx').on(t.campId, t.number),
    index('song_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${t.title} || ' ' || coalesce(${t.lyrics}, ''))`,
    ),
  ],
);

/* ========================================================================== */
/* People, teams and rooms                                                     */
/* ========================================================================== */

/**
 * Rooms.
 *
 * `sortKey` exists so ordering is stable and human-sensible (DATA-ROOM-02): plain text
 * ordering puts "A10" before "A9". It is derived on write by zero-padding the numeric
 * portion — see src/lib/sort-key.ts — so the database can ORDER BY a single indexed
 * column rather than parsing at query time.
 */
export const room = pgTable(
  'room',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    location: text('location'),
    /** Derived, not entered. See DATA-ROOM-02 and lib/sort-key.ts. */
    sortKey: text('sort_key').notNull(),
    ...timestamps,
  },
  (t) => [index('room_camp_sort_idx').on(t.campId, t.sortKey)],
);

export const team = pgTable(
  'team',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Blob URL for the team logo (ADM-07). Nullable — FR-TEAM-05 needs a fallback. */
    logoUrl: text('logo_url'),
    contactPhone: text('contact_phone'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('team_camp_idx').on(t.campId)],
);

/**
 * A camp participant.
 *
 * Note: this is NOT an account. Per ADR-0001 there are no per-camper logins; these rows
 * exist so rooms, teams and pairings can reference people by name. Nobody authenticates
 * as a `person`.
 *
 * Named `person` rather than `user` to make that distinction obvious, and because `user`
 * is a reserved word in Postgres that needs quoting everywhere.
 */
export const person = pgTable(
  'person',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    gender: text('gender'),
    phone: text('phone'),
    email: text('email'),
    photoUrl: text('photo_url'),
    /**
     * Deleting a team or room must not delete the person, so these are `set null`.
     * The legacy schema had no foreign keys at all, so orphaned rows silently
     * disappeared from results (L-11).
     */
    teamId: integer('team_id').references(() => team.id, { onDelete: 'set null' }),
    roomId: integer('room_id').references(() => room.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('person_camp_idx').on(t.campId),
    index('person_team_idx').on(t.teamId),
    index('person_room_idx').on(t.roomId),
    index('person_name_idx').on(t.name),
  ],
);

/** Leadership roles within a team, replacing the legacy captain/viceCaptain collections. */
export const teamRole = pgEnum('team_role', ['captain', 'vice_captain', 'spoc']);

export const teamLeader = pgTable(
  'team_leader',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    role: teamRole('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.personId, t.role] })],
);

/* ========================================================================== */
/* Two by Two (FR-2X2)                                                         */
/* ========================================================================== */

/**
 * A fellowship pairing for a given camp day (DATA-2X2-01).
 *
 * The reveal instant lives on `camp_day.two_by_two_reveal_at`, so gating is a property
 * of the day rather than of each pairing. FR-2X2-05 requires that filtering happen
 * SERVER-SIDE: unrevealed pairings must never appear in a payload, not merely be hidden
 * with CSS.
 */
export const twoByTwo = pgTable(
  'two_by_two',
  {
    id: serial('id').primaryKey(),
    campDayId: integer('camp_day_id')
      .notNull()
      .references(() => campDay.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('two_by_two_camp_day_idx').on(t.campDayId)],
);

/**
 * Pairing membership.
 *
 * Replaces the legacy `twobytwo_partners__user_partners_user` join table, which had
 * Waterline's generated name and no foreign keys. Because the legacy Two by Two query
 * inner-joined across it, an orphaned row made a pairing silently vanish (L-11).
 */
export const twoByTwoPartner = pgTable(
  'two_by_two_partner',
  {
    twoByTwoId: integer('two_by_two_id')
      .notNull()
      .references(() => twoByTwo.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.twoByTwoId, t.personId] }),
    index('two_by_two_partner_person_idx').on(t.personId),
  ],
);

/* ========================================================================== */
/* Editable content (DATA-CONTENT-01)                                          */
/* ========================================================================== */

/**
 * Everything that used to be hardcoded HTML in Angular partials.
 *
 * The legacy app required a developer to edit markup and redeploy to change the prayer
 * wall, camp rules, quiz rules, contacts or venue. FR-GUIDE-03 forbids that: an organiser
 * must be able to update all of it from the admin dashboard with no code change.
 *
 * The model is deliberately generic — a page holds ordered sections — because these
 * pages differ in structure but not in behaviour. Section navigation (FR-GUIDE-05) falls
 * out of the section titles.
 */
export const contentPageKey = pgEnum('content_page_key', [
  'prayer_wall',
  'camp_guidelines',
  'quiz_rules',
  'game_rules',
  'two_by_two_guidelines',
  'venue',
]);

export const contentPage = pgTable(
  'content_page',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    key: contentPageKey('key').notNull(),
    title: text('title').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('content_page_camp_key_idx').on(t.campId, t.key)],
);

export const contentSection = pgTable(
  'content_section',
  {
    id: serial('id').primaryKey(),
    pageId: integer('page_id')
      .notNull()
      .references(() => contentPage.id, { onDelete: 'cascade' }),
    heading: text('heading'),
    /** Sanitised HTML. Sanitise on save (ADM-06) AND on render (NFR-SEC-03). */
    body: text('body').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('content_section_page_idx').on(t.pageId, t.sortOrder)],
);

/* ========================================================================== */
/* Contacts (FR-CONT)                                                          */
/* ========================================================================== */

export const contactCategory = pgTable(
  'contact_category',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('contact_category_camp_idx').on(t.campId, t.sortOrder)],
);

export const contact = pgTable(
  'contact',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => contactCategory.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    /** E.164 preferred, so tel: and WhatsApp links both work (FR-CONT-03, FR-CONT-04). */
    phone: text('phone'),
    photoUrl: text('photo_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('contact_category_idx').on(t.categoryId, t.sortOrder)],
);

/* ========================================================================== */
/* Useful links (FR-LINK)                                                      */
/* ========================================================================== */

export const link = pgTable(
  'link',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url').notNull(),
    category: text('category'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('link_camp_idx').on(t.campId, t.sortOrder)],
);

/* ========================================================================== */
/* Venue (FR-VENUE)                                                            */
/* ========================================================================== */

export const venueKind = pgEnum('venue_kind', ['camp', 'hospital', 'other']);

/**
 * Coordinates are stored so a platform-neutral maps URL can be built (FR-VENUE-02).
 * The legacy app branched on `window.device.platform`, a Cordova global that is
 * undefined in a real browser (L-05).
 */
export const venue = pgTable(
  'venue',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    kind: venueKind('kind').notNull().default('other'),
    name: text('name').notNull(),
    address: text('address'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    phone: text('phone'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('venue_camp_idx').on(t.campId, t.sortOrder)],
);

/* ========================================================================== */
/* Admin accounts (ADM-01, ADM-03)                                             */
/* ========================================================================== */

export const adminRole = pgEnum('admin_role', ['admin', 'super_admin']);

/**
 * Admin accounts are entirely separate from camper access (FR-AUTH-08): holding the camp
 * code grants no admin capability.
 *
 * `passwordHash` must be a modern salted slow hash (ADM-01). The legacy migration seeded
 * a plaintext credential and generated API keys as v1 UUIDs, which encode a timestamp
 * and MAC address and are unsuitable as secrets (L-09).
 */
export const admin = pgTable(
  'admin',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: adminRole('role').notNull().default('admin'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('admin_username_idx').on(t.username)],
);

/* ========================================================================== */
/* Push notifications (FR-PUSH)                                                */
/* ========================================================================== */

/**
 * A push subscription, keyed to an anonymous device — NOT to a person (ADR-0001).
 * Notifications are broadcast; there is no per-camper targeting.
 *
 * `failureCount` supports pruning expired or rejected endpoints (FR-PUSH-10), and one
 * dead subscription must never abort a whole broadcast.
 */
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** Category opt-outs (FR-PUSH-11). Empty means subscribed to everything. */
    mutedCategories: text('muted_categories').array().notNull().default(sql`ARRAY[]::text[]`),
    failureCount: integer('failure_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('push_subscription_endpoint_idx').on(t.endpoint)],
);

export const notificationKind = pgEnum('notification_kind', [
  'announcement',
  'event_reminder',
  'schedule_change',
]);

/**
 * A record of notifications sent.
 *
 * `eventId` plus a partial unique index is what makes reminders at-most-once
 * (FR-PUSH-07). Schedulers run more than once, overlap, and retry — de-duplication has
 * to be enforced by the DATABASE, not by application logic that races with itself.
 *
 * The unique index is created in the migration rather than here, because it must be
 * partial (only for `event_reminder` rows); see drizzle/0001_reminder_dedupe.sql.
 */
export const notification = pgTable(
  'notification',
  {
    id: serial('id').primaryKey(),
    campId: integer('camp_id')
      .notNull()
      .references(() => camp.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Deep link target (FR-PUSH-05). */
    url: text('url'),
    /** Set for event reminders; drives the at-most-once guarantee. */
    eventId: integer('event_id').references(() => event.id, { onDelete: 'cascade' }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    recipientCount: integer('recipient_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('notification_camp_idx').on(t.campId, t.sentAt)],
);

/* ========================================================================== */
/* Relations                                                                   */
/* ========================================================================== */

export const campRelations = relations(camp, ({ many }) => ({
  days: many(campDay),
  sessions: many(session),
  songs: many(song),
  rooms: many(room),
  teams: many(team),
  people: many(person),
  links: many(link),
  venues: many(venue),
  contentPages: many(contentPage),
  contactCategories: many(contactCategory),
}));

export const campDayRelations = relations(campDay, ({ one, many }) => ({
  camp: one(camp, { fields: [campDay.campId], references: [camp.id] }),
  events: many(event),
  pairings: many(twoByTwo),
}));

export const eventRelations = relations(event, ({ one }) => ({
  campDay: one(campDay, { fields: [event.campDayId], references: [campDay.id] }),
  session: one(session, { fields: [event.sessionId], references: [session.id] }),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  camp: one(camp, { fields: [session.campId], references: [camp.id] }),
  events: many(event),
}));

export const songRelations = relations(song, ({ one }) => ({
  camp: one(camp, { fields: [song.campId], references: [camp.id] }),
}));

export const roomRelations = relations(room, ({ one, many }) => ({
  camp: one(camp, { fields: [room.campId], references: [camp.id] }),
  occupants: many(person),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  camp: one(camp, { fields: [team.campId], references: [camp.id] }),
  members: many(person),
  leaders: many(teamLeader),
}));

export const personRelations = relations(person, ({ one, many }) => ({
  camp: one(camp, { fields: [person.campId], references: [camp.id] }),
  team: one(team, { fields: [person.teamId], references: [team.id] }),
  room: one(room, { fields: [person.roomId], references: [room.id] }),
  leaderRoles: many(teamLeader),
  pairings: many(twoByTwoPartner),
}));

export const teamLeaderRelations = relations(teamLeader, ({ one }) => ({
  team: one(team, { fields: [teamLeader.teamId], references: [team.id] }),
  person: one(person, { fields: [teamLeader.personId], references: [person.id] }),
}));

export const twoByTwoRelations = relations(twoByTwo, ({ one, many }) => ({
  campDay: one(campDay, { fields: [twoByTwo.campDayId], references: [campDay.id] }),
  partners: many(twoByTwoPartner),
}));

export const twoByTwoPartnerRelations = relations(twoByTwoPartner, ({ one }) => ({
  pairing: one(twoByTwo, { fields: [twoByTwoPartner.twoByTwoId], references: [twoByTwo.id] }),
  person: one(person, { fields: [twoByTwoPartner.personId], references: [person.id] }),
}));

export const contentPageRelations = relations(contentPage, ({ one, many }) => ({
  camp: one(camp, { fields: [contentPage.campId], references: [camp.id] }),
  sections: many(contentSection),
}));

export const contentSectionRelations = relations(contentSection, ({ one }) => ({
  page: one(contentPage, { fields: [contentSection.pageId], references: [contentPage.id] }),
}));

export const contactCategoryRelations = relations(contactCategory, ({ one, many }) => ({
  camp: one(camp, { fields: [contactCategory.campId], references: [camp.id] }),
  contacts: many(contact),
}));

export const contactRelations = relations(contact, ({ one }) => ({
  category: one(contactCategory, {
    fields: [contact.categoryId],
    references: [contactCategory.id],
  }),
}));

export const linkRelations = relations(link, ({ one }) => ({
  camp: one(camp, { fields: [link.campId], references: [camp.id] }),
}));

export const venueRelations = relations(venue, ({ one }) => ({
  camp: one(camp, { fields: [venue.campId], references: [camp.id] }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  camp: one(camp, { fields: [notification.campId], references: [camp.id] }),
  event: one(event, { fields: [notification.eventId], references: [event.id] }),
}));

/* ========================================================================== */
/* Inferred types                                                              */
/* ========================================================================== */

export type Camp = typeof camp.$inferSelect;
export type CampDay = typeof campDay.$inferSelect;
export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Song = typeof song.$inferSelect;
export type Room = typeof room.$inferSelect;
export type Team = typeof team.$inferSelect;
export type Person = typeof person.$inferSelect;
export type TwoByTwo = typeof twoByTwo.$inferSelect;
export type ContentPage = typeof contentPage.$inferSelect;
export type ContentSection = typeof contentSection.$inferSelect;
export type Contact = typeof contact.$inferSelect;
export type ContactCategory = typeof contactCategory.$inferSelect;
export type Link = typeof link.$inferSelect;
export type Venue = typeof venue.$inferSelect;
export type Admin = typeof admin.$inferSelect;
export type PushSubscription = typeof pushSubscription.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type EventCategory = (typeof eventCategory.enumValues)[number];
export type ContentPageKey = (typeof contentPageKey.enumValues)[number];
