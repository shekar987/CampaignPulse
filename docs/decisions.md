# Decision log

Short records of the decisions that shape the codebase, in the style of architecture decision
records. Newest at the bottom.

## 1. npm workspaces, no additional monorepo tooling

**Decision.** Use npm workspaces (`apps/*`, `packages/*`) with plain npm scripts and
`concurrently` for `npm run dev`.

**Why.** The project has two apps and three small packages. Task graphs and remote caches would
add configuration without solving a problem this size has. `npm install && npm run dev` is the
entire onboarding story.

## 2. Internal packages export TypeScript source

**Decision.** Packages point `exports` at `./src/index.ts`. Nothing in `packages/*` is compiled
except the design-token CSS generator.

**Why.** Consumers (Vite, tsx, Vitest) all understand TypeScript, so a build step would only add
latency and stale-output bugs. Type-checking an app type-checks the packages it imports.

## 3. Schema-first GraphQL with generated types on both sides

**Decision.** `apps/api/src/graphql/schema.graphql` is the contract. GraphQL Code Generator
produces resolver types for the API and typed string documents for the web app.

**Why.** One file to review when the API changes, end-to-end types without hand-written
duplicates, and the browser needs no GraphQL runtime because documents are pre-printed strings.

## 4. GraphQL Yoga as the server

**Decision.** Use GraphQL Yoga on a Node HTTP server locally.

**Why.** Yoga is built on the Fetch API, so the same `createApp()` instance can be driven by a
Node server today and by an AWS Lambda handler later without changing application code.

## 5. Prisma 7 with the `pg` driver adapter

**Decision.** Prisma 7 (`prisma-client` generator, `prisma.config.ts`, `@prisma/adapter-pg`),
pinned to an exact version.

**Why.** Prisma gives a typed client, migrations and a schema that doubles as documentation. The
exact pin matters: at the time of writing the package's `latest` tag pointed at a release
candidate of the next major.

## 6. Health is persisted, metrics are computed

**Decision.** `campaigns.health_status` and `campaign_channels.health_status` are stored and
recalculated by `HealthService` whenever events change. Success rate, error rate and latency are
aggregated on read from `delivery_events`.

**Why.** Filtering the campaign list by health becomes a plain indexed `WHERE`, and health
transitions become an explicit, loggable event that incident detection can build on. Metrics
change with every event and would be stale the moment they were stored; one grouped query per
request is cheap at this scale.

## 7. Metric semantics

**Decision.** Each delivery attempt yields exactly one outcome event. Successes are
`DELIVERY_SUCCEEDED` and `DELIVERY_RETRY_SUCCEEDED`; failures are `DELIVERY_FAILED`.
`DELIVERY_FINAL_FAILURE` marks the move to the dead-letter queue and is not counted again.
`successRate` and `errorRate` are `null` when there are no outcomes; the UI says "No delivery data
available" rather than "0%". Campaign health is the worst channel health; `UNKNOWN` only wins when
every channel is unknown. The overview page measures a rolling 24-hour window; campaign and
channel figures are all-time.

**Why.** Per-attempt rates match how operators read error rates (a retry storm should be visible)
and keep the demo scenarios ("100 events, 22 failures") literal. Null rates avoid the classic
`0 / 0` trap. Worst-channel-wins means one critical channel is never hidden by healthy ones.

## 8. Health thresholds are demo assumptions

**Decision.** Error rate `< 2%` is `HEALTHY`, `>= 2%` and `< 10%` is `DEGRADED`, `>= 10%` is
`CRITICAL`, zero events is `UNKNOWN`. The values live in one place (`HEALTH_THRESHOLDS`).

**Why.** They make the seeded scenarios legible. They are not claimed to be anyone's real service
levels and are documented as such in the README.

## 9. Additions to the initial data model

**Decision.** Beyond the original five-table design: `campaigns.health_status`,
`delivery_events.latency_ms`, `delivery_events.metadata` (JSONB), `updated_at` on channels and
incidents, an `ErrorCode` enum instead of free text, `UNIQUE (campaign_id, channel)`, and CHECK
constraints (`attempt >= 1`, non-empty name, non-negative latency) added in the migration SQL.
Ids are UUIDv7.

