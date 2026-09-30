# CBF Camp

The CBF Camp website is a new Next.js application replacing the old camp application.

The goal is to provide a clean, responsive, mobile-first camp experience for participants, along with an admin area for managing camp content.

The application should work well on:

* Mobile phones
* Tablets
* iPads
* Desktop browsers

The mobile experience is particularly important because most campers will access the application from their phones.

---

## Tech Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* PostgreSQL
* Neon
* Drizzle ORM
* Vercel

The database has already been seeded with realistic camp data.

---

# Getting Started

## 1. Clone the repository

Clone the repository and enter the project directory.

```bash
git clone <repository-url>
cd cbf-camp
```

## 2. Install dependencies

This project uses pnpm.

```bash
pnpm install
```

## 3. Get the database connection

Ask Jestin for the development **read-only database connection string**.

Create:

```text
.env.local
```

and add:

```env
DATABASE_URL=...
```

Do not commit `.env.local`.

The database is already populated with development data. You should not need to create or seed the database yourself.

## 4. Start the application

```bash
pnpm dev
```

Then open the local development URL shown by Next.js.

## 5. Useful commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

The database is already set up and seeded. Do not run migrations or seed scripts unless specifically asked by Jestin.

---

# Important Development Rules

### Responsive by default

Every page and component must be responsive.

Design mobile-first and then adapt for larger screens.

Do not build a desktop page and try to make it responsive afterwards.

### Use the seeded database

The database already contains realistic data for the camp.

Use the database data when building pages rather than hardcoding example content into the UI.

### Don't modify the database structure

Do not change the schema, create migrations, seed data, or modify database records unless specifically requested.

The development database connection provided to you is read-only.

### Keep the UI reusable

Where several pages share the same pattern, create reusable components rather than duplicating the UI.

Examples:

* Header
* Footer
* Page header
* Cards
* Lists
* Search
* Navigation
* Empty states
* Loading states
* Error states
* Admin tables/forms

### Mobile is the primary experience

Pay particular attention to:

* Touch targets
* Navigation
* Typography
* Long lists
* Tables
* Search
* Scrolling
* Buttons
* Images
* Bottom navigation where appropriate

---

# Build Phases

Work through the phases in order.

Do not try to build every page at once.

---

## Phase 1 — Project Setup & Application Shell

Get the basic application structure working.

### Build

* Application layout
* Header
* Footer
* Global styles
* Responsive layout
* Basic navigation
* Loading states
* Error states
* Not-found page
* Basic reusable UI components
* Public assets structure

Add the required logos, icons and other static assets to:

```text
public/
```

Wire the logos and assets into the application.

### Done when

* The application has a consistent visual shell.
* Navigation works.
* Header and footer work on mobile and desktop.
* The application looks good at common phone, tablet and desktop sizes.
* Static assets are correctly loaded from `public/`.

---

# Phase 2 — Authentication & Protected Routes

Build the authentication foundation.

There are two types of access:

### Camper access

Campers use the shared camp access code.

There are no individual camper accounts.

### Admin access

Administrators have a separate username/password login.

### Build

* Camp access page
* Admin login page
* Authentication state
* Protected routes
* Logout
* Authentication error states
* Session persistence
* Redirects for authenticated/unauthenticated users

Authentication should use the existing server-side authentication architecture.

Do not store authentication credentials or authentication tokens in `localStorage`.

The login/session should remain persistent using the secure session mechanism already defined for the application.

### Done when

* Unauthenticated users cannot access protected pages.
* Campers can enter the camp access code.
* Admins can access the admin area.
* Logout works.
* Refreshing the browser does not unexpectedly log the user out.
* Authentication works on mobile and desktop.

---

# Phase 3 — Main Landing Page

Build the main camp landing page.

This is the first page campers should see after entering the application.

The landing page should provide large, easy-to-understand navigation to the major areas of the camp application.

Examples include:

