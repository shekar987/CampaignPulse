import { buildPage } from "../../services/pagination";
import {
  isUuid,
  parseCampaignListArgs,
  parseDeadLetterListArgs,
  parseDeliveryEventListArgs,
  parseIncidentListArgs,
} from "../args";
import type { QueryResolvers } from "../generated/types";

export const queryResolvers: QueryResolvers = {
  status: (_parent, _args, ctx) => ctx.services.system.status(),

  systemHealth: (_parent, _args, ctx) => ctx.services.systemHealth.getSnapshot(),

  campaigns: (_parent, args, ctx) => ctx.services.campaigns.list(parseCampaignListArgs(args)),

  campaign: (_parent, { id }, ctx) => (isUuid(id) ? ctx.services.campaigns.findById(id) : null),

  campaignHealth: (_parent, { id }, ctx) =>
    isUuid(id) ? ctx.services.campaigns.getHealth(id) : null,

  deliveryEvents: (_parent, args, ctx) => {
    const params = parseDeliveryEventListArgs(args);
    if (!isUuid(params.campaignId)) {
      return buildPage([], 0, params);
    }
    return ctx.services.events.list(params);
  },

  incidents: (_parent, args, ctx) => {
    const params = parseIncidentListArgs(args);
    if (params.campaignId && !isUuid(params.campaignId)) {
      return buildPage([], 0, params);
    }
    return ctx.services.incidents.list(params);
  },

  incident: (_parent, { id }, ctx) => (isUuid(id) ? ctx.services.incidents.findById(id) : null),

  deadLetterEntries: (_parent, args, ctx) => {
    const params = parseDeadLetterListArgs(args);
    if (params.campaignId && !isUuid(params.campaignId)) {
      return buildPage([], 0, params);
    }
    return ctx.services.deadLetters.list(params);
  },
};
