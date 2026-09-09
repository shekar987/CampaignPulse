import { requireUuid } from "../args";
import type { MutationResolvers } from "../generated/types";

export const mutationResolvers: MutationResolvers = {
  createCampaign: (_parent, { input }, ctx) => ctx.services.campaigns.create(input),

  simulateDelivery: (_parent, { input }, ctx) => ctx.services.simulation.run(input),

  retryFailedDeliveries: (_parent, { campaignId, channel }, ctx) =>
    ctx.services.deadLetters.replay(requireUuid(campaignId, "campaignId"), channel ?? undefined),

  acknowledgeIncident: (_parent, { id }, ctx) =>
    ctx.services.incidents.acknowledge(requireUuid(id, "id")),

  resolveIncident: (_parent, { id, note }, ctx) =>
    ctx.services.incidents.resolve(requireUuid(id, "id"), note),
};
