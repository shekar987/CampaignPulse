import { CHANNEL_LABELS } from "@campaignpulse/shared";
import { useEffect, useRef, useState } from "react";

import { describeError } from "../../api/client";
import {
  useAcknowledgeIncident,
  useResolveIncident,
  useRetryFailedDeliveries,
  type Incident,
} from "../../api/hooks";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { formatInteger } from "../../lib/format";

/**
 * The three operator actions on an incident. Each reports its own outcome inline so the
 * engineer sees what happened without leaving the page.
 */
export function IncidentActions({ incident }: { incident: Incident }) {
  const acknowledge = useAcknowledgeIncident();
  const retry = useRetryFailedDeliveries();
  const resolve = useResolveIncident();
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const resolveFormRef = useRef<HTMLFormElement>(null);

  // The resolve form appears in response to the engineer's click, so move focus into it.
  useEffect(() => {
    if (resolving) {
      resolveFormRef.current?.querySelector("input")?.focus();
    }
  }, [resolving]);

  const isResolved = incident.status === "RESOLVED";
  const error = acknowledge.error ?? retry.error ?? resolve.error;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => acknowledge.mutate(incident.id)}
          disabled={incident.status !== "OPEN" || acknowledge.isPending}
          icon={<Icon name="check-square" size={16} />}
        >
          {incident.status === "OPEN"
            ? acknowledge.isPending
              ? "Acknowledging…"
              : "Acknowledge"
            : "Acknowledged"}
        </Button>
        <Button
          onClick={async () => {
            setReplayMessage(null);
            const result = await retry.mutateAsync({
              campaignId: incident.campaignId,
              channel: incident.channel,
            });
            setReplayMessage(
              result.replayed === 0
                ? `No dead-lettered ${CHANNEL_LABELS[incident.channel]} deliveries to retry.`
                : `${formatInteger(result.replayed)} ${result.replayed === 1 ? "delivery" : "deliveries"} re-requested.`,
            );
          }}
          disabled={isResolved || retry.isPending}
          icon={<Icon name="rotate-ccw" size={16} />}
        >
          {retry.isPending ? "Retrying…" : "Retry failed deliveries"}
        </Button>
        {!isResolved && !resolving ? (
          <Button
            variant="primary"
            onClick={() => setResolving(true)}
            icon={<Icon name="check-circle" size={16} />}
          >
            Resolve
          </Button>
        ) : null}
      </div>

      {resolving && !isResolved ? (
        <form
          ref={resolveFormRef}
          className="flex flex-col gap-3 rounded-md border border-line-subtle bg-surface-canvas p-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            resolve.mutate(
              { id: incident.id, note: note.trim() || null },
              { onSuccess: () => setResolving(false) },
            );
          }}
        >
          <div className="flex-1">
            <TextField
              id="resolution-note"
              label="Resolution note (optional)"
              value={note}
              maxLength={500}
              placeholder="What fixed it?"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={resolve.isPending}>
              {resolve.isPending ? "Resolving…" : "Confirm resolve"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setResolving(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {replayMessage ? (
        <p role="status" className="text-sm text-fg-secondary">
          {replayMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-status-error-fg">
          {describeError(error)}
        </p>
      ) : null}
    </div>
  );
}
