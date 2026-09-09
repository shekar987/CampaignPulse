import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CampaignFilter,
  CampaignQuery,
  CampaignSort,
  CampaignsQuery,
  Channel,
  CreateCampaignInput,
  DeadLetterEntriesQuery,
  DeadLetterStatus,
  DeliveryEventsQuery,
  IncidentFieldsFragment,
  IncidentSeverity,
  IncidentStatus,
  SimulateDeliveryInput,
  SystemHealthQuery,
} from "../gql/graphql";
import { execute } from "./client";
import {
  AcknowledgeIncidentDocument,
  CampaignDocument,
  CampaignsDocument,
  CreateCampaignDocument,
  DeadLetterEntriesDocument,
  DeliveryEventsDocument,
  IncidentDocument,
  IncidentsDocument,
  ResolveIncidentDocument,
  RetryFailedDeliveriesDocument,
  SimulateDeliveryDocument,
  SystemHealthDocument,
} from "./queries";

export type SystemHealth = SystemHealthQuery["systemHealth"];
export type CampaignListItem = CampaignsQuery["campaigns"]["items"][number];
export type CampaignDetail = NonNullable<CampaignQuery["campaign"]>;
export type DeliveryEventItem = DeliveryEventsQuery["deliveryEvents"]["items"][number];
export type Incident = IncidentFieldsFragment;
export type DeadLetterEntry = DeadLetterEntriesQuery["deadLetterEntries"]["items"][number];

/** How often live views poll while workers process deliveries in the background. */
export const LIVE_REFRESH_MS = 5_000;

export const queryKeys = {
  systemHealth: ["system-health"] as const,
  campaigns: (params: CampaignListParams) => ["campaigns", "list", params] as const,
  campaign: (id: string) => ["campaigns", "detail", id] as const,
  deliveryEvents: (params: DeliveryEventListParams) => ["delivery-events", params] as const,
  incidents: (params: IncidentListParams) => ["incidents", "list", params] as const,
  incident: (id: string) => ["incidents", "detail", id] as const,
  deadLetters: (params: DeadLetterListParams) => ["dead-letters", params] as const,
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
    refetchInterval: LIVE_REFRESH_MS,
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
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export interface IncidentListParams {
  status: IncidentStatus | null;
  severity: IncidentSeverity | null;
  campaignId: string | null;
  page: number;
  pageSize: number;
}

export function useIncidents(params: IncidentListParams) {
  return useQuery({
    queryKey: queryKeys.incidents(params),
    queryFn: async () =>
      (
        await execute(IncidentsDocument, {
          filter: {
            status: params.status,
            severity: params.severity,
            campaignId: params.campaignId,
          },
          page: params.page,
          pageSize: params.pageSize,
        })
      ).incidents,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS * 2,
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: queryKeys.incident(id),
    queryFn: async () => (await execute(IncidentDocument, { id })).incident,
    refetchInterval: LIVE_REFRESH_MS * 2,
  });
}

export interface DeadLetterListParams {
  campaignId: string | null;
  status: DeadLetterStatus | null;
  page: number;
  pageSize: number;
}

export function useDeadLetterEntries(params: DeadLetterListParams) {
  return useQuery({
    queryKey: queryKeys.deadLetters(params),
    queryFn: async () => (await execute(DeadLetterEntriesDocument, params)).deadLetterEntries,
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS * 2,
  });
}

/** Everything a processed delivery can change: campaign health, events, incidents, DLQ. */
function useInvalidateDeliveryData() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-events"] }),
      queryClient.invalidateQueries({ queryKey: ["incidents"] }),
      queryClient.invalidateQueries({ queryKey: ["dead-letters"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.systemHealth }),
    ]);
  };
}

export function useCreateCampaign() {
  const invalidate = useInvalidateDeliveryData();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) =>
      (await execute(CreateCampaignDocument, { input })).createCampaign,
    onSuccess: invalidate,
  });
}

export function useSimulateDelivery() {
  const invalidate = useInvalidateDeliveryData();
  return useMutation({
    mutationFn: async (input: SimulateDeliveryInput) =>
      (await execute(SimulateDeliveryDocument, { input })).simulateDelivery,
    onSuccess: invalidate,
  });
}

export function useRetryFailedDeliveries() {
  const invalidate = useInvalidateDeliveryData();
  return useMutation({
    mutationFn: async (variables: { campaignId: string; channel?: Channel | null }) =>
      (await execute(RetryFailedDeliveriesDocument, variables)).retryFailedDeliveries,
    onSuccess: invalidate,
  });
}

export function useAcknowledgeIncident() {
  const invalidate = useInvalidateDeliveryData();
  return useMutation({
    mutationFn: async (id: string) =>
      (await execute(AcknowledgeIncidentDocument, { id })).acknowledgeIncident,
    onSuccess: invalidate,
  });
}

export function useResolveIncident() {
  const invalidate = useInvalidateDeliveryData();
  return useMutation({
    mutationFn: async (variables: { id: string; note?: string | null }) =>
      (await execute(ResolveIncidentDocument, variables)).resolveIncident,
    onSuccess: invalidate,
  });
}
