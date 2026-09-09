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

export const CreateCampaignDocument = graphql(`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      id
      name
      healthStatus
    }
  }
`);
