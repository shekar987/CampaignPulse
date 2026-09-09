# Demo scenarios

`npm run db:seed` loads a deterministic data set (same seed, same data every time; only the
timestamps are anchored to the moment the seed runs). The scenarios below are all visible from
the overview page and the campaign list after seeding.

Every campaign, advertiser and event is synthetic.

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

This counts as two failures and one success in the metrics (see the decision log for why).
Automatic retry processing is built in phase 4; the seed only records what such a run looks like.

## Scenario 5: dead-letter queue

Also on Summer Drinks / `SMARTSHOP`: the correlation id whose last event is **Final failure
(dead-letter queue)** fails three times and is then marked `DELIVERY_FINAL_FAILURE`. Incident
creation from this signal arrives in phase 3.

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
