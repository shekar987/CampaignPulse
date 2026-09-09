import type {
  CampaignStatus,
  Channel,
  ErrorCode,
  EventStatus,
  EventType,
} from "@campaignpulse/event-contracts";

/**
 * Deterministic demo data. Every campaign below is synthetic; the outcome counts are chosen so
 * the documented scenarios (docs/demo-scenarios.md) are visible on the dashboard:
 *
 *  - Scenario 1, healthy:  Autumn Homeware, WEB 99/1
 *  - Scenario 2, degraded: Back to School, WEB 94/6
 *  - Scenario 3, critical: Summer Drinks, SMARTSHOP 78/22
 *
 * plus a draft campaign with no events (UNKNOWN health) and two retry chains so the timeline
 * shows real retry and dead-letter sequences.
 */

export interface ChannelPlan {
  channel: Channel;
  /** Delivery attempts that succeeded. */
  successes: number;
  /** Delivery attempts that failed. */
  failures: number;
}

export interface RetryChainPlan {
  channel: Channel;
  /** Deliveries that fail twice and succeed on the third attempt. */
  retrySuccess: number;
  /** Deliveries that fail three times and are moved to the dead-letter queue. */
  finalFailure: number;
}

export interface CampaignPlan {
  slug: string;
  name: string;
  advertiserName: string;
  status: CampaignStatus;
  /** Days before the seed time the campaign was created, to give a stable "newest" order. */
  createdDaysAgo: number;
  channels: ChannelPlan[];
  retryChains?: RetryChainPlan;
}

export const DEMO_CAMPAIGNS: CampaignPlan[] = [
  {
    slug: "summer-drinks",
    name: "Summer Drinks",
    advertiserName: "Fizz Beverages",
    status: "ACTIVE",
    createdDaysAgo: 2,
    channels: [
      { channel: "WEB", successes: 99, failures: 1 },
      { channel: "MOBILE_APP", successes: 99, failures: 1 },
      { channel: "SMARTSHOP", successes: 78, failures: 22 },
    ],
    retryChains: { channel: "SMARTSHOP", retrySuccess: 1, finalFailure: 1 },
  },
  {
    slug: "back-to-school",
    name: "Back to School",
    advertiserName: "Pencil & Co",
    status: "ACTIVE",
    createdDaysAgo: 3,
    channels: [
      { channel: "WEB", successes: 94, failures: 6 },
      { channel: "MOBILE_APP", successes: 99, failures: 1 },
    ],
  },
  {
    slug: "autumn-homeware",
    name: "Autumn Homeware",
    advertiserName: "Hearth Living",
    status: "ACTIVE",
    createdDaysAgo: 4,
    channels: [
      { channel: "WEB", successes: 99, failures: 1 },
      { channel: "IN_STORE_DISPLAY", successes: 100, failures: 0 },
    ],
  },
  {
    slug: "winter-warmers",
    name: "Winter Warmers",
    advertiserName: "Cosy Foods",
    status: "DRAFT",
    createdDaysAgo: 1,
    channels: [
      { channel: "WEB", successes: 0, failures: 0 },
      { channel: "IN_STORE_DISPLAY", successes: 0, failures: 0 },
    ],
  },
  {
    slug: "fresh-fruit-fortnight",
    name: "Fresh Fruit Fortnight",
    advertiserName: "Orchard Growers",
    status: "ACTIVE",
    createdDaysAgo: 5,
    channels: [
      { channel: "WEB", successes: 118, failures: 2 },
      { channel: "MOBILE_APP", successes: 79, failures: 1 },
      { channel: "IN_STORE_DISPLAY", successes: 60, failures: 0 },
    ],
  },
  {
    slug: "pet-care-essentials",
    name: "Pet Care Essentials",
    advertiserName: "Wagtail",
    status: "ACTIVE",
    createdDaysAgo: 6,
    channels: [
      { channel: "WEB", successes: 99, failures: 1 },
      { channel: "MOBILE_APP", successes: 88, failures: 12 },
    ],
    retryChains: { channel: "MOBILE_APP", retrySuccess: 1, finalFailure: 0 },
  },
  {
    slug: "bakery-bundles",
    name: "Bakery Bundles",
    advertiserName: "Golden Crust",
    status: "ACTIVE",
    createdDaysAgo: 7,
    channels: [
      { channel: "IN_STORE_DISPLAY", successes: 95, failures: 5 },
      { channel: "SMARTSHOP", successes: 99, failures: 1 },
    ],
  },
  {
    slug: "household-heroes",
    name: "Household Heroes",
    advertiserName: "Sparkle Clean",
    status: "ACTIVE",
    createdDaysAgo: 8,
    channels: [
      { channel: "WEB", successes: 149, failures: 1 },
      { channel: "MOBILE_APP", successes: 99, failures: 1 },
    ],
  },
  {
    slug: "weekend-bbq",
    name: "Weekend BBQ",
    advertiserName: "Grill Masters",
    status: "COMPLETED",
    createdDaysAgo: 12,
    channels: [
      { channel: "WEB", successes: 197, failures: 3 },
      { channel: "SMARTSHOP", successes: 99, failures: 1 },
    ],
  },
  {
    slug: "coffee-club-launch",
    name: "Coffee Club Launch",
    advertiserName: "Bean Street",
    status: "PAUSED",
    createdDaysAgo: 9,
    channels: [{ channel: "WEB", successes: 48, failures: 2 }],
  },
  {
    slug: "skincare-spotlight",
    name: "Skincare Spotlight",
    advertiserName: "Glow Labs",
    status: "ACTIVE",
    createdDaysAgo: 10,
    channels: [
      { channel: "WEB", successes: 99, failures: 1 },
      { channel: "SMARTSHOP", successes: 97, failures: 3 },
    ],
  },
  {
    slug: "kids-lunchbox",
    name: "Kids Lunchbox",
    advertiserName: "Snack Smart",
    status: "ACTIVE",
    createdDaysAgo: 11,
    channels: [
      { channel: "MOBILE_APP", successes: 100, failures: 0 },
      { channel: "IN_STORE_DISPLAY", successes: 100, failures: 0 },
    ],
  },
];

