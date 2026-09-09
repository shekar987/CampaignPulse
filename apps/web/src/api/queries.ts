import { graphql } from "../gql";

/**
 * Every GraphQL operation the web app issues, in one place. GraphQL Code Generator turns these
 * into typed documents (`src/gql`), so result shapes are checked against the API schema.
 */

export const SystemHealthDocument = graphql(`
  query SystemHealth {
    systemHealth {
      windowHours
      generatedAt
      openIncidents
      deadLetterCount
      channels {
        channel
        healthStatus
        metrics {
          totalEvents
          successfulEvents
          failedEvents
          successRate
          errorRate
          avgLatencyMs
        }
      }
      campaigns {
        healthy
        degraded
        critical
        unknown
      }
      delivery {
        totalEvents
        successfulEvents
        failedEvents
        successRate
        errorRate
        avgLatencyMs
      }
      attention {
        id
        name
        advertiserName
        status
        healthStatus
        openIncidentCount
        metrics {
          totalEvents
          errorRate
        }
        channels {
          id
          channel
          healthStatus
          metrics {
            totalEvents
            errorRate
          }
        }
      }
    }
  }
`);

export const CampaignsDocument = graphql(`
  query Campaigns($filter: CampaignFilter, $sort: CampaignSort, $page: Int, $pageSize: Int) {
    campaigns(filter: $filter, sort: $sort, page: $page, pageSize: $pageSize) {
      items {
        id
        name
        advertiserName
        status
        healthStatus
        openIncidentCount
        deadLetterCount
        createdAt
        metrics {
          totalEvents
          successfulEvents
          failedEvents
          successRate
          errorRate
          avgLatencyMs
        }
        channels {
          id
          channel
          healthStatus
          metrics {
            totalEvents
            successRate
            errorRate
          }
        }
      }
      totalCount
      page
      pageSize
      totalPages
    }
  }
`);

export const CampaignDocument = graphql(`
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      name
      advertiserName
      status
      healthStatus
      openIncidentCount
      deadLetterCount
      createdAt
      updatedAt
      metrics {
        totalEvents
        successfulEvents
        failedEvents
        successRate
        errorRate
        avgLatencyMs
      }
      channels {
        id
        channel
        healthStatus
        metrics {
          totalEvents
          successfulEvents
          failedEvents
          successRate
          errorRate
          avgLatencyMs
        }
      }
    }
  }
`);

export const DeliveryEventsDocument = graphql(`
  query DeliveryEvents(
    $campaignId: ID!
    $channel: Channel
    $correlationId: String
    $page: Int
    $pageSize: Int
  ) {
    deliveryEvents(
      campaignId: $campaignId
      channel: $channel
      correlationId: $correlationId
      page: $page
      pageSize: $pageSize
    ) {
      items {
        id
        correlationId
        eventType
        channel
        status
        attempt
        occurredAt
        latencyMs
        error {
          code
          message
        }
      }
      totalCount
      page
      pageSize
      totalPages
    }
  }
`);

export const IncidentFields = graphql(`
  fragment IncidentFields on Incident {
    id
    campaignId
    campaignName
    advertiserName
    channel
    status
    severity
    title
    description
    errorRateAtDetection
    failedEventsAtDetection
    totalEventsAtDetection
    resolutionNote
    startedAt
    acknowledgedAt
    resolvedAt
    updatedAt
    currentChannelHealth
    currentMetrics {
      totalEvents
      successfulEvents
      failedEvents
      successRate
      errorRate
      avgLatencyMs
    }
  }
`);

export const IncidentsDocument = graphql(`
  query Incidents($filter: IncidentFilter, $page: Int, $pageSize: Int) {
    incidents(filter: $filter, page: $page, pageSize: $pageSize) {
      items {
        ...IncidentFields
      }
      totalCount
      page
      pageSize
      totalPages
    }
  }
`);

export const IncidentDocument = graphql(`
  query Incident($id: ID!) {
    incident(id: $id) {
      ...IncidentFields
    }
  }
`);

export const DeadLetterEntriesDocument = graphql(`
  query DeadLetterEntries($campaignId: ID, $status: DeadLetterStatus, $page: Int, $pageSize: Int) {
    deadLetterEntries(campaignId: $campaignId, status: $status, page: $page, pageSize: $pageSize) {
      items {
        id
        campaignId
        campaignName
        correlationId
        channel
        attempts
        lastError {
          code
          message
        }
        reason
        status
        enqueuedAt
        replayedAt
        replayCorrelationId
      }
      totalCount
      page
      pageSize
      totalPages
    }
  }
`);

export const CreateCampaignDocument = graphql(`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      id
      name
      healthStatus
    }
  }
`);

export const SimulateDeliveryDocument = graphql(`
  mutation SimulateDelivery($input: SimulateDeliveryInput!) {
    simulateDelivery(input: $input) {
      id
      campaignId
      channels
      scenario
      deliveries
      seed
      startedAt
    }
  }
`);

export const RetryFailedDeliveriesDocument = graphql(`
  mutation RetryFailedDeliveries($campaignId: ID!, $channel: Channel) {
    retryFailedDeliveries(campaignId: $campaignId, channel: $channel) {
      replayed
      correlationIds
    }
  }
`);

export const AcknowledgeIncidentDocument = graphql(`
  mutation AcknowledgeIncident($id: ID!) {
    acknowledgeIncident(id: $id) {
      ...IncidentFields
    }
  }
`);

export const ResolveIncidentDocument = graphql(`
  mutation ResolveIncident($id: ID!, $note: String) {
    resolveIncident(id: $id, note: $note) {
      ...IncidentFields
    }
  }
`);
