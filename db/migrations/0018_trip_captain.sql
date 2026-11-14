ALTER TABLE "trip_batches" ADD COLUMN "captain_id" integer;--> statement-breakpoint
ALTER TABLE "trip_batches" ADD COLUMN "costs_closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_batches" ADD CONSTRAINT "trip_batches_captain_id_employees_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;