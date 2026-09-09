import { CHANNELS, HEALTH_STATUSES } from "@campaignpulse/event-contracts";
import { CHANNEL_LABELS, HEALTH_LABELS } from "@campaignpulse/shared";
import { useEffect, useState } from "react";

import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import type { CampaignSort, Channel, HealthStatus } from "../../gql/graphql";
import { CAMPAIGN_SORTS, type CampaignListState } from "./campaign-list-params";

export interface CampaignFiltersProps {
  state: CampaignListState;
  onChange: (next: CampaignListState) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function CampaignFilters({ state, onChange }: CampaignFiltersProps) {
  const [search, setSearch] = useState(state.search);
  const [syncedSearch, setSyncedSearch] = useState(state.search);

  // When the URL changes externally (back button, cleared filters), adopt its search term.
  if (state.search !== syncedSearch) {
    setSyncedSearch(state.search);
    setSearch(state.search);
  }

  // Debounce typing so every keystroke does not hit the API.
  useEffect(() => {
    if (search === state.search) {
      return;
    }
    const handle = window.setTimeout(() => {
      onChange({ ...state, search, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [search, state, onChange]);

  const hasFilters = state.search || state.health || state.channel || state.sort !== "NEWEST";

  return (
    <form
      role="search"
      aria-label="Filter campaigns"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...state, search, page: 1 });
      }}
      className="grid gap-3 rounded-lg border border-line-subtle bg-surface-raised p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end"
    >
      <TextField
        id="campaign-search"
        label="Search"
        type="search"
        placeholder="Campaign or advertiser name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        autoComplete="off"
      />
      <SelectField
        id="campaign-health"
        label="Health"
        value={state.health ?? ""}
        onChange={(event) =>
          onChange({
            ...state,
            health: (event.target.value || null) as HealthStatus | null,
            page: 1,
          })
        }
      >
        <option value="">All statuses</option>
        {HEALTH_STATUSES.map((status) => (
          <option key={status} value={status}>
            {HEALTH_LABELS[status]}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="campaign-channel"
        label="Channel"
        value={state.channel ?? ""}
        onChange={(event) =>
          onChange({ ...state, channel: (event.target.value || null) as Channel | null, page: 1 })
        }
      >
        <option value="">All channels</option>
        {CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {CHANNEL_LABELS[channel]}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="campaign-sort"
        label="Sort"
        value={state.sort}
        onChange={(event) =>
          onChange({ ...state, sort: event.target.value as CampaignSort, page: 1 })
        }
      >
        {CAMPAIGN_SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </SelectField>
      <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
        <Button type="submit" variant="secondary" icon={<Icon name="search" size={16} />}>
          Search
        </Button>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              onChange({ search: "", health: null, channel: null, sort: "NEWEST", page: 1 });
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
