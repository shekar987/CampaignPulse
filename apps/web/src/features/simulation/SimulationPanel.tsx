import type { Channel } from "@campaignpulse/event-contracts";
import { SCENARIO_LABELS } from "@campaignpulse/shared";
import { useState } from "react";

import { describeError } from "../../api/client";
import { useSimulateDelivery } from "../../api/hooks";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import type { SimulateDeliveryMutation } from "../../gql/graphql";
import { formatInteger, formatTime } from "../../lib/format";
import { SimulationForm } from "./SimulationForm";

type SimulationRun = SimulateDeliveryMutation["simulateDelivery"];

export function SimulationPanel({
  campaignId,
  channels,
}: {
  campaignId: string;
  channels: readonly Channel[];
}) {
  const mutation = useSimulateDelivery();
  const [lastRun, setLastRun] = useState<SimulationRun | null>(null);

  return (
    <Card
      title="Run simulation"
      description="Publish simulated delivery requests for this campaign and watch health, incidents and retries respond."
      className="border-accent/30 bg-[linear-gradient(135deg,var(--color-accent-subtle),var(--color-surface-raised)_45%)]"
    >
      <div className="flex flex-col gap-4">
        <SimulationForm
          campaignId={campaignId}
          channels={channels}
          submitting={mutation.isPending}
          onSubmit={async (input) => {
            const run = await mutation.mutateAsync(input);
            setLastRun(run);
          }}
        />
        {mutation.isError ? (
          <p role="alert" className="text-sm font-medium text-status-error-fg">
            {describeError(mutation.error)}
          </p>
        ) : null}
        {lastRun ? (
          <p
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-md border border-status-info-border bg-status-info-bg px-3 py-2 text-sm text-status-info-fg"
          >
            <Icon name="check-circle" size={16} />
            <span>
              Run <code className="font-mono text-xs">{lastRun.id}</code> started at{" "}
              {formatTime(lastRun.startedAt)}: {formatInteger(lastRun.deliveries)}{" "}
              {SCENARIO_LABELS[lastRun.scenario].toLowerCase()} deliveries across{" "}
              {lastRun.channels.length} {lastRun.channels.length === 1 ? "channel" : "channels"}{" "}
              (seed {lastRun.seed}). This page refreshes automatically.
            </span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
