CREATE TYPE "public"."channel" AS ENUM('airbnb', 'booking', 'vrbo', 'mmt', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."stay_status" AS ENUM('confirmed', 'cancelled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'doing', 'waiting', 'done');--> statement-breakpoint
CREATE TYPE "public"."turnover_status" AS ENUM('todo', 'doing', 'done', 'issue');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"area" text,
	"bedrooms" integer DEFAULT 1 NOT NULL,
	"max_guests" integer DEFAULT 2 NOT NULL,
	"checkin_time" text DEFAULT '14:00' NOT NULL,
	"checkout_time" text DEFAULT '11:00' NOT NULL,
	"lock_code" text,
	"wifi_name" text,
	"wifi_pass" text,
	"notes" text,
	"ical_token" text NOT NULL,
	"housekeeper_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_code_unique" UNIQUE("code"),
	CONSTRAINT "properties_ical_token_unique" UNIQUE("ical_token")
);
--> statement-breakpoint
CREATE TABLE "property_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"channel" "channel" NOT NULL,
	"url" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"last_count" integer
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"channel" "channel" NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_uid" text,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guest_name" text,
	"guests" integer,
	"phone" text,
	"amount" integer,
	"status" "stay_status" DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"business" "business" NOT NULL,
	"property_id" integer,
	"title" text NOT NULL,
	"detail" text,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assignee_id" integer,
	"vendor_id" integer,
	"cost" integer,
	"created_by" integer,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"reservation_id" integer,
	"date" date NOT NULL,
	"next_check_in" date,
	"assignee_id" integer,
	"status" "turnover_status" DEFAULT 'todo' NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_housekeeper_id_ops_users_id_fk" FOREIGN KEY ("housekeeper_id") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_feeds" ADD CONSTRAINT "property_feeds_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_ops_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_ops_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_ops_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnovers" ADD CONSTRAINT "turnovers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnovers" ADD CONSTRAINT "turnovers_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnovers" ADD CONSTRAINT "turnovers_assignee_id_ops_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ops_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_feed_uid_idx" ON "reservations" USING btree ("property_id","channel","external_uid");--> statement-breakpoint
CREATE INDEX "reservations_property_dates_idx" ON "reservations" USING btree ("property_id","check_in");--> statement-breakpoint
CREATE INDEX "tickets_business_status_idx" ON "tickets" USING btree ("business","status");--> statement-breakpoint
CREATE UNIQUE INDEX "turnovers_reservation_idx" ON "turnovers" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "turnovers_date_idx" ON "turnovers" USING btree ("date");