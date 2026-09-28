# Architecture

> **Status:** partly a decision record, partly a template. Sections marked
> _(to be completed in Phase N)_ are filled in by whoever does that phase, as part of
> that phase's PR. Keeping this current is a requirement, not a courtesy — the next
> person relies on it.

## Principles

These are the load-bearing ideas. When a specific choice is ambiguous, decide in the
direction these point.

1. **The server holds the secrets.** The browser never possesses a credential that can
   write. This is the single biggest change from the legacy app, which shipped a
   write-capable API key to every visitor.
2. **The data decides the shape.** Day counts, categories, and content structure come
   from the database. Hardcoding a count is a defect (`L-03`).
3. **Content is editable without a deploy.** Every page an organiser might want to change
   between camps is database-backed (`FR-GUIDE-03`).
4. **Mobile first, on camp wifi.** The target device is a mid-range Android phone on a
   poor connection. Ship less to it.
5. **Boring and legible beats clever.** This codebase is maintained occasionally, by
   volunteers, often a year after it was written.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js, App Router | Server components let us keep data access server-side |
| Language | TypeScript, `strict` | `NFR-CODE-01` |
| Database | PostgreSQL on Neon | Same engine as the legacy app, easing migration |
| Data access | Drizzle ORM | [ADR-0002](decisions/0002-neon-drizzle-prebuilt-data-layer.md) |
| Styling | _(Phase 0 decision)_ | `globals.css` is deliberately near-empty |
| Validation | Zod | At every trust boundary: env, forms, API input |
| Camper auth | Server-verified code, signed `httpOnly` cookie | [ADR-0001](decisions/0001-shared-camp-code.md) |
| Admin auth | Username + password, modern slow hash | `ADM-01` |
| File storage | Vercel Blob | [ADR-0002](decisions/0002-neon-drizzle-prebuilt-data-layer.md) |
| PWA | Manifest + service worker | Phase 8 |
| Push | Web Push (VAPID) | Phase 9 |
| Testing | Vitest + _(Phase 0 e2e decision)_ | |
| Hosting | _(Phase 10 decision)_ | |

## Project structure

_(to be completed in Phase 0)_

Record the chosen structure — feature-grouped or type-grouped — and the rule for where a
new file goes. Consistency matters more than which one you pick.

## Data model

Defined in [`src/db/schema.ts`](../src/db/schema.ts); the generated SQL is in
`drizzle/0000_*.sql`. Twenty tables, all with real foreign keys and deliberate
`ON DELETE` behaviour (`DATA-INT-01`).

```
camp ──┬── camp_day ──┬── event ──── session
       │              └── two_by_two ──── two_by_two_partner ──── person
       ├── person ────┬── team ──── team_leader
       │              └── room
       ├── song
       ├── content_page ──── content_section
       ├── contact_category ──── contact
       ├── venue
       ├── link
       ├── push_subscription
       └── notification ──── event
```

Choices worth knowing:

- **`camp` is a table.** One camp per deployment (SPEC §9), but the row is the natural
  home for the camp name, timezone and access code hash, and it keeps every other table
  scoped by a real foreign key.
- **`camp_day.date` is ISO text (`'2026-05-24'`), not a timestamp.** "The second day of
  camp" is a calendar concept, not an instant. Combining it with the camp timezone
  derives instants where they're needed; storing it as a timestamp would invite the
  timezone bugs this schema exists to avoid.
