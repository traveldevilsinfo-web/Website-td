CREATE TYPE "public"."message_kind" AS ENUM('confirm', 'checkin', 'checkout', 'review');--> statement-breakpoint
CREATE TABLE "stay_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_id" integer NOT NULL,
	"kind" "message_kind" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" integer
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "house_rules" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "guide" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "guide_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "needs_id" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "guest_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "guest_email" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "agreed_name" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "agreed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "agreed_ip" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "id_path" text;--> statement-breakpoint
ALTER TABLE "stay_messages" ADD CONSTRAINT "stay_messages_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_messages" ADD CONSTRAINT "stay_messages_sent_by_ops_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stay_messages_reservation_kind_idx" ON "stay_messages" USING btree ("reservation_id","kind");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_guide_token_unique" UNIQUE("guide_token");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_token_unique" UNIQUE("guest_token");