import { CHANNEL_LABELS } from "@campaignpulse/shared";

import type { CampaignDetail } from "../../api/hooks";
import { HealthBadge } from "../../components/ui/StatusBadge";
import { formatInteger, formatLatency, formatPercent } from "../../lib/format";

export function ChannelHealthGrid({ channels }: { channels: CampaignDetail["channels"] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Channel delivery health">
      {channels.map((channel) => {
        const { metrics } = channel;
        const hasData = metrics.totalEvents > 0;
        return (
          <li
            key={channel.id}
            className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-surface-raised p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-fg-primary">{CHANNEL_LABELS[channel.channel]}</h3>
              <HealthBadge status={channel.healthStatus} size="sm" />
            </div>
            {hasData ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Metric label="Success rate" value={formatPercent(metrics.successRate)} />
                <Metric label="Error rate" value={formatPercent(metrics.errorRate)} />
                <Metric label="Attempts" value={formatInteger(metrics.totalEvents)} />
                <Metric label="Failed" value={formatInteger(metrics.failedEvents)} />
                <Metric label="Avg latency" value={formatLatency(metrics.avgLatencyMs)} />
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">No delivery data available</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-fg-primary">{value ?? "—"}</dd>
    </div>
  );
}
