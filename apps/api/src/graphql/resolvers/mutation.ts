import type { MutationResolvers } from "../generated/types";

export const mutationResolvers: MutationResolvers = {
  createCampaign: (_parent, { input }, ctx) => ctx.services.campaigns.create(input),
};
