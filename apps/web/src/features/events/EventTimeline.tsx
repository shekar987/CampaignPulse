import { CHANNELS } from "@campaignpulse/event-contracts";
import { CHANNEL_LABELS, ERROR_CODE_LABELS, EVENT_TYPE_LABELS } from "@campaignpulse/shared";

import { describeError } from "../../api/client";
import { useDeliveryEvents, type DeliveryEventItem } from "../../api/hooks";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Pagination } from "../../components/ui/Pagination";
import { EventStatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import type { Channel } from "../../gql/graphql";
import { formatDateTime, formatLatency } from "../../lib/format";
import styles from "./EventTimeline.module.css";

const EVENT_PAGE_SIZE = 25;

export interface EventTimelineFilters {
  channel: Channel | null;
  correlationId: string | null;
  page: number;
}

export interface EventTimelineProps {
  campaignId: string;
  filters: EventTimelineFilters;
  onFiltersChange: (next: EventTimelineFilters) => void;
}

export function EventTimeline({ campaignId, filters, onFiltersChange }: EventTimelineProps) {
  const query = useDeliveryEvents({
    campaignId,
    channel: filters.channel,
    correlationId: filters.correlationId,
    page: filters.page,
    pageSize: EVENT_PAGE_SIZE,
  });

  return (
    <Card
      title="Event timeline"
      description="Every delivery event recorded for this campaign, newest first. Select a correlation id to follow one delivery end to end."
      padded={false}
      actions={
        <SelectField
          id="timeline-channel"
          label="Channel"
          value={filters.channel ?? ""}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              channel: (event.target.value || null) as Channel | null,
              page: 1,
            })
          }
          className="min-w-44"
        >
          <option value="">All channels</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {CHANNEL_LABELS[channel]}
            </option>
          ))}
        </SelectField>
      }
    >
      {filters.correlationId ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-accent-subtle px-4 py-2 text-sm sm:px-5">
          <Icon name="link" size={16} className="text-accent" />
          <span>
            Showing delivery{" "}
            <code className={`${styles.mono} rounded bg-surface-raised px-1.5 py-0.5`}>
              {filters.correlationId}
            </code>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFiltersChange({ ...filters, correlationId: null, page: 1 })}
            icon={<Icon name="close" size={14} />}
          >
            Show all events
          </Button>
        </div>
      ) : null}

      {query.isPending ? (
        <LoadingRegion label="Loading delivery events">
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        </LoadingRegion>
      ) : query.isError ? (
        <div className="p-4">
          <ErrorState
            title="Could not load delivery events"
            message={describeError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </div>
      ) : query.data.items.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon="clock"
            title="No delivery events"
            description={
              filters.channel || filters.correlationId
                ? "Nothing matches the current filter."
                : "Events will appear here once deliveries run for this campaign."
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Event</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempt</th>
                  <th scope="col">Latency</th>
                  <th scope="col">Correlation id</th>
                  <th scope="col">Error</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onSelectCorrelation={(correlationId) =>
                      onFiltersChange({ ...filters, correlationId, page: 1 })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-subtle px-4 py-3 sm:px-5">
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalCount={query.data.totalCount}
              pageSize={query.data.pageSize}
              itemLabel="events"
              onPageChange={(page) => onFiltersChange({ ...filters, page })}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function EventRow({
  event,
  onSelectCorrelation,
}: {
  event: DeliveryEventItem;
  onSelectCorrelation: (correlationId: string) => void;
}) {
  return (
    <tr>
      <td data-label="Time" className={`${styles.mono} whitespace-nowrap`}>
        <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
      </td>
      <td data-label="Event">
        <span className="font-medium text-fg-primary">{EVENT_TYPE_LABELS[event.eventType]}</span>
        <span className={`${styles.mono} block text-fg-muted`}>{event.eventType}</span>
      </td>
      <td data-label="Channel">{CHANNEL_LABELS[event.channel]}</td>
      <td data-label="Status">
        <EventStatusBadge status={event.status} />
      </td>
      <td data-label="Attempt" className="tabular-nums">
        {event.attempt}
      </td>
      <td data-label="Latency" className="tabular-nums whitespace-nowrap">
        {formatLatency(event.latencyMs) ?? "—"}
      </td>
      <td data-label="Correlation id">
        <button
          type="button"
          className={`${styles.correlation} ${styles.mono}`}
          onClick={() => onSelectCorrelation(event.correlationId)}
          aria-label={`Show all events for delivery ${event.correlationId}`}
        >
          {event.correlationId}
        </button>
      </td>
      <td data-label="Error">
        {event.error ? (
          <span className={styles.error}>
            <span className="font-medium">{ERROR_CODE_LABELS[event.error.code]}</span>
            <span className="block text-xs">{event.error.message}</span>
          </span>
        ) : (
          <span className="text-fg-muted">—</span>
        )}
      </td>
    </tr>
  );
}
