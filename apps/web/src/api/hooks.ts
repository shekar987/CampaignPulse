import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CampaignFilter,
  CampaignSort,
  CampaignsQuery,
  CampaignQuery,
  Channel,
  CreateCampaignInput,
  DeliveryEventsQuery,
  SystemHealthQuery,
} from "../gql/graphql";
import { execute } from "./client";
import {
  CampaignDocument,
  CampaignsDocument,
  CreateCampaignDocument,
  DeliveryEventsDocument,
  SystemHealthDocument,
} from "./queries";

export type SystemHealth = SystemHealthQuery["systemHealth"];
export type CampaignListItem = CampaignsQuery["campaigns"]["items"][number];
export type CampaignDetail = NonNullable<CampaignQuery["campaign"]>;
export type DeliveryEventItem = DeliveryEventsQuery["deliveryEvents"]["items"][number];

export const queryKeys = {
  systemHealth: ["system-health"] as const,
  campaigns: (params: CampaignListParams) => ["campaigns", "list", params] as const,
  campaign: (id: string) => ["campaigns", "detail", id] as const,
  deliveryEvents: (params: DeliveryEventListParams) => ["delivery-events", params] as const,
};

export function useSystemHealth() {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: async () => (await execute(SystemHealthDocument)).systemHealth,
    refetchInterval: 30_000,
  });
}

export interface CampaignListParams {
  filter: CampaignFilter;
  sort: CampaignSort;
  page: number;
  pageSize: number;
}

export function useCampaigns(params: CampaignListParams) {
  return useQuery({
    queryKey: queryKeys.campaigns(params),
    queryFn: async () => (await execute(CampaignsDocument, params)).campaigns,
    placeholderData: keepPreviousData,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: async () => (await execute(CampaignDocument, { id })).campaign,
  });
}

export interface DeliveryEventListParams {
  campaignId: string;
  channel: Channel | null;
  correlationId: string | null;
  page: number;
  pageSize: number;
}

export function useDeliveryEvents(params: DeliveryEventListParams) {
  return useQuery({
    queryKey: queryKeys.deliveryEvents(params),
    queryFn: async () => (await execute(DeliveryEventsDocument, params)).deliveryEvents,
    placeholderData: keepPreviousData,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) =>
      (await execute(CreateCampaignDocument, { input })).createCampaign,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
      ]);
    },
  });
}
