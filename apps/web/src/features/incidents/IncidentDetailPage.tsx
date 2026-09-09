import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { describeError } from "../../api/client";
import { useIncident } from "../../api/hooks";
import { NotFoundPage } from "../../components/layout/NotFoundPage";
import { ButtonLink } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { HealthBadge, IncidentStatusBadge, SeverityBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import { formatDateTime, formatInteger, formatPercent } from "../../lib/format";
import { EventTimeline, type EventTimelineFilters } from "../events/EventTimeline";
import { IncidentActions } from "./IncidentActions";

export function IncidentDetailPage() {
  const { incidentId = "" } = useParams();
  const query = useIncident(incidentId);
  const [timeline, setTimeline] = useState<EventTimelineFilters | null>(null);

  const backLink = (
    <Link
      to="/incidents"
      className="inline-flex items-center gap-1 text-sm font-medium text-fg-secondary hover:text-fg-primary"
    >
      <Icon name="arrow-left" size={16} />
      All incidents
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        <PageHeader eyebrow={backLink} title="Loading incident…" />
        <LoadingRegion label="Loading incident">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="mt-4 h-40" />
        </LoadingRegion>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        <PageHeader eyebrow={backLink} title="Incident" />
        <ErrorState
          title="Could not load this incident"
          message={describeError(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </>
    );
  }

  const incident = query.data;
  if (!incident) {
    return <NotFoundPage />;
  }

  const filters: EventTimelineFilters = timeline ?? {
    channel: incident.channel,
    correlationId: null,
    page: 1,
  };

  return (
    <>
      <PageHeader
        eyebrow={backLink}
        title={incident.title}
        meta={
          <>
            <SeverityBadge severity={incident.severity} size="md" />
            <IncidentStatusBadge status={incident.status} size="md" />
          </>
        }
        description={
          <>
            <Link to={`/campaigns/${incident.campaignId}`} className="font-medium hover:underline">
              {incident.campaignName}
            </Link>{" "}
            ({incident.advertiserName}) · {CHANNEL_LABELS[incident.channel]} · started{" "}
            {formatDateTime(incident.startedAt)}
          </>
        }
        actions={
          <ButtonLink
            to={`/campaigns/${incident.campaignId}?channel=${incident.channel}`}
            icon={<Icon name="clock" size={16} />}
          >
            Campaign timeline
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Error rate at detection"
            value={formatPercent(incident.errorRateAtDetection)}
            tone={incident.severity === "CRITICAL" ? "error" : "warning"}
          />
          <MetricCard
            label="Affected attempts"
            value={
              incident.failedEventsAtDetection !== null &&
              incident.failedEventsAtDetection !== undefined
                ? formatInteger(incident.failedEventsAtDetection)
                : null
            }
            hint={
              incident.totalEventsAtDetection
                ? `of ${formatInteger(incident.totalEventsAtDetection)} attempts when detected`
                : undefined
            }
          />
          <div className="rounded-lg border border-line-subtle bg-surface-raised p-4 shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              Channel health now
            </p>
            <div className="mt-2">
              <HealthBadge status={incident.currentChannelHealth} />
            </div>
          </div>
          <MetricCard
            label="Current error rate"
            value={formatPercent(incident.currentMetrics.errorRate)}
            hint={
              incident.currentMetrics.totalEvents > 0
                ? `${formatInteger(incident.currentMetrics.failedEvents)} of ${formatInteger(incident.currentMetrics.totalEvents)} attempts failed`
                : undefined
            }
            tone={
              incident.currentChannelHealth === "CRITICAL"
                ? "error"
                : incident.currentChannelHealth === "DEGRADED"
                  ? "warning"
                  : incident.currentChannelHealth === "HEALTHY"
                    ? "success"
                    : "neutral"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title="Actions" description="Investigate, retry and close out this incident.">
            <IncidentActions incident={incident} />
          </Card>
          <Card title="Timeline">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Detected" value={formatDateTime(incident.startedAt)} />
              <Row
                label="Acknowledged"
                value={
                  incident.acknowledgedAt ? formatDateTime(incident.acknowledgedAt) : "Not yet"
                }
              />
              <Row
                label="Resolved"
                value={incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "Not yet"}
              />
              {incident.resolutionNote ? (
                <Row label="Resolution note" value={incident.resolutionNote} />
              ) : null}
            </dl>
            {incident.description ? (
              <p className="mt-3 border-t border-line-subtle pt-3 text-sm text-fg-secondary">
                {incident.description}
              </p>
            ) : null}
          </Card>
        </div>

        <EventTimeline
          campaignId={incident.campaignId}
          filters={filters}
          onFiltersChange={setTimeline}
        />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg-primary">{value}</dd>
    </div>
  );
}
