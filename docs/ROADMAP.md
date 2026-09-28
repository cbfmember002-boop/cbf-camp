# Roadmap

Work is delivered in **phases**. Each phase is a set of small pull requests with a
defined exit condition. Phases are sequential — a phase starts when the previous one
meets its exit criteria.

Detailed briefs live in [`phases/`](phases/). Requirement IDs come from [SPEC.md](../docs/SPEC.md).

| Phase | Theme | Delivers | Depends on |
| --- | --- | --- | --- |
| [0](phases/PHASE-0.md) | Foundation | Run the provided scaffold, connect a database, add e2e testing | — |
| [1](phases/PHASE-1.md) | Data | Understand the provided schema, build the data access layer | 0 |
| [2](phases/PHASE-2.md) | Auth & shell | Server-side camp code, session cookie, app shell, navigation | 1 |
| [3](phases/PHASE-3.md) | Schedule | The schedule module, incl. day tabs and current-event highlighting | 2 |
| [4](phases/PHASE-4.md) | Content modules | Sessions, songs, rooms, teams | 3 |
| [5](phases/PHASE-5.md) | Two by Two | Pairings with server-enforced date gating | 4 |
| [6](phases/PHASE-6.md) | Admin dashboard | Admin auth, CRUD, rich text, uploads, cache invalidation | 4 |
| [7](phases/PHASE-7.md) | Static content | Prayer wall, guidelines, rules, contacts, venue, links — DB-backed | 6 |
| [8](phases/PHASE-8.md) | PWA & offline | Installability, service worker, offline reads, update flow | 4 |
| [9](phases/PHASE-9.md) | Push & reminders | Subscriptions, broadcasts, scheduled event reminders | 8 |
| [10](phases/PHASE-10.md) | Polish & launch | Global search, dark mode, a11y and performance passes, deploy | 9 |

## Phase rules

1. **One phase at a time.** Don't start the next phase's work inside this phase's PRs.
2. **Small PRs.** One task per PR. If a PR needs more than about 400 changed lines of
   real logic, it should probably have been two.
3. **Every PR declares requirement IDs.** See the pull request template.
4. **Exit criteria are checked before moving on.** They're listed at the bottom of each
   phase brief.
5. **Deviations get written down.** Either as a spec change or an ADR — never silently.

## Continuously enforced

Some requirements belong to no single phase because they apply to **every** PR from
Phase 0 onward. They're checked by CI or by the [rubric](REVIEW_RUBRIC.md) on every
review, not scheduled as tasks:

| ID | Enforced by |
| --- | --- |
| `NFR-SEC-01` no secrets client-side | CI secret scan + review Gate 4 |
| `NFR-SEC-02` database access server-side only | Review Gate 4 |
| `NFR-SEC-04` parameterised queries | Review Gate 4 |
| `NFR-SEC-08` errors leak no internals | Review Gate 4 |
| `NFR-CODE-01` TypeScript strict | CI typecheck |
| `NFR-CODE-02` lint clean | CI lint |
| `NFR-CODE-03` data access in the data layer | Review Gate 8 |
| `NFR-CODE-06` no dead code or debug logging | Review Gate 8 |
| `NFR-CODE-07` no secrets in the repo | CI secret scan |
| `NFR-OPS-01` CI green before merge | Branch protection |
| `NFR-OPS-04` migrations checked in and ordered | Review Gate 5 |

## Definition of done, for any PR

- [ ] CI is green
- [ ] The declared requirement IDs are genuinely implemented
- [ ] Logic with real rules has unit tests (`NFR-CODE-04`)
- [ ] Loading, empty, and error states exist for anything that can fail
- [ ] Verified at 360px viewport width
- [ ] Keyboard operable (`NFR-A11Y-01`)
- [ ] No secrets, dead code, or debug logging
- [ ] Docs updated if behaviour or setup changed

## Deliberately deferred

These are real requirements that are intentionally *not* in an early phase, so nobody
builds them speculatively:

- **Global search** (`FR-SEARCH-*`) — phase 10, because it needs every module to exist.
- **Dark mode** (`NFR-A11Y-07`) — phase 10, once the design has settled.
- **Audit trail** (`ADM-13`) and **soft delete** (`ADM-12`) — phase 6 if time allows,
  otherwise phase 10.
- **Notification categories** (`FR-PUSH-11`) — phase 9 only after basic push works.

## Out of scope

See [SPEC.md §9](SPEC.md#9-explicitly-out-of-scope). Adding anything from that list
requires an ADR.
