ALTER TABLE "leads" ADD COLUMN "kind" text DEFAULT 'enquiry' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "details" jsonb;