- **Day count is data** — `camp_day` rows with an ordering column. Nothing may assume
  three (`DATA-DAY-01`, [L-03](LEGACY.md#l-03-hardcoded-three-day-schedule)).
- **`person`, not `user`.** It isn't an account ([ADR-0001](decisions/0001-shared-camp-code.md)),
  and `user` is a reserved word in PostgreSQL.
- **Room sort key is derived on write** by zero-padding each numeric run
  ([`src/lib/sort-key.ts`](../src/lib/sort-key.ts)), so `A10` sorts after `A9` from a
  single indexed column (`DATA-ROOM-02`).
- **A Two by Two pairing is a group of partners**, not two columns. An odd number of
  participants means one group of three, which two columns cannot express (`DATA-2X2-01`).
- **`camp_day.two_by_two_reveal_at` stores the reveal instant** rather than computing it,
  so organisers can stagger or reveal early.
- **Song search uses a GIN index** on `to_tsvector(title || lyrics)` so search happens in
  the database, not by shipping every song to the browser
  ([L-10](LEGACY.md#l-10-fetch-everything)).
- **Reminder at-most-once is a partial unique index** (`drizzle/0001_reminder_dedupe.sql`),
  not an application check, because concurrent scheduler runs would race (`FR-PUSH-07`).
- Rich-text storage for `content_section.body` is still open — see Phase 1.

## Time handling

The rule, which applies everywhere:

- Store absolute instants as `timestamptz` (`DATA-EVENT-01`).
- Store the camp timezone as configuration (on the `camp` row).
- **Render and compute in the camp timezone, never the device's.** A camper whose phone
  is in another timezone must see identical times (`FR-SCHED-09`), and must not be able
  to reveal Two by Two pairings early (`FR-2X2-10`).
- Never store or transport a time as a display string. That's `L-07`.

Implemented in [`src/lib/camp-time.ts`](../src/lib/camp-time.ts), with no timezone
dependency — `Intl.DateTimeFormat` supplies the offset, including across DST. The
functions to use are `campTimeToInstant`, `campDayStart`, `campDateOf`, `formatCampTime`
and `formatCampDate`. `parseLegacyTime` and `parseLegacyDate` exist solely for the
one-off legacy import and should never be used on new data.

## Authentication

**Campers.** One shared access code for the whole camp, verified server-side, exchanged
for a signed `httpOnly` session cookie lasting the length of camp. The code never
reaches the client bundle. Camper sessions grant **read access only** (`FR-AUTH-09`).

**Admins.** Entirely separate. Username and password, two roles (admin, super-admin),
authorised server-side on every route and mutation (`ADM-02`, `ADM-03`).

The two systems share no credentials and no session. Holding the camp code grants no
admin capability (`FR-AUTH-08`).

_(Phase 2 and Phase 6 complete this.)_

## Caching and live updates

Content must reach campers without a redeploy (`FR-LIVE-01`), with schedule changes
propagating within 60 seconds (`FR-LIVE-02`). Nothing may be cached indefinitely
(`FR-LIVE-04`).

The general approach: render on the server, cache with tags, and invalidate the relevant
tags when an admin saves (`ADM-11`).

_(Phase 3 establishes the pattern; Phase 6 wires invalidation to admin writes.)_

## Security model

| Concern | Approach |
| --- | --- |
| Secrets | Server-side only. `NEXT_PUBLIC_` is a security decision (`NFR-SEC-01`) |
| Database access | Server only; the browser never connects (`NFR-SEC-02`) |
| Authored HTML | Sanitised before render, and on save (`NFR-SEC-03`, `ADM-06`) |
| SQL | Always parameterised (`NFR-SEC-04`) |
| Mutations | CSRF-protected, server-authorised, schema-validated |
| Gated content | Filtered **server-side**; never sent then hidden (`FR-2X2-05`) |
| Rate limiting | Auth endpoints and notification sending (`NFR-SEC-06`) |
| Errors | No stack traces, SQL, or paths to clients (`NFR-SEC-08`) |

## What we deliberately don't do

- No Cordova, and no dependence on Cordova globals (`L-05`).
- No custom scrolling (`FR-NAV-05`, `L-02`).
- No client-side database or `localStorage` as the primary data store (`L-10`).
- No per-camper accounts ([ADR-0001](decisions/0001-shared-camp-code.md)).
- No unbounded `?limit=5000` fetches to render a first screen (`NFR-PERF-03`).