**Why.** Latency is a first-class metric and belongs in a column, not buried in JSON. An enum
lets the database reject unknown error codes. CHECK constraints are not expressible in the Prisma
schema, so they are written directly into the migration, which Prisma preserves. UUIDv7 keeps
event ids roughly time-ordered, which is kind to the indexes.

## 10. Offset pagination

**Decision.** `page` / `pageSize` for campaigns and events, capped at 100 per page.

**Why.** It maps directly onto "Page 2 of 5" in the UI and is adequate for demo volumes. Cursor
pagination would be the choice for an unbounded, frequently appended event stream at scale.

## 11. Design tokens generate the Tailwind theme

**Decision.** `packages/design-tokens/src/tokens.ts` is the source of truth; a generator writes
`theme.css` as a `@theme static` block that the web app imports. The generated file is committed
and a test fails when it is out of date.

**Why.** Tokens need to exist in TypeScript (for logic, tests and CSS Modules) and in CSS (for
Tailwind utilities). Generating one from the other removes drift; committing the output keeps
`npm run dev` a single step. `static` makes every variable available to CSS Modules even when no
utility references it.

## 12. Vite dev proxy instead of CORS in development

**Decision.** The web dev server proxies `/graphql` to the API.

**Why.** The browser stays same-origin, so there is no CORS configuration to get subtly wrong
locally. Production CORS is configured where the API is deployed.

## 13. Toolchain pins

**Decision.** TypeScript `~6.0`, ESLint `^9`, Vitest `^5`, and exact Prisma versions.

**Why.** `typescript-eslint` declares support for TypeScript below 6.1 and the TypeScript 7
native compiler does not yet expose the API that linters use. `eslint-plugin-jsx-a11y` does not
yet declare ESLint 10 support, and accessibility linting matters more than being on the newest
ESLint major. Pins are revisited when the ecosystem catches up.

## 14. Line endings

**Decision.** `.gitattributes` normalises to LF and Prettier enforces `endOfLine: lf`.

**Why.** Development happens on Windows and CI on Linux; without this every diff would be noise.

## 15. Events on the bus are commands too

**Decision.** The message transport carries `DeliveryEvent`s. Producers publish
`CAMPAIGN_DELIVERY_REQUESTED`; the worker reacts by performing the attempt and recording the
outcome events, and schedules retries by publishing `DELIVERY_RETRY_REQUESTED` with a delay.
Every other event type is written straight to the timeline and never queued.

**Why.** One vocabulary for the queue and the audit log keeps the contract small, and the
timeline shows exactly what was requested, when, and what happened. The `EventBus` interface has
two methods (`publish`, `publishBatch`) plus a delay option, which is all SQS needs.

## 16. In-process bus with queue semantics

**Decision.** `LocalEventBus` is asynchronous, at-least-once, supports per-message delay,
redelivers on handler failure, hands poison messages to a dead-letter callback after
`maxReceiveCount`, and can deliver every message twice on request.

**Why.** The local bus exists so the application runs without cloud credentials, but it must not
hide the failure modes SQS has. Making the semantics match means the integration tests exercise
idempotency and poison handling for real, and the processor code is identical in Lambda.

## 17. One row per delivery, transitions guarded in SQL

**Decision.** A `deliveries` table holds the current status and attempt count per correlation
id. Status changes are `UPDATE ... WHERE status IN (allowed sources)`; zero rows updated means
the message is stale and is ignored. `SUCCESS` and `FINAL_FAILURE` are terminal.

**Why.** Deriving state from the append-only events on every message is racy under concurrent
workers. A guarded update is atomic, cheap and readable, and it is what makes "a late retry can
never overwrite a success" true rather than hoped for.

## 18. Idempotency inside the transaction

**Decision.** The worker claims the event id in `processed_events` inside the same transaction
as every side effect of processing it. A unique violation means "already processed"; a crash
rolls the claim back with everything else.

