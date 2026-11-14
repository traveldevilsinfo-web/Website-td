ALTER TABLE "expenses" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD COLUMN "property_id" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "payout" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "channel_fee" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cleaning_fee" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "confirmation_code" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "earnings_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_property_idx" ON "expenses" USING btree ("property_id");