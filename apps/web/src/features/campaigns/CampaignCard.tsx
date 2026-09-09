import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { Link } from "react-router";

import type { CampaignListItem } from "../../api/hooks";
import { Icon } from "../../components/ui/Icon";
import { CampaignStatusBadge, HealthBadge } from "../../components/ui/StatusBadge";
import { formatInteger, formatPercent } from "../../lib/format";
import { HEALTH_ICONS, HEALTH_TONES } from "../../lib/health";

const CHANNEL_TONE_CLASSES = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  neutral: "text-fg-muted",
  info: "text-status-info-fg",
} as const;

export function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const successRate = formatPercent(campaign.metrics.successRate);
  const headingId = `campaign-${campaign.id}-name`;

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-surface-raised p-4 shadow-sm transition-shadow hover:shadow-md"
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
          <dd className="font-medium tabular-nums text-fg-primary">
            {successRate ?? <span className="font-normal text-fg-muted">No delivery data</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Delivery attempts</dt>
          <dd className="font-medium tabular-nums text-fg-primary">
            {campaign.metrics.totalEvents > 0 ? (
              formatInteger(campaign.metrics.totalEvents)
            ) : (
              <span className="font-normal text-fg-muted">None yet</span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Channels">
        {campaign.channels.map((channel) => {
          const tone = HEALTH_TONES[channel.healthStatus];
          return (
            <li
              key={channel.id}
              className={`inline-flex items-center gap-1 ${CHANNEL_TONE_CLASSES[tone]}`}
              title={`${CHANNEL_LABELS[channel.channel]}: ${formatPercent(channel.metrics.successRate) ?? "no delivery data"}`}
            >
              <Icon name={HEALTH_ICONS[channel.healthStatus]} size={14} />
              <span>{CHANNEL_LABELS[channel.channel]}</span>
              <span className="tabular-nums">
                {formatPercent(channel.metrics.successRate) ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>

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
