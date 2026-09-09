import { CHANNELS, type Channel } from "@campaignpulse/event-contracts";
import {
  ADVERTISER_NAME_MAX_LENGTH,
  CAMPAIGN_NAME_MAX_LENGTH,
  CHANNEL_LABELS,
  createCampaignSchema,
  type CreateCampaignInput,
} from "@campaignpulse/shared";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "../../components/ui/Button";
import { CheckboxGroup, TextField } from "../../components/ui/Field";
import { ErrorState } from "../../components/ui/States";

const CHANNEL_DESCRIPTIONS: Record<Channel, string> = {
  WEB: "Placements on the retailer website",
  MOBILE_APP: "Placements in the shopping app",
  IN_STORE_DISPLAY: "Connected digital screens in store",
  SMARTSHOP: "Self-scan device screens",
};

type FieldErrors = Partial<Record<"name" | "advertiserName" | "channels", string>>;

export interface CreateCampaignFormProps {
  onSubmit: (input: CreateCampaignInput) => Promise<void>;
  submitting: boolean;
  /** Error from the last submission attempt, if any. */
  submitError?: string | null;
  /** Field-level problems reported by the API. */
  serverIssues?: { path: string; message: string }[];
}

export function CreateCampaignForm({
  onSubmit,
  submitting,
  submitError,
  serverIssues = [],
}: CreateCampaignFormProps) {
  const [name, setName] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const combinedErrors: FieldErrors = { ...errors };
  for (const issue of serverIssues) {
    const key = issue.path.split(".")[0] as keyof FieldErrors;
    if (key === "name" || key === "advertiserName" || key === "channels") {
      combinedErrors[key] ??= issue.message;
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = createCampaignSchema.safeParse({ name, advertiserName, channels });
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "advertiserName" || key === "channels") {
          next[key] ??= issue.message;
        }
      }
      setErrors(next);
      const firstInvalid = Object.keys(next)[0];
      if (firstInvalid) {
        document
          .getElementById(firstInvalid === "channels" ? `channels-${CHANNELS[0]}` : firstInvalid)
          ?.focus();
      }
      return;
    }
    setErrors({});
    await onSubmit(result.data);
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex flex-col gap-5 rounded-lg border border-line-subtle bg-surface-raised p-5 shadow-sm"
      aria-describedby={submitError ? "create-campaign-error" : undefined}
    >
      {submitError ? (
        <div id="create-campaign-error">
          <ErrorState title="The campaign could not be created" message={submitError} />
        </div>
      ) : null}

      <TextField
        id="name"
        name="name"
        label="Campaign name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={combinedErrors.name}
        hint={`Up to ${CAMPAIGN_NAME_MAX_LENGTH} characters.`}
        maxLength={CAMPAIGN_NAME_MAX_LENGTH}
        autoComplete="off"
        required
      />

      <TextField
        id="advertiserName"
        name="advertiserName"
        label="Advertiser"
        value={advertiserName}
        onChange={(event) => setAdvertiserName(event.target.value)}
        error={combinedErrors.advertiserName}
        maxLength={ADVERTISER_NAME_MAX_LENGTH}
        autoComplete="organization"
        required
      />

      <CheckboxGroup
        legend="Channels"
        name="channels"
        options={CHANNELS.map((channel) => ({
          value: channel,
          label: CHANNEL_LABELS[channel],
          description: CHANNEL_DESCRIPTIONS[channel],
        }))}
        value={channels}
        onChange={(next) => setChannels(next)}
        hint="Select every channel this campaign will be delivered to."
        error={combinedErrors.channels}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create campaign"}
        </Button>
        <ButtonLink to="/campaigns" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
