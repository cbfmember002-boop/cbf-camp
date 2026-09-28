# The Legacy App — What It Did, and What To Watch Out For

This document exists so you **don't** faithfully reimplement the old app's bugs.

The original product is three repositories. You are replacing all three. You do not need
to run them, but you should be able to read them — they are the only complete record of
how some features actually behave.

| Repo | Stack | Role |
| --- | --- | --- |
| `camp-api` | Sails.js 1.x, PostgreSQL, Docker, nginx | REST API, mostly auto-generated CRUD |
| `camp-ui` | AngularJS 1.x, Angular Material, ui-router, iScroll, Cordova | The camper-facing PWA |
| `camp-admin-ui` | Backbone + Marionette, Nunjucks, Semantic UI, webpack 1 | The admin CRUD tool |

---

## Part 1 — How the legacy system was built

### `camp-api`

A Sails.js application leaning almost entirely on **blueprint routes**: define a model,
get REST CRUD for free. Only three routes were written by hand (admin signup, admin
login, and team image upload).

Models: `User`, `Team`, `Room`, `Schedule`, `Event`, `Session`, `Song`, `TwoByTwo`,
`Link`, `Media`, `Admin`, plus an `archive` table capturing deleted records.

Relationships used Waterline collection associations, which produce implicit join
tables with generated names like
`twobytwo_partners__user_partners_user`. This naming is a Waterline artifact — **do not
carry these table names forward.** Design clean join tables.

Authorisation was a single policy applied globally: read an `X-API-KEY` header, look up
a matching `admin` row, allow the request. There was **one** trust level — anyone with
the key could read *and write* everything.

`TwoByTwoController.find` is the one place the blueprints were abandoned in favour of
raw SQL, because the pairing data needed grouping the blueprints couldn't express. It's
worth reading as a description of the desired output shape.

### `camp-ui`

AngularJS with `ui-router`, one state per module. There is **no build step** for the
app source: vendor libraries are committed into the repo and files are hand-copied from
`www/` to `dist/`.

The data pattern per module is a service that fetches from the API, transforms the
response, and writes it into `localStorage`; the controller reads the cached copy on
load and refreshes in the background.

Static content — prayer wall, camp rules, quiz rules, indoor-game rules, contacts,
venue — was **hardcoded HTML** inside Angular partials. Updating it for a new camp year
meant editing markup and redeploying. Removing this is a primary goal of the rewrite
(`FR-GUIDE-03`, `DATA-CONTENT-01`).

### `camp-admin-ui`

A Backbone/Marionette single-page app with a model and collection per API resource, and
a list/edit view per resource. It stored the admin API key in a cookie and attached it
to every request. It included Trumbowyg for rich text and a media upload view.

Its feature set is the **minimum bar** for the new admin dashboard: users, teams, songs,
sessions, events, schedules, two-by-twos, rooms. The new one must additionally manage
all the static content that used to be hardcoded.

---

## Part 2 — Known traps

Each trap has an ID. If your PR touches the relevant area, say how you handled it.

### L-01 — Client-side PIN check

**What it did:** the camper "login" compared the typed PIN against a hardcoded string
*inside client-side JavaScript*. Separately, the API key was a literal in the shared
frontend service and was sent to the API from the browser.

**Why it's a problem:** both the camp PIN and a fully write-capable API credential were
readable by anyone who opened devtools. The "authentication" stopped nobody.

**What to do:** verify the code server-side and hand back a signed `httpOnly` session
cookie. The browser must never possess a credential that can write.

**Requirements:** `FR-AUTH-02`, `FR-AUTH-03`, `FR-AUTH-09`, `NFR-SEC-01`, `NFR-SEC-02`

---

### L-02 — Custom scrolling

**What it did:** used the iScroll library plus a custom scroller directive to replace
native scrolling app-wide.

**Why it's a problem:** it was the single largest source of engineering pain — it fought
with dynamic lists, nested scroll areas, dialogs, and pull-to-refresh, and needed
re-measuring whenever content changed. The project's own assessment calls this out.

**What to do:** use native scrolling. If you need pull-to-refresh, implement it over
native scroll. Do not introduce a scroll-hijacking library.

**Requirements:** `FR-NAV-05`, `NFR-PERF-02`

---

### L-03 — Hardcoded three-day schedule

**What it did:** the schedule controller assumed exactly three camp days. A periodic
timer indexed `scheduleArr[0]`, `scheduleArr[1]` and `scheduleArr[2]` directly, and the
"after camp" branch set the tab index to the literal `2`.

**Why it's a problem:** a camp with two days throws a runtime error every minute; a camp
with four days silently breaks highlighting on the extra day. The day count is data, and
the code pretended it was a constant.

The same code also applied the current-event index from one day to *all three* days when
clearing highlights, so it could clear the wrong event.

**What to do:** derive everything from the data. Your implementation must be correct for
1, 2, 3 and 5+ days. A test with a non-three-day fixture is expected.

**Requirements:** `FR-SCHED-02`, `FR-SCHED-06`, `DATA-DAY-01`, `NFR-CODE-04`

---

### L-04 — Two by Two partial rendering

**What it did:** originally rendered only a subset of pairings; users had to type in the
search box before the rest appeared. It was later changed to render everything, which
then created scrolling problems (see L-02).

**Why it's a problem:** people could not find their own pairing. This is the module's
entire purpose.

