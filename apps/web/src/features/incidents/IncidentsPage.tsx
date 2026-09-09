import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";

import { describeError } from "../../api/client";
import { useIncidents, type Incident } from "../../api/hooks";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { HealthBadge, IncidentStatusBadge, SeverityBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import type { IncidentSeverity, IncidentStatus } from "../../gql/graphql";
import { formatInteger, formatPercent, formatRelative } from "../../lib/format";

const PAGE_SIZE = 20;
const STATUSES: IncidentStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];
const SEVERITIES: IncidentSeverity[] = ["CRITICAL", "WARNING"];

interface ListState {
  status: IncidentStatus | null;
  severity: IncidentSeverity | null;
  campaignId: string | null;
  page: number;
}

function readState(params: URLSearchParams): ListState {
  const status = params.get("status");
  const severity = params.get("severity");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    status: STATUSES.includes(status as IncidentStatus) ? (status as IncidentStatus) : null,
    severity: SEVERITIES.includes(severity as IncidentSeverity)
      ? (severity as IncidentSeverity)
      : null,
    campaignId: params.get("campaign"),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

function writeState(state: ListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.status) params.set("status", state.status);
  if (state.severity) params.set("severity", state.severity);
  if (state.campaignId) params.set("campaign", state.campaignId);
  if (state.page > 1) params.set("page", String(state.page));
  return params;
}

export function IncidentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => readState(searchParams), [searchParams]);
  const query = useIncidents({ ...state, pageSize: PAGE_SIZE });
  const update = useCallback(
    (next: ListState) => setSearchParams(writeState(next)),
    [setSearchParams],
  );
  const hasFilters = Boolean(state.status || state.severity || state.campaignId);

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Opened automatically when a channel's error rate crosses a threshold. Acknowledge, retry and resolve from here."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            id="incident-status"
            label="Status"
            value={state.status ?? ""}
            onChange={(event) =>
              update({
                ...state,
                status: (event.target.value || null) as IncidentStatus | null,
                page: 1,
              })
            }
            className="min-w-44"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Investigating</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </SelectField>
          <SelectField
            id="incident-severity"
            label="Severity"
            value={state.severity ?? ""}
            onChange={(event) =>
              update({
                ...state,
                severity: (event.target.value || null) as IncidentSeverity | null,
                page: 1,
              })
            }
            className="min-w-44"
          >
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
          </SelectField>
          {state.campaignId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ ...state, campaignId: null, page: 1 })}
              icon={<Icon name="close" size={14} />}
            >
              Clear campaign filter
            </Button>
          ) : null}
        </div>

        {query.isPending ? (
          <LoadingRegion label="Loading incidents">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          </LoadingRegion>
        ) : query.isError ? (
          <ErrorState
            title="Could not load incidents"
            message={describeError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            icon={hasFilters ? "filter" : "check-circle"}
            title={hasFilters ? "No incidents match these filters" : "No incidents"}
            description={
              hasFilters
                ? "Try a different status or severity."
                : "Every channel is within its error-rate threshold. Run a critical simulation on a campaign to see one open."
            }
          />
        ) : (
          <>
            <p className="text-sm text-fg-secondary" aria-live="polite">
              {formatInteger(query.data.totalCount)}{" "}
              {query.data.totalCount === 1 ? "incident" : "incidents"}
            </p>
            <ul className={`flex flex-col gap-3 ${query.isFetching ? "opacity-70" : ""}`}>
              {query.data.items.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </ul>
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalCount={query.data.totalCount}
              pageSize={query.data.pageSize}
              itemLabel="incidents"
              onPageChange={(page) => update({ ...state, page })}
            />
          </>
        )}
      </div>
    </>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <li
      className={`rounded-lg border border-line-subtle border-l-4 bg-surface-raised p-4 shadow-sm ${
        incident.severity === "CRITICAL"
          ? "border-l-status-error-solid"
          : "border-l-status-warning-solid"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg-primary">
            <Link to={`/incidents/${incident.id}`} className="hover:text-accent">
              {incident.title}
            </Link>
          </h2>
          <p className="text-sm text-fg-secondary">
            <Link to={`/campaigns/${incident.campaignId}`} className="hover:text-fg-primary">
              {incident.campaignName}
            </Link>{" "}
            · {CHANNEL_LABELS[incident.channel]} · started {formatRelative(incident.startedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-fg-muted">Error rate at detection</dt>
          <dd className="font-medium tabular-nums text-fg-primary">
            {formatPercent(incident.errorRateAtDetection) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Affected attempts</dt>
          <dd className="font-medium tabular-nums text-fg-primary">
            {incident.failedEventsAtDetection !== null &&
            incident.failedEventsAtDetection !== undefined
              ? formatInteger(incident.failedEventsAtDetection)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Channel now</dt>
          <dd>
            <HealthBadge status={incident.currentChannelHealth} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Current error rate</dt>
          <dd className="font-medium tabular-nums text-fg-primary">
            {formatPercent(incident.currentMetrics.errorRate) ?? "—"}
          </dd>
        </div>
      </dl>
    </li>
  );
}