* Schedule
* Sessions
* Songs
* People
* Teams
* Two by Two
* Contacts
* Camp Information
* Venues
* Links
* Other relevant camp sections

Use the seeded database to determine which content is available.

### Done when

* The landing page clearly presents the major camp areas.
* Navigation works.
* The design is visually clear and easy to use on a phone.
* The layout adapts properly to tablets and desktops.

---

# Phase 4 — Admin Landing Page

Create the admin version of the application.

The admin landing page should use the same overall visual language as the main application but provide management functionality.

Each major area should allow an administrator to manage its associated content.

For example:

```text
Admin Home

Schedule       → View / Add / Edit
Sessions       → View / Add / Edit
Songs          → View / Add / Edit
People         → View / Add / Edit
Teams          → View / Add / Edit
Rooms          → View / Add / Edit
Contacts       → View / Add / Edit
Content Pages  → View / Add / Edit
Venues         → View / Add / Edit
Links          → View / Add / Edit
```

Management pages should generally use:

* Search
* Lists/tables
* Add forms
* Edit forms
* Appropriate filtering
* Clear actions
* Confirmation where destructive actions are involved

The admin experience should also be responsive.

### Important

The current development database is read-only.

Initially, build the admin UI and interaction patterns against the existing data. Actual database writes will be enabled separately when the write-capable backend is ready.

Do not work around the read-only database by changing permissions or creating another database connection.

---

# Phase 5 — Schedule

Build the main schedule experience.

Use the seeded:

* Camp days
* Events
* Sessions
* Event categories
* Times

The schedule should make it easy to understand:

* What is happening now
* What is happening next
* What happened earlier
* What is happening on each camp day

Pay attention to the camp timezone and event times.

Do not convert camp times to the user's device timezone.

### Include

* Day navigation
* Event cards/list
* Current/upcoming event indication
* Event details
* Session information where applicable
* Empty days
* Events around midnight

The seeded database deliberately contains edge cases that should work correctly.

---

# Phase 6 — Core Camp Content Pages

Build the main informational pages using the seeded content.

Start with:

* Camp Guidelines
* Quiz Rules
* Game Rules
* Two-by-Two Guidelines
* Prayer Wall
* Venue information

Content should come from the database rather than being hardcoded into the page.

Create reusable components for displaying content sections.

---

# Phase 7 — People, Teams & Rooms

Build the participant-related pages.

### People

Use the seeded people data.

Include:

* Search
* Person details
* Team information where applicable
* Room information where applicable
* Appropriate contact actions where provided

### Teams

Display:

* Teams
* Team members
* Team leaders
* Team contact information
* Team branding where available

### Rooms

Display:

* Room list
* Location
* Occupants where appropriate
* Useful room information

Use the existing room sorting logic rather than relying on alphabetical string sorting.

---

# Phase 8 — Two by Two

Build the Two-by-Two experience using the seeded data.

The application should respect the configured reveal time for each camp day.

The UI should handle:

* Before reveal
* After reveal
* Participants
* Partners
* The group containing three people

Do not assume every day has Two-by-Two data.

---

# Phase 9 — Songs

Build the songbook.

Use the seeded songs.

Include:

* Song list
* Search
* Song number
* Song title
* First line
* Lyrics
* Song detail page

The search should work well on mobile.

Long songs should remain easy to read and navigate.

---

# Phase 10 — Contacts, Venues & Links

Build the remaining utility sections.

### Contacts

Use the seeded contact categories and contacts.

Include appropriate actions such as:

* Call
* WhatsApp/message where appropriate

### Venues

Display venue information including:

* Name
* Type
* Address
* Phone
* Location information where available

### Links

Display the configured camp links with their descriptions and categories.

---

# Phase 11 — Search, Navigation & UX Polish

Once the main pages are working, improve the overall experience.

Review:

* Global navigation
* Search
* Back navigation
* Loading states
* Empty states
* Error states
* Long lists
* Mobile scrolling
* Touch targets
* Typography
* Spacing
* Accessibility
* Keyboard navigation
* Focus states