**What to do:** render the complete set for a revealed day, with no search required.

**Requirements:** `FR-2X2-06`

---

### L-05 — Cordova globals

**What it did:** platform detection read `window.device.platform`, a global injected by
a Cordova plugin. Other code depended on Cordova's SQLite plugin and a `deviceready`
event.

**Why it's a problem:** in a plain browser `window.device` is undefined, so that code
throws. The new app is a pure PWA with no Cordova at all.

**What to do:** no Cordova. Feature-detect, or use platform-neutral URLs (a `geo:` or
universal maps URL works on both platforms without branching).

**Requirements:** `FR-VENUE-03`

---

### L-06 — iOS push constraint

**Not a legacy bug — a platform constraint that will surprise you.**

Web Push works on Android and desktop from a normal browser tab. On iOS it works **only**
when the site has been installed to the home screen, and only on iOS 16.4+. A camper
browsing in Safari cannot receive notifications and the permission request will not
succeed.

**What to do:** detect this and tell the user to install the app first, rather than
failing silently or showing a broken toggle. Since a large share of campers will be on
iPhones, treat this messaging as part of the feature, not a nicety.

**Requirements:** `FR-PUSH-03`

---

### L-07 — Free-text times and dates

**What it did:** `event.startTime` and `event.endTime` were free-text strings such as
`"7:30pm"`, and `schedule.date` was a string like `"24/05/2026"` (`dd/MM/yyyy`). The
frontend parsed them with a regular expression that split on `:`, `am`, or `pm`, then
special-cased 12 o'clock, then constructed a local `Date`.

**Why it's a problem:**
- Anything typed slightly differently (`"7.30 pm"`, `"19:30"`, a stray space) parses to
  garbage or `NaN`, with no validation at entry.
- Times are interpreted in the *device's* timezone, so the app shows different times to
  a camper whose phone is set to another timezone.
- You cannot reliably schedule a reminder off `"7:30pm"`.

**What to do:** store real `timestamptz` values, store the camp timezone as config, and
convert the legacy data once during migration. Unparseable legacy values must be
reported, not guessed at.

**Requirements:** `DATA-EVENT-01`, `DATA-MIG-01`, `DATA-MIG-03`, `FR-SCHED-09`, `FR-PUSH-06`

---

### L-08 — Commented-out code and debug logging

**What it did:** dead code was left commented out beside its replacement (the Two by Two
tab-selection logic has an entire superseded version sitting above the live one), and
`console.log` calls were left in shipped controllers.

**Why it's a problem:** the commented block was subtly different from the live one, so a
reader cannot tell which behaviour is intended. Version control already remembers old
code.

**What to do:** delete dead code. Remove debug logging before merge.

**Requirements:** `NFR-CODE-06`

---

### L-09 — Plaintext credential in the migration

**What it did:** the checked-in database dump seeds an admin row with a plaintext
username, password and a fixed API key.

**Why it's a problem:** if that dump were ever applied to a real environment, it creates
a known-credential admin account. Admin passwords elsewhere were bcrypt-hashed, so this
seed also bypasses the app's own hashing.

Related: API keys were generated as **v1 UUIDs**, which encode a timestamp and MAC
address and are not suitable as secrets.

**What to do:** never commit credentials. Seed data must use randomly generated
development-only values, and secret-like tokens must come from a cryptographically
secure random source.

**Requirements:** `NFR-SEC-01`, `NFR-CODE-07`, `DATA-SEED-02`, `ADM-01`

---

### L-10 — Unbounded fetches

**What it did:** the frontend requested every collection with `?limit=5000` and cached
whole datasets in `localStorage`.

**Why it's a problem:** the entire song book, every room and every user were downloaded
and parsed before the first screen could render, on a phone, possibly on camp wifi.
`localStorage` is also synchronous and size-capped.

**What to do:** render the first screen from the server with only the data it needs.
Paginate, stream, or search server-side where a collection can grow.

**Requirements:** `NFR-PERF-01`, `NFR-PERF-03`, `FR-SONG-06`

---

### L-11 — No referential integrity

**What it did:** Waterline join tables were created without foreign key constraints, so
deleting a user could leave join rows pointing at a row that no longer exists.

**Why it's a problem:** the Two by Two query inner-joins across those tables, so orphan
rows silently drop pairings from the results — a pairing just vanishes with no error.

**What to do:** declare real foreign keys with explicit delete behaviour, and let the
database enforce it.

**Requirements:** `DATA-INT-01`

---

## Part 3 — Behaviour worth preserving

Not everything is a trap. These were good decisions — keep them:

- **One shared code, no accounts.** Zero administrative overhead, and campers get in
  instantly. Deliberately retained; see [ADR-0001](decisions/0001-shared-camp-code.md).
- **Schedule as the landing page.** It's what people open the app for.
- **Current-event highlighting.** Small feature, disproportionately useful — it answers
  "what's happening now?" without reading.
- **Search where lists are long.** Songs, rooms and pairings each have it.
- **Two by Two's delayed reveal.** The surprise is the point of the feature.
- **Tap-to-call and WhatsApp shortcuts on contacts.** Removes all friction in a moment
  of need.
- **A consistent shell across every module.** Same header, same menu, same interactions,
  so there is nothing to learn.
- **Mobile-first.** Every screen is designed for a phone held one-handed.
