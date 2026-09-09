import type { HealthStatus } from "@campaignpulse/event-contracts";
import { CHANNEL_LABELS, HEALTH_LABELS } from "@campaignpulse/shared";
import { Link } from "react-router";

import { describeError } from "../../api/client";
import { useSystemHealth, type SystemHealth } from "../../api/hooks";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { RateBar } from "../../components/ui/RateBar";
import { HealthBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import { formatInteger, formatLatency, formatPercent, formatRelative } from "../../lib/format";
import { HEALTH_ICONS, HEALTH_TONES, rateTone } from "../../lib/health";

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
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
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

const TILE_CLASSES: Record<HealthStatus, string> = {
  HEALTHY: "border-status-success-border bg-status-success-bg text-status-success-fg",
  DEGRADED: "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
  CRITICAL: "border-status-error-border bg-status-error-bg text-status-error-fg",
  UNKNOWN: "border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg",
};

const ATTENTION_ACCENT: Record<HealthStatus, string> = {
  HEALTHY: "border-l-status-success-solid",
  DEGRADED: "border-l-status-warning-solid",
  CRITICAL: "border-l-status-error-solid",
  UNKNOWN: "border-l-status-neutral-solid",
};

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
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-canvas sm:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))] sm:px-5"
              >
                <p className="font-semibold text-fg-primary">{CHANNEL_LABELS[channel.channel]}</p>
                <HealthBadge status={channel.healthStatus} size="sm" />
                <div className="col-span-2 sm:col-span-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-xs text-fg-muted">Success rate</span>
                    <span className="font-semibold tabular-nums text-fg-primary">
                      {formatPercent(channel.metrics.successRate) ?? "No data"}
                    </span>
                  </div>
                  <RateBar
                    value={channel.metrics.successRate}
                    tone={rateTone(channel.metrics.errorRate)}
                    className="mt-1.5"
                  />
                </div>
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
                    className={`block rounded-lg border p-3 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md ${TILE_CLASSES[status]}`}
                    aria-label={`${formatInteger(totals[key])} ${HEALTH_LABELS[status].toLowerCase()} campaigns`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                      <Icon name={HEALTH_ICONS[status]} size={14} />
                      {HEALTH_LABELS[status]}
                    </span>
                    <span className="mt-2 block text-3xl font-semibold tabular-nums">
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
            icon="send"
            tone="info"
            value={
              snapshot.delivery.totalEvents > 0
                ? formatInteger(snapshot.delivery.totalEvents)
                : null
            }
          />
          <MetricCard
            label="Success rate"
            icon="trending-up"
            value={formatPercent(snapshot.delivery.successRate)}
            tone={rateTone(snapshot.delivery.errorRate)}
            bar={snapshot.delivery.successRate}
          />
          <MetricCard
            label="Failed attempts"
            icon="alert-circle"
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
          <MetricCard
            label="Avg latency"
            icon="zap"
            value={formatLatency(snapshot.delivery.avgLatencyMs)}
          />
        </div>
      </section>

      <section aria-labelledby="operations-heading">
        <h2 id="operations-heading" className="mb-3 text-base font-semibold text-fg-primary">
          Operations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/incidents?status=OPEN"
            className="block rounded-lg transition-transform hover:-translate-y-0.5"
          >
            <MetricCard
              label="Open incidents"
              icon="siren"
              value={formatInteger(snapshot.openIncidents)}
              hint="Investigating or acknowledged. Select to triage."
              tone={snapshot.openIncidents > 0 ? "error" : "success"}
            />
          </Link>
          <Link
            to="/dead-letters"
            className="block rounded-lg transition-transform hover:-translate-y-0.5"
          >
            <MetricCard
              label="Dead-letter queue"
              icon="archive"
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
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 px-4 py-3 transition-colors hover:bg-surface-canvas sm:px-5 ${ATTENTION_ACCENT[campaign.healthStatus]}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg-primary">{campaign.name}</p>
                      <p className="truncate text-sm text-fg-secondary">
                        {campaign.advertiserName}
                        {campaign.openIncidentCount > 0
                          ? ` · ${campaign.openIncidentCount} open ${campaign.openIncidentCount === 1 ? "incident" : "incidents"}`
                          : ""}
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
                          className={`font-semibold text-status-${HEALTH_TONES[worst.healthStatus]}-fg tabular-nums`}
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
      <span className="font-semibold tabular-nums text-fg-primary">{value ?? "No data"}</span>
    </p>
  );
}
