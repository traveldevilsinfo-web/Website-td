ALTER TABLE "categories" ADD COLUMN "age_limit" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "things_to_pack" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_batches" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "routes" jsonb DEFAULT '[]'::jsonb NOT NULL;