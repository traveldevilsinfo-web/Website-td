ALTER TABLE "trips" ADD COLUMN "pickup_points" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "things_to_carry" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "important_notes" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "itinerary_pdf" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "video_url" text;