**Why.** Claiming before the work would lose a message whose processing crashed; claiming after
would double-process on redelivery. Inside the transaction, exactly one of "processed once" or
"not processed" is ever true. The retry message is published after commit, so a publish failure
leaves a `RETRYING` delivery without a message, which a reconciler would repair in a larger
system (a transactional outbox is the textbook fix and is noted as future work).

## 19. Retry policy

**Decision.** Three attempts; backoff 0 s, 5 s, 30 s. `TIMEOUT`, `NETWORK_ERROR`,
`DEPENDENCY_UNAVAILABLE`, `RATE_LIMITED` and `UNKNOWN_ERROR` are retried; `VALIDATION_ERROR` and
`AUTHORIZATION_ERROR` go straight to the dead-letter queue. `RETRY_BACKOFF_SCALE` compresses the
schedule for local demos.

**Why.** Retrying a rejected payload or credential cannot succeed and only adds load. Rate limits
and unknown failures are more often transient than not, and the backoff bounds the cost of being
wrong. Replays of dead-lettered deliveries drop any scripted failure: the script models an outage
that has since passed.

## 20. Incident detection waits for volume

**Decision.** An incident opens only when a channel's health is degraded or critical **and** it
has at least 100 recorded attempts (`MIN_OUTCOMES_FOR_INCIDENT`). At most one unresolved incident
exists per campaign channel, enforced by a partial unique index. Severity escalates from warning
to critical but never de-escalates automatically; resolution is an operator action.

**Why.** After the first few deliveries a single failure reads as a 20% error rate. The health
badge shows that raw number honestly; alerting on it would page people for noise. The unique
index makes "one incident per problem" hold even when several workers evaluate the same channel
at once. Automatic resolution was left out so the incident record reflects a human judgement
that the channel is stable.

## 21. Deterministic simulation

**Decision.** A scenario expands into per-delivery scripts (which attempts fail and how) chosen
by a seed, and a simulated channel decides outcomes as a pure function of the correlation id and
attempt. The seed is returned so a run can be reproduced.

**Why.** "Critical" must mean exactly 22 failures, not roughly 22, or the demo stops being
explainable. Determinism also makes the integration tests assert on exact counts and the retry
chain event by event.

## 22. Health and incidents evaluated per batch, not per event

**Decision.** The processor recalculates health and evaluates incidents once per touched
campaign channel after a batch; locally a batch is one message, in Lambda up to ten.

**Why.** Recalculation is a grouped query; doing it per event in a ten-message batch would
multiply database work for no better answer.

## 23. Terraform owns the platform, Serverless owns the functions

**Decision.** Queues, topic, secret, log groups, metric filters, alarms, dashboard and the
optional RDS instance are Terraform. Lambda functions, the API route, event-source mappings and
the execution role are Serverless Framework. Terraform hands identifiers over through SSM
parameters.

**Why.** Each tool is used for what it is best at, and the boundary is explicit: nothing is
managed twice. Log groups sit on the Terraform side because metric filters and alarms need to
reference them.

## 24. Single-file Lambda bundles

**Decision.** esbuild bundles each handler into one ESM file, with the GraphQL SDL inlined as a
generated module and the Prisma query compiler carried as an embedded base64 module.

**Why.** No native binaries, no file-system lookups at runtime and no layer to maintain. The
bundle is exercised locally against PostgreSQL before it is ever deployed.

## 25. Named widths reference container tokens explicitly

**Decision.** The design tokens define a `container` scale (`--container-md` … `--container-7xl`)
and components use it directly, e.g. `max-w-(--container-3xl)`, instead of the shorthand
`max-w-3xl`.

**Why.** The spacing scale uses the same names (`sm`, `md`, … `3xl`) as Tailwind's width scale,
and Tailwind v4 resolves `max-w-3xl` from `--spacing-3xl` (3rem) before it looks at
`--container-3xl` (48rem). Every description paragraph in the app was silently 48px wide, one
word per line, and no test caught it; a screenshot did. Referencing the token by name removes
the ambiguity and keeps the spacing names, which CSS Modules depend on.
