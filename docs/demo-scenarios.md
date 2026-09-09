# Demo scenarios

`npm run db:seed` loads a deterministic data set (same seed, same data every time; only the
timestamps are anchored to the moment the seed runs). The scenarios below are all visible from
the overview page and the campaign list after seeding. The seed also derives the per-delivery
rows, one dead-letter entry and the incidents the processor would have opened, so the incidents
and dead-letter pages are populated from the start.

Every campaign, advertiser and event is synthetic.

## Running scenarios live

Open any campaign and use the **Scenario runner**. Each preset is exact and reproducible from its seed:

| Scenario              | Per channel                                           | What to watch                                           |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Healthy               | 100 deliveries, 1 fails once then succeeds on retry   | Health stays healthy; no incident                       |
| Degraded              | 100 deliveries, 6 fail once                           | Channel degraded; a warning incident opens              |
| Critical              | 100 deliveries, 22 fail once                          | Channel critical; a critical incident opens             |
| Retry that succeeds   | 1 delivery: timeout, timeout, success                 | Follow the correlation id: three attempts, two backoffs |
| Retries exhausted     | 1 delivery: three transient failures                  | Final failure; entry appears in the dead-letter queue   |
| Non-retryable failure | 1 delivery: validation error                          | Dead-lettered immediately, no retry requested           |
| Custom                | Your volume (1 to 500) and first-attempt failure rate | Push a channel across a threshold, then replay          |

Incidents open only once a channel has 100 recorded attempts, so the single-delivery scenarios
never open one on their own. Backoff is compressed locally (`RETRY_BACKOFF_SCALE=0.1`), so a
retry chain completes in a few seconds rather than 35.

The operator journey is: run the **Critical** scenario, open the incident, **Acknowledge**, **Retry failed
deliveries** (replays anything in the dead-letter queue for that channel), then **Resolve** with
a note. Every step lands on the campaign timeline.

## Scenario 1: healthy

**Campaign:** Autumn Homeware (Hearth Living), channel `WEB`, 100 delivery attempts, 99 succeeded,
1 failed.

**Expected:** channel and campaign show **Healthy** (1% error rate, below the 2% threshold).

## Scenario 2: degraded

**Campaign:** Back to School (Pencil & Co), channel `WEB`, 100 attempts, 94 succeeded, 6 failed.

**Expected:** `WEB` shows **Degraded** (6%); the campaign is degraded because its worst channel is.

## Scenario 3: critical

**Campaign:** Summer Drinks (Fizz Beverages), channel `SMARTSHOP`, 100 attempts, 78 succeeded,
22 failed, while `WEB` and `MOBILE_APP` stay healthy.

**Expected:** `SMARTSHOP` shows **Critical** (22%), the campaign is critical, and it appears at the
top of "Needs attention" on the overview.

## Scenario 4: retry that eventually succeeds

On the Summer Drinks timeline, filter to `SMARTSHOP` and open the correlation id whose last event
is **Retry succeeded**. The sequence is:

```
CAMPAIGN_DELIVERY_REQUESTED  attempt 1
DELIVERY_STARTED             attempt 1
DELIVERY_FAILED              attempt 1   TIMEOUT
DELIVERY_RETRY_REQUESTED     attempt 2   (+5 s backoff)
DELIVERY_STARTED             attempt 2
DELIVERY_FAILED              attempt 2   TIMEOUT
DELIVERY_RETRY_REQUESTED     attempt 3   (+30 s backoff)
DELIVERY_STARTED             attempt 3
DELIVERY_RETRY_SUCCEEDED     attempt 3
```

This counts as two failures and one success in the metrics (see the decision log for why). The
same chain is produced live by the **Retry that succeeds** scenario.

## Scenario 5: dead-letter queue

Also on Summer Drinks / `SMARTSHOP`: the correlation id whose last event is **Final failure
(dead-letter queue)** fails three times and is then marked `DELIVERY_FINAL_FAILURE`. It is listed
in the campaign's dead-letter queue as "Awaiting replay"; **Retry all failed deliveries** replays
it as a new delivery (suffix `-r1`) and marks the entry replayed.

## Seeded incidents

Every seeded channel that is degraded or critical with at least 100 attempts has an open incident:
Summer Drinks / SmartShop (critical), Pet Care Essentials / Mobile app (critical), Back to School
/ Website, Bakery Bundles / In-store display and Skincare Spotlight / SmartShop (warnings). Coffee
Club Launch is degraded on 50 attempts and therefore has none.

## No data

**Campaign:** Winter Warmers (Cosy Foods) is a draft with channels but no events. Every metric
reads "No delivery data available" and its health is **No data**, never "0% success".

## The rest of the seed

| Campaign              | Status    | Channels and outcomes                                  | Health   |
| --------------------- | --------- | ------------------------------------------------------ | -------- |
| Summer Drinks         | Active    | WEB 99/1 · MOBILE_APP 99/1 · SMARTSHOP 78/22           | Critical |
| Back to School        | Active    | WEB 94/6 · MOBILE_APP 99/1                             | Degraded |
| Autumn Homeware       | Active    | WEB 99/1 · IN_STORE_DISPLAY 100/0                      | Healthy  |
| Winter Warmers        | Draft     | WEB, IN_STORE_DISPLAY (no events)                      | No data  |
| Fresh Fruit Fortnight | Active    | WEB 118/2 · MOBILE_APP 79/1 · IN_STORE_DISPLAY 60/0    | Healthy  |
| Pet Care Essentials   | Active    | WEB 99/1 · MOBILE_APP 88/12 (includes a retry success) | Critical |
| Bakery Bundles        | Active    | IN_STORE_DISPLAY 95/5 · SMARTSHOP 99/1                 | Degraded |
| Household Heroes      | Active    | WEB 149/1 · MOBILE_APP 99/1                            | Healthy  |
| Weekend BBQ           | Completed | WEB 197/3 · SMARTSHOP 99/1                             | Healthy  |
| Coffee Club Launch    | Paused    | WEB 48/2                                               | Degraded |
| Skincare Spotlight    | Active    | WEB 99/1 · SMARTSHOP 97/3                              | Degraded |
| Kids Lunchbox         | Active    | MOBILE_APP 100/0 · IN_STORE_DISPLAY 100/0              | Healthy  |

Counts are `succeeded/failed` delivery attempts. Failure codes are drawn per channel from a fixed
distribution: the website mostly sees rate limiting and validation errors, the app network errors
and timeouts, in-store displays dependency outages, and SmartShop devices timeouts.
