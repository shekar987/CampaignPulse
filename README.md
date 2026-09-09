# CampaignPulse

**Retail Media Delivery Reliability Platform.** Monitor, detect and investigate failures across
distributed campaign delivery systems.

CampaignPulse is a portfolio engineering project. It explores the reliability, observability,
event-driven processing and incident-management patterns needed to operate omnichannel retail
media delivery at scale: one campaign, delivered to a website, a mobile app, in-store screens and
self-scan devices, each of which can fail independently.

> **What this is not.** CampaignPulse is not affiliated with any retailer or retail media
> network. It is not a clone of, or a replacement for, any production system, and it makes no
> claims about how any real platform is built or how reliable it is. All campaigns, advertisers
> and delivery events are synthetic.

## The problem it models

A campaign is delivered to several channels. Some deliveries succeed, some time out, some are
retried, and some end up in a dead-letter queue. The engineering team needs to answer, quickly:

- Which channel failed, and when?
- How many deliveries failed, and is the failure isolated or widespread?
- How long is delivery taking?
- Has the system retried, and did the retry work?
- Is the service healthy, degraded or critical right now?

## Features

Implemented:

- **System overview**: per-channel health over a rolling window, campaign health counts,
  delivery metrics (attempts, success rate, failures, average latency) and the campaigns that
  need attention first.
- **Campaign list**: search, filter by health and channel, sort, paginate. Filters live in the
  URL so a view can be shared.
- **Campaign detail**: overall metrics, per-channel delivery health, and an event timeline with
  channel filtering and click-to-follow correlation ids that trace one delivery end to end
  (requested → started → failed → retry → succeeded).
- **Create campaign** with validation shared between the form and the API.
- **Deterministic demo data** covering healthy, degraded and critical channels, a draft campaign
  with no data, a retry that eventually succeeds and a delivery that exhausts its retries.
- **Structured logging** (JSON lines with request and correlation ids) and typed configuration.

Planned (see [Roadmap](#roadmap)): event simulation through an event-bus abstraction, automatic
incident detection and management, retry and dead-letter-queue processing, end-to-end tests, and
an AWS deployment (Lambda, SQS, SNS, CloudWatch).

## Architecture at a glance

```
apps/web  (React 19, Vite, TanStack Query, Tailwind)
   │  GraphQL over HTTP (typed documents generated from the schema)
   ▼
apps/api  (Node.js, GraphQL Yoga)
   ├─ graphql/    thin resolvers: validate arguments, call a service
   ├─ services/   business logic: campaigns, metrics, health, events
   └─ Prisma ──▶ PostgreSQL
packages/
   ├─ event-contracts   the delivery event schema and enums (Zod)
   ├─ shared            health calculation, metric semantics, input validation
   └─ design-tokens     semantic design tokens → Tailwind theme
```

Health is **persisted** (recalculated whenever delivery events change) while delivery metrics are
**computed on read** from the event table. See [docs/architecture.md](docs/architecture.md) and
the decision log in [docs/decisions.md](docs/decisions.md).

## Getting started

Prerequisites: Node.js 22.12 or later (24 recommended) and Docker Desktop for PostgreSQL. No cloud
credentials are needed; everything runs locally.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # PowerShell: Copy-Item apps/api/.env.example apps/api/.env
npm run codegen                           # Prisma client + GraphQL types
npm run db:up                             # PostgreSQL 17 in Docker
npm run db:migrate                        # apply migrations
npm run db:seed                           # load the demo scenarios
npm run dev                               # API on :4000, web on :5173
```

Then open http://localhost:5173. GraphiQL is available at http://localhost:4000/graphql.

`npm run setup` runs the codegen, database and seed steps in one go.

The Docker container is published on host port 5433 so it never collides with a PostgreSQL
service that may already be installed on the machine. To use an existing server instead, create
a database and role for the project and point `DATABASE_URL` in `apps/api/.env` at it:

```sql
CREATE ROLE campaignpulse WITH LOGIN PASSWORD 'campaignpulse';
CREATE DATABASE campaignpulse OWNER campaignpulse;
```

## Scripts

| Script                      | What it does                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Starts the API and the web app together                       |
| `npm run codegen`           | Generates the Prisma client and GraphQL types for API and web |
| `npm run db:up` / `db:down` | Starts / stops PostgreSQL via Docker Compose                  |
| `npm run db:migrate`        | Applies Prisma migrations to the local database               |
| `npm run db:seed`           | Replaces all data with the deterministic demo set             |
| `npm run db:reset`          | Drops, recreates, migrates and seeds the database             |
| `npm run db:studio`         | Opens Prisma Studio                                           |
| `npm run lint`              | ESLint (TypeScript, React hooks, accessibility rules)         |
| `npm run format:check`      | Prettier                                                      |
| `npm run typecheck`         | `tsc --noEmit` in every workspace                             |
| `npm test`                  | Unit and component tests (Vitest, Testing Library)            |
| `npm run build`             | Production build of the web app and generated theme CSS       |

## Project structure

```
apps/api            GraphQL API, Prisma schema, migrations and seed
apps/web            React application
packages/event-contracts
packages/shared
packages/design-tokens
docs/               architecture, decision log, demo scenarios
.github/workflows   continuous integration
```

## Demo assumptions

- **Health thresholds.** Error rate below 2% is healthy, 2% to below 10% is degraded, 10% or
  above is critical, and zero events is "no data" rather than "0% success". These thresholds are
  chosen to make the demo scenarios legible; they are not derived from any real operator's
  service levels.
- **Channels.** `WEB`, `MOBILE_APP`, `IN_STORE_DISPLAY` and `SMARTSHOP` are simulated surfaces,
  not integrations with real systems.
- **Metrics.** Each delivery attempt produces exactly one outcome. Success and error rates are
  per attempt, so a delivery that fails twice and succeeds on the third try counts as two
  failures and one success. See [docs/decisions.md](docs/decisions.md) for the full semantics.

## Roadmap

| Phase | Scope                                                              | Status  |
| ----- | ------------------------------------------------------------------ | ------- |
| 0     | Monorepo, tooling, database, CI                                    | Done    |
| 1     | Overview, campaign list and detail, schema, GraphQL API            | Done    |
| 2     | Event contracts in motion: local event bus, delivery simulation    | Planned |
| 3     | Automatic incident detection and incident management               | Planned |
| 4     | Retry policy, exponential backoff, dead-letter queue               | Planned |
| 5     | End-to-end tests (Playwright) and database integration tests       | Planned |
| 6     | AWS: Lambda, SQS with DLQ, SNS, CloudWatch, infrastructure as code | Planned |
| 7     | Polish: responsive and accessibility passes, screenshots           | Planned |

## Documentation

- [Architecture](docs/architecture.md)
- [Decision log](docs/decisions.md)
- [Demo scenarios](docs/demo-scenarios.md)
