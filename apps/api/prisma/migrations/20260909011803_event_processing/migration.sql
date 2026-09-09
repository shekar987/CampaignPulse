-- CreateEnum
CREATE TYPE "DeadLetterReason" AS ENUM ('RETRIES_EXHAUSTED', 'NON_RETRYABLE_ERROR', 'PROCESSING_FAILURE');

-- CreateEnum
CREATE TYPE "DeadLetterStatus" AS ENUM ('PENDING', 'REPLAYED', 'DISCARDED');

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "error_rate_at_detection" DOUBLE PRECISION,
ADD COLUMN     "failed_events_at_detection" INTEGER,
ADD COLUMN     "resolution_note" TEXT,
ADD COLUMN     "total_events_at_detection" INTEGER;

-- CreateTable
CREATE TABLE "deliveries" (
    "correlation_id" VARCHAR(255) NOT NULL,
    "campaign_id" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" "ErrorCode",
    "last_error_message" TEXT,
    "simulation" JSONB,
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("correlation_id")
);

-- CreateTable
CREATE TABLE "dead_letter_entries" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "correlation_id" VARCHAR(255) NOT NULL,
    "channel" "Channel" NOT NULL,
    "attempts" INTEGER NOT NULL,
    "last_error_code" "ErrorCode" NOT NULL,
    "last_error_message" TEXT NOT NULL,
    "reason" "DeadLetterReason" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeadLetterStatus" NOT NULL DEFAULT 'PENDING',
    "enqueued_at" TIMESTAMPTZ(3) NOT NULL,
    "replayed_at" TIMESTAMPTZ(3),
    "replay_correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dead_letter_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliveries_campaign_id_status_idx" ON "deliveries"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_campaign_id_channel_requested_at_idx" ON "deliveries"("campaign_id", "channel", "requested_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "dead_letter_entries_correlation_id_key" ON "dead_letter_entries"("correlation_id");

-- CreateIndex
CREATE INDEX "dead_letter_entries_campaign_id_status_idx" ON "dead_letter_entries"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "dead_letter_entries_status_enqueued_at_idx" ON "dead_letter_entries"("status", "enqueued_at" DESC);

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_entries" ADD CONSTRAINT "dead_letter_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business-rule constraints not expressible in the Prisma schema.
-- At most one unresolved incident per campaign channel, even under concurrent workers.
CREATE UNIQUE INDEX "incidents_one_active_per_channel" ON "incidents"("campaign_id", "channel") WHERE "status" <> 'RESOLVED';
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_attempts_non_negative" CHECK ("attempts" >= 0);
ALTER TABLE "dead_letter_entries" ADD CONSTRAINT "dead_letter_entries_attempts_positive" CHECK ("attempts" >= 1);
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_error_rate_range" CHECK ("error_rate_at_detection" IS NULL OR ("error_rate_at_detection" >= 0 AND "error_rate_at_detection" <= 1));