The application should feel like one consistent product rather than a collection of separate pages.

---

# Phase 12 — PWA

Turn the application into a Progressive Web App.

The application should support:

* Install to phone/home screen
* Appropriate app icons
* Splash/loading experience where supported
* Standalone app experience
* Manifest
* Service worker where appropriate
* Mobile-friendly viewport/configuration

Test installation on supported Android and iOS devices.

The PWA should not break normal browser usage.

---

# Phase 13 — Notifications

Add push notification support.

The goal is to allow the application to send useful camp updates to users' phones.

Potential notification types include:

* Camp announcements
* Event reminders
* Schedule changes

Build the notification permission/subscription experience carefully.

Do not request notification permission immediately on the first page load without context.

The user should understand why notifications are useful before being asked for permission.

The existing database contains the notification-related tables required for this feature.

---

# Phase 14 — Admin Content Management

Once the application UI is stable, complete the admin management functionality.

Admin users should be able to manage the relevant camp data through the application.

This includes, where applicable:

* Add
* Edit
* Search
* Filter
* Reorder
* Publish/update
* Delete where appropriate

All writes must go through authenticated server-side operations.

Never expose database write credentials to the browser.

Authorization must be checked on the server for every admin mutation.

---

# Phase 15 — Final Responsive & Production Review

Before the application is considered complete, test the entire application.

### Mobile

Test on:

* Small phone
* Normal phone
* Large phone
* Portrait
* Landscape

### Tablet

Test common tablet/iPad sizes.

### Desktop

Test common desktop widths.

### Functional review

Verify:

* Authentication
* Protected routes
* Navigation
* Schedule
* Search
* Songs
* People
* Teams
* Rooms
* Two-by-Two
* Content pages
* Contacts
* Venues
* Links
* Admin
* PWA installation
* Notifications
* Loading/error/empty states

### Final requirement

Every page must remain usable and visually coherent across mobile, tablet and desktop.

---

# Suggested Build Order

If you need to prioritize work, follow this order:

```text
1.  Project setup
2.  Application shell
3.  Header + footer + navigation
4.  Authentication + protected routes
5.  Camper landing page
6.  Admin landing page
7.  Schedule
8.  Core content pages
9.  People / Teams / Rooms
10. Two by Two
11. Songs
12. Contacts / Venues / Links
13. Search + UX polish
14. Admin management UI
15. PWA
16. Notifications
17. Final responsive testing
18. Production polish
```

The database is already seeded, so after the application shell and authentication are working, the priority should be getting the **real database data onto the main user-facing pages** rather than building lots of static UI first.

---

# Definition of Done

A feature is not finished simply because it works on the developer's desktop.

A feature is finished when:

* It works with the real seeded database data.
* It is responsive.
* It works on mobile.
* Loading states are handled.
* Empty states are handled.
* Errors are handled.
* Navigation works.
* The UI fits the existing application design.
* No unnecessary hardcoded data is introduced.
* TypeScript/type checking passes.
* The implementation does not introduce unnecessary dependencies or complexity.

When a phase is complete, open a pull request for review.

Do not combine large unrelated features into one pull request.

---

# Development Workflow

For each phase:

1. Create a branch.
2. Build the feature.
3. Test it locally.
4. Test mobile/responsive layouts.
5. Run type checking and linting.
6. Open a pull request.
7. Jestin reviews the changes.
8. Make requested changes.
9. Merge the pull request.
10. Move to the next phase.

When something is unclear, ask before making a large architectural change.

Prefer simple, maintainable solutions over adding complexity.

---

# Source of Truth

The following documents define the project:

```text
docs/SPEC.md
docs/LEGACY.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
```

The functional specification is the source of truth for what the application should do.

The legacy document describes useful existing behavior and known problems in the old application.

The architecture document describes technical constraints and decisions.

The roadmap describes the overall development sequence.

If a proposed implementation conflicts with these documents, discuss it before changing the architecture.