export interface SeedEvent {
  correlationId: string;
  eventType: EventType;
  channel: Channel;
  status: EventStatus;
  attempt: number;
  occurredAt: Date;
  latencyMs: number | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  metadata: Record<string, string | number | boolean>;
}

export interface GenerateOptions {
  /** Instant the most recent delivery completes. */
  endAt: Date;
  /** How far back the deliveries are spread. */
  spanMs?: number;
  random: () => number;
}

/** Small seeded PRNG so every seed run produces identical data. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ERROR_WEIGHTS: Record<Channel, [ErrorCode, number][]> = {
  WEB: [
    ["RATE_LIMITED", 4],
    ["VALIDATION_ERROR", 3],
    ["TIMEOUT", 2],
    ["UNKNOWN_ERROR", 1],
  ],
  MOBILE_APP: [
    ["NETWORK_ERROR", 5],
    ["TIMEOUT", 3],
    ["AUTHORIZATION_ERROR", 1],
    ["DEPENDENCY_UNAVAILABLE", 1],
  ],
  IN_STORE_DISPLAY: [
    ["DEPENDENCY_UNAVAILABLE", 5],
    ["TIMEOUT", 3],
    ["UNKNOWN_ERROR", 2],
  ],
  SMARTSHOP: [
    ["TIMEOUT", 5],
    ["DEPENDENCY_UNAVAILABLE", 3],
    ["NETWORK_ERROR", 2],
  ],
};

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  TIMEOUT: "Channel endpoint did not respond within 3000ms",
  RATE_LIMITED: "Channel endpoint returned 429 Too Many Requests",
  VALIDATION_ERROR: "Creative payload rejected: missing required field 'creativeId'",
  DEPENDENCY_UNAVAILABLE: "Placement service returned 503 Service Unavailable",
  AUTHORIZATION_ERROR: "Delivery token was rejected by the channel (401)",
  NETWORK_ERROR: "Connection reset while streaming creative payload",
  UNKNOWN_ERROR: "Channel returned an unexpected response body",
};

const CHANNEL_SLUGS: Record<Channel, string> = {
  WEB: "web",
  MOBILE_APP: "app",
  IN_STORE_DISPLAY: "store",
  SMARTSHOP: "smartshop",
};

const RETRY_BACKOFF_MS = [0, 5_000, 30_000] as const;
const WORKER_COUNT = 4;

function pickErrorCode(channel: Channel, random: () => number): ErrorCode {
  const weights = ERROR_WEIGHTS[channel];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [code, weight] of weights) {
    roll -= weight;
    if (roll < 0) {
      return code;
    }
  }
  return weights[weights.length - 1]?.[0] ?? "UNKNOWN_ERROR";
}

function successLatency(random: () => number): number {
  return 120 + Math.round(random() * 330);
}

function failureLatency(code: ErrorCode, random: () => number): number {
  return code === "TIMEOUT" ? 3000 : 200 + Math.round(random() * 700);
}

function worker(random: () => number): string {
  return `sim-worker-${1 + Math.floor(random() * WORKER_COUNT)}`;
}

interface DeliveryScript {
  /** Outcome of each attempt in order. */
  attempts: ("success" | "failure")[];
  /** Whether the delivery ends in the dead-letter queue. */
  finalFailure: boolean;
}

