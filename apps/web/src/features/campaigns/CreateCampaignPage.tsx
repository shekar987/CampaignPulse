import type { CreateCampaignInput } from "@campaignpulse/shared";
import { Link, useNavigate } from "react-router";

import { ApiError, describeError } from "../../api/client";
import { useCreateCampaign } from "../../api/hooks";
import { Icon } from "../../components/ui/Icon";
import { PageHeader } from "../../components/ui/PageHeader";
import { CreateCampaignForm } from "./CreateCampaignForm";

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const mutation = useCreateCampaign();

  const handleSubmit = async (input: CreateCampaignInput) => {
    try {
      const created = await mutation.mutateAsync(input);
      await navigate(`/campaigns/${created.id}`);
    } catch {
      // The mutation state carries the error; the form renders it.
    }
  };

  const serverIssues =
    mutation.error instanceof ApiError && mutation.error.code === "BAD_USER_INPUT"
      ? mutation.error.issues
      : [];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-medium text-fg-secondary hover:text-fg-primary"
          >
            <Icon name="arrow-left" size={16} />
            All campaigns
          </Link>
        }
        title="New campaign"
        description="Create a demo campaign and choose the channels it is delivered to. Delivery events can be simulated once it exists."
      />
      <div className="max-w-(--container-2xl)">
        <CreateCampaignForm
          onSubmit={handleSubmit}
          submitting={mutation.isPending}
          submitError={
            mutation.error && serverIssues.length === 0 ? describeError(mutation.error) : null
          }
          serverIssues={serverIssues}
        />
      </div>
    </>
  );
}
