import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { Link } from "react-router";

import { describeError } from "../../api/client";
import { useIncidents } from "../../api/hooks";
import { ButtonLink } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { IncidentStatusBadge, SeverityBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import { formatPercent, formatRelative } from "../../lib/format";

/** The unresolved incidents for one campaign, shown on its detail page. */
export function CampaignIncidentsCard({ campaignId }: { campaignId: string }) {
  const query = useIncidents({
    campaignId,
    status: null,
    severity: null,
    page: 1,
    pageSize: 20,
  });
  const active = query.data?.items.filter((incident) => incident.status !== "RESOLVED") ?? [];
  const resolvedCount = (query.data?.totalCount ?? 0) - active.length;

  return (
    <Card
      title="Incidents"
      description="Opened automatically when a channel's error rate crosses a threshold."
      padded={false}
      actions={
        <ButtonLink to={`/incidents?campaign=${campaignId}`} size="sm" variant="ghost">
          All incidents
          {resolvedCount > 0 ? ` (${resolvedCount} resolved)` : ""}
        </ButtonLink>
      }
    >
      {query.isPending ? (
        <LoadingRegion label="Loading incidents">
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </LoadingRegion>
      ) : query.isError ? (
        <div className="p-4">
          <ErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : active.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon="check-circle"
            title="No open incidents"
            description="Every channel is within its error-rate threshold."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {active.map((incident) => (
            <li key={incident.id}>
              <Link
                to={`/incidents/${incident.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-surface-sunken sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg-primary">{incident.title}</p>
                  <p className="text-sm text-fg-secondary">
                    {CHANNEL_LABELS[incident.channel]} ·{" "}
                    {formatPercent(incident.errorRateAtDetection) ?? "—"} at detection · started{" "}
                    {formatRelative(incident.startedAt)}
                  </p>
                </div>
                <SeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
                <Icon name="chevron-right" size={16} className="text-fg-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
