ALTER TABLE "trip_batches" ADD COLUMN "tier_prices" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_batches" ADD COLUMN "label" text;