/** Interleaves plain successes and failures deterministically. */
function planDeliveries(
  plan: ChannelPlan,
  chains: RetryChainPlan | undefined,
  random: () => number,
) {
  const scripts: DeliveryScript[] = [];
  let successes = plan.successes;
  let failures = plan.failures;

  if (chains && chains.channel === plan.channel) {
    for (let i = 0; i < chains.retrySuccess && failures >= 2 && successes >= 1; i += 1) {
      scripts.push({ attempts: ["failure", "failure", "success"], finalFailure: false });
      failures -= 2;
      successes -= 1;
    }
    for (let i = 0; i < chains.finalFailure && failures >= 3; i += 1) {
      scripts.push({ attempts: ["failure", "failure", "failure"], finalFailure: true });
      failures -= 3;
    }
  }

  const plain: DeliveryScript[] = [
    ...Array.from({ length: successes }, (): DeliveryScript => ({
      attempts: ["success"],
      finalFailure: false,
    })),
    ...Array.from({ length: failures }, (): DeliveryScript => ({
      attempts: ["failure"],
      finalFailure: false,
    })),
  ];
  // Fisher-Yates shuffle with the seeded generator.
  for (let i = plain.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = plain[i];
    const b = plain[j];
    if (a && b) {
      plain[i] = b;
      plain[j] = a;
    }
  }

  // Place the chains roughly a third of the way through so they are easy to find.
  const insertAt = Math.floor(plain.length / 3);
  return [...plain.slice(0, insertAt), ...scripts, ...plain.slice(insertAt)];
}

/** Generates the full event timeline for one campaign plan. */
export function generateCampaignEvents(plan: CampaignPlan, options: GenerateOptions): SeedEvent[] {
  const { endAt, random } = options;
  const spanMs = options.spanMs ?? 6 * 60 * 60 * 1000;
  const events: SeedEvent[] = [];

  for (const channelPlan of plan.channels) {
    const scripts = planDeliveries(channelPlan, plan.retryChains, random);
    if (scripts.length === 0) {
      continue;
    }
    const step = spanMs / scripts.length;
    const startAt = endAt.getTime() - spanMs;

    scripts.forEach((script, index) => {
      const correlationId = `cmp-${plan.slug}-${CHANNEL_SLUGS[channelPlan.channel]}-${String(index + 1).padStart(4, "0")}`;
      const jitter = Math.floor(random() * step * 0.5);
      const requestedAt = startAt + index * step + jitter;
      const metadata = { source: "seed", worker: worker(random) };
      const base = { correlationId, channel: channelPlan.channel, metadata };

      events.push({
        ...base,
        eventType: "CAMPAIGN_DELIVERY_REQUESTED",
        status: "PENDING",
        attempt: 1,
        occurredAt: new Date(requestedAt),
        latencyMs: null,
        errorCode: null,
        errorMessage: null,
      });

      let attemptStart = requestedAt;
      script.attempts.forEach((outcome, attemptIndex) => {
        const attempt = attemptIndex + 1;
        if (attempt > 1) {
          attemptStart += RETRY_BACKOFF_MS[attemptIndex] ?? 30_000;
          events.push({
            ...base,
            eventType: "DELIVERY_RETRY_REQUESTED",
            status: "RETRYING",
            attempt,
            occurredAt: new Date(attemptStart),
            latencyMs: null,
            errorCode: null,
            errorMessage: null,
          });
        }
        const startedAt = attemptStart + 20 + Math.floor(random() * 40);
        events.push({
          ...base,
          eventType: "DELIVERY_STARTED",
          status: "PROCESSING",
          attempt,
          occurredAt: new Date(startedAt),
          latencyMs: null,
          errorCode: null,
          errorMessage: null,
        });

        if (outcome === "success") {
          const latencyMs = successLatency(random);
          events.push({
            ...base,
            eventType: attempt === 1 ? "DELIVERY_SUCCEEDED" : "DELIVERY_RETRY_SUCCEEDED",
            status: "SUCCESS",
            attempt,
            occurredAt: new Date(startedAt + latencyMs),
            latencyMs,
            errorCode: null,
            errorMessage: null,
          });
        } else {
          const errorCode = pickErrorCode(channelPlan.channel, random);
          const latencyMs = failureLatency(errorCode, random);
          events.push({
            ...base,
            eventType: "DELIVERY_FAILED",
            status: "FAILED",
            attempt,
            occurredAt: new Date(startedAt + latencyMs),
            latencyMs,
            errorCode,
            errorMessage: ERROR_MESSAGES[errorCode],
          });
          attemptStart = startedAt + latencyMs;
        }
      });

      if (script.finalFailure) {
        events.push({
          ...base,
          eventType: "DELIVERY_FINAL_FAILURE",
          status: "FINAL_FAILURE",
          attempt: script.attempts.length,
          occurredAt: new Date(attemptStart + 50),
          latencyMs: null,
          errorCode: "TIMEOUT",
          errorMessage: "Maximum attempts (3) exhausted; delivery moved to dead-letter queue",
        });
      }
    });
  }

  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
