import { CHANNELS } from "@campaignpulse/event-contracts";
import { useCallback, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { describeError } from "../../api/client";
import { useCampaign } from "../../api/hooks";
import { NotFoundPage } from "../../components/layout/NotFoundPage";
import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { CampaignStatusBadge, HealthBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import type { Channel } from "../../gql/graphql";
import { formatDateTime, formatInteger, formatLatency, formatPercent } from "../../lib/format";
import { DeadLetterPanel } from "../dead-letters/DeadLetterPanel";
import { EventTimeline, type EventTimelineFilters } from "../events/EventTimeline";
import { CampaignIncidentsCard } from "../incidents/CampaignIncidentsCard";
import { SimulationPanel } from "../simulation/SimulationPanel";
import { ChannelHealthGrid } from "./ChannelHealthGrid";

function readTimelineFilters(params: URLSearchParams): EventTimelineFilters {
  const channel = params.get("channel");
  const page = Number.parseInt(params.get("eventsPage") ?? "1", 10);
  return {
    channel:
      channel && (CHANNELS as readonly string[]).includes(channel) ? (channel as Channel) : null,
    correlationId: params.get("correlation"),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

function writeTimelineFilters(filters: EventTimelineFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.channel) {
    params.set("channel", filters.channel);
  }
  if (filters.correlationId) {
    params.set("correlation", filters.correlationId);
  }
  if (filters.page > 1) {
    params.set("eventsPage", String(filters.page));
  }
  return params;
}

export function CampaignDetailPage() {
  const { campaignId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readTimelineFilters(searchParams), [searchParams]);
  const query = useCampaign(campaignId);

  const updateFilters = useCallback(
    (next: EventTimelineFilters) => setSearchParams(writeTimelineFilters(next)),
    [setSearchParams],
  );

  const backLink = (
    <Link
      to="/campaigns"
      className="inline-flex items-center gap-1 text-sm font-medium text-fg-secondary hover:text-fg-primary"
    >
      <Icon name="arrow-left" size={16} />
      All campaigns
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        <PageHeader eyebrow={backLink} title="Loading campaign…" />
        <LoadingRegion label="Loading campaign">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="mt-4 h-40" />
          <Skeleton className="mt-4 h-96" />
        </LoadingRegion>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        <PageHeader eyebrow={backLink} title="Campaign" />
        <ErrorState
          title="Could not load this campaign"
          message={describeError(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </>
    );
  }

  const campaign = query.data;
  if (!campaign) {
    return <NotFoundPage />;
  }

  const { metrics } = campaign;

  return (
    <>
      <PageHeader
        eyebrow={backLink}
        title={campaign.name}
        meta={
          <>
            <HealthBadge status={campaign.healthStatus} />
            <CampaignStatusBadge status={campaign.status} />
          </>
        }
        description={
          <>
            {campaign.advertiserName} · created {formatDateTime(campaign.createdAt)} · health
            recalculated {formatDateTime(campaign.updatedAt)}
          </>
        }
        actions={
          <ButtonLink to="/campaigns/new" icon={<Icon name="plus" size={16} />}>
            New campaign
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="overall-heading">
          <h2 id="overall-heading" className="mb-3 text-base font-semibold text-fg-primary">
            Overall delivery
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Delivery attempts"
              value={metrics.totalEvents > 0 ? formatInteger(metrics.totalEvents) : null}
            />
            <MetricCard
              label="Success rate"
              value={formatPercent(metrics.successRate)}
              tone={
                campaign.healthStatus === "CRITICAL"
                  ? "error"
                  : campaign.healthStatus === "DEGRADED"
                    ? "warning"
                    : campaign.healthStatus === "HEALTHY"
                      ? "success"
                      : "neutral"
              }
            />
            <MetricCard
              label="Failed attempts"
              value={metrics.totalEvents > 0 ? formatInteger(metrics.failedEvents) : null}
              hint={
                metrics.errorRate !== null && metrics.errorRate !== undefined
                  ? `${formatPercent(metrics.errorRate)} error rate`
                  : undefined
              }
              tone={metrics.failedEvents > 0 ? "error" : "neutral"}
            />
            <MetricCard label="Avg latency" value={formatLatency(metrics.avgLatencyMs)} />
          </div>
        </section>

        <section aria-labelledby="channels-heading">
          <h2 id="channels-heading" className="mb-3 text-base font-semibold text-fg-primary">
            Channel delivery
          </h2>
          <ChannelHealthGrid channels={campaign.channels} />
        </section>

        <SimulationPanel
          campaignId={campaign.id}
          channels={campaign.channels.map((channel) => channel.channel)}
        />

        <CampaignIncidentsCard campaignId={campaign.id} />

        <DeadLetterPanel campaignId={campaign.id} />

        <EventTimeline campaignId={campaign.id} filters={filters} onFiltersChange={updateFilters} />
      </div>
    </>
  );
}
