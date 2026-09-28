# Camp App — Functional Specification

> **This document is the source of truth.** Every pull request must declare which
> requirement IDs it implements. Reviews are performed against the exact text below.
>
> If you believe a requirement is wrong, incomplete, or impossible: **do not silently
> deviate.** Open an issue, or raise it in your PR description under "Spec questions".
> Changing the spec is allowed and encouraged — changing it *without saying so* is not.

## How to read requirement IDs

| Prefix | Meaning |
| --- | --- |
| `FR-` | Functional requirement — user-visible behaviour |
| `DATA-` | Data model requirement — schema, constraints, migration |
| `NFR-` | Non-functional requirement — performance, accessibility, security |
| `ADM-` | Admin dashboard requirement |

IDs are **stable and never reused.** If a requirement is dropped, mark it
`[WITHDRAWN]` and leave the ID in place. If it changes materially, supersede it with a
new ID and mark the old one `[SUPERSEDED BY FR-XXX-NN]`.

Each requirement is marked with a priority:

- **MUST** — required for launch, blocking.
- **SHOULD** — expected, but may slip a phase with agreement.
- **MAY** — optional; implement only if the phase's core work is complete.

---

## 1. Authentication & Access (`FR-AUTH`)

The camp uses a **single shared access code** for all campers. There are no per-camper
accounts. See [ADR-0001](decisions/0001-shared-camp-code.md) for why.

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-AUTH-01` | MUST | An unauthenticated visitor to any camper route is redirected to the access-code screen. |
| `FR-AUTH-02` | MUST | The access code is verified **server-side only**. The correct code MUST NOT appear in any client bundle, API response, or error message. |
| `FR-AUTH-03` | MUST | On success the server sets a signed, `httpOnly`, `SameSite=Lax`, `Secure` session cookie. The session payload MUST NOT contain the access code. |
| `FR-AUTH-04` | MUST | The session lasts at least 30 days and survives PWA relaunch, so a camper logs in once for the whole camp. |
| `FR-AUTH-05` | MUST | An incorrect code shows a generic "Incorrect code" message. The response MUST NOT reveal whether a code was close, expired, or previously valid. |
| `FR-AUTH-06` | MUST | Code submission is rate-limited per IP. After a threshold, further attempts are rejected for a cooldown period. |
| `FR-AUTH-07` | SHOULD | The access code is stored hashed at rest and configurable per camp year without a code deploy. |
| `FR-AUTH-08` | MUST | Admin authentication is **separate** from camper access. Holding the camp code grants **no** admin capability. |
| `FR-AUTH-09` | MUST | No camper-facing request may carry a credential that grants write access to any resource. |

> **Legacy trap:** the old app compared the PIN in client JavaScript and shipped a
> live write-capable API key to every browser. See [LEGACY.md](LEGACY.md#l-01-client-side-pin-check).

---

## 2. Navigation & Shell (`FR-NAV`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-NAV-01` | MUST | Every camper page is reachable from a single navigation menu available on all pages. |
| `FR-NAV-02` | MUST | The menu closes when a destination is selected, and when the user taps/clicks outside it. |
| `FR-NAV-03` | MUST | The Android/browser back gesture closes an open menu or dialog before navigating away from the page. |
| `FR-NAV-04` | MUST | Every module is addressable by a distinct, shareable URL. |
| `FR-NAV-05` | MUST | Page scrolling uses native browser scrolling. Custom scroll-hijacking libraries MUST NOT be introduced. See [LEGACY.md](LEGACY.md#l-02-custom-scrolling). |
| `FR-NAV-06` | SHOULD | The shell renders header and navigation without waiting for module data, so navigation feels instant. |

---

## 3. Schedule (`FR-SCHED`)

The schedule is the app's landing page and its most-used module.

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-SCHED-01` | MUST | Events are grouped by camp day, with one selectable tab per day. |
| `FR-SCHED-02` | MUST | The number of camp days is **driven entirely by data**. The UI MUST work correctly with 1, 2, 3, 5 or more days. Hardcoding a day count is a defect. See [LEGACY.md](LEGACY.md#l-03-hardcoded-three-day-schedule). |
| `FR-SCHED-03` | MUST | Within a day, events are sorted by start time, ascending. |
| `FR-SCHED-04` | MUST | The event currently in progress is visually highlighted and distinguishable from past and upcoming events. |
| `FR-SCHED-05` | MUST | The highlight updates while the page stays open, without requiring a manual refresh, at least once per minute. |
| `FR-SCHED-06` | MUST | On first load the app auto-selects the tab for the current camp day. Before camp it selects the first day; after camp it selects the last day. |
| `FR-SCHED-07` | MUST | Each event displays a category icon, its title, its start and end time, and its subtitle when present. |
| `FR-SCHED-08` | MUST | Pull-to-refresh (touch) and a visible refresh affordance re-fetch the schedule. |
| `FR-SCHED-09` | MUST | All times are rendered in the camp's configured timezone regardless of the device timezone. See [DATA-EVENT-01](#6-data-model-data). |
| `FR-SCHED-10` | SHOULD | An empty day renders an explicit empty state, not a blank page. |

---

## 4. Content Modules (`FR-*`)

### 4.1 Sessions (`FR-SESS`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-SESS-01` | MUST | A list of all camp sessions is shown, each with topic and speaker. |
| `FR-SESS-02` | MUST | Selecting a session opens a detail view with topic, speaker, Bible reference, outline, and reflection questions. |
| `FR-SESS-03` | MUST | Outline and reflections are authored as rich text by admins and render with their formatting preserved. |
| `FR-SESS-04` | MUST | Admin-authored rich text is sanitised before rendering. Raw HTML injection MUST NOT be possible. |
| `FR-SESS-05` | MUST | A session detail view has its own URL and is shareable. |
| `FR-SESS-06` | SHOULD | Sessions with no notes yet render a "notes coming soon" state rather than empty fields. |

### 4.2 Song Book (`FR-SONG`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-SONG-01` | MUST | All songs are listed with song number, title, and first-line preview. |
| `FR-SONG-02` | MUST | Search matches against **both** title and full lyrics. |
| `FR-SONG-03` | MUST | Search is case-insensitive and ignores leading/trailing whitespace. |
| `FR-SONG-04` | MUST | Selecting a song shows its complete lyrics, preserving line and verse breaks. |
| `FR-SONG-05` | MUST | Lyrics are readable on a phone during worship: generous line height, high contrast, no horizontal scrolling. |
| `FR-SONG-06` | MUST | The song list remains smooth when scrolling the full collection (several hundred songs). |
| `FR-SONG-07` | SHOULD | The search input stays visible (sticky) while the results list scrolls. |
| `FR-SONG-08` | SHOULD | A search with no matches shows an explicit "no songs found" state. |
| `FR-SONG-09` | MAY | Songs can be looked up directly by typing their number. |

### 4.3 Teams (`FR-TEAM`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-TEAM-01` | MUST | All camp teams are listed, each showing its name and logo. |
| `FR-TEAM-02` | MUST | Selecting a team opens a detail view with captain(s), vice-captain(s), a contact number, and the full member list. |
| `FR-TEAM-03` | MUST | The contact number offers a tap-to-call action on mobile. |
| `FR-TEAM-04` | MUST | A team detail view has its own URL and is shareable. |
| `FR-TEAM-05` | SHOULD | A missing team logo falls back to a placeholder rather than a broken image. |

### 4.4 Rooms (`FR-ROOM`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-ROOM-01` | MUST | All rooms are listed with their description/number, location, and occupant names. |
| `FR-ROOM-02` | MUST | Search matches against **both** room description/location and occupant names. |
| `FR-ROOM-03` | MUST | Rooms are listed in a stable, human-sensible order (see [DATA-ROOM-02](#6-data-model-data)). |
| `FR-ROOM-04` | SHOULD | A search with no matches shows an explicit empty state. |

### 4.5 Two by Two (`FR-2X2`)

The fellowship-pairing module. **Its date-gating behaviour is a deliberate product
feature, not an implementation detail — read carefully.**

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-2X2-01` | MUST | Pairings are grouped by camp day, with one selectable tab per day. |
| `FR-2X2-02` | MUST | A day's pairings are **hidden** until that day arrives, preserving the surprise. |
| `FR-2X2-03` | MUST | Gating granularity is the **whole day**: a day's pairings become visible from local midnight at the start of that day, and remain visible for the rest of camp. |
| `FR-2X2-04` | MUST | Hidden days show a friendly "revealed on <date>" placeholder, and MUST NOT leak partner names. |
| `FR-2X2-05` | MUST | Gating is enforced **server-side**. Hidden pairings MUST NOT be present in any client payload, HTML, or API response before their reveal time. |
| `FR-2X2-06` | MUST | The **complete** set of pairings for a visible day renders without requiring the user to search first. See [LEGACY.md](LEGACY.md#l-04-two-by-two-partial-rendering). |
| `FR-2X2-07` | MUST | Search filters the visible day's pairings by participant name. |
| `FR-2X2-08` | MUST | The module includes accessible guidelines and conversation starters. |
| `FR-2X2-09` | MUST | On load, the tab for the current camp day is auto-selected. |
| `FR-2X2-10` | MUST | Reveal time is computed in the **camp's** timezone, not the device's, so a camper travelling across timezones cannot reveal pairings early. |

### 4.6 Prayer Wall (`FR-PRAY`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-PRAY-01` | MUST | Prayer points are shown grouped into titled categories. |
| `FR-PRAY-02` | MUST | Categories and their content are **admin-editable** and stored in the database, not in source code. |
| `FR-PRAY-03` | MUST | Category order is admin-controllable. |
| `FR-PRAY-04` | MUST | The page remains smooth to scroll with substantial formatted content. |

### 4.7 Contacts (`FR-CONT`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-CONT-01` | MUST | Contacts are listed grouped by role category (e.g. elders, coordinators, ministry leads). |
| `FR-CONT-02` | MUST | Each contact shows a name, role, and photo. |
| `FR-CONT-03` | MUST | Each contact offers a tap-to-call action. |
| `FR-CONT-04` | MUST | Each contact offers a WhatsApp action that opens a chat with that number. |
| `FR-CONT-05` | MUST | Contacts are admin-editable and database-backed. |
| `FR-CONT-06` | SHOULD | A missing photo falls back to initials or a placeholder. |

### 4.8 Guidelines & Rules pages (`FR-GUIDE`)

Covers camp guidelines, quiz rules, and indoor-game rules.

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-GUIDE-01` | MUST | Guidelines content is shown as titled, formatted sections (packing list, arrival, rules, venue, food, safety). |
| `FR-GUIDE-02` | MUST | Quiz rules and activity/game rules are shown on their own pages. |
| `FR-GUIDE-03` | MUST | **All** of this content is admin-editable and database-backed. Updating it for a new camp year MUST NOT require a code change or deploy. |
| `FR-GUIDE-04` | MUST | Admin-authored content is sanitised before rendering. |
| `FR-GUIDE-05` | SHOULD | Long pages offer in-page section navigation. |

### 4.9 Useful Links (`FR-LINK`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-LINK-01` | MUST | Links are listed grouped by category, each with a title and optional description. |
| `FR-LINK-02` | MUST | Links open in a new browser context and do not trap the user inside the PWA. |
| `FR-LINK-03` | MUST | External links carry `rel="noopener noreferrer"`. |
| `FR-LINK-04` | MUST | Links are admin-editable and database-backed. |

### 4.10 Venue (`FR-VENUE`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-VENUE-01` | MUST | The camp venue and the designated emergency hospital are both shown with addresses. |
| `FR-VENUE-02` | MUST | Each location offers a "navigate" action that opens the device's map application. |
| `FR-VENUE-03` | MUST | Map links work correctly on both Android and iOS. Platform behaviour MUST be feature-detected, not derived from a Cordova-only global. See [LEGACY.md](LEGACY.md#l-05-cordova-globals). |
| `FR-VENUE-04` | MUST | Venue details are admin-editable and database-backed. |

---

## 5. Cross-cutting Camper Features

### 5.1 Global Search (`FR-SEARCH`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-SEARCH-01` | SHOULD | A single search entry point queries across sessions, songs, rooms, contacts, and guidelines. |
| `FR-SEARCH-02` | SHOULD | Results are grouped by source module and state which module each result came from. |
| `FR-SEARCH-03` | SHOULD | Selecting a result navigates to that item's own page. |
| `FR-SEARCH-04` | MUST | Global search MUST respect [`FR-2X2-05`](#45-two-by-two-fr-2x2): unrevealed pairings are never searchable. |

### 5.2 PWA & Offline (`FR-PWA`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-PWA-01` | MUST | The app is installable to the device home screen with a name, icon set, and splash configuration. |
| `FR-PWA-02` | MUST | Launching from the home screen opens standalone, without browser chrome, directly into the app. |
| `FR-PWA-03` | MUST | A returning, authenticated user is not asked for the access code again (see `FR-AUTH-04`). |
| `FR-PWA-04` | MUST | Previously visited content remains readable offline. |
| `FR-PWA-05` | MUST | When offline or serving stale data, the UI says so rather than silently showing outdated information. |
| `FR-PWA-06` | MUST | A new deployment reaches already-installed clients without the user manually clearing storage. |
| `FR-PWA-07` | SHOULD | An install prompt is offered contextually, not on first paint. |

### 5.3 Live Updates (`FR-LIVE`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-LIVE-01` | MUST | An admin content change is reflected for campers **without a redeploy**. |
| `FR-LIVE-02` | MUST | Schedule changes propagate to campers within 60 seconds of being saved. |
| `FR-LIVE-03` | SHOULD | Other module changes propagate within 5 minutes, or on next navigation to that module. |
| `FR-LIVE-04` | MUST | Cached content MUST NOT be served indefinitely. Every cached surface has a defined staleness bound. |

### 5.4 Notifications & Reminders (`FR-PUSH`)

Notifications are **broadcast to all subscribers**. There is no per-camper targeting.
See [ADR-0001](decisions/0001-shared-camp-code.md).

| ID | Priority | Requirement |
| --- | --- | --- |
| `FR-PUSH-01` | MUST | A camper can opt in to push notifications, and can opt out again from within the app. |
| `FR-PUSH-02` | MUST | Permission is requested only after an explicit user action explaining the benefit — never automatically on load. |
| `FR-PUSH-03` | MUST | The app detects when push is unavailable (notably iOS Safari before home-screen install) and explains what the user must do instead of failing silently. See [LEGACY.md](LEGACY.md#l-06-ios-push-constraint). |
| `FR-PUSH-04` | MUST | An admin can compose and broadcast an announcement to all subscribers. |
| `FR-PUSH-05` | MUST | Tapping a notification opens the relevant in-app page. |
| `FR-PUSH-06` | MUST | Automated reminders are sent a configurable interval before an event starts. |
| `FR-PUSH-07` | MUST | A reminder is sent **at most once** per event, even if the scheduler runs repeatedly, overlaps, or retries. |
| `FR-PUSH-08` | MUST | Reminders are not sent for events that have already started or been deleted. |
| `FR-PUSH-09` | MUST | Rescheduling an event reschedules or cancels its pending reminder accordingly. |
| `FR-PUSH-10` | MUST | Expired or rejected push subscriptions are pruned automatically. |
| `FR-PUSH-11` | SHOULD | Campers can opt into or out of notification categories (e.g. schedule changes, announcements, reminders). |
| `FR-PUSH-12` | MUST | Notification sending is restricted to authenticated admins and is rate-limited. |

---

## 6. Data Model (`DATA`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `DATA-EVENT-01` | MUST | Event start and end are stored as absolute timestamps (`timestamptz`), **not** as display strings. The camp timezone is stored as configuration. See [LEGACY.md](LEGACY.md#l-07-free-text-times). |
| `DATA-EVENT-02` | MUST | An event's end MUST NOT be before its start; this is enforced by a database constraint. |
| `DATA-EVENT-03` | MUST | An event's category is a constrained value, not an unvalidated free number. |
| `DATA-DAY-01` | MUST | Camp days are represented as data with an explicit date and ordering. Day count is never hardcoded (supports `FR-SCHED-02`). |
| `DATA-ROOM-02` | MUST | Rooms have an explicit sort key so ordering is stable and human-sensible (e.g. `A10` after `A9`, not before). |
| `DATA-2X2-01` | MUST | Each pairing references a camp day and its participants, and the day carries the reveal date used by `FR-2X2-03`. |
| `DATA-CONTENT-01` | MUST | All formerly-hardcoded pages (prayer wall, guidelines, quiz rules, game rules, contacts, venue, links) are database-backed with a defined schema. |
| `DATA-MIG-01` | MUST | A repeatable migration imports the legacy PostgreSQL dump into the new schema, including the free-text time conversion. |
| `DATA-MIG-02` | MUST | The migration is idempotent, or safely re-runnable against a clean database, and is verified by a row-count and spot-value check. |
| `DATA-MIG-03` | MUST | Legacy records that cannot be converted (e.g. unparseable times) fail loudly with a report. They MUST NOT be silently dropped or defaulted. |
| `DATA-SEED-01` | MUST | A seed script produces a realistic, non-empty dataset so any developer can run the app locally without production data. |
| `DATA-SEED-02` | MUST | Seed and fixture data contain **no real personal data** — no real names, phone numbers, or photos. |
| `DATA-INT-01` | MUST | Referential integrity is enforced by foreign keys. Orphaned join rows MUST NOT be possible. |

---

## 7. Admin Dashboard (`ADM`)

| ID | Priority | Requirement |
| --- | --- | --- |
| `ADM-01` | MUST | Admins log in with a username and password. Passwords are stored using a modern, salted, slow hash. |
| `ADM-02` | MUST | Every admin route and mutation is authorised server-side. Hiding a UI control is **not** authorisation. |
| `ADM-03` | MUST | Two roles are supported: admin, and super-admin. Only super-admins can manage other admin accounts. |
| `ADM-04` | MUST | Full create/read/update/delete for: schedule days, events, sessions, songs, teams, rooms, users, two-by-two pairings, and links. |
| `ADM-05` | MUST | Full editing for all database-backed static content (`DATA-CONTENT-01`). |
| `ADM-06` | MUST | A rich-text editor is available for long-form fields, and its output is sanitised **server-side** on save. |
| `ADM-07` | MUST | Image upload for team logos and contact photos, with type and size validation. |
| `ADM-08` | MUST | Uploaded files MUST NOT be executable, and the upload path MUST NOT permit directory traversal or overwriting existing files. |
| `ADM-09` | MUST | All input is validated server-side against a schema. Client validation is a convenience only. |
| `ADM-10` | MUST | Destructive actions require confirmation and report what will be affected. |
| `ADM-11` | MUST | Saving content invalidates the relevant camper-facing cache, satisfying `FR-LIVE-01`. |
| `ADM-12` | SHOULD | Deletions are recoverable (soft delete or archive), mirroring the legacy `archive` table's intent. |
| `ADM-13` | SHOULD | An audit trail records who changed what and when. |
| `ADM-14` | MUST | The admin dashboard is usable on a laptop screen; unlike the camper app it is not required to be mobile-first. |
| `ADM-15` | MUST | Bulk entry for repetitive data (songs, rooms, users) is possible without one-by-one form submission. |

---

## 8. Non-Functional Requirements (`NFR`)

### 8.1 Performance

| ID | Priority | Requirement |
| --- | --- | --- |
| `NFR-PERF-01` | MUST | The schedule page is interactive within 3 seconds on a mid-range Android phone on a 3G-like connection. |
| `NFR-PERF-02` | MUST | Long lists (songs, rooms, pairings) scroll smoothly without visible stutter on a mid-range phone. |
| `NFR-PERF-03` | MUST | No camper page ships an unbounded dataset to the client purely to render the first screen. |
| `NFR-PERF-04` | SHOULD | Lighthouse mobile performance ≥ 85 on schedule, songs, and rooms. |
| `NFR-PERF-05` | MUST | Images are served responsively sized; original-resolution photos MUST NOT be shipped to phones. |

### 8.2 Accessibility

| ID | Priority | Requirement |
| --- | --- | --- |
| `NFR-A11Y-01` | MUST | All interactive elements are reachable and operable by keyboard. |
| `NFR-A11Y-02` | MUST | Body text meets WCAG AA contrast (4.5:1), in both light and dark themes. |
| `NFR-A11Y-03` | MUST | All images and icon-only buttons carry accessible names. |
| `NFR-A11Y-04` | MUST | Opening the menu or a dialog moves focus into it and restores focus on close. |
| `NFR-A11Y-05` | MUST | Tap targets are at least 44×44 CSS pixels. |
| `NFR-A11Y-06` | SHOULD | The app respects the OS "reduce motion" preference. |
| `NFR-A11Y-07` | SHOULD | A dark mode is available and follows the OS preference by default. |

### 8.3 Security

| ID | Priority | Requirement |
| --- | --- | --- |
| `NFR-SEC-01` | MUST | No secret (access code, admin credential, VAPID private key, database URL, API token) is present in any client bundle or committed to the repository. |
| `NFR-SEC-02` | MUST | All database access happens server-side. The browser never talks to the database directly. |
| `NFR-SEC-03` | MUST | All rendered user- or admin-authored HTML is sanitised against XSS. |
| `NFR-SEC-04` | MUST | All queries are parameterised. String-concatenated SQL is prohibited. |
| `NFR-SEC-05` | MUST | Mutating requests are protected against cross-site request forgery. |
| `NFR-SEC-06` | MUST | Authentication endpoints and notification sending are rate-limited. |
| `NFR-SEC-07` | MUST | Dependencies are free of known high or critical vulnerabilities at merge time. |
| `NFR-SEC-08` | MUST | Error responses do not leak stack traces, SQL, or file paths to clients. |

### 8.4 Reliability & Operations

| ID | Priority | Requirement |
| --- | --- | --- |
| `NFR-OPS-01` | MUST | A successful CI build is a precondition for merge. |
| `NFR-OPS-02` | MUST | The whole stack runs locally with a documented, single-command setup. |
| `NFR-OPS-03` | MUST | Required environment variables are documented and validated at startup, failing fast with a clear message. |
| `NFR-OPS-04` | MUST | Database schema changes are applied through checked-in, ordered migrations. Manual production edits are prohibited. |
| `NFR-OPS-05` | SHOULD | Server errors are reported to an error-tracking service. |
| `NFR-OPS-06` | SHOULD | A health-check endpoint reports application and database status. |
| `NFR-OPS-07` | MUST | The app degrades gracefully if the database is briefly unavailable: it shows an error state, it does not crash. |

### 8.5 Code Quality

| ID | Priority | Requirement |
| --- | --- | --- |
| `NFR-CODE-01` | MUST | TypeScript is used throughout. `any` requires a written justification in review. |
| `NFR-CODE-02` | MUST | Lint and format checks pass with no warnings. |
| `NFR-CODE-03` | MUST | Data access is centralised in a data layer, not scattered inline through components. |
| `NFR-CODE-04` | MUST | Business rules with real logic — time parsing, reveal gating, current-event detection, reminder de-duplication — have unit tests covering their edge cases. |
| `NFR-CODE-05` | MUST | Every module has at least one end-to-end test covering its primary user journey. |
| `NFR-CODE-06` | MUST | No commented-out code blocks or debug logging in merged code. See [LEGACY.md](LEGACY.md#l-08-commented-out-code). |
| `NFR-CODE-07` | MUST | No secrets, tokens, or personal data in the repository, including its history. |

---

## 9. Explicitly Out of Scope

Listed so nobody builds them speculatively. Adding any of these requires an ADR.

- Per-camper accounts, logins, or profiles (see [ADR-0001](decisions/0001-shared-camp-code.md)).
- Personalised views ("your room", "your team", "your partner").
- Targeted or per-person notifications.
- Camper-generated content: comments, chat, photo uploads, prayer submissions.
- Payments, registration, or ticketing.
- Native iOS/Android app store builds. The PWA is the delivery vehicle.
- Multi-camp / multi-tenant support. One camp per deployment.
- Offline *writes*. Offline is read-only.
