import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { describeError } from "../../api/client";
import { useCampaigns } from "../../api/hooks";
import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import { formatInteger } from "../../lib/format";
import { CampaignCard } from "./CampaignCard";
import { CampaignFilters } from "./CampaignFilters";
import {
  CAMPAIGN_PAGE_SIZE,
  readListState,
  toQueryParams,
  writeListState,
  type CampaignListState,
} from "./campaign-list-params";

export function CampaignsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => readListState(searchParams), [searchParams]);
  const query = useCampaigns(toQueryParams(state));

  const updateState = useCallback(
    (next: CampaignListState) => setSearchParams(writeListState(next)),
    [setSearchParams],
  );

  const hasFilters = Boolean(state.search || state.health || state.channel);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Delivery health for every campaign. Filter by status or channel to find the ones that need work."
        actions={
          <ButtonLink to="/campaigns/new" variant="primary" icon={<Icon name="plus" size={16} />}>
            New campaign
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-4">
        <CampaignFilters state={state} onChange={updateState} />

        {query.isPending ? (
          <LoadingRegion label="Loading campaigns">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: CAMPAIGN_PAGE_SIZE }, (_, index) => (
                <Skeleton key={index} className="h-52" />
              ))}
            </div>
          </LoadingRegion>
        ) : query.isError ? (
          <ErrorState
            title="Could not load campaigns"
            message={describeError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data.items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon="filter"
              title="No campaigns match these filters"
              description="Try a different search term, or clear the filters to see every campaign."
            />
          ) : (
            <EmptyState
              icon="megaphone"
              title="No campaigns yet"
              description="Create a campaign to start tracking its delivery across channels."
              action={
                <ButtonLink to="/campaigns/new" variant="primary">
                  Create campaign
                </ButtonLink>
              }
            />
          )
        ) : (
          <>
            <p className="text-sm text-fg-secondary" aria-live="polite">
              {formatInteger(query.data.totalCount)}{" "}
              {query.data.totalCount === 1 ? "campaign" : "campaigns"}
              {query.isFetching ? " · refreshing…" : ""}
            </p>
            <div
              className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${query.isFetching ? "opacity-70" : ""}`}
            >
              {query.data.items.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalCount={query.data.totalCount}
              pageSize={query.data.pageSize}
              itemLabel="campaigns"
              onPageChange={(page) => updateState({ ...state, page })}
            />
          </>
        )}
      </div>
    </>
  );
}
