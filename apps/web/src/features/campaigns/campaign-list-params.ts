import { CHANNELS, HEALTH_STATUSES } from "@campaignpulse/event-contracts";

import type { CampaignListParams } from "../../api/hooks";
import type { CampaignSort, Channel, HealthStatus } from "../../gql/graphql";

export const CAMPAIGN_PAGE_SIZE = 9;
export const CAMPAIGN_SORTS: { value: CampaignSort; label: string }[] = [
  { value: "NEWEST", label: "Newest first" },
  { value: "OLDEST", label: "Oldest first" },
  { value: "NAME", label: "Name A–Z" },
];

export interface CampaignListState {
  search: string;
  health: HealthStatus | null;
  channel: Channel | null;
  sort: CampaignSort;
  page: number;
}

function isHealthStatus(value: string | null): value is HealthStatus {
  return value !== null && (HEALTH_STATUSES as readonly string[]).includes(value);
}

function isChannel(value: string | null): value is Channel {
  return value !== null && (CHANNELS as readonly string[]).includes(value);
}

function isSort(value: string | null): value is CampaignSort {
  return value !== null && CAMPAIGN_SORTS.some((sort) => sort.value === value);
}

/** Reads list state from the URL so filters are shareable and survive refreshes. */
export function readListState(params: URLSearchParams): CampaignListState {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const health = params.get("health");
  const channel = params.get("channel");
  const sort = params.get("sort");
  return {
    search: params.get("q") ?? "",
    health: isHealthStatus(health) ? health : null,
    channel: isChannel(channel) ? channel : null,
    sort: isSort(sort) ? sort : "NEWEST",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** Writes list state back to the URL, omitting defaults to keep links short. */
export function writeListState(state: CampaignListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search) {
    params.set("q", state.search);
  }
  if (state.health) {
    params.set("health", state.health);
  }
  if (state.channel) {
    params.set("channel", state.channel);
  }
  if (state.sort !== "NEWEST") {
    params.set("sort", state.sort);
  }
  if (state.page > 1) {
    params.set("page", String(state.page));
  }
  return params;
}

export function toQueryParams(state: CampaignListState): CampaignListParams {
  return {
    filter: {
      search: state.search || null,
      healthStatus: state.health,
      channel: state.channel,
    },
    sort: state.sort,
    page: state.page,
    pageSize: CAMPAIGN_PAGE_SIZE,
  };
}
