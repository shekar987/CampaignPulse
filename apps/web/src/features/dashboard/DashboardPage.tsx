import type { HealthStatus } from "@campaignpulse/event-contracts";
import { CHANNEL_LABELS, HEALTH_LABELS } from "@campaignpulse/shared";
import { Link } from "react-router";

import { describeError } from "../../api/client";
import { useSystemHealth, type SystemHealth } from "../../api/hooks";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { HealthBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import { formatInteger, formatLatency, formatPercent, formatRelative } from "../../lib/format";
import { HEALTH_TONES } from "../../lib/health";

export function DashboardPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useSystemHealth();

  return (
    <>
      <PageHeader
        title="System overview"
        description="Delivery health across every simulated channel, with the campaigns that need attention first."
      />

      {isPending ? (
        <LoadingRegion label="Loading system overview">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </LoadingRegion>
      ) : isError ? (
        <ErrorState
          title="Could not load the system overview"
          message={describeError(error)}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : (
        <DashboardContent snapshot={data} />
      )}
    </>
  );
}

function DashboardContent({ snapshot }: { snapshot: SystemHealth }) {
  const window = `Last ${snapshot.windowHours} hours`;
  const totals = snapshot.campaigns;
  const totalCampaigns = totals.healthy + totals.degraded + totals.critical + totals.unknown;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Channel health"
          description={`${window}, across all campaigns. Updated ${formatRelative(snapshot.generatedAt)}.`}
          padded={false}
        >
          <ul className="divide-y divide-line-subtle">
            {snapshot.channels.map((channel) => (
              <li
                key={channel.channel}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_auto_repeat(3,minmax(0,1fr))] sm:px-5"
              >
                <p className="font-medium text-fg-primary">{CHANNEL_LABELS[channel.channel]}</p>
                <HealthBadge status={channel.healthStatus} size="sm" />
                <Stat label="Success rate" value={formatPercent(channel.metrics.successRate)} />
                <Stat
                  label="Attempts"
                  value={
                    channel.metrics.totalEvents > 0
                      ? formatInteger(channel.metrics.totalEvents)
                      : null
                  }
                />
                <Stat label="Avg latency" value={formatLatency(channel.metrics.avgLatencyMs)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Campaign health" description={`${formatInteger(totalCampaigns)} campaigns`}>
          <ul className="grid grid-cols-2 gap-3" aria-label="Campaigns by health">
            {(["critical", "degraded", "healthy", "unknown"] as const).map((key) => {
              const status = key.toUpperCase() as HealthStatus;
              return (
                <li key={key}>
                  <Link
                    to={`/campaigns?health=${status}`}
                    className="block rounded-md border border-line-subtle bg-surface-canvas p-3 hover:bg-surface-sunken"
                    aria-label={`${formatInteger(totals[key])} ${HEALTH_LABELS[status].toLowerCase()} campaigns`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
                      <HealthBadge status={status} size="sm" />
                    </span>
                    <span className="mt-2 block text-2xl font-semibold tabular-nums text-fg-primary">
                      {formatInteger(totals[key])}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="mb-3 text-base font-semibold text-fg-primary">
          Delivery <span className="font-normal text-fg-secondary">({window.toLowerCase()})</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Delivery attempts"
            value={
              snapshot.delivery.totalEvents > 0
                ? formatInteger(snapshot.delivery.totalEvents)
                : null
            }
          />
          <MetricCard
            label="Success rate"
            value={formatPercent(snapshot.delivery.successRate)}
            tone={rateTone(snapshot.delivery.errorRate)}
          />
          <MetricCard
            label="Failed attempts"
            value={
              snapshot.delivery.totalEvents > 0
                ? formatInteger(snapshot.delivery.failedEvents)
                : null
            }
            hint={
              snapshot.delivery.errorRate !== null && snapshot.delivery.errorRate !== undefined
                ? `${formatPercent(snapshot.delivery.errorRate)} error rate`
                : undefined
            }
            tone={snapshot.delivery.failedEvents > 0 ? "error" : "neutral"}
          />
          <MetricCard label="Avg latency" value={formatLatency(snapshot.delivery.avgLatencyMs)} />
        </div>
      </section>

      <section aria-labelledby="operations-heading">
        <h2 id="operations-heading" className="mb-3 text-base font-semibold text-fg-primary">
          Operations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/incidents?status=OPEN" className="block rounded-lg hover:shadow-md">
            <MetricCard
              label="Open incidents"
              value={formatInteger(snapshot.openIncidents)}
              hint="Investigating or acknowledged. Select to triage."
              tone={snapshot.openIncidents > 0 ? "error" : "success"}
            />
          </Link>
          <Link to="/dead-letters" className="block rounded-lg hover:shadow-md">
            <MetricCard
              label="Dead-letter queue"
              value={formatInteger(snapshot.deadLetterCount)}
              hint="Deliveries awaiting replay after exhausting their retries."
              tone={snapshot.deadLetterCount > 0 ? "warning" : "success"}
            />
          </Link>
        </div>
      </section>

      <Card
        title="Needs attention"
        description="Campaigns whose delivery is degraded or critical, most severe first."
        padded={false}
      >
        {snapshot.attention.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="check-circle"
              title="All campaigns are healthy"
              description="No campaign is currently above the degraded error-rate threshold."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {snapshot.attention.map((campaign) => {
              const worst = [...campaign.channels].sort(
                (a, b) => (b.metrics.errorRate ?? -1) - (a.metrics.errorRate ?? -1),
              )[0];
              return (
                <li key={campaign.id}>
                  <Link
                    to={`/campaigns/${campaign.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-surface-sunken sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg-primary">{campaign.name}</p>
                      <p className="truncate text-sm text-fg-secondary">
                        {campaign.advertiserName}
                      </p>
                    </div>
                    <HealthBadge status={campaign.healthStatus} size="sm" />
                    {worst ? (
                      <p className="text-sm text-fg-secondary">
                        <span className="font-medium text-fg-primary">
                          {CHANNEL_LABELS[worst.channel]}
                        </span>{" "}
                        at{" "}
                        <span
                          className={`font-medium text-status-${HEALTH_TONES[worst.healthStatus]}-fg tabular-nums`}
                        >
                          {formatPercent(worst.metrics.errorRate) ?? "no data"}
                        </span>{" "}
                        errors
                      </p>
                    ) : null}
                    <Icon name="chevron-right" size={16} className="text-fg-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="text-sm">
      <span className="block text-xs text-fg-muted">{label}</span>
      <span className="font-medium tabular-nums text-fg-primary">{value ?? "No data"}</span>
    </p>
  );
}

function rateTone(errorRate: number | null | undefined) {
  if (errorRate === null || errorRate === undefined) {
    return "neutral" as const;
  }
  if (errorRate >= 0.1) {
    return "error" as const;
  }
  if (errorRate >= 0.02) {
    return "warning" as const;
  }
  return "success" as const;
}
