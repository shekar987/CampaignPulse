import {
  CHANNEL_LABELS,
  DEAD_LETTER_REASON_LABELS,
  ERROR_CODE_LABELS,
} from "@campaignpulse/shared";
import { useState } from "react";
import { Link } from "react-router";

import { describeError } from "../../api/client";
import {
  useDeadLetterEntries,
  useRetryFailedDeliveries,
  type DeadLetterEntry,
} from "../../api/hooks";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Pagination } from "../../components/ui/Pagination";
import { DeadLetterStatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "../../components/ui/States";
import type { DeadLetterStatus } from "../../gql/graphql";
import { formatDateTime, formatInteger } from "../../lib/format";
import styles from "../events/EventTimeline.module.css";

const PAGE_SIZE = 20;

export interface DeadLetterPanelProps {
  /** Scope to one campaign; omit for the global queue. */
  campaignId?: string;
}

/**
 * Deliveries that gave up, why, and a replay action. Replays re-request every pending entry
 * for a campaign channel as new delivery workflows; the entries flip to "Replayed".
 */
export function DeadLetterPanel({ campaignId }: DeadLetterPanelProps) {
  const [status, setStatus] = useState<DeadLetterStatus | null>("PENDING");
  const [page, setPage] = useState(1);
  const query = useDeadLetterEntries({
    campaignId: campaignId ?? null,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const retry = useRetryFailedDeliveries();
  const [message, setMessage] = useState<string | null>(null);

  const replay = async (target: { campaignId: string; channel?: DeadLetterEntry["channel"] }) => {
    setMessage(null);
    const result = await retry.mutateAsync(target);
    setMessage(
      result.replayed === 0
        ? "Nothing to replay."
        : `${formatInteger(result.replayed)} ${result.replayed === 1 ? "delivery" : "deliveries"} re-requested.`,
    );
  };

  const pendingCount = status === "PENDING" ? (query.data?.totalCount ?? 0) : null;

  return (
    <Card
      title="Dead-letter queue"
      description="Deliveries that exhausted their retries or failed with a non-retryable error. Replay them once the cause is fixed."
      padded={false}
      actions={
        <>
          <SelectField
            id={`dlq-status-${campaignId ?? "all"}`}
            label="Show"
            value={status ?? ""}
            onChange={(event) => {
              setStatus((event.target.value || null) as DeadLetterStatus | null);
              setPage(1);
            }}
            className="min-w-40"
          >
            <option value="PENDING">Awaiting replay</option>
            <option value="REPLAYED">Replayed</option>
            <option value="">All</option>
          </SelectField>
          {campaignId ? (
            <Button
              onClick={() => void replay({ campaignId })}
              disabled={retry.isPending || !pendingCount}
              icon={<Icon name="rotate-ccw" size={16} />}
            >
              {retry.isPending ? "Retrying…" : "Retry all failed deliveries"}
            </Button>
          ) : null}
        </>
      }
    >
      {message ? (
        <p
          role="status"
          className="border-b border-line-subtle px-4 py-2 text-sm text-fg-secondary sm:px-5"
        >
          {message}
        </p>
      ) : null}
      {retry.isError ? (
        <p
          role="alert"
          className="border-b border-line-subtle px-4 py-2 text-sm font-medium text-status-error-fg sm:px-5"
        >
          {describeError(retry.error)}
        </p>
      ) : null}

      {query.isPending ? (
        <LoadingRegion label="Loading dead-letter queue">
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        </LoadingRegion>
      ) : query.isError ? (
        <div className="p-4">
          <ErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : query.data.items.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon="inbox"
            title={status === "PENDING" ? "Nothing awaiting replay" : "No dead-letter entries"}
            description={
              status === "PENDING"
                ? "Every delivery either succeeded or has been replayed."
                : "Entries appear here when a delivery gives up."
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Enqueued</th>
                  {campaignId ? null : <th scope="col">Campaign</th>}
                  <th scope="col">Delivery</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Last error</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Enqueued" className={`${styles.mono} whitespace-nowrap`}>
                      <time dateTime={entry.enqueuedAt}>{formatDateTime(entry.enqueuedAt)}</time>
                    </td>
                    {campaignId ? null : (
                      <td data-label="Campaign">
                        <Link
                          to={`/campaigns/${entry.campaignId}`}
                          className="font-medium text-fg-primary hover:text-accent"
                        >
                          {entry.campaignName}
                        </Link>
                      </td>
                    )}
                    <td data-label="Delivery">
                      <Link
                        to={`/campaigns/${entry.campaignId}?correlation=${encodeURIComponent(entry.correlationId)}`}
                        className={`${styles.mono} text-accent hover:underline`}
                      >
                        {entry.correlationId}
                      </Link>
                      {entry.replayCorrelationId ? (
                        <span className={`${styles.mono} block text-fg-muted`}>
                          replayed as {entry.replayCorrelationId}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Channel">{CHANNEL_LABELS[entry.channel]}</td>
                    <td data-label="Attempts" className="tabular-nums">
                      {entry.attempts}
                    </td>
                    <td data-label="Reason">{DEAD_LETTER_REASON_LABELS[entry.reason]}</td>
                    <td data-label="Last error">
                      <span className={styles.error}>
                        <span className="font-medium">
                          {ERROR_CODE_LABELS[entry.lastError.code]}
                        </span>
                        <span className="block text-xs">{entry.lastError.message}</span>
                      </span>
                    </td>
                    <td data-label="Status">
                      <DeadLetterStatusBadge status={entry.status} />
                    </td>
                    <td data-label="Actions">
                      {entry.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={retry.isPending}
                          onClick={() =>
                            void replay({ campaignId: entry.campaignId, channel: entry.channel })
                          }
                          aria-label={`Retry ${CHANNEL_LABELS[entry.channel]} deliveries for ${entry.campaignName}`}
                        >
                          Retry channel
                        </Button>
                      ) : null}
                    </td>
                  </tr>
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
              itemLabel="entries"
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </Card>
  );
}
