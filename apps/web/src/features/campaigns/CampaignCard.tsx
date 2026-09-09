import type { HealthStatus } from "@campaignpulse/event-contracts";
import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { Link } from "react-router";

import type { CampaignListItem } from "../../api/hooks";
import { Icon } from "../../components/ui/Icon";
import { RateBar } from "../../components/ui/RateBar";
import { CampaignStatusBadge, HealthBadge } from "../../components/ui/StatusBadge";
import { formatInteger, formatPercent } from "../../lib/format";
import { HEALTH_ICONS, HEALTH_TONES, rateTone } from "../../lib/health";

const CHANNEL_TONE_CLASSES = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
  info: "bg-status-info-bg text-status-info-fg",
} as const;

const ACCENT_CLASSES: Record<HealthStatus, string> = {
  HEALTHY: "border-t-status-success-solid",
  DEGRADED: "border-t-status-warning-solid",
  CRITICAL: "border-t-status-error-solid",
  UNKNOWN: "border-t-status-neutral-solid",
};

export function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const successRate = formatPercent(campaign.metrics.successRate);
  const headingId = `campaign-${campaign.id}-name`;

  return (
    <article
      aria-labelledby={headingId}
      className={`flex flex-col gap-3 rounded-lg border border-line-subtle border-t-4 bg-surface-raised p-4 shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md ${ACCENT_CLASSES[campaign.healthStatus]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="truncate text-base font-semibold text-fg-primary">
            <Link
              to={`/campaigns/${campaign.id}`}
              className="hover:text-accent focus-visible:text-accent"
            >
              {campaign.name}
            </Link>
          </h3>
          <p className="truncate text-sm text-fg-secondary">{campaign.advertiserName}</p>
        </div>
        <HealthBadge status={campaign.healthStatus} size="sm" />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-fg-muted">Success rate</dt>
          <dd className="font-semibold tabular-nums text-fg-primary">
            {successRate ?? <span className="font-normal text-fg-muted">No delivery data</span>}
          </dd>
          <dd>
            <RateBar
              value={campaign.metrics.successRate}
              tone={rateTone(campaign.metrics.errorRate)}
              className="mt-1.5"
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Delivery attempts</dt>
          <dd className="font-semibold tabular-nums text-fg-primary">
            {campaign.metrics.totalEvents > 0 ? (
              formatInteger(campaign.metrics.totalEvents)
            ) : (
              <span className="font-normal text-fg-muted">None yet</span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Channels">
        {campaign.channels.map((channel) => {
          const tone = HEALTH_TONES[channel.healthStatus];
          return (
            <li
              key={channel.id}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${CHANNEL_TONE_CLASSES[tone]}`}
              title={`${CHANNEL_LABELS[channel.channel]}: ${formatPercent(channel.metrics.successRate) ?? "no delivery data"}`}
            >
              <Icon name={HEALTH_ICONS[channel.healthStatus]} size={12} />
              <span>{CHANNEL_LABELS[channel.channel]}</span>
              <span className="tabular-nums">
                {formatPercent(channel.metrics.successRate) ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>

      {campaign.openIncidentCount > 0 || campaign.deadLetterCount > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Operational flags">
          {campaign.openIncidentCount > 0 ? (
            <li className="inline-flex items-center gap-1 font-medium text-status-error-fg">
              <Icon name="siren" size={14} />
              {campaign.openIncidentCount} open{" "}
              {campaign.openIncidentCount === 1 ? "incident" : "incidents"}
            </li>
          ) : null}
          {campaign.deadLetterCount > 0 ? (
            <li className="inline-flex items-center gap-1 font-medium text-status-warning-fg">
              <Icon name="archive" size={14} />
              {campaign.deadLetterCount} dead-lettered
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t border-line-subtle pt-3">
        <CampaignStatusBadge status={campaign.status} />
        <Link
          to={`/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          aria-label={`View ${campaign.name}`}
        >
          View
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </article>
  );
}
