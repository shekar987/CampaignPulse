import { SIMULATION_SCENARIOS, type Channel } from "@campaignpulse/event-contracts";
import {
  CHANNEL_LABELS,
  CUSTOM_SIMULATION_LIMITS,
  SCENARIO_LABELS,
  SIMULATION_PRESETS,
} from "@campaignpulse/shared";
import { useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { CheckboxGroup, SelectField, TextField } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import type { SimulateDeliveryInput, SimulationScenario } from "../../gql/graphql";

export interface SimulationFormProps {
  campaignId: string;
  /** Channels the campaign is configured for. */
  channels: readonly Channel[];
  onSubmit: (input: SimulateDeliveryInput) => Promise<void>;
  submitting: boolean;
}

const DEFAULT_CUSTOM_DELIVERIES = 50;
const DEFAULT_CUSTOM_FAILURE_PERCENT = 5;

export function SimulationForm({
  campaignId,
  channels,
  onSubmit,
  submitting,
}: SimulationFormProps) {
  const [scenario, setScenario] = useState<SimulationScenario>("CRITICAL");
  const [selected, setSelected] = useState<Channel[]>([...channels]);
  const [deliveries, setDeliveries] = useState(String(DEFAULT_CUSTOM_DELIVERIES));
  const [failurePercent, setFailurePercent] = useState(String(DEFAULT_CUSTOM_FAILURE_PERCENT));
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preset = scenario === "CUSTOM" ? null : SIMULATION_PRESETS[scenario];
  const parsedDeliveries = Number.parseInt(deliveries, 10);
  const parsedFailure = Number.parseFloat(failurePercent);
  const parsedSeed = seed.trim() === "" ? null : Number.parseInt(seed, 10);

  const perChannel = preset
    ? preset.deliveries
    : Number.isFinite(parsedDeliveries)
      ? parsedDeliveries
      : 0;
  const totalDeliveries = perChannel * selected.length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected.length === 0) {
      setError("Select at least one channel.");
      return;
    }
    if (scenario === "CUSTOM") {
      if (
        !Number.isInteger(parsedDeliveries) ||
        parsedDeliveries < CUSTOM_SIMULATION_LIMITS.minDeliveries ||
        parsedDeliveries > CUSTOM_SIMULATION_LIMITS.maxDeliveries
      ) {
        setError(
          `Deliveries per channel must be between ${CUSTOM_SIMULATION_LIMITS.minDeliveries} and ${CUSTOM_SIMULATION_LIMITS.maxDeliveries}.`,
        );
        return;
      }
      if (!Number.isFinite(parsedFailure) || parsedFailure < 0 || parsedFailure > 100) {
        setError("Failure rate must be between 0 and 100 percent.");
        return;
      }
    }
    if (parsedSeed !== null && (!Number.isInteger(parsedSeed) || parsedSeed < 0)) {
      setError("Seed must be a whole number of 0 or more.");
      return;
    }
    setError(null);
    await onSubmit({
      campaignId,
      channels: selected,
      scenario,
      ...(scenario === "CUSTOM"
        ? { deliveries: parsedDeliveries, failureRate: parsedFailure / 100 }
        : {}),
      ...(parsedSeed !== null ? { seed: parsedSeed } : {}),
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="simulation-scenario"
          label="Scenario"
          value={scenario}
          onChange={(event) => setScenario(event.target.value as SimulationScenario)}
          hint={preset ? preset.description : "Choose the volume and first-attempt failure rate."}
        >
          {SIMULATION_SCENARIOS.map((key) => (
            <option key={key} value={key}>
              {SCENARIO_LABELS[key]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="simulation-seed"
          label="Seed (optional)"
          type="number"
          inputMode="numeric"
          min={0}
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          hint="Reuse a seed from a previous run to reproduce exactly which deliveries fail."
        />
      </div>

      {scenario === "CUSTOM" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="simulation-deliveries"
            label="Deliveries per channel"
            type="number"
            inputMode="numeric"
            min={CUSTOM_SIMULATION_LIMITS.minDeliveries}
            max={CUSTOM_SIMULATION_LIMITS.maxDeliveries}
            value={deliveries}
            onChange={(event) => setDeliveries(event.target.value)}
          />
          <TextField
            id="simulation-failure-rate"
            label="First-attempt failure rate (%)"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={failurePercent}
            onChange={(event) => setFailurePercent(event.target.value)}
            hint="Failed attempts use a retryable error and recover on retry."
          />
        </div>
      ) : null}

      <CheckboxGroup
        legend="Channels"
        name="simulation-channels"
        options={channels.map((channel) => ({ value: channel, label: CHANNEL_LABELS[channel] }))}
        value={selected}
        onChange={setSelected}
        hint={`${totalDeliveries} ${totalDeliveries === 1 ? "delivery" : "deliveries"} will be requested.`}
        error={error ?? undefined}
      />

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          icon={<Icon name="play" size={16} />}
        >
          {submitting ? "Publishing…" : "Run scenario"}
        </Button>
        <p className="text-xs text-fg-secondary">
          Requests go through the delivery queue and are processed by workers in the background.
        </p>
      </div>
    </form>
  );
}
