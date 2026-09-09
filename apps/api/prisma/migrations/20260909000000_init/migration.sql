-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB', 'MOBILE_APP', 'IN_STORE_DISPLAY', 'SMARTSHOP');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CAMPAIGN_DELIVERY_REQUESTED', 'DELIVERY_STARTED', 'DELIVERY_SUCCEEDED', 'DELIVERY_FAILED', 'DELIVERY_RETRY_REQUESTED', 'DELIVERY_RETRY_SUCCEEDED', 'DELIVERY_FINAL_FAILURE', 'INCIDENT_CREATED', 'INCIDENT_ACKNOWLEDGED', 'INCIDENT_RESOLVED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRYING', 'FINAL_FAILURE');

-- CreateEnum
CREATE TYPE "ErrorCode" AS ENUM ('TIMEOUT', 'RATE_LIMITED', 'VALIDATION_ERROR', 'DEPENDENCY_UNAVAILABLE', 'AUTHORIZATION_ERROR', 'NETWORK_ERROR', 'UNKNOWN_ERROR');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "advertiser_name" VARCHAR(255) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "health_status" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_channels" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "health_status" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaign_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "correlation_id" VARCHAR(255) NOT NULL,
    "event_type" "EventType" NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "EventStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "latency_ms" INTEGER,
    "error_code" "ErrorCode",
    "error_message" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "IncidentSeverity" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "campaigns_health_status_idx" ON "campaigns"("health_status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_channels_campaign_id_channel_key" ON "campaign_channels"("campaign_id", "channel");

-- CreateIndex
CREATE INDEX "delivery_events_campaign_id_occurred_at_idx" ON "delivery_events"("campaign_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "delivery_events_correlation_id_idx" ON "delivery_events"("correlation_id");

-- CreateIndex
CREATE INDEX "delivery_events_campaign_id_channel_event_type_idx" ON "delivery_events"("campaign_id", "channel", "event_type");

-- CreateIndex
CREATE INDEX "delivery_events_occurred_at_idx" ON "delivery_events"("occurred_at");

-- CreateIndex
CREATE INDEX "incidents_campaign_id_status_idx" ON "incidents"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "incidents_status_started_at_idx" ON "incidents"("status", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "campaign_channels" ADD CONSTRAINT "campaign_channels_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business-rule constraints. Prisma cannot express CHECK constraints in the schema, so they are
-- declared here; Prisma Migrate leaves them in place on later migrations.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_name_not_blank" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_name_not_blank" CHECK (char_length(btrim("advertiser_name")) > 0);
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_attempt_positive" CHECK ("attempt" >= 1);
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_latency_non_negative" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0);
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_error_code_and_message_together" CHECK (("error_code" IS NULL) = ("error_message" IS NULL));
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_title_not_blank" CHECK (char_length(btrim("title")) > 0);
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_after_started" CHECK ("resolved_at" IS NULL OR "resolved_at" >= "started_